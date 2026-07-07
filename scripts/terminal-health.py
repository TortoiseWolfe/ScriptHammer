#!/usr/bin/env python3
"""
Terminal Health - Health check for terminal status and queue system

Monitors terminal states and detects issues.
Usage: python3 scripts/terminal-health.py [command] [options]

Commands:
  check                    Full health check (default)
  status <terminal>        Check specific terminal
  blocked                  List blocked terminals
  idle                     List idle terminals
  stale                    List terminals with stale assignments

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/terminal-health.py
  python3 scripts/terminal-health.py status toolsmith
  python3 scripts/terminal-health.py blocked --json
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
STATUS_FILE = PROJECT_ROOT / "docs" / "design" / "wireframes" / ".terminal-status.json"

# Terminal definitions
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
        return {"terminals": {}, "queue": [], "completedToday": [], "lastUpdated": None}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_terminal_info(data: dict, terminal: str) -> dict:
    """Get info for a specific terminal"""
    info = data.get("terminals", {}).get(terminal, {})
    return {
        "terminal": terminal,
        "status": info.get("status", "idle"),
        "feature": info.get("feature"),
        "task": info.get("task"),
        "startedAt": info.get("startedAt"),
        "blockedReason": info.get("blockedReason"),
        "group": next((g for g, ts in TERMINAL_GROUPS.items() if terminal in ts), "unknown")
    }


def get_queue_for_terminal(data: dict, terminal: str) -> list:
    """Get queue items assigned to terminal"""
    return [item for item in data.get("queue", [])
            if item.get("assignedTo") == terminal]


def check_health(data: dict) -> dict:
    """Run full health check"""
    health = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "healthy",
        "issues": [],
        "warnings": [],
        "terminals": {
            "total": len(ALL_TERMINALS),
            "idle": 0,
            "active": 0,
            "blocked": 0,
            "unknown": 0
        },
        "queue": {
            "total": len(data.get("queue", [])),
            "unassigned": 0,
            "by_action": defaultdict(int)
        },
        "last_updated": data.get("lastUpdated")
    }

    # Check terminals
    for terminal in ALL_TERMINALS:
        info = get_terminal_info(data, terminal)
        status = info["status"].lower()

        if status == "idle":
            health["terminals"]["idle"] += 1
        elif status == "blocked":
            health["terminals"]["blocked"] += 1
            health["warnings"].append(f"{terminal} is blocked: {info.get('blockedReason', 'unknown reason')}")
        elif status in ["active", "working", "generating", "validating", "inspecting"]:
            health["terminals"]["active"] += 1
        else:
            health["terminals"]["unknown"] += 1

    # Check queue
    for item in data.get("queue", []):
        action = item.get("action", "UNKNOWN")
        health["queue"]["by_action"][action] += 1

        if not item.get("assignedTo"):
            health["queue"]["unassigned"] += 1

    health["queue"]["by_action"] = dict(health["queue"]["by_action"])

    # Check for stale status
    if health["last_updated"]:
        try:
            last_update = datetime.fromisoformat(health["last_updated"].replace('Z', '+00:00'))
            age = datetime.now(timezone.utc) - last_update
            if age > timedelta(hours=24):
                health["warnings"].append(f"Status file is {age.days}d {age.seconds//3600}h old")
        except Exception:
            pass

    # Determine overall status
    if health["terminals"]["blocked"] > 0:
        health["status"] = "degraded"
    if health["issues"]:
        health["status"] = "unhealthy"
    if health["queue"]["unassigned"] > 5:
        health["warnings"].append(f"{health['queue']['unassigned']} unassigned queue items")

    return health


def get_blocked_terminals(data: dict) -> list:
    """Get list of blocked terminals"""
    blocked = []
    for terminal in ALL_TERMINALS:
        info = get_terminal_info(data, terminal)
        if info["status"].lower() == "blocked":
            blocked.append(info)
    return blocked


def get_idle_terminals(data: dict) -> list:
    """Get list of idle terminals"""
    idle = []
    for terminal in ALL_TERMINALS:
        info = get_terminal_info(data, terminal)
        queue_items = get_queue_for_terminal(data, terminal)
        if info["status"].lower() == "idle" and len(queue_items) == 0:
            idle.append(info)
    return idle


def get_stale_terminals(data: dict) -> list:
    """Get terminals with stale assignments"""
    stale = []
    now = datetime.now(timezone.utc)

    for terminal in ALL_TERMINALS:
        info = get_terminal_info(data, terminal)
        if info.get("startedAt"):
            try:
                started = datetime.fromisoformat(info["startedAt"].replace('Z', '+00:00'))
                age = now - started
                if age > timedelta(hours=4):  # Stale if > 4 hours on same task
                    info["age_hours"] = age.total_seconds() / 3600
                    stale.append(info)
            except Exception:
                pass
    return stale


# Command handlers

def cmd_check(args):
    """Full health check"""
    data = load_status()
    health = check_health(data)

    if args.json:
        print(json.dumps(health, indent=2))
        return

    status_color = {"healthy": "OK", "degraded": "WARN", "unhealthy": "FAIL"}

    print("+" + "=" * 78 + "+")
    print(f"| TERMINAL HEALTH CHECK - {status_color.get(health['status'], 'UNKNOWN')}{' ' * 49}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Terminals: {health['terminals']['active']} active, {health['terminals']['idle']} idle, {health['terminals']['blocked']} blocked{' ' * 30}|"[:80])
    print(f"| Queue: {health['queue']['total']} items ({health['queue']['unassigned']} unassigned){' ' * 40}|"[:80])
    print("+" + "-" * 78 + "+")

    if health["warnings"]:
        print("| WARNINGS:" + " " * 68 + "|")
        for w in health["warnings"]:
            print(f"|   ⚠ {w[:70]:<70} |")
        print("+" + "-" * 78 + "+")

    if health["issues"]:
        print("| ISSUES:" + " " * 70 + "|")
        for i in health["issues"]:
            print(f"|   ✗ {i[:70]:<70} |")
        print("+" + "-" * 78 + "+")

    # Show queue breakdown
    if health["queue"]["by_action"]:
        print("| Queue by Action:" + " " * 61 + "|")
        for action, count in health["queue"]["by_action"].items():
            print(f"|   {action}: {count}{' ' * 65}|"[:80])

    print("+" + "=" * 78 + "+")


def cmd_status(terminal: str, args):
    """Check specific terminal"""
    data = load_status()
    info = get_terminal_info(data, terminal)
    queue_items = get_queue_for_terminal(data, terminal)

    if args.json:
        output = {**info, "queue_items": queue_items}
        print(json.dumps(output, indent=2))
        return

    print(f"Terminal: {terminal}")
    print(f"Group: {info['group']}")
    print(f"Status: {info['status']}")

    if info["feature"]:
        print(f"Current Feature: {info['feature']}")
    if info["task"]:
        print(f"Current Task: {info['task']}")
    if info["blockedReason"]:
        print(f"Blocked Reason: {info['blockedReason']}")

    print(f"\nQueued Items: {len(queue_items)}")
    for item in queue_items[:5]:
        print(f"  - {item.get('feature')}: {item.get('action')}")


def cmd_blocked(args):
    """List blocked terminals"""
    data = load_status()
    blocked = get_blocked_terminals(data)

    if args.json:
        print(json.dumps(blocked, indent=2))
        return

    print(f"Blocked Terminals ({len(blocked)}):")
    if not blocked:
        print("  None")
    else:
        for b in blocked:
            print(f"  {b['terminal']}: {b.get('blockedReason', 'unknown reason')}")


def cmd_idle(args):
    """List idle terminals"""
    data = load_status()
    idle = get_idle_terminals(data)

    if args.json:
        print(json.dumps(idle, indent=2))
        return

    print(f"Idle Terminals ({len(idle)}):")
    if not idle:
        print("  None (all terminals are busy)")
    else:
        by_group = defaultdict(list)
        for t in idle:
            by_group[t["group"]].append(t["terminal"])

        for group, terminals in by_group.items():
            print(f"  {group}: {', '.join(terminals)}")


def cmd_stale(args):
    """List terminals with stale assignments"""
    data = load_status()
    stale = get_stale_terminals(data)

    if args.json:
        print(json.dumps(stale, indent=2))
        return

    print(f"Stale Terminals ({len(stale)}):")
    if not stale:
        print("  None")
    else:
        for s in stale:
            age = s.get("age_hours", 0)
            print(f"  {s['terminal']}: {s.get('task', 'unknown task')} ({age:.1f}h)")


def to_summary(args) -> str:
    """Generate one-line summary"""
    data = load_status()
    health = check_health(data)

    return f"Health: {health['status'].upper()} | {health['terminals']['active']} active | {health['terminals']['blocked']} blocked | {health['queue']['total']} queued"


def main():
    parser = argparse.ArgumentParser(
        description="Terminal Health Check",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="check",
                       help="Command (check, status, blocked, idle, stale)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "check":
        cmd_check(args)
    elif args.command == "status":
        if not args.args:
            print("Error: status requires terminal name", file=sys.stderr)
            sys.exit(1)
        cmd_status(args.args[0], args)
    elif args.command == "blocked":
        cmd_blocked(args)
    elif args.command == "idle":
        cmd_idle(args)
    elif args.command == "stale":
        cmd_stale(args)
    else:
        # Assume it's a terminal name
        cmd_status(args.command, args)


if __name__ == "__main__":
    main()
