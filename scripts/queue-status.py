#!/usr/bin/env python3
"""
Queue Status - CLI for terminal and queue status

Replaces prompt-based /queue-check skill to reduce token usage.
Usage: python3 scripts/queue-status.py [command] [options]

Commands:
  dashboard                Full terminal and queue view (default)
  pending                  Queue items only
  active                   Active (non-idle) terminals only
  <terminal>               Filter by specific terminal

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/queue-status.py
  python3 scripts/queue-status.py pending
  python3 scripts/queue-status.py generator-1
  python3 scripts/queue-status.py --json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
STATUS_FILE = WIREFRAMES_DIR / ".terminal-status.json"

# Terminal groups
TERMINAL_GROUPS = {
    'COUNCIL': ['cto', 'architect', 'security-lead', 'toolsmith', 'devops', 'product-owner'],
    'GENERATORS': ['generator-1', 'generator-2', 'generator-3'],
    'PIPELINE': ['planner', 'preview-host', 'wireframe-qa', 'validator', 'inspector'],
    'IMPLEMENTATION': ['developer', 'test-engineer', 'auditor'],
    'SUPPORT': ['coordinator', 'author', 'qa-lead', 'tech-writer']
}

ALL_TERMINALS = []
for group in TERMINAL_GROUPS.values():
    ALL_TERMINALS.extend(group)


def load_status():
    """Load .terminal-status.json"""
    if not STATUS_FILE.exists():
        return {"terminals": {}, "queue": [], "completedToday": [], "lastUpdated": None}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_terminal_status(data, terminal):
    """Get status for a specific terminal"""
    return data.get("terminals", {}).get(terminal, {"status": "idle"})


def get_queue_by_terminal(data, terminal):
    """Get queue items for a specific terminal"""
    return [item for item in data.get("queue", [])
            if item.get("assignedTo") == terminal]


def get_queue_by_action(data, action):
    """Get queue items by action type"""
    return [item for item in data.get("queue", [])
            if item.get("action", "").upper() == action.upper()]


def format_terminal_grid(data):
    """Format terminal status as grid"""
    lines = []

    for group_name, terminals in TERMINAL_GROUPS.items():
        lines.append(f"  {group_name}")
        row = "    "
        for i, terminal in enumerate(terminals):
            info = get_terminal_status(data, terminal)
            status = info.get("status", "idle")[:8].ljust(8)
            row += f"{terminal}: {status}  "
            if (i + 1) % 3 == 0:
                lines.append(row.rstrip())
                row = "    "
        if row.strip():
            lines.append(row.rstrip())
        lines.append("")

    return lines


def cmd_dashboard(data, args):
    """Full terminal and queue dashboard"""
    queue = data.get("queue", [])
    last_updated = data.get("lastUpdated", "unknown")

    if args.json:
        result = {
            "lastUpdated": last_updated,
            "terminals": data.get("terminals", {}),
            "queue": {
                "count": len(queue),
                "items": queue
            }
        }
        print(json.dumps(result, indent=2))
        return

    # Count terminal statuses
    active = idle = blocked = 0
    for terminal in ALL_TERMINALS:
        info = get_terminal_status(data, terminal)
        status = info.get("status", "idle").lower()
        if status == "idle":
            idle += 1
        elif status == "blocked":
            blocked += 1
        else:
            active += 1

    print("+" + "=" * 78 + "+")
    print(f"| Terminal Status{' ' * 40}Updated: {last_updated[:19]} |"[:80])
    print("+" + "-" * 78 + "+")

    for line in format_terminal_grid(data):
        if line:
            print(f"| {line:<76} |")
        else:
            print("|" + " " * 78 + "|")

    print(f"|   Active: {active}  |  Idle: {idle}  |  Blocked: {blocked}{' ' * 40}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Queue ({len(queue)} items){' ' * 58}|"[:80])
    print("+" + "-" * 78 + "+")

    if not queue:
        print("|   (empty)" + " " * 68 + "|")
    else:
        for i, item in enumerate(queue[:10], 1):
            feature = item.get("feature", "?")[:26]
            action = item.get("action", "?")
            assigned = item.get("assignedTo") or "unassigned"
            reason = item.get("reason", "")[:30]
            print(f"| {i}. {feature} -> {assigned} ({action}){' ' * 30}|"[:80])
            if reason:
                print(f"|    {reason}{' ' * 70}|"[:80])

        if len(queue) > 10:
            print(f"|   ... and {len(queue) - 10} more items{' ' * 50}|"[:80])

    print("+" + "=" * 78 + "+")


def cmd_pending(data, args):
    """Queue items only"""
    queue = data.get("queue", [])

    if args.json:
        print(json.dumps(queue, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| Pending Queue ({len(queue)} items){' ' * 50}|"[:80])
    print("+" + "-" * 78 + "+")

    if not queue:
        print("| (empty)" + " " * 70 + "|")
    else:
        # Group by action
        by_action = defaultdict(list)
        for item in queue:
            action = item.get("action", "OTHER")
            by_action[action].append(item)

        for action, items in sorted(by_action.items()):
            print(f"|   {action} ({len(items)}):" + " " * 60 + "|"[:80])
            for item in items[:5]:
                feature = item.get("feature", "?")[:30]
                assigned = item.get("assignedTo") or "unassigned"
                print(f"|     - {feature} -> {assigned}{' ' * 30}|"[:80])
            if len(items) > 5:
                print(f"|     ... and {len(items) - 5} more{' ' * 50}|"[:80])

    print("+" + "=" * 78 + "+")


def cmd_active(data, args):
    """Active terminals only"""
    active_terminals = []

    for terminal in ALL_TERMINALS:
        info = get_terminal_status(data, terminal)
        status = info.get("status", "idle").lower()
        if status != "idle":
            active_terminals.append({
                "terminal": terminal,
                "status": status,
                "feature": info.get("feature"),
                "task": info.get("task")
            })

    if args.json:
        print(json.dumps(active_terminals, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| Active Terminals ({len(active_terminals)}){' ' * 55}|"[:80])
    print("+" + "-" * 78 + "+")

    if not active_terminals:
        print("| All terminals are idle" + " " * 55 + "|")
    else:
        print("| Terminal        | Status      | Feature              | Task                 |")
        print("+" + "-" * 78 + "+")
        for t in active_terminals:
            term = t["terminal"][:15].ljust(15)
            status = t["status"][:11].ljust(11)
            feature = (t["feature"] or "-")[:20].ljust(20)
            task = (t["task"] or "-")[:20].ljust(20)
            print(f"| {term} | {status} | {feature} | {task} |")

    print("+" + "=" * 78 + "+")


def cmd_terminal(data, terminal, args):
    """Filter by specific terminal"""
    if terminal not in ALL_TERMINALS:
        print(f"Error: Unknown terminal '{terminal}'")
        print(f"Valid terminals: {', '.join(ALL_TERMINALS[:10])}...")
        sys.exit(1)

    info = get_terminal_status(data, terminal)
    queue_items = get_queue_by_terminal(data, terminal)

    if args.json:
        result = {
            "terminal": terminal,
            "status": info,
            "queue_items": queue_items
        }
        print(json.dumps(result, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| Tasks for: {terminal}{' ' * 60}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Terminal Status: {info.get('status', 'idle')}{' ' * 55}|"[:80])

    if info.get("feature"):
        print(f"| Current Feature: {info.get('feature')}{' ' * 55}|"[:80])
    if info.get("task"):
        print(f"| Current Task: {info.get('task')}{' ' * 55}|"[:80])

    print("+" + "-" * 78 + "+")
    print(f"| Assigned Tasks ({len(queue_items)}):{' ' * 55}|"[:80])
    print("+" + "-" * 78 + "+")

    if not queue_items:
        print("| (no tasks assigned)" + " " * 57 + "|")
    else:
        for i, item in enumerate(queue_items, 1):
            feature = item.get("feature", "?")[:30]
            action = item.get("action", "?")
            reason = item.get("reason", "")[:40]
            print(f"| {i}. {feature} ({action}){' ' * 40}|"[:80])
            if reason:
                print(f"|    {reason}{' ' * 70}|"[:80])

    print("+" + "=" * 78 + "+")


def to_summary(data):
    """Generate one-line summary"""
    queue = data.get("queue", [])

    active = 0
    for terminal in ALL_TERMINALS:
        info = get_terminal_status(data, terminal)
        if info.get("status", "idle").lower() != "idle":
            active += 1

    # Count by action
    actions = defaultdict(int)
    for item in queue:
        action = item.get("action", "OTHER")
        actions[action] += 1

    action_str = ", ".join(f"{k}:{v}" for k, v in sorted(actions.items()))

    return f"Queue: {len(queue)} items | Active: {active} | {action_str or 'no actions'}"


def main():
    parser = argparse.ArgumentParser(
        description="Queue Status Dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="dashboard",
                       help="Command or terminal name")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    data = load_status()

    # Handle summary
    if args.summary:
        print(to_summary(data))
        return

    # Handle commands
    if args.command == "dashboard":
        cmd_dashboard(data, args)
    elif args.command == "pending":
        cmd_pending(data, args)
    elif args.command == "active":
        cmd_active(data, args)
    elif args.command in ALL_TERMINALS:
        cmd_terminal(data, args.command, args)
    else:
        # Might be a terminal name with different casing
        lower_command = args.command.lower()
        if lower_command in [t.lower() for t in ALL_TERMINALS]:
            for t in ALL_TERMINALS:
                if t.lower() == lower_command:
                    cmd_terminal(data, t, args)
                    return
        else:
            print(f"Error: Unknown command '{args.command}'")
            print("Valid commands: dashboard, pending, active, <terminal-name>")
            sys.exit(1)


if __name__ == "__main__":
    main()
