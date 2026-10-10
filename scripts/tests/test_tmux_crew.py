"""
Tests for scripts/tmux-crew.py.

Run from the repo root:  python3 -m unittest discover -s scripts/tests

Nothing here starts tmux. The tmux runner is replaced by FakeTmux, which records every command
it is given, so the tests can also prove what plan mode does NOT do. tmux-session.sh is only
ever read (its tables are parsed); no test, and no code path, may execute it.
"""

import contextlib
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from io import StringIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True  # keep scripts/__pycache__ out of the working tree
_spec = importlib.util.spec_from_file_location("tmux_crew", SCRIPTS / "tmux-crew.py")
crew = importlib.util.module_from_spec(_spec)
sys.modules["tmux_crew"] = crew
_spec.loader.exec_module(crew)

ORDER = ["CTO", "ProductOwner", "Architect", "Developer", "TestEngineer", "Auditor", "Coordinator"]
MODELS = {"CTO": "opus", "Developer": "sonnet", "TestEngineer": "sonnet", "Auditor": "opus"}


def win(name, index=0):
    return crew.Window(index, name, f"@{index}")


def run_plan(queue=None, health=None, windows=(), context=None, max_open=6, **kw):
    kw.setdefault("roles", ORDER)
    return crew.plan(
        queue or {}, health or {}, list(windows), context or {}, MODELS, max_open, **kw
    )


def by_role(actions):
    return {a.role: a for a in actions}


def kinds(actions, kind):
    return [a.role for a in actions if a.kind == kind]


class FakeClock:
    """A clock that only moves when sleep() is called, so timeouts cost nothing."""

    def __init__(self):
        self.now = 1000.0
        self.slept = []

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


class FakeTmux:
    """Stands in for subprocess_runner: a tiny model of tmux that records every argv."""

    def __init__(self, windows=(), panes=None, session=None, exits_on_exit=False, fail=()):
        self.calls = []
        self.windows = [(i, f"@{i}", name) for i, name in enumerate(windows)]
        self.next_id = len(self.windows)
        self.session = bool(self.windows) if session is None else session
        self.panes = dict(panes or {})  # window id -> text, or a list of successive screens
        self.exits_on_exit = exits_on_exit
        self.fail = set(fail)  # tmux verbs that should fail
        self.script_result = crew.Result(0, "Done. cleared and re-primed.\n")
        self.missing = False  # pretend tmux is not installed

    def __call__(self, argv, timeout=30.0):
        self.calls.append(list(argv))
        if argv[0] != "tmux":
            return self.script_result
        if self.missing:
            return crew.Result(127, "", "tmux: command not found")
        verb, rest = argv[1], argv[2:]
        if verb in self.fail:
            return crew.Result(1, "", f"{verb} failed on purpose")
        if verb == "list-windows":
            if not self.session:
                return crew.Result(1, "", "can't find session: scripthammer")
            ids_only = "-F" in rest and rest[rest.index("-F") + 1] == "#{window_id}"
            lines = [wid if ids_only else f"{i} {wid} {name}" for i, wid, name in self.windows]
            return crew.Result(0, "\n".join(lines) + "\n")
        if verb == "capture-pane":
            screen = self.panes.get(rest[rest.index("-t") + 1], "")
            if isinstance(screen, list):
                screen = screen.pop(0) if len(screen) > 1 else screen[0]
            return crew.Result(0, screen)
        if verb in ("new-session", "new-window"):
            wid = f"@{self.next_id}"
            self.windows.append((self.next_id, wid, rest[rest.index("-n") + 1]))
            self.next_id += 1
            self.session = True
            return crew.Result(0, wid + "\n")
        if verb == "kill-window":
            self._drop(rest[rest.index("-t") + 1])
        if verb == "send-keys" and self.exits_on_exit and "/exit" in rest:
            self._drop(rest[rest.index("-t") + 1])
        return crew.Result(0)

    def _drop(self, wid):
        self.windows = [w for w in self.windows if w[1] != wid]

    def verbs(self):
        return [c[1] for c in self.calls if c[0] == "tmux"]

    def sent_text(self):
        """Literal text typed with send-keys -l, in order."""
        return [
            c[c.index("-l") + 1] for c in self.calls if c[:2] == ["tmux", "send-keys"] and "-l" in c
        ]


class ParseSessionScriptTests(unittest.TestCase):
    """The real tmux-session.sh is the single source of truth; parse it, never run it."""

    @classmethod
    def setUpClass(cls):
        cls.tables = crew.parse_session_script(crew.SESSION_SCRIPT)

    def test_models_are_parsed_from_the_real_script(self):
        m = self.tables["models"]
        self.assertEqual(m["CTO"], "opus")
        self.assertEqual(m["Developer"], "sonnet")
        self.assertEqual(m["PreviewHost"], "haiku")

    def test_primers_are_parsed_from_the_real_script(self):
        p = self.tables["primers"]
        self.assertEqual(p["CTO"], "/prime cto")
        self.assertEqual(p["Security"], "/prime security")
        self.assertEqual(p["WireframeGenerator2"], "/prime wireframe-generator")

    def test_all_order_is_the_assembly_line(self):
        order = self.tables["all"]
        self.assertEqual(order[0], "CTO")
        self.assertLess(order.index("ProductOwner"), order.index("Architect"))
        self.assertLess(order.index("Architect"), order.index("Developer"))
        self.assertEqual(order[-1], "Coordinator")

    def test_every_role_in_all_has_a_primer_and_every_model_names_a_role(self):
        primers, models = self.tables["primers"], self.tables["models"]
        self.assertEqual(sorted(self.tables["all"]), sorted(primers))
        self.assertFalse(set(models) - set(primers))

    def test_operator_is_not_a_role(self):
        self.assertNotIn("Operator", crew.known_roles(self.tables))

    def test_comments_and_bare_and_quoted_values(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.sh"
            p.write_text(
                'declare -A PRIMERS=(\n  # a comment\n  ["A"]="/prime a"\n  ["B"]="/prime b"\n)\n'
                "declare -A MODELS=(\n  [A]=sonnet [B]=haiku\n)\nALL=(B A)\n"
            )
            t = crew.parse_session_script(p)
        self.assertEqual(t["primers"], {"A": "/prime a", "B": "/prime b"})
        self.assertEqual(t["models"], {"A": "sonnet", "B": "haiku"})
        self.assertEqual(t["all"], ["B", "A"])

    def test_a_model_that_is_not_a_plain_name_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.sh"
            p.write_text(
                'declare -A PRIMERS=(\n  ["A"]="/prime a"\n)\ndeclare -A MODELS=(\n  [A]=x;rm\n)\n'
            )
            with self.assertRaises(crew.CrewError):
                crew.parse_session_script(p)

    def test_missing_table_is_an_error_not_an_empty_crew(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.sh"
            p.write_text("ALL=(A)\n")
            with self.assertRaises(crew.CrewError):
                crew.parse_session_script(p)


class PlanRuleTests(unittest.TestCase):
    def test_open_a_role_with_pending_work_and_no_window(self):
        a = by_role(run_plan(queue={"Developer": 2}))["Developer"]
        self.assertEqual((a.kind, a.model, a.pending), ("OPEN", "sonnet", 2))

    def test_model_defaults_to_opus_when_the_table_is_silent(self):
        a = by_role(run_plan(queue={"Coordinator": 1}))["Coordinator"]
        self.assertEqual((a.kind, a.model), ("OPEN", "opus"))

    def test_no_pending_and_no_window_is_not_listed(self):
        self.assertEqual(run_plan(queue={"Developer": 0}), [])

    def test_open_follows_assembly_line_order_and_the_cap_waits_the_rest(self):
        queue = {"Auditor": 1, "Developer": 1, "CTO": 1, "Architect": 1}  # not in ALL order
        acts = run_plan(queue=queue, max_open=2)
        self.assertEqual(kinds(acts, "OPEN"), ["CTO", "Architect"])
        self.assertEqual(kinds(acts, "WAIT"), ["Developer", "Auditor"])
        self.assertTrue(all("waiting: cap" in a.reason for a in acts if a.kind == "WAIT"))

    def test_cap_of_zero_opens_nothing(self):
        acts = run_plan(queue={"CTO": 1, "Developer": 1}, max_open=0)
        self.assertEqual(kinds(acts, "OPEN"), [])
        self.assertEqual(kinds(acts, "WAIT"), ["CTO", "Developer"])

    def test_refresh_an_idle_window_at_or_below_ten_percent(self):
        for free in (10, 3, 0):
            a = by_role(run_plan({"Developer": 2}, {}, [win("Developer")], {"Developer": free}))
            self.assertEqual(a["Developer"].kind, "REFRESH", free)

    def test_eleven_percent_is_not_low(self):
        a = by_role(run_plan({"Developer": 2}, {}, [win("Developer")], {"Developer": 11}))
        self.assertEqual(a["Developer"].kind, "KEEP")

    def test_close_an_idle_window_with_nothing_pending(self):
        a = by_role(run_plan({}, {}, [win("Developer")], {"Developer": 60}))
        self.assertEqual(a["Developer"].kind, "CLOSE")

    def test_close_beats_refresh_when_there_is_no_work(self):
        a = by_role(run_plan({}, {}, [win("Developer")], {"Developer": 4}))
        self.assertEqual(a["Developer"].kind, "CLOSE")

    def test_a_busy_role_with_nothing_pending_is_kept_not_closed(self):
        a = by_role(run_plan({}, {"Developer": "active"}, [win("Developer")], {"Developer": 60}))
        self.assertEqual(a["Developer"].kind, "KEEP")

    def test_a_window_with_work_to_do_is_kept(self):
        a = by_role(run_plan({"Developer": 3}, {}, [win("Developer")], {"Developer": 60}))
        self.assertEqual(a["Developer"].kind, "KEEP")

    def test_an_existing_window_means_no_open(self):
        acts = run_plan({"Developer": 3}, {}, [win("Developer")], {"Developer": 60})
        self.assertEqual(kinds(acts, "OPEN"), [])


class ReportOnlyTests(unittest.TestCase):
    def assertReportOnly(self, acts, role):
        a = by_role(acts)[role]
        self.assertEqual(a.kind, "REPORT", a.reason)
        self.assertFalse({"OPEN", "REFRESH", "CLOSE"} & {x.kind for x in acts if x.role == role})

    def test_blocked_role_with_a_window(self):
        # idle-looking otherwise: 0 pending at 5% free would be CLOSE
        acts = run_plan({}, {"Developer": "blocked"}, [win("Developer")], {"Developer": 5})
        self.assertReportOnly(acts, "Developer")

    def test_stale_role_with_a_window(self):
        acts = run_plan(
            {"Developer": 1}, {"Developer": "stale"}, [win("Developer")], {"Developer": 5}
        )
        self.assertReportOnly(acts, "Developer")

    def test_blocked_or_stale_role_is_not_opened(self):
        for state in ("blocked", "stale"):
            acts = run_plan({"Developer": 4}, {"Developer": state})
            self.assertReportOnly(acts, "Developer")

    def test_blocked_reason_is_shown(self):
        acts = run_plan(
            {},
            {"Developer": "blocked"},
            [win("Developer")],
            {"Developer": 50},
            details={"Developer": "waiting on RFC-9"},
        )
        self.assertIn("waiting on RFC-9", by_role(acts)["Developer"].reason)

    def test_low_context_but_busy_is_reported_not_refreshed(self):
        acts = run_plan(
            {"Developer": 1}, {"Developer": "active"}, [win("Developer")], {"Developer": 6}
        )
        self.assertReportOnly(acts, "Developer")

    def test_unknown_context_is_reported_even_when_close_would_apply(self):
        acts = run_plan({}, {}, [win("Developer")], {"Developer": -1})
        self.assertReportOnly(acts, "Developer")
        self.assertEqual(by_role(acts)["Developer"].context, -1)

    def test_context_that_was_never_read_counts_as_unknown(self):
        self.assertReportOnly(run_plan({}, {}, [win("Developer")], {}), "Developer")

    def test_a_window_that_is_not_a_role_is_reported_and_left_alone(self):
        acts = run_plan({}, {}, [win("htop")], {})
        a = by_role(acts)["htop"]
        self.assertEqual(a.kind, "REPORT")
        self.assertIn("not a known role", a.reason)

    def test_the_operator_is_never_touched(self):
        acts = run_plan(
            {"Operator": 5},
            {"Operator": "idle"},
            [win("Operator")],
            {"Operator": 2},
            roles=ORDER + ["Operator"],
        )
        self.assertEqual(kinds(acts, "OPEN") + kinds(acts, "REFRESH") + kinds(acts, "CLOSE"), [])
        self.assertTrue(all(a.kind == "REPORT" for a in acts if a.role == "Operator"))

    def test_duplicate_windows_for_one_role_are_reported(self):
        acts = run_plan({}, {}, [win("Developer", 1), win("Developer", 2)], {"Developer": 3})
        self.assertEqual(kinds(acts, "REPORT"), ["Developer", "Developer"])
        self.assertEqual(kinds(acts, "CLOSE"), [])

    def test_pending_items_for_a_role_that_does_not_exist_are_reported(self):
        a = by_role(run_plan({"Ghost": 2}))["Ghost"]
        self.assertEqual(a.kind, "REPORT")

    def test_a_decorated_window_name_is_still_that_role(self):
        # tmux-context-monitor.sh --update-names renames windows to this shape
        acts = run_plan(
            {"Developer": 3}, {}, [win("🟢💻 Developer [72%]")], {"🟢💻 Developer [72%]": 72}
        )
        self.assertEqual(kinds(acts, "OPEN"), [])
        self.assertEqual(by_role(acts)["Developer"].kind, "KEEP")


class NoSessionAndNoStatusFileTests(unittest.TestCase):
    def test_no_session_means_no_windows_so_only_opens(self):
        acts = run_plan({"CTO": 1, "Developer": 1}, {}, [], {})
        self.assertEqual(kinds(acts, "OPEN"), ["CTO", "Developer"])
        self.assertEqual(kinds(acts, "CLOSE") + kinds(acts, "REFRESH"), [])

    def test_without_a_status_file_nothing_is_closed_or_refreshed(self):
        wins = [win("Developer", 1), win("Auditor", 2)]
        ctx = {"Developer": 60, "Auditor": 4}  # would be CLOSE and CLOSE
        acts = run_plan({}, {}, wins, ctx, queue_known=False)
        self.assertEqual(kinds(acts, "CLOSE") + kinds(acts, "REFRESH"), [])
        self.assertEqual(kinds(acts, "REPORT"), ["Developer", "Auditor"])

    def test_a_healthy_window_is_just_kept_when_the_status_file_is_missing(self):
        acts = run_plan(
            {"Developer": 2}, {}, [win("Developer")], {"Developer": 60}, queue_known=False
        )
        self.assertEqual(by_role(acts)["Developer"].kind, "KEEP")


class SummaryAndTableTests(unittest.TestCase):
    def test_summary_line_matches_the_example_shape(self):
        wins = [win("Developer", 1), win("Auditor", 2), win("Coordinator", 3), win("htop", 4)]
        ctx = {"Developer": 60, "Auditor": 5, "Coordinator": -1}
        acts = run_plan({"CTO": 1, "Architect": 1, "Auditor": 2}, {}, wins, ctx)
        self.assertEqual(
            crew.summary_line(crew.counts(acts)), "open 2, refresh 1, close 1, report 2"
        )

    def test_summary_mentions_the_cap_only_when_it_bit(self):
        acts = run_plan({"CTO": 1, "Architect": 1}, max_open=1)
        self.assertEqual(
            crew.summary_line(crew.counts(acts)),
            "open 1, refresh 0, close 0, report 0, waiting 1 (cap)",
        )

    def test_table_has_every_column_and_row(self):
        acts = run_plan({"Developer": 2}, {}, [], {})
        table = crew.render_table(acts)
        for col in ("role", "model", "pending", "context", "state", "action", "reason"):
            self.assertIn(col, table.splitlines()[0])
        self.assertIn("Developer", table)
        self.assertIn("OPEN", table)

    def test_unknown_context_renders_as_a_question_mark(self):
        acts = run_plan({}, {}, [win("Developer")], {"Developer": -1})
        self.assertIn("?", crew.render_table(acts).splitlines()[2].split())


class TmuxWrapperTests(unittest.TestCase):
    def test_parse_free_takes_the_most_recent_value(self):
        self.assertEqual(crew.parse_free("old 80% free\nnoise\nnew 13% free\n"), 13)

    def test_parse_free_is_minus_one_when_the_screen_says_nothing(self):
        self.assertEqual(crew.parse_free("$ ls\nfile\n"), -1)
        self.assertEqual(crew.parse_free(""), -1)

    def test_a_missing_session_means_no_windows(self):
        for stderr in (
            "can't find session: scripthammer",
            "no server running on /tmp/tmux-1000/default",
            "error connecting to /tmp/tmux-1000/default (No such file or directory)",
        ):
            runner = lambda argv, timeout=30.0, e=stderr: crew.Result(1, "", e)  # noqa: E731
            self.assertEqual(crew.Tmux(runner).list_windows(), [], stderr)

    def test_any_other_list_windows_failure_is_not_mistaken_for_no_windows(self):
        runner = lambda argv, timeout=30.0: crew.Result(1, "", "permission denied")  # noqa: E731
        with self.assertRaises(crew.TmuxError):
            crew.Tmux(runner).list_windows()

    def test_tmux_not_installed_is_its_own_error(self):
        fake = FakeTmux()
        fake.missing = True
        with self.assertRaises(crew.TmuxUnavailable):
            crew.Tmux(fake).list_windows()

    def test_windows_are_parsed_with_spaces_in_the_name(self):
        wins = crew.parse_windows("0 @1 CTO\n2 @7 🔴👔 Architect [10%]\n")
        self.assertEqual(
            [(w.index, w.id, w.name) for w in wins],
            [(0, "@1", "CTO"), (2, "@7", "🔴👔 Architect [10%]")],
        )

    def test_read_only_mode_refuses_state_changing_commands_before_the_runner(self):
        fake = FakeTmux(windows=["CTO"])
        tmux = crew.Tmux(fake, read_only=True)
        for verb in ("kill-window", "send-keys", "new-window", "new-session", "kill-session"):
            with self.assertRaises(crew.ReadOnlyViolation):
                tmux.call(verb, "-t", "x")
        with self.assertRaises(crew.ReadOnlyViolation):
            tmux.script(["scripts/tmux-context-monitor.sh", "--clear", "CTO"], timeout=1)
        self.assertEqual(fake.calls, [])

    def test_read_only_mode_allows_the_three_read_verbs(self):
        fake = FakeTmux(windows=["CTO"])
        tmux = crew.Tmux(fake, read_only=True)
        tmux.call("list-windows", "-t", "scripthammer")
        tmux.call("capture-pane", "-t", "@0", "-p")
        tmux.call("display", "-p", "x")
        self.assertEqual(fake.verbs(), ["list-windows", "capture-pane", "display"])


def write_status(directory, terminals=None, queue=None, last_updated=None):
    path = Path(directory) / ".terminal-status.json"
    path.write_text(
        json.dumps(
            {
                "lastUpdated": last_updated or datetime.now(UTC).isoformat(),
                "terminals": terminals or {},
                "queue": queue or [],
                "completedToday": [],
            }
        )
    )
    return path


def item(who, feature="010-x"):
    return {"feature": feature, "action": "BUILD", "assignedTo": who, "reason": "test"}


class LoaderTests(unittest.TestCase):
    ROLES = ["CTO", "Developer", "BusinessAnalyst", "WireframeGenerator1", "Security", "QALead"]

    def load(self, **kw):
        with tempfile.TemporaryDirectory() as d:
            return crew.load_queue_health(self.ROLES, write_status(d, **kw))

    def test_pending_counts_come_from_queue_status_by_slug(self):
        q = [
            item("developer"),
            item("developer"),
            item("generator-1"),
            item("security-lead"),
            item("qa-lead"),
            item("business-analyst"),
        ]
        info = self.load(queue=q)
        self.assertEqual(info.pending["Developer"], 2)
        self.assertEqual(info.pending["WireframeGenerator1"], 1)
        self.assertEqual(info.pending["Security"], 1)  # the slug is security-lead
        self.assertEqual(info.pending["QALead"], 1)
        self.assertEqual(info.pending["BusinessAnalyst"], 1)  # terminal-health never listed it
        self.assertEqual(info.pending["CTO"], 0)

    def test_idle_blocked_stale_and_active_follow_terminal_health(self):
        old = (datetime.now(UTC) - timedelta(hours=9)).isoformat()
        terminals = {
            "cto": {"status": "idle"},
            "developer": {"status": "blocked", "blockedReason": "waiting on RFC-9"},
            "security-lead": {"status": "active", "startedAt": old, "task": "audit"},
            "qa-lead": {"status": "working", "startedAt": datetime.now(UTC).isoformat()},
            "business-analyst": {"status": "blocked", "blockedReason": "no brief"},
        }
        info = self.load(terminals=terminals)
        self.assertEqual(info.health["CTO"], "idle")
        self.assertEqual(info.health["Developer"], "blocked")
        self.assertEqual(info.details["Developer"], "waiting on RFC-9")
        self.assertEqual(info.health["Security"], "stale")
        self.assertEqual(info.health["QALead"], "active")
        self.assertEqual(info.health["BusinessAnalyst"], "blocked")  # outside th.ALL_TERMINALS
        self.assertEqual(info.health["WireframeGenerator1"], "idle")  # absent means idle
        self.assertTrue(info.known)

    def test_terminal_health_globals_are_restored_after_widening(self):
        th = crew._load_sibling("terminal-health.py", "th_probe")
        before = list(th.ALL_TERMINALS)
        crew.load_queue_health(["BusinessAnalyst"], Path("/nonexistent/x.json"))
        self.assertEqual(before, list(th.ALL_TERMINALS))

    def test_a_missing_status_file_is_flagged_not_trusted(self):
        info = crew.load_queue_health(self.ROLES, Path("/nonexistent/.terminal-status.json"))
        self.assertFalse(info.known)
        self.assertTrue(any("no status file" in n for n in info.notes))

    def test_an_unreadable_status_file_is_an_error_not_an_empty_queue(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / ".terminal-status.json"
            path.write_text("{ not json")
            with self.assertRaises(crew.CrewError):
                crew.load_queue_health(self.ROLES, path)

    def test_items_for_unmapped_or_missing_assignees_become_notes(self):
        info = self.load(queue=[item("reviewer"), {"feature": "x", "action": "A"}])
        text = " ".join(info.notes)
        self.assertIn("'reviewer'", text)
        self.assertIn("no assignee", text)

    def test_every_terminal_health_slug_maps_to_a_role(self):
        th = crew._load_sibling("terminal-health.py", "th_probe2")
        self.assertFalse(set(th.ALL_TERMINALS) - set(crew.ROLE_SLUGS.values()))

    def test_every_role_slug_is_a_real_role(self):
        roles = crew.known_roles(crew.parse_session_script())
        self.assertFalse(set(crew.ROLE_SLUGS) - set(roles))

    def test_idle_with_nothing_pending_agrees_with_terminal_healths_idle_list(self):
        th = crew._load_sibling("terminal-health.py", "th_probe3")
        roles = [r for r, s in crew.ROLE_SLUGS.items() if s in th.ALL_TERMINALS]
        terminals = {"developer": {"status": "active"}, "cto": {"status": "blocked"}}
        q = [item("auditor"), item("developer")]
        with tempfile.TemporaryDirectory() as d:
            path = write_status(d, terminals=terminals, queue=q)
            info = crew.load_queue_health(roles, path)
            th.STATUS_FILE = path
            theirs = {i["terminal"] for i in th.get_idle_terminals(th.load_status())}
        mine = {
            crew.ROLE_SLUGS[r] for r in roles if info.health[r] == "idle" and not info.pending[r]
        }
        self.assertEqual(mine, theirs)

    def test_kebab_fallback_for_roles_terminal_health_does_not_list(self):
        self.assertEqual(crew.slug_for("UXDesigner"), "ux-designer")
        self.assertEqual(crew.slug_for("DockerCaptain"), "docker-captain")
        self.assertEqual(crew.slug_for("ReleaseManager"), "release-manager")


CONSENT = "WARNING: Bypass Permissions mode\n  1. No, exit\n  2. Yes, I accept\n"
PROMPT = "╭──────────╮\n│ >        │\n╰──────────╯\n  ? for shortcuts      80% free\n"


def action(role, kind="OPEN", model="opus", window=None):
    return crew.Action(role=role, kind=kind, reason="test", model=model, window=window)


def make_executor(fake, primers=None, **kw):
    clock = FakeClock()
    ex = crew.Executor(
        crew.Tmux(fake, read_only=False),
        {"Developer": "/prime developer", "CTO": "/prime cto", "Auditor": "/prime auditor"}
        if primers is None
        else primers,
        project_dir=Path("/proj"),
        sleep=clock.sleep,
        clock=clock.time,
        **kw,
    )
    return ex, clock


def key_sequence(fake):
    """Every send-keys in order, as ('text', t) or ('key', k)."""
    seq = []
    for c in fake.calls:
        if c[:2] != ["tmux", "send-keys"]:
            continue
        seq.append(("text", c[c.index("-l") + 1]) if "-l" in c else ("key", c[-1]))
    return seq


class OpenTests(unittest.TestCase):
    def test_open_with_no_session_creates_one_then_launches_claude_and_primes(self):
        fake = FakeTmux(panes={"@0": [CONSENT, PROMPT]})
        ex, _ = make_executor(fake)
        res = ex.open_role(action("Developer", model="sonnet"))
        self.assertTrue(res["ok"], res)
        made = next(c for c in fake.calls if c[1] == "new-session")
        self.assertEqual(
            made[2:10], ["-d", "-s", "scripthammer", "-n", "Developer", "-c", "/proj", "-P"]
        )
        seq = key_sequence(fake)
        self.assertEqual(
            seq,
            [
                ("text", "claude --model sonnet --dangerously-skip-permissions"),
                ("key", "Enter"),
                ("key", "Down"),
                ("key", "Enter"),
                ("text", "/prime developer"),
                ("key", "Enter"),
                ("key", "Enter"),
            ],
        )

    def test_text_and_enter_are_never_sent_together(self):
        fake = FakeTmux(panes={"@0": [PROMPT]})
        ex, _ = make_executor(fake)
        ex.open_role(action("Developer"))
        for kind, value in key_sequence(fake):
            if kind == "text":
                self.assertNotIn("Enter", value)

    def test_open_into_an_existing_session_uses_new_window(self):
        fake = FakeTmux(windows=["CTO"], panes={"@1": [PROMPT]})
        ex, _ = make_executor(fake)
        self.assertTrue(ex.open_role(action("Developer"))["ok"])
        self.assertIn("new-window", fake.verbs())
        self.assertNotIn("new-session", fake.verbs())
        made = next(c for c in fake.calls if c[1] == "new-window")
        self.assertEqual(made[2:4], ["-t", "scripthammer:"])

    def test_the_consent_keys_are_skipped_when_the_prompt_is_already_up(self):
        fake = FakeTmux(panes={"@0": [PROMPT]})
        ex, _ = make_executor(fake)
        ex.open_role(action("Developer"))
        self.assertNotIn(("key", "Down"), key_sequence(fake))

    def test_the_primer_waits_for_the_prompt(self):
        fake = FakeTmux(panes={"@0": ["$ claude ...\n", "starting\n", PROMPT]})
        ex, _ = make_executor(fake)
        ex.open_role(action("Developer"))
        polls_before_primer = 0
        for c in fake.calls:
            if c[1] == "capture-pane":
                polls_before_primer += 1
            if c[1] == "send-keys" and "-l" in c and c[-1] == "/prime developer":
                break
        self.assertGreaterEqual(polls_before_primer, 3)

    def test_no_prompt_means_failure_and_the_primer_is_not_typed_into_a_shell(self):
        fake = FakeTmux(panes={"@0": ["$ claude: command not found\n"]})
        ex, _ = make_executor(fake)
        res = ex.open_role(action("Developer"))
        self.assertFalse(res["ok"])
        self.assertIn("primer NOT sent", res["detail"])
        self.assertNotIn("/prime developer", fake.sent_text())

    def test_a_failed_new_window_is_a_failure_and_types_nothing(self):
        fake = FakeTmux(windows=["CTO"], fail={"new-window"})
        ex, _ = make_executor(fake)
        self.assertFalse(ex.open_role(action("Developer"))["ok"])
        self.assertEqual(fake.sent_text(), [])

    def test_a_role_without_a_primer_is_refused(self):
        fake = FakeTmux()
        ex, _ = make_executor(fake, primers={})
        self.assertFalse(ex.open_role(action("Developer"))["ok"])
        self.assertEqual(fake.calls, [])

    def test_a_model_name_that_could_run_a_command_is_refused(self):
        fake = FakeTmux()
        ex, _ = make_executor(fake)
        self.assertFalse(ex.open_role(action("Developer", model="opus; rm -rf ~"))["ok"])
        self.assertEqual(fake.calls, [])

    def test_windows_are_staggered(self):
        fake = FakeTmux(panes={"@0": [PROMPT], "@1": [PROMPT], "@2": [PROMPT]})
        ex, clock = make_executor(fake)
        ex.apply([action("CTO"), action("Developer"), action("Auditor")])
        self.assertEqual(clock.slept.count(3.0), 2)  # between three windows
        self.assertEqual(fake.verbs().count("new-session") + fake.verbs().count("new-window"), 3)


class RefreshAndCloseTests(unittest.TestCase):
    def test_refresh_runs_the_context_monitor_for_that_role(self):
        fake = FakeTmux(windows=["Developer"])
        ex, _ = make_executor(fake)
        res = ex.apply([action("Developer", "REFRESH", window=win("Developer"))])
        self.assertTrue(res[0]["ok"])
        self.assertIn([str(crew.MONITOR_SCRIPT), "--clear", "Developer"], fake.calls)

    def test_a_failed_refresh_is_reported_as_failed(self):
        fake = FakeTmux(windows=["Developer"])
        fake.script_result = crew.Result(1, "", "Error: no window named 'Developer'")
        ex, _ = make_executor(fake)
        res = ex.apply([action("Developer", "REFRESH", window=win("Developer"))])
        self.assertFalse(res[0]["ok"])
        self.assertIn("no window named", res[0]["detail"])

    def test_close_sends_exit_then_enter_and_does_not_kill_a_window_that_left(self):
        fake = FakeTmux(windows=["Developer"], exits_on_exit=True)
        ex, _ = make_executor(fake)
        res = ex.apply([action("Developer", "CLOSE", window=crew.Window(0, "Developer", "@0"))])
        self.assertTrue(res[0]["ok"])
        self.assertEqual(key_sequence(fake), [("text", "/exit"), ("key", "Enter")])
        self.assertNotIn("kill-window", fake.verbs())

    def test_close_kills_a_window_still_there_after_fifteen_seconds(self):
        fake = FakeTmux(windows=["Developer"], exits_on_exit=False)
        ex, clock = make_executor(fake)
        start = clock.now
        res = ex.apply([action("Developer", "CLOSE", window=crew.Window(0, "Developer", "@0"))])
        self.assertTrue(res[0]["ok"], res)
        self.assertGreaterEqual(clock.now - start, 15.0)
        kill = next(c for c in fake.calls if c[1] == "kill-window")
        self.assertEqual(kill[2:], ["-t", "@0"])
        self.assertEqual(fake.windows, [])

    def test_close_of_several_windows_shares_one_wait(self):
        fake = FakeTmux(windows=["Developer", "Auditor"], exits_on_exit=False)
        ex, clock = make_executor(fake)
        start = clock.now
        ex.apply(
            [
                action("Developer", "CLOSE", window=crew.Window(0, "Developer", "@0")),
                action("Auditor", "CLOSE", window=crew.Window(1, "Auditor", "@1")),
            ]
        )
        self.assertLess(clock.now - start, 25.0)  # not 2 x 15
        self.assertEqual(fake.verbs().count("kill-window"), 2)

    def test_open_runs_before_close_so_the_session_never_empties_mid_run(self):
        fake = FakeTmux(windows=["Developer"], panes={"@1": [PROMPT]}, exits_on_exit=True)
        ex, _ = make_executor(fake)
        res = ex.apply(
            [
                action("Developer", "CLOSE", window=crew.Window(0, "Developer", "@0")),
                action("CTO", "OPEN"),
            ]
        )
        self.assertEqual([r["role"] for r in res], ["CTO", "Developer"])
        self.assertTrue(all(r["ok"] for r in res))
        self.assertEqual([w[2] for w in fake.windows], ["CTO"])
        self.assertNotIn("new-session", fake.verbs())


class MainTests(unittest.TestCase):
    """The whole program with a fake tmux. Every run also proves tmux-session.sh is never executed."""

    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.addCleanup(self._dir.cleanup)
        self.dir = Path(self._dir.name)

    def run_main(self, fake, *argv, terminals=None, queue=None, status=True):
        path = (
            write_status(self.dir, terminals=terminals, queue=queue) if status else self.dir / "x"
        )
        out, err, clock = StringIO(), StringIO(), FakeClock()
        code = crew.main(
            [*argv, "--status-file", str(path)],
            runner=fake,
            sleep=clock.sleep,
            clock=clock.time,
            stdout=out,
            stderr=err,
        )
        for call in fake.calls:
            self.assertFalse(any("tmux-session.sh" in part for part in call), call)
        return code, out.getvalue(), err.getvalue()

    def crew_fixture(self):
        panes = {"@0": "60% free", "@1": "old 80% free\n4% free", "@2": "no number here", "@3": "x"}
        return FakeTmux(windows=["CTO", "Developer", "Auditor", "htop"], panes=panes)

    # plan mode
    def test_plan_mode_only_issues_read_only_tmux_commands(self):
        fake = self.crew_fixture()
        code, out, _ = self.run_main(fake, queue=[item("developer"), item("developer")])
        self.assertEqual(code, 0)
        self.assertTrue(set(fake.verbs()) <= crew.READ_ONLY_TMUX, fake.verbs())
        self.assertEqual([c for c in fake.calls if c[0] != "tmux"], [])  # no monitor script either
        self.assertTrue(fake.calls)

    def test_plan_mode_decides_each_window_and_prints_the_summary(self):
        fake = self.crew_fixture()
        code, out, _ = self.run_main(fake, queue=[item("developer"), item("developer")])
        rows = {line.split()[0]: line for line in out.splitlines() if line.split()[:1]}
        self.assertIn("CLOSE", rows["CTO"])  # 60% free, nothing pending, idle
        self.assertIn("REFRESH", rows["Developer"])  # 4% free, idle, 2 pending
        self.assertIn("REPORT", rows["Auditor"])  # no "N% free" on screen
        self.assertIn("not a known role", rows["htop"])
        self.assertIn("open 0, refresh 1, close 1, report 2", out)

    def test_plan_mode_reads_context_only_for_role_windows(self):
        fake = self.crew_fixture()
        self.run_main(fake)
        captured = {c[c.index("-t") + 1] for c in fake.calls if c[1] == "capture-pane"}
        self.assertEqual(captured, {"@0", "@1", "@2"})  # not @3, the htop window

    def test_plan_mode_with_no_session_lists_the_opens_and_does_not_crash(self):
        fake = FakeTmux(session=False)
        code, out, _ = self.run_main(fake, queue=[item("cto"), item("architect")])
        self.assertEqual(code, 0)
        self.assertEqual(fake.verbs(), ["list-windows"])
        self.assertIn("open 2, refresh 0, close 0, report 0", out)

    def test_max_open_caps_the_plan_and_reports_the_rest(self):
        fake = FakeTmux(session=False)
        q = [item("auditor"), item("developer"), item("cto")]
        _, out, _ = self.run_main(fake, "--max-open", "1", queue=q)
        self.assertIn("open 1, refresh 0, close 0, report 0, waiting 2 (cap)", out)
        self.assertIn("waiting: cap", out)

    def test_json_is_one_parseable_document(self):
        fake = self.crew_fixture()
        code, out, _ = self.run_main(fake, "--json", queue=[item("developer")])
        doc = json.loads(out)
        self.assertEqual(doc["mode"], "plan")
        self.assertEqual(doc["summary"]["refresh"], 1)
        row = next(a for a in doc["actions"] if a["role"] == "Developer")
        self.assertEqual(row["action"], "REFRESH")
        self.assertEqual(row["context"], 4)

    def test_without_tmux_plan_mode_still_prints_with_a_note(self):
        fake = FakeTmux()
        fake.missing = True
        code, out, _ = self.run_main(fake, queue=[item("cto")])
        self.assertEqual(code, 0)
        self.assertIn("tmux is not available", out)
        self.assertIn("open 1,", out)

    def test_an_unreadable_status_file_stops_the_run(self):
        (self.dir / ".terminal-status.json").write_text("{ nope")
        fake = self.crew_fixture()
        out, err = StringIO(), StringIO()
        code = crew.main(
            ["--status-file", str(self.dir / ".terminal-status.json")],
            runner=fake,
            stdout=out,
            stderr=err,
        )
        self.assertEqual(code, 1)
        self.assertIn("cannot read", err.getvalue())

    def test_a_missing_status_file_holds_back_close_and_refresh(self):
        fake = self.crew_fixture()
        code, out, _ = self.run_main(fake, status=False)
        self.assertIn("no status file", out)
        self.assertIn("open 0, refresh 0, close 0, report 4", out)  # CTO, Developer, Auditor, htop

    # apply mode
    def test_apply_opens_the_crew_in_order_and_exits_zero(self):
        fake = FakeTmux(session=False, panes={"@0": [PROMPT], "@1": [PROMPT]})
        code, out, _ = self.run_main(fake, "--apply", queue=[item("architect"), item("cto")])
        self.assertEqual(code, 0, out)
        self.assertEqual([w[2] for w in fake.windows], ["CTO", "Architect"])
        self.assertEqual(fake.verbs().count("new-session"), 1)
        self.assertEqual(fake.verbs().count("new-window"), 1)
        self.assertEqual(fake.sent_text()[0], "claude --model opus --dangerously-skip-permissions")
        self.assertIn("/prime architect", fake.sent_text())

    def test_apply_exits_one_when_anything_fails(self):
        fake = FakeTmux(session=False, fail={"new-session"})
        code, out, _ = self.run_main(fake, "--apply", queue=[item("cto")])
        self.assertEqual(code, 1)
        self.assertIn("1 failed", out)

    def test_apply_exits_one_when_a_refresh_fails_even_if_the_rest_worked(self):
        fake = self.crew_fixture()
        fake.script_result = crew.Result(1, "", "boom")
        fake.exits_on_exit = True
        code, _, _ = self.run_main(fake, "--apply", queue=[item("developer")])
        self.assertEqual(code, 1)
        self.assertIn([str(crew.MONITOR_SCRIPT), "--clear", "Developer"], fake.calls)

    def test_apply_with_nothing_to_do_changes_nothing(self):
        fake = FakeTmux(session=False)
        code, _, _ = self.run_main(fake, "--apply")
        self.assertEqual(code, 0)
        self.assertEqual(fake.verbs(), ["list-windows"])

    def test_apply_leaves_report_only_windows_alone(self):
        fake = self.crew_fixture()
        fake.exits_on_exit = True
        self.run_main(fake, "--apply", queue=[item("developer")])
        sent_to = {c[c.index("-t") + 1] for c in fake.calls if c[1] in ("send-keys", "kill-window")}
        self.assertFalse({"@2", "@3"} & sent_to)  # Auditor (unknown context) and htop

    def test_apply_without_tmux_fails_instead_of_pretending(self):
        fake = FakeTmux()
        fake.missing = True
        code, _, err = self.run_main(fake, "--apply", queue=[item("cto")])
        self.assertEqual(code, 1)
        self.assertIn("command not found", err)

    def test_negative_max_open_is_a_usage_error(self):
        fake = FakeTmux()
        with contextlib.redirect_stderr(StringIO()), self.assertRaises(SystemExit) as caught:
            crew.main(["--max-open", "-1"], runner=fake)
        self.assertEqual(caught.exception.code, 2)
        self.assertEqual(fake.calls, [])


class ContextMonitorScriptTests(unittest.TestCase):
    """tmux-context-monitor.sh is what REFRESH shells out to, so what it targets matters."""

    SCRIPT = SCRIPTS / "tmux-context-monitor.sh"

    def window_for(self, role, listing):
        text = self.SCRIPT.read_text()
        fn = re.search(r"^window_for\(\) \{.*?^\}", text, re.DOTALL | re.MULTILINE).group(0)
        code = f'SESSION=x\ntmux() {{ printf "%s\\n" {listing}; }}\n{fn}\nwindow_for "$1"'
        out = subprocess.run(["bash", "-c", code, "bash", role], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr)
        return out.stdout.strip()

    LISTING = '"0 CTO" "3 Architect" "7 🟢💻 Developer [72%]" "8 Developer2"'

    def test_a_window_is_found_by_name_not_by_a_fixed_index(self):
        self.assertEqual(self.window_for("Architect", self.LISTING), "3")  # the old table said 1

    def test_a_decorated_name_from_update_names_still_matches(self):
        self.assertEqual(self.window_for("Developer", self.LISTING), "7")

    def test_a_role_with_no_window_resolves_to_nothing_not_to_someone_else(self):
        self.assertEqual(self.window_for("Auditor", self.LISTING), "")
        self.assertEqual(self.window_for("Dev", self.LISTING), "")

    def test_the_monitor_can_re_prime_every_role_tmux_session_can_launch(self):
        text = self.SCRIPT.read_text()
        block = re.search(r"^declare -A PRIMERS=\((.*?)^\)", text, re.DOTALL | re.MULTILINE).group(
            1
        )
        have = set(re.findall(r'\["(\w+)"\]="You are', block))
        want = set(crew.parse_session_script()["primers"])
        self.assertFalse(want - have, f"monitor has no primer for {sorted(want - have)}")

    def test_the_script_still_parses(self):
        out = subprocess.run(["bash", "-n", str(self.SCRIPT)], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr)


if __name__ == "__main__":
    unittest.main()
