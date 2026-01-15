#!/usr/bin/env python3
"""
Escalation Check - Detect items requiring escalation

Monitors queue and issues for escalation candidates.
Usage: python3 scripts/escalation-check.py [command] [options]

Commands:
  check                    Run escalation check (default)
  stale                    Show stale items
  blocked                  Show blocked items
  issues                   Show unresolved issues

Options:
  --threshold <hours>      Stale threshold (default: 24)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/escalation-check.py
  python3 scripts/escalation-check.py stale --threshold 12
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
STATUS_FILE = PROJECT_ROOT / "docs" / "design" / "wireframes" / ".terminal-status.json"
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
ISSUES_FILE = WIREFRAMES_DIR / "GENERAL_ISSUES.md"


def load_status() -> dict:
    """Load terminal status"""
    if not STATUS_FILE.exists():
        return {"queue": [], "terminals": {}}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_stale_items(threshold_hours: int = 24) -> list:
    """Get items in queue longer than threshold"""
    data = load_status()
    now = datetime.now(timezone.utc)
    stale = []

    # Check last updated
    last_updated = data.get("lastUpdated")
    if last_updated:
        try:
            last_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            age = now - last_time
            if age > timedelta(hours=threshold_hours):
                stale.append({
                    "type": "queue",
                    "item": "entire_queue",
                    "age_hours": age.total_seconds() / 3600,
                    "reason": f"Queue not updated in {age.days}d {age.seconds//3600}h"
                })
        except Exception:
            pass

    # Check for old queue items (by position - older items at back)
    queue = data.get("queue", [])
    for i, item in enumerate(queue):
        if i >= 5:  # Items at position 5+ might be stale
            stale.append({
                "type": "queue_item",
                "item": item.get("feature", "unknown"),
                "action": item.get("action"),
                "position": i,
                "reason": f"Item at position {i} in queue"
            })

    return stale


def get_blocked_items() -> list:
    """Get blocked terminals and items"""
    data = load_status()
    blocked = []

    for terminal, info in data.get("terminals", {}).items():
        if info.get("status", "").lower() == "blocked":
            blocked.append({
                "type": "terminal",
                "terminal": terminal,
                "reason": info.get("blockedReason", "unknown"),
                "waiting_on": info.get("waitingOn", [])
            })

    return blocked


def get_unresolved_issues() -> list:
    """Get unresolved issues from GENERAL_ISSUES.md"""
    issues = []

    if not ISSUES_FILE.exists():
        return issues

    content = ISSUES_FILE.read_text()

    # Look for open issues (unchecked boxes)
    import re
    for match in re.finditer(r'- \[ \]\s+(.+)$', content, re.MULTILINE):
        issues.append({
            "type": "general_issue",
            "description": match.group(1).strip()
        })

    # Check feature issue files
    for feature_dir in WIREFRAMES_DIR.iterdir():
        if not feature_dir.is_dir():
            continue
        if feature_dir.name.startswith(('.', 'includes', 'templates')):
            continue

        for issue_file in feature_dir.glob("*.issues.md"):
            file_content = issue_file.read_text()
            if "REGEN" in file_content or "REGENERATE" in file_content:
                issues.append({
                    "type": "wireframe_issue",
                    "feature": feature_dir.name,
                    "file": issue_file.name,
                    "severity": "REGEN"
                })

    return issues


def run_escalation_check(threshold_hours: int = 24) -> dict:
    """Run full escalation check"""
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "escalation_needed": False,
        "candidates": [],
        "summary": {
            "stale": 0,
            "blocked": 0,
            "issues": 0
        }
    }

    stale = get_stale_items(threshold_hours)
    blocked = get_blocked_items()
    issues = get_unresolved_issues()

    result["summary"]["stale"] = len(stale)
    result["summary"]["blocked"] = len(blocked)
    result["summary"]["issues"] = len(issues)

    # Determine escalation candidates
    for item in stale:
        item["escalation_type"] = "stale"
        result["candidates"].append(item)

    for item in blocked:
        item["escalation_type"] = "blocked"
        result["candidates"].append(item)

    # Only escalate critical issues
    for item in issues:
        if item.get("severity") == "REGEN":
            item["escalation_type"] = "unresolved"
            result["candidates"].append(item)

    result["escalation_needed"] = len(result["candidates"]) > 0

    return result


# Command handlers

def cmd_check(args):
    """Run escalation check"""
    result = run_escalation_check(args.threshold)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    status = "ESCALATE" if result["escalation_needed"] else "OK"

    print("+" + "=" * 78 + "+")
    print(f"| ESCALATION CHECK: {status}{' ' * 55}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Stale items: {result['summary']['stale']:<62} |")
    print(f"| Blocked terminals: {result['summary']['blocked']:<56} |")
    print(f"| Unresolved issues: {result['summary']['issues']:<56} |")
    print("+" + "-" * 78 + "+")

    if result["candidates"]:
        print("| ESCALATION CANDIDATES:" + " " * 55 + "|")
        for c in result["candidates"][:10]:
            desc = c.get("reason") or c.get("description") or c.get("feature", "unknown")
            print(f"|   [{c['escalation_type']}] {desc[:60]:<60} |")
        if len(result["candidates"]) > 10:
            print(f"|   ... and {len(result['candidates']) - 10} more{' ' * 55}|"[:80])

    print("+" + "=" * 78 + "+")


def cmd_stale(args):
    """Show stale items"""
    stale = get_stale_items(args.threshold)

    if args.json:
        print(json.dumps(stale, indent=2))
        return

    print(f"Stale Items (threshold: {args.threshold}h):")
    if not stale:
        print("  None")
    else:
        for s in stale:
            print(f"  - {s.get('item', 'unknown')}: {s.get('reason', '')}")


def cmd_blocked(args):
    """Show blocked items"""
    blocked = get_blocked_items()

    if args.json:
        print(json.dumps(blocked, indent=2))
        return

    print(f"Blocked Items ({len(blocked)}):")
    if not blocked:
        print("  None")
    else:
        for b in blocked:
            print(f"  - {b['terminal']}: {b['reason']}")


def cmd_issues(args):
    """Show unresolved issues"""
    issues = get_unresolved_issues()

    if args.json:
        print(json.dumps(issues, indent=2))
        return

    print(f"Unresolved Issues ({len(issues)}):")
    if not issues:
        print("  None")
    else:
        for i in issues[:20]:
            if i["type"] == "wireframe_issue":
                print(f"  [{i.get('severity', '?')}] {i['feature']}/{i['file']}")
            else:
                print(f"  - {i.get('description', 'unknown')[:60]}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    result = run_escalation_check(24)
    status = "ESCALATE" if result["escalation_needed"] else "OK"
    return f"Escalation: {status} | {len(result['candidates'])} candidates | {result['summary']['blocked']} blocked"


def main():
    parser = argparse.ArgumentParser(
        description="Escalation Check",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="check",
                       choices=["check", "stale", "blocked", "issues"],
                       help="Command")
    parser.add_argument("--threshold", type=int, default=24,
                       help="Stale threshold in hours")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "check":
        cmd_check(args)
    elif args.command == "stale":
        cmd_stale(args)
    elif args.command == "blocked":
        cmd_blocked(args)
    elif args.command == "issues":
        cmd_issues(args)


if __name__ == "__main__":
    main()
