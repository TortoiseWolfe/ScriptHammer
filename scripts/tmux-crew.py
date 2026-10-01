#!/usr/bin/env python3
"""
Morning crew manager for ScriptHammer's tmux assembly line.

Looks at the queue, the open tmux windows and each window's context left, then prints a
plan: which roles to OPEN, REFRESH or CLOSE, and which to leave alone and only REPORT.
Nothing is touched unless you pass --apply.

Usage:
  python3 scripts/tmux-crew.py                  # print the plan (read-only)
  python3 scripts/tmux-crew.py --apply          # carry the plan out
  python3 scripts/tmux-crew.py --max-open 3     # open at most 3 windows this run
  python3 scripts/tmux-crew.py --json           # machine-readable plan

Rules (see plan()):
  OPEN     a role with >=1 pending item and no window, capped by --max-open, in ALL order
  REFRESH  a window at <=10% free whose role is idle (and still has work to do)
  CLOSE    a window whose role has 0 pending items and is idle
  REPORT   blocked or stale roles, a busy window at <=10% free, unknown context, duplicate
           windows and any window that is not a known role. Never acted on.

The Operator runs outside tmux and is never touched.

tmux-session.sh is only ever READ (its MODELS, PRIMERS and ALL tables are the single source of
truth). It is never run: it has no --help, treats unknown arguments as roles, and starts by
killing the whole session.
"""

import argparse
import importlib.util
import json
import re
import subprocess
import sys
import time
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

SESSION = "scripthammer"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SESSION_SCRIPT = SCRIPT_DIR / "tmux-session.sh"
MONITOR_SCRIPT = SCRIPT_DIR / "tmux-context-monitor.sh"

DEFAULT_MODEL = "opus"
DEFAULT_MAX_OPEN = 6
CRITICAL_FREE = 10  # same threshold as tmux-context-monitor.sh
STAGGER_SECONDS = 3.0  # AUTOMATION.md: stagger windows so /prime reads do not collide
PROMPT_TIMEOUT = 60.0
CLOSE_TIMEOUT = 15.0
REFRESH_TIMEOUT = 240.0  # the monitor sleeps ~35 s per clear

# The only tmux verbs plan mode may issue. Everything else is refused before it reaches the runner.
READ_ONLY_TMUX = frozenset({"list-windows", "capture-pane", "display"})
LIST_FORMAT = "#{window_index} #{window_id} #{window_name}"

PROTECTED_ROLES = frozenset({"Operator"})  # runs outside tmux

# Output of `tmux` when there is simply nothing to list (as opposed to a real failure).
NO_SESSION_MARKERS = ("can't find session", "no server running", "error connecting to")

# Screen text that tells us Claude Code is waiting for input, or showing the consent dialog.
# Kept together so they are easy to adjust when the Claude Code UI changes.
CONSENT_PATTERN = re.compile(r"Bypass Permissions mode|Yes, I accept|No, exit", re.IGNORECASE)
PROMPT_PATTERNS = (
    re.compile(r"\d+% free"),
    re.compile(r"╭─"),
    re.compile(r"\? for shortcuts"),
    re.compile(r"bypass permissions on", re.IGNORECASE),
)
FREE_PATTERN = re.compile(r"(\d+)% free")
SAFE_MODEL = re.compile(r"[A-Za-z0-9._\[\]-]+")  # the model name is typed into a shell
# tmux-context-monitor.sh --update-names renames windows to e.g. "🔴👔 CTO [10%]".
DECORATED_NAME = re.compile(r"^\S+ (?P<role>[A-Za-z0-9]+) \[\d+%\]$")

# Queue and terminal-status files name terminals by slug, tmux windows by role. Explicit
# where the two differ; anything else falls back to kebab-case (BusinessAnalyst -> business-analyst).
ROLE_SLUGS = {
    "CTO": "cto",
    "Architect": "architect",
    "Security": "security-lead",
    "Toolsmith": "toolsmith",
    "DevOps": "devops",
    "ProductOwner": "product-owner",
    "WireframeGenerator1": "generator-1",
    "WireframeGenerator2": "generator-2",
    "WireframeGenerator3": "generator-3",
    "Planner": "planner",
    "PreviewHost": "preview-host",
    "WireframeQA": "wireframe-qa",
    "Validator": "validator",
    "Inspector": "inspector",
    "Developer": "developer",
    "TestEngineer": "test-engineer",
    "Auditor": "auditor",
    "Coordinator": "coordinator",
    "Author": "author",
    "QALead": "qa-lead",
    "TechWriter": "tech-writer",
}


class CrewError(RuntimeError):
    """Something prevented a trustworthy plan; the message is for the user."""


class TmuxError(CrewError):
    pass


class TmuxUnavailable(TmuxError):
    pass


class ReadOnlyViolation(TmuxError):
    """A state-changing command was attempted while in plan (read-only) mode."""


@dataclass(frozen=True)
class Result:
    rc: int
    out: str = ""
    err: str = ""

    @property
    def ok(self) -> bool:
        return self.rc == 0


@dataclass(frozen=True)
class Window:
    index: int
    name: str
    id: str = ""

    @property
    def target(self) -> str:
        # The window id (@N) survives renumbering; fall back to an exact-name match.
        return self.id or f"{SESSION}:={self.name}"


@dataclass
class Action:
    role: str
    kind: str  # OPEN | REFRESH | CLOSE | REPORT | WAIT | KEEP
    reason: str
    model: str = "-"
    pending: int = 0
    context: int | None = None  # None: no window; -1: window, context unknown
    state: str = "-"
    window: Window | None = None

    def as_dict(self) -> dict:
        d = asdict(self)
        d["action"] = d.pop("kind")
        return d


def kebab(role: str) -> str:
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "-", role).lower()


def slug_for(role: str) -> str:
    return ROLE_SLUGS.get(role) or kebab(role)


def subprocess_runner(argv: Sequence[str], timeout: float = 30.0) -> Result:
    """The one place a process is started. Tests inject a fake with the same signature."""
    try:
        p = subprocess.run(list(argv), capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        return Result(127, "", f"{argv[0]}: command not found")
    except subprocess.TimeoutExpired:
        return Result(124, "", f"timed out after {timeout:g}s: {' '.join(argv[:3])}")
    return Result(p.returncode, p.stdout, p.stderr)


# --- tmux-session.sh tables (read, never executed) -------------------------------------------

_ENTRY = re.compile(r"\[\"?(?P<key>\w+)\"?\]=(?:\"(?P<quoted>[^\"]*)\"|(?P<bare>[^\s)]+))")


def _assoc_block(text: str, name: str) -> str:
    m = re.search(rf"^declare -A {name}=\((?P<body>.*?)^\)", text, re.DOTALL | re.MULTILINE)
    if not m:
        raise CrewError(f"could not find `declare -A {name}=(...)` in {SESSION_SCRIPT.name}")
    body = m.group("body")
    return "\n".join(ln for ln in body.splitlines() if not ln.lstrip().startswith("#"))


def parse_session_script(path: Path = SESSION_SCRIPT) -> dict:
    """Return {"models": {role: model}, "primers": {role: text}, "all": [roles in ALL order]}."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        raise CrewError(f"cannot read {path}: {exc}") from exc

    def table(name: str) -> dict[str, str]:
        out = {}
        for m in _ENTRY.finditer(_assoc_block(text, name)):
            value = m.group("quoted") if m.group("quoted") is not None else m.group("bare")
            out[m.group("key")] = value
        return out

    models, primers = table("MODELS"), table("PRIMERS")
    if not primers:
        raise CrewError(f"PRIMERS in {Path(path).name} parsed as empty")
    for role, model in models.items():
        if not SAFE_MODEL.fullmatch(model):
            raise CrewError(f"MODELS[{role}]={model!r} is not a plain model name")
    m = re.search(r"^ALL=\((?P<roles>[^)]*)\)", text, re.MULTILINE)
    order = m.group("roles").split() if m else []
    if not order:
        order = list(primers)  # fall back to PRIMERS order
    return {"models": models, "primers": primers, "all": order}


def known_roles(tables: Mapping) -> list[str]:
    """ALL order first, then any role that only appears in PRIMERS."""
    seen = list(dict.fromkeys(tables["all"]))
    return seen + [r for r in tables["primers"] if r not in seen]


def resolve_role(window_name: str, roles: Sequence[str]) -> str | None:
    """Map a tmux window name to a role, or None. Understands the monitor's decorated names."""
    if window_name in roles:
        return window_name
    m = DECORATED_NAME.match(window_name)
    if m and m.group("role") in roles:
        return m.group("role")
    return None


def parse_windows(stdout: str) -> list[Window]:
    windows = []
    for line in stdout.splitlines():
        parts = line.split(" ", 2)  # the name is last because it may contain spaces
        if len(parts) < 2 or not parts[0].isdigit() or not parts[1].startswith("@"):
            continue
        windows.append(Window(int(parts[0]), parts[2] if len(parts) > 2 else "", parts[1]))
    return windows


def parse_free(pane_text: str) -> int:
    """Port of check_context(): the most recent 'N% free' on screen, or -1 if there is none."""
    found = FREE_PATTERN.findall(pane_text or "")
    return int(found[-1]) if found else -1


# --- the one tmux runner ---------------------------------------------------------------------


class Tmux:
    """Every tmux call goes through call(). In read-only mode only READ_ONLY_TMUX verbs pass."""

    def __init__(self, runner: Callable[..., Result] = subprocess_runner, read_only: bool = True):
        self.runner = runner
        self.read_only = read_only

    def call(self, *args: str, timeout: float = 30.0) -> Result:
        if not args:
            raise TmuxError("empty tmux command")
        if self.read_only and args[0] not in READ_ONLY_TMUX:
            raise ReadOnlyViolation(f"plan mode refused state-changing tmux command: {args[0]}")
        return self.runner(["tmux", *args], timeout=timeout)

    def script(self, argv: Sequence[str], timeout: float) -> Result:
        """Run a helper script (tmux-context-monitor.sh). Never in plan mode."""
        if self.read_only:
            raise ReadOnlyViolation(f"plan mode refused to run {argv[0]}")
        return self.runner(list(argv), timeout=timeout)

    # reads
    def list_windows(self) -> list[Window]:
        """Windows of the crew session. A missing session or server means no windows."""
        r = self.call("list-windows", "-t", SESSION, "-F", LIST_FORMAT)
        if r.ok:
            return parse_windows(r.out)
        err = r.err.lower()
        if r.rc == 127:
            raise TmuxUnavailable(r.err.strip() or "tmux not found")
        if any(marker in err for marker in NO_SESSION_MARKERS):
            return []
        raise TmuxError(f"tmux list-windows failed (rc={r.rc}): {r.err.strip()}")

    def session_exists(self) -> bool:
        r = self.call("list-windows", "-t", SESSION, "-F", "#{window_id}")
        return r.ok

    def capture(self, window: Window) -> str:
        r = self.call("capture-pane", "-t", window.target, "-p", "-S", "-100")
        return r.out if r.ok else ""

    # writes (apply mode only)
    def send_text(self, target: str, text: str) -> Result:
        return self.call("send-keys", "-t", target, "-l", text)

    def send_keys(self, target: str, *keys: str) -> Result:
        return self.call("send-keys", "-t", target, *keys)


# --- queue and health: reuse queue-status.py and terminal-health.py, do not copy them ----------


def _load_sibling(filename: str, modname: str):
    """Import scripts/<filename>. The names have dashes, so a plain import cannot reach them."""
    spec = importlib.util.spec_from_file_location(modname, SCRIPT_DIR / filename)
    if spec is None or spec.loader is None:
        raise CrewError(f"cannot import {filename}")
    module = importlib.util.module_from_spec(spec)
    # Do not leave scripts/__pycache__ behind: it is untracked, and this runs every morning.
    keep, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = keep
    return module


@dataclass
class QueueInfo:
    pending: dict[str, int]  # role -> pending items
    health: dict[str, str]  # role -> idle | active | blocked | stale
    details: dict[str, str]  # role -> why (blocked reason, stale age)
    known: bool  # False when the status file is missing: every role then looks idle
    notes: list[str]


def load_queue_health(roles: Sequence[str], status_file: Path | None = None) -> QueueInfo:
    """Pending counts and idle/blocked/stale per role, from the same file and logic as the CLIs."""
    qs = _load_sibling("queue-status.py", "queue_status")
    th = _load_sibling("terminal-health.py", "terminal_health")
    if status_file is not None:
        qs.STATUS_FILE = th.STATUS_FILE = Path(status_file)
    path = Path(qs.STATUS_FILE)
    try:
        data = qs.load_status()
    except (OSError, ValueError) as exc:  # unreadable is not "empty": refuse rather than guess
        raise CrewError(f"cannot read {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise CrewError(f"{path} does not hold a JSON object")

    known = path.exists()
    notes = []
    if not known:
        notes.append(
            f"no status file at {path}: every role looks idle with 0 pending, "
            "so REFRESH and CLOSE are held back"
        )

    slugs = {role: slug_for(role) for role in roles}
    pending = {role: len(qs.get_queue_by_terminal(data, slugs[role])) for role in roles}

    by_slug = {slug: role for role, slug in slugs.items()}
    stray: dict[str, int] = defaultdict(int)
    unassigned = 0
    for item in data.get("queue", []):
        who = item.get("assignedTo")
        if not who:
            unassigned += 1
        elif who not in by_slug:
            stray[who] += 1
    for who, n in sorted(stray.items()):
        notes.append(f"{n} queue item(s) assigned to '{who}', which maps to no role")
    if unassigned:
        notes.append(f"{unassigned} queue item(s) have no assignee")

    # terminal-health only walks its own ALL_TERMINALS; widen it for roles it never listed
    # (BusinessAnalyst, UXDesigner, ...) for the duration of the calls, then put it back.
    extra = [slug for slug in slugs.values() if slug not in th.ALL_TERMINALS]
    th.ALL_TERMINALS.extend(extra)
    try:
        blocked = {i["terminal"]: i for i in th.get_blocked_terminals(data)}
        stale = {i["terminal"]: i for i in th.get_stale_terminals(data)}
        warnings = th.check_health(data)["warnings"]
        infos = {slug: th.get_terminal_info(data, slug) for slug in slugs.values()}
    finally:
        if extra:
            del th.ALL_TERMINALS[-len(extra) :]
    notes.extend(w for w in warnings if " is blocked:" not in w)  # blocked ones get their own row

    health: dict[str, str] = {}
    details: dict[str, str] = {}
    for role, slug in slugs.items():
        if slug in blocked:
            health[role] = "blocked"
            details[role] = str(blocked[slug].get("blockedReason") or "no reason given")
        elif slug in stale:
            health[role] = "stale"
            details[role] = f"{stale[slug].get('age_hours', 0):.1f}h on one task"
        elif str(infos[slug]["status"]).lower() == "idle":
            health[role] = "idle"
        else:
            health[role] = "active"
    return QueueInfo(pending, health, details, known, notes)


# --- the plan ----------------------------------------------------------------------------------


def plan(
    queue: Mapping[str, int],
    health: Mapping[str, str],
    windows: Sequence[Window],
    context: Mapping[str, int],
    models: Mapping[str, str],
    max_open: int,
    *,
    roles: Sequence[str] | None = None,
    queue_known: bool = True,
    details: Mapping[str, str] | None = None,
) -> list[Action]:
    """Decide what to do. Pure: no tmux, no files (unless `roles` is omitted).

    queue    role -> pending item count
    health   role -> "idle" | "active" | "blocked" | "stale" (absent means idle)
    windows  the windows of the session
    context  window name -> percent free, -1 when unknown (absent means unknown)
    models   role -> model; a role not listed runs DEFAULT_MODEL
    roles    known roles in ALL order; defaults to the ALL line of tmux-session.sh
    queue_known  False when there is no status file: nothing can be called idle, so no
                 REFRESH or CLOSE is planned

    Precedence for a role that has a window: blocked/stale > unknown context > held-back by a
    missing queue > CLOSE > REFRESH > a low-context window that is busy (report) > keep.
    CLOSE beats REFRESH because refreshing a role with nothing to do is wasted work.
    """
    if roles is None:
        roles = known_roles(parse_session_script())
    roles = [r for r in roles if r not in PROTECTED_ROLES]
    details = details or {}

    by_role: dict[str, list[Window]] = defaultdict(list)
    stranger_windows: list[Window] = []
    for w in windows:
        role = resolve_role(w.name, roles)
        if role is None:
            stranger_windows.append(w)
        else:
            by_role[role].append(w)

    actions: list[Action] = []
    opens: list[Action] = []
    for role in roles:
        wins = by_role.get(role, [])
        pending = int(queue.get(role, 0))
        state = health.get(role, "idle")
        base = {
            "role": role,
            "model": models.get(role, DEFAULT_MODEL),
            "pending": pending,
            "state": state,
        }
        why = details.get(role)
        sick = f"{state}: {why}" if why else state

        if len(wins) > 1:
            ids = ", ".join(w.id or str(w.index) for w in wins)
            for w in wins:
                free = context.get(w.name, -1)
                reason = f"{len(wins)} windows for one role ({ids}); not acted on"
                actions.append(Action(kind="REPORT", reason=reason, context=free, window=w, **base))
        elif wins:
            w = wins[0]
            free = context.get(w.name, -1)
            idle = state == "idle"
            low = 0 <= free <= CRITICAL_FREE
            closable = idle and pending == 0
            if state in ("blocked", "stale"):
                kind, reason = "REPORT", sick
            elif free < 0:
                kind, reason = "REPORT", "context unknown (no 'N% free' on screen); not acted on"
            elif (low or closable) and not queue_known:
                kind, reason = "REPORT", "no status file, so idle vs busy is unknown; not touched"
            elif closable:
                kind = "CLOSE"
                reason = "no pending items and idle" + (f" ({free}% free)" if low else "")
            elif low and idle:
                kind, reason = "REFRESH", f"{free}% free, idle, {pending} pending"
            elif low:
                kind, reason = "REPORT", f"{free}% free but {state}; refresh once it is idle"
            else:
                kind, reason = "KEEP", f"{state}, {pending} pending"
            actions.append(Action(kind=kind, reason=reason, context=free, window=w, **base))
        elif pending >= 1:
            if state in ("blocked", "stale"):
                actions.append(Action(kind="REPORT", reason=f"{sick}; has no window", **base))
            else:
                a = Action(kind="OPEN", reason=f"{pending} pending, no window", **base)
                opens.append(a)
                actions.append(a)

    cap = max(0, int(max_open))
    for a in opens[cap:]:
        a.kind, a.reason = "WAIT", f"waiting: cap ({cap} per run)"

    known = set(roles)
    for w in stranger_windows:
        free = context.get(w.name)
        why = (
            "the Operator runs outside tmux; left alone"
            if w.name in PROTECTED_ROLES
            else "not a known role; left alone"
        )
        actions.append(Action(role=w.name, kind="REPORT", reason=why, context=free, window=w))
    for role, n in queue.items():
        if role not in known and n:
            actions.append(
                Action(
                    role=role, kind="REPORT", reason="pending items for an unknown role", pending=n
                )
            )
    return actions


# --- gathering windows and context ---------------------------------------------------------------


def gather_context(tmux: Tmux, windows: Sequence[Window], roles: Sequence[str]) -> dict[str, int]:
    """Percent free per role window (name -> %), -1 when unknown. Other windows are not read."""
    return {w.name: parse_free(tmux.capture(w)) for w in windows if resolve_role(w.name, roles)}


# --- output ------------------------------------------------------------------------------------

COLUMNS = ("role", "model", "pending", "context", "state", "action", "reason")


def _cell_context(a: Action) -> str:
    if a.context is None:
        return "-"
    return "?" if a.context < 0 else f"{a.context}%"


def _row(a: Action) -> tuple[str, ...]:
    action = "-" if a.kind == "KEEP" else a.kind
    return (a.role, a.model, str(a.pending), _cell_context(a), a.state, action, a.reason)


def counts(actions: Sequence[Action]) -> dict[str, int]:
    c = dict.fromkeys(("open", "refresh", "close", "report", "waiting", "keep"), 0)
    names = {"WAIT": "waiting"}
    for a in actions:
        c[names.get(a.kind, a.kind.lower())] += 1
    return c


def summary_line(c: Mapping[str, int]) -> str:
    line = f"open {c['open']}, refresh {c['refresh']}, close {c['close']}, report {c['report']}"
    if c["waiting"]:
        line += f", waiting {c['waiting']} (cap)"
    return line


def render_table(actions: Sequence[Action]) -> str:
    rows = [COLUMNS, *(_row(a) for a in actions)]
    widths = [max(len(r[i]) for r in rows) for i in range(len(COLUMNS))]
    last = len(COLUMNS) - 1

    def fmt(r: Sequence[str]) -> str:
        cells = [c.ljust(widths[i]) if i < last else c for i, c in enumerate(r)]
        return "  ".join(cells).rstrip()

    lines = [fmt(rows[0]), "  ".join("-" * w for w in widths[:last]) + "  " + "-" * 6]
    lines += [fmt(r) for r in rows[1:]]
    if not actions:
        lines.append("(no windows and no pending work)")
    return "\n".join(lines)


def render_plan(actions: Sequence[Action], notes: Sequence[str], applying: bool) -> str:
    mode = "APPLY" if applying else "PLAN (read-only; pass --apply to carry it out)"
    parts = [f"Morning crew - {mode}", "", render_table(actions), ""]
    if notes:
        parts += ["notes:", *(f"  - {n}" for n in notes), ""]
    parts.append(summary_line(counts(actions)))
    return "\n".join(parts)


def to_json(
    actions: Sequence[Action],
    notes: Sequence[str],
    applying: bool,
    results: Sequence[dict] | None = None,
) -> str:
    doc = {
        "session": SESSION,
        "mode": "apply" if applying else "plan",
        "summary": counts(actions),
        "summary_line": summary_line(counts(actions)),
        "actions": [a.as_dict() for a in actions],
        "notes": list(notes),
    }
    if results is not None:
        doc["results"] = list(results)
        doc["failed"] = sum(1 for r in results if not r["ok"])
    return json.dumps(doc, indent=2, ensure_ascii=False)


# --- applying a plan ---------------------------------------------------------------------------


class Executor:
    """Carries out OPEN, REFRESH and CLOSE. Only ever built around a non-read-only Tmux.

    Timing follows scripts/AUTOMATION.md: text and Enter are separate sends, windows are
    staggered, and nothing is typed until the prompt has actually appeared.
    """

    def __init__(
        self,
        tmux: Tmux,
        primers: Mapping[str, str],
        project_dir: Path = PROJECT_ROOT,
        monitor: Path = MONITOR_SCRIPT,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        stagger: float = STAGGER_SECONDS,
        prompt_timeout: float = PROMPT_TIMEOUT,
        close_timeout: float = CLOSE_TIMEOUT,
        poll: float = 1.0,
        log: Callable[[str], None] = lambda msg: None,
    ):
        self.tmux = tmux
        self.primers = primers
        self.project_dir = Path(project_dir)
        self.monitor = Path(monitor)
        self.sleep = sleep
        self.clock = clock
        self.stagger = stagger
        self.prompt_timeout = prompt_timeout
        self.close_timeout = close_timeout
        self.poll = poll
        self.log = log

    # helpers
    def _type(self, target: str, text: str, second_enter: bool = False) -> None:
        """Text, a pause, then Enter on its own: Enter sent with the text is sometimes dropped."""
        self.tmux.send_text(target, text)
        self.sleep(0.5)
        self.tmux.send_keys(target, "Enter")
        if second_enter:
            self.sleep(1.0)
            self.tmux.send_keys(target, "Enter")

    def _screen(self, target: str) -> str:
        r = self.tmux.call("capture-pane", "-t", target, "-p")  # visible screen, not scrollback
        return r.out if r.ok else ""

    def _await_prompt(self, target: str) -> bool:
        """Accept the one-time consent dialog if it appears, then wait for Claude's prompt."""
        deadline = self.clock() + self.prompt_timeout
        accepted = 0
        last_try = -1e9
        while True:
            screen = self._screen(target)
            if CONSENT_PATTERN.search(screen):
                if accepted < 3 and self.clock() - last_try >= 2.0:
                    # The dialog opens on "No, exit"; Down moves to "Yes, I accept".
                    self.tmux.send_keys(target, "Down")
                    self.sleep(0.2)
                    self.tmux.send_keys(target, "Enter")
                    accepted += 1
                    last_try = self.clock()
            elif any(p.search(screen) for p in PROMPT_PATTERNS):
                return True
            if self.clock() >= deadline:
                return False
            self.sleep(self.poll)

    # actions
    def open_role(self, a: Action) -> dict:
        role, primer = a.role, self.primers.get(a.role)
        if not primer:
            return _result(a, False, "no primer for this role in tmux-session.sh")
        if not SAFE_MODEL.fullmatch(a.model):
            return _result(a, False, f"refusing to type model name {a.model!r} into a shell")
        verb = ["new-window", "-t", f"{SESSION}:"]
        if not self.tmux.session_exists():
            verb = ["new-session", "-d", "-s", SESSION]
        made = self.tmux.call(
            *verb, "-n", role, "-c", str(self.project_dir), "-P", "-F", "#{window_id}"
        )
        if not made.ok:
            return _result(a, False, f"tmux {verb[0]} failed: {made.err.strip()}")
        target = made.out.strip() or f"{SESSION}:={role}"
        self._type(target, f"claude --model {a.model} --dangerously-skip-permissions")
        if not self._await_prompt(target):
            return _result(
                a, False, f"no Claude prompt after {self.prompt_timeout:g}s; primer NOT sent"
            )
        self.sleep(1.0)  # let the prompt settle before the first message
        self._type(target, primer, second_enter=True)
        return _result(a, True, f"opened on {a.model}, sent {primer!r}")

    def refresh_role(self, a: Action) -> dict:
        r = self.tmux.script([str(self.monitor), "--clear", a.role], timeout=REFRESH_TIMEOUT)
        tail = (r.out.strip().splitlines() or [r.err.strip()])[-1]
        return _result(a, r.ok, tail if r.ok else f"monitor exited {r.rc}: {tail}")

    def close_roles(self, closing: Sequence[Action]) -> list[dict]:
        """/exit every window, wait once, then kill whatever is still there."""
        keyed = {}
        for a in closing:
            w = a.window
            self._type(w.target, "/exit")
            keyed[w.id or w.name] = a
        deadline = self.clock() + self.close_timeout
        remaining = set(keyed)
        while remaining:
            live = {w.id or w.name for w in self.tmux.list_windows()}
            remaining &= live
            if not remaining or self.clock() >= deadline:
                break
            self.sleep(self.poll)
        results = []
        for key, a in keyed.items():
            if key not in remaining:
                results.append(_result(a, True, "exited after /exit"))
                continue
            k = self.tmux.call("kill-window", "-t", a.window.target)
            gone = k.ok or a.window.id not in {w.id for w in self.tmux.list_windows()}
            detail = f"still open {self.close_timeout:g}s after /exit; kill-window"
            results.append(
                _result(a, gone, detail if gone else f"{detail} failed: {k.err.strip()}")
            )
        return results

    def apply(self, actions: Sequence[Action]) -> list[dict]:
        """OPEN first (so the session never empties mid-run), then REFRESH, then CLOSE."""
        results = []
        opens = [a for a in actions if a.kind == "OPEN"]
        for i, a in enumerate(opens):
            if i:
                self.sleep(self.stagger)
            self.log(f"OPEN {a.role} ({a.model}) ...")
            results.append(self._logged(self.open_role(a)))
        if opens:
            self.sleep(2.0)  # AUTOMATION.md: a final buffer after the last window
        for a in (a for a in actions if a.kind == "REFRESH"):
            self.log(f"REFRESH {a.role} ... (about 40s)")
            results.append(self._logged(self.refresh_role(a)))
        closing = [a for a in actions if a.kind == "CLOSE"]
        if closing:
            self.log(f"CLOSE {', '.join(a.role for a in closing)} ...")
            results.extend(self._logged(r) for r in self.close_roles(closing))
        return results

    def _logged(self, result: dict) -> dict:
        self.log(f"  {'ok' if result['ok'] else 'FAILED'}: {result['role']}: {result['detail']}")
        return result


def _result(a: Action, ok: bool, detail: str) -> dict:
    return {"role": a.role, "action": a.kind, "ok": ok, "detail": detail}


# --- command line ------------------------------------------------------------------------------


def _non_negative(text: str) -> int:
    n = int(text)
    if n < 0:
        raise argparse.ArgumentTypeError("must be 0 or more")
    return n


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="tmux-crew.py",
        description="Morning crew manager: plan which tmux roles to open, refresh or close.",
        epilog="The default only prints the plan. --apply is the only thing that touches tmux.",
    )
    p.add_argument("--apply", action="store_true", help="carry the plan out (default: print it)")
    p.add_argument(
        "--max-open",
        type=_non_negative,
        default=DEFAULT_MAX_OPEN,
        metavar="N",
        help=f"open at most N windows this run, in assembly-line order (default {DEFAULT_MAX_OPEN})",
    )
    p.add_argument("--json", action="store_true", help="print the plan as JSON")
    p.add_argument(
        "--status-file",
        type=Path,
        metavar="PATH",
        help="read this .terminal-status.json instead of docs/design/wireframes/'s",
    )
    p.add_argument(
        "--stagger",
        type=float,
        default=STAGGER_SECONDS,
        metavar="SECONDS",
        help=f"pause between opening windows (default {STAGGER_SECONDS:g})",
    )
    return p


def main(
    argv: Sequence[str] | None = None,
    runner: Callable[..., Result] = subprocess_runner,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    stdout=None,
    stderr=None,
) -> int:
    args = build_parser().parse_args(argv)
    out = stdout or sys.stdout
    err = stderr or sys.stderr

    def say(text: str = "") -> None:
        print(text, file=out)

    # With --json, stdout is one JSON document; progress goes to stderr.
    def progress(text: str) -> None:
        print(text, file=err if args.json else out, flush=True)

    try:
        tables = parse_session_script()
        roles = [r for r in known_roles(tables) if r not in PROTECTED_ROLES]
        tmux = Tmux(runner, read_only=not args.apply)
        notes: list[str] = []
        try:
            windows = tmux.list_windows()
        except TmuxUnavailable as exc:
            if args.apply:
                raise
            windows = []
            notes.append(f"tmux is not available ({exc}); assuming no windows")
        info = load_queue_health(roles, args.status_file)
        notes.extend(info.notes)
        context = gather_context(tmux, windows, roles)
        actions = plan(
            info.pending,
            info.health,
            windows,
            context,
            tables["models"],
            args.max_open,
            roles=roles,
            queue_known=info.known,
            details=info.details,
        )
    except CrewError as exc:
        print(f"tmux-crew: {exc}", file=err)
        return 1

    results = None
    if args.apply:
        if not args.json:
            say(render_plan(actions, notes, applying=True))
            say()
        todo = [a for a in actions if a.kind in ("OPEN", "REFRESH", "CLOSE")]
        if todo:
            executor = Executor(
                tmux,
                tables["primers"],
                sleep=sleep,
                clock=clock,
                stagger=args.stagger,
                log=progress,
            )
            results = executor.apply(actions)
        else:
            results = []
            progress("nothing to apply")
        failed = [r for r in results if not r["ok"]]
        if not args.json and results:
            say(
                f"applied {len(results) - len(failed)} of {len(results)} action(s); {len(failed)} failed"
            )
    if args.json:
        say(to_json(actions, notes, args.apply, results))
    elif not args.apply:
        say(render_plan(actions, notes, applying=False))
    return 1 if results and any(not r["ok"] for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
