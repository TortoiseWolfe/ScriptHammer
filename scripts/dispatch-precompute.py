#!/usr/bin/env python3
"""
Dispatch Precompute - Pre-compute task assignments from audit files

Eliminates AI parsing of audit files across 20+ terminals.
Usage: python3 scripts/dispatch-precompute.py [command] [options]

Commands:
  audit <date>             Parse audit for tasks (default: today)
  for <role>               Tasks for specific role
  ready                    Terminals ready for work
  blocked                  Terminals waiting on deps
  assign                   Auto-assign pending tasks

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/dispatch-precompute.py audit 2026-01-15
  python3 scripts/dispatch-precompute.py for toolsmith
  python3 scripts/dispatch-precompute.py ready --json
  python3 scripts/dispatch-precompute.py blocked
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
AUDITS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "audits"
STATUS_FILE = PROJECT_ROOT / "docs" / "design" / "wireframes" / ".terminal-status.json"

# Terminal role mappings
ROLE_KEYWORDS = {
    "cto": ["strategic", "priority", "risk", "cross-cutting", "leadership"],
    "architect": ["architecture", "pattern", "dependency", "design", "system"],
    "security-lead": ["security", "auth", "owasp", "secrets", "compliance", "vulnerability"],
    "toolsmith": ["skill", "script", "command", "automation", "tool", "cli"],
    "devops": ["ci", "cd", "docker", "deployment", "workflow", "github actions"],
    "product-owner": ["user", "requirement", "acceptance", "stakeholder", "ux"],
    "planner": ["plan", "wireframe-plan", "feature planning"],
    "generator-1": ["generate", "svg", "wireframe"],
    "generator-2": ["generate", "svg", "wireframe"],
    "generator-3": ["generate", "svg", "wireframe"],
    "validator": ["validate", "validation", "inspect"],
    "inspector": ["inspect", "consistency", "cross-svg"],
    "wireframe-qa": ["review", "qa", "quality"],
    "developer": ["implement", "code", "feature"],
    "test-engineer": ["test", "e2e", "unit", "coverage"],
    "auditor": ["audit", "compliance", "review", "analyze"],
    "coordinator": ["coordinate", "queue", "dispatch"],
    "author": ["document", "blog", "readme", "changelog"],
}

# Terminal groups
TERMINAL_GROUPS = {
    "council": ["cto", "architect", "security-lead", "toolsmith", "devops", "product-owner"],
    "generators": ["generator-1", "generator-2", "generator-3"],
    "pipeline": ["planner", "preview-host", "wireframe-qa", "validator", "inspector"],
    "implementation": ["developer", "test-engineer", "auditor"],
    "support": ["coordinator", "author", "qa-lead", "tech-writer"]
}

ALL_TERMINALS = []
for group in TERMINAL_GROUPS.values():
    ALL_TERMINALS.extend(group)


def load_status() -> dict:
    """Load terminal status"""
    if not STATUS_FILE.exists():
        return {"terminals": {}, "queue": [], "completedToday": []}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_terminal_status(data: dict, terminal: str) -> str:
    """Get status of a terminal"""
    return data.get("terminals", {}).get(terminal, {}).get("status", "idle")


def parse_audit_file(audit_file: Path) -> dict:
    """Parse an audit file for action items"""
    result = {
        "file": audit_file.name,
        "date": "",
        "author": "",
        "scope": "",
        "tasks": [],
        "recommendations": []
    }

    try:
        content = audit_file.read_text()

        # Extract date
        date_match = re.search(r'\*\*Date\*\*:\s*(.+)$', content, re.MULTILINE)
        if date_match:
            result["date"] = date_match.group(1).strip()

        # Extract author
        author_match = re.search(r'\*\*Author\*\*:\s*(.+)$', content, re.MULTILINE)
        if author_match:
            result["author"] = author_match.group(1).strip()

        # Extract scope
        scope_match = re.search(r'\*\*Scope\*\*:\s*(.+)$', content, re.MULTILINE)
        if scope_match:
            result["scope"] = scope_match.group(1).strip()

        # Look for action items / tasks in various formats
        # Pattern 1: - [ ] Task description
        checkbox_pattern = r'- \[ \]\s+(.+)$'
        for match in re.finditer(checkbox_pattern, content, re.MULTILINE):
            task_text = match.group(1).strip()
            result["tasks"].append({
                "description": task_text,
                "type": "checkbox",
                "assigned_to": infer_terminal(task_text),
                "priority": infer_priority(task_text)
            })

        # Pattern 2: | Priority | Script | ... (table format)
        table_pattern = r'\|\s*(\d+)\s*\|\s*`?([^|`]+)`?\s*\|'
        for match in re.finditer(table_pattern, content):
            priority = match.group(1)
            item = match.group(2).strip()
            if "script" in content.lower() and item.endswith(".py"):
                result["tasks"].append({
                    "description": f"Create {item}",
                    "type": "script",
                    "assigned_to": "toolsmith",
                    "priority": f"P{priority}" if int(priority) <= 3 else "P2"
                })

        # Pattern 3: Numbered recommendations
        rec_pattern = r'^(?:\d+\.|\*|-)\s+\*?\*?([^*\n]+)\*?\*?(?:\s*[-:]\s*(.+))?$'
        in_recommendations = False
        for line in content.split('\n'):
            if re.match(r'^##.*(?:Recommendation|Action|TODO)', line, re.IGNORECASE):
                in_recommendations = True
                continue
            if re.match(r'^##', line):
                in_recommendations = False
                continue

            if in_recommendations:
                rec_match = re.match(rec_pattern, line)
                if rec_match:
                    desc = rec_match.group(1).strip()
                    detail = rec_match.group(2).strip() if rec_match.group(2) else ""
                    result["recommendations"].append({
                        "description": desc,
                        "detail": detail,
                        "assigned_to": infer_terminal(desc + " " + detail)
                    })

    except Exception as e:
        print(f"Warning: Error parsing {audit_file}: {e}", file=sys.stderr)

    return result


def infer_terminal(text: str) -> str:
    """Infer which terminal should handle a task based on keywords"""
    text_lower = text.lower()

    best_match = None
    best_score = 0

    for terminal, keywords in ROLE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_match = terminal

    return best_match if best_match else "coordinator"


def infer_priority(text: str) -> str:
    """Infer priority from text"""
    text_lower = text.lower()

    if any(kw in text_lower for kw in ["critical", "urgent", "blocker", "p0"]):
        return "P0"
    elif any(kw in text_lower for kw in ["high", "important", "p1"]):
        return "P1"
    elif any(kw in text_lower for kw in ["low", "minor", "p3"]):
        return "P3"
    else:
        return "P2"


def get_audits_for_date(date_str: str) -> list:
    """Get all audit files for a specific date"""
    audits = []

    if not AUDITS_DIR.exists():
        return audits

    for audit_file in AUDITS_DIR.glob(f"{date_str}*.md"):
        audits.append(parse_audit_file(audit_file))

    return audits


def get_tasks_for_role(role: str, date_str: str = None) -> list:
    """Get tasks assigned to a specific role"""
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    audits = get_audits_for_date(date_str)
    tasks = []

    for audit in audits:
        for task in audit.get("tasks", []):
            if task.get("assigned_to") == role:
                task["source"] = audit["file"]
                tasks.append(task)

        for rec in audit.get("recommendations", []):
            if rec.get("assigned_to") == role:
                tasks.append({
                    "description": rec["description"],
                    "detail": rec.get("detail", ""),
                    "source": audit["file"],
                    "type": "recommendation",
                    "assigned_to": role,
                    "priority": "P2"
                })

    return tasks


def get_ready_terminals() -> list:
    """Get terminals ready for work (idle with no assigned tasks)"""
    data = load_status()
    queue = data.get("queue", [])

    # Build assignment map
    assigned = defaultdict(list)
    for item in queue:
        if item.get("assignedTo"):
            assigned[item["assignedTo"]].append(item)

    ready = []
    for terminal in ALL_TERMINALS:
        status = get_terminal_status(data, terminal)
        if status == "idle" and len(assigned[terminal]) == 0:
            ready.append({
                "terminal": terminal,
                "status": status,
                "group": next((g for g, ts in TERMINAL_GROUPS.items() if terminal in ts), "unknown")
            })

    return ready


def get_blocked_terminals() -> list:
    """Get terminals blocked on dependencies"""
    data = load_status()
    blocked = []

    for terminal, info in data.get("terminals", {}).items():
        if info.get("status") == "blocked":
            blocked.append({
                "terminal": terminal,
                "reason": info.get("blockedReason", "unknown"),
                "waiting_on": info.get("waitingOn", [])
            })

    return blocked


# Command handlers

def cmd_audit(date_str: str, args):
    """Parse audit files for a date"""
    audits = get_audits_for_date(date_str)

    if args.json:
        print(json.dumps(audits, indent=2))
        return

    if not audits:
        print(f"No audits found for {date_str}")
        return

    print("+" + "=" * 78 + "+")
    print(f"| AUDITS FOR {date_str} ({len(audits)} files){' ' * 47}|"[:80])
    print("+" + "-" * 78 + "+")

    total_tasks = 0
    for audit in audits:
        tasks = len(audit.get("tasks", []))
        recs = len(audit.get("recommendations", []))
        total_tasks += tasks + recs

        print(f"| {audit['file'][:60]:<60} |"[:80])
        print(f"|   Author: {audit['author'][:40]:<40} Tasks: {tasks} Recs: {recs} |"[:80])
        print("+" + "-" * 78 + "+")

        for task in audit.get("tasks", [])[:5]:
            desc = task["description"][:55]
            assigned = task.get("assigned_to", "?")[:12]
            print(f"|   [{assigned}] {desc:<55} |"[:80])

    print(f"| TOTAL: {total_tasks} action items{' ' * 58}|"[:80])
    print("+" + "=" * 78 + "+")


def cmd_for_role(role: str, args):
    """Get tasks for a specific role"""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tasks = get_tasks_for_role(role, date_str)

    if args.json:
        print(json.dumps(tasks, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| TASKS FOR {role.upper()} ({len(tasks)} tasks){' ' * 50}|"[:80])
    print("+" + "-" * 78 + "+")

    if not tasks:
        print("| No tasks assigned" + " " * 60 + "|")
    else:
        for task in tasks:
            prio = task.get("priority", "P2")
            desc = task["description"][:60]
            print(f"| [{prio}] {desc:<70} |"[:80])
            if task.get("detail"):
                print(f"|      {task['detail'][:68]:<68} |"[:80])

    print("+" + "=" * 78 + "+")


def cmd_ready(args):
    """Show terminals ready for work"""
    ready = get_ready_terminals()

    if args.json:
        print(json.dumps(ready, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| READY TERMINALS ({len(ready)}){' ' * 56}|"[:80])
    print("+" + "-" * 78 + "+")

    if not ready:
        print("| All terminals are busy or have assigned tasks" + " " * 31 + "|")
    else:
        for group_name, terminals in TERMINAL_GROUPS.items():
            group_ready = [t for t in ready if t["terminal"] in terminals]
            if group_ready:
                names = ", ".join([t["terminal"] for t in group_ready])
                print(f"| {group_name.upper()}: {names:<66} |"[:80])

    print("+" + "=" * 78 + "+")


def cmd_blocked(args):
    """Show blocked terminals"""
    blocked = get_blocked_terminals()

    if args.json:
        print(json.dumps(blocked, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| BLOCKED TERMINALS ({len(blocked)}){' ' * 54}|"[:80])
    print("+" + "-" * 78 + "+")

    if not blocked:
        print("| No terminals are blocked" + " " * 52 + "|")
    else:
        for t in blocked:
            terminal = t["terminal"][:15].ljust(15)
            reason = t["reason"][:50]
            print(f"| {terminal} | {reason:<58} |"[:80])

    print("+" + "=" * 78 + "+")


def cmd_assign(args):
    """Auto-assign tasks to terminals"""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    audits = get_audits_for_date(date_str)
    ready = get_ready_terminals()

    assignments = []

    for audit in audits:
        for task in audit.get("tasks", []):
            assigned_to = task.get("assigned_to")
            if assigned_to and any(t["terminal"] == assigned_to for t in ready):
                assignments.append({
                    "terminal": assigned_to,
                    "task": task["description"],
                    "priority": task.get("priority", "P2"),
                    "source": audit["file"]
                })

    if args.json:
        print(json.dumps(assignments, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| AUTO-ASSIGNMENTS ({len(assignments)} tasks){' ' * 51}|"[:80])
    print("+" + "-" * 78 + "+")

    if not assignments:
        print("| No assignments to make" + " " * 54 + "|")
    else:
        for a in assignments[:20]:
            terminal = a["terminal"][:12].ljust(12)
            task = a["task"][:55]
            print(f"| {terminal} <- {task:<60} |"[:80])

    print("+" + "=" * 78 + "+")


def to_summary(args) -> str:
    """Generate one-line summary"""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    audits = get_audits_for_date(date_str)
    ready = get_ready_terminals()
    blocked = get_blocked_terminals()

    total_tasks = sum(
        len(a.get("tasks", [])) + len(a.get("recommendations", []))
        for a in audits
    )

    return f"Dispatch: {len(audits)} audits | {total_tasks} tasks | {len(ready)} ready | {len(blocked)} blocked"


def main():
    parser = argparse.ArgumentParser(
        description="Dispatch Precompute",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="ready",
                       help="Command (audit, for, ready, blocked, assign)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "audit":
        date_str = args.args[0] if args.args else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cmd_audit(date_str, args)
    elif args.command == "for":
        if not args.args:
            print("Error: 'for' requires a role name", file=sys.stderr)
            sys.exit(1)
        cmd_for_role(args.args[0], args)
    elif args.command == "ready":
        cmd_ready(args)
    elif args.command == "blocked":
        cmd_blocked(args)
    elif args.command == "assign":
        cmd_assign(args)
    else:
        # Assume it's a role name
        cmd_for_role(args.command, args)


if __name__ == "__main__":
    main()
