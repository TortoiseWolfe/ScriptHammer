#!/usr/bin/env python3
"""
Stale Finder - Find stale items across the project

Identifies files, queue items, and tasks that haven't been updated.
Usage: python3 scripts/stale-finder.py [command] [options]

Commands:
  all                      Find all stale items (default)
  wireframes               Stale wireframes
  issues                   Stale issue files
  queue                    Stale queue items
  audits                   Old audit files

Options:
  --days <n>               Stale threshold in days (default: 7)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/stale-finder.py
  python3 scripts/stale-finder.py wireframes --days 14
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
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
AUDITS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "audits"
STATUS_FILE = WIREFRAMES_DIR / ".terminal-status.json"


def get_file_age(filepath: Path) -> timedelta:
    """Get age of a file"""
    if not filepath.exists():
        return None
    mtime = datetime.fromtimestamp(filepath.stat().st_mtime, tz=timezone.utc)
    return datetime.now(timezone.utc) - mtime


def find_stale_wireframes(days: int = 7) -> list:
    """Find stale wireframe SVGs"""
    stale = []
    threshold = timedelta(days=days)

    for feature_dir in WIREFRAMES_DIR.iterdir():
        if not feature_dir.is_dir():
            continue
        if feature_dir.name.startswith(('.', 'includes', 'templates', 'png', 'node_modules')):
            continue

        for svg_file in feature_dir.glob("*.svg"):
            age = get_file_age(svg_file)
            if age and age > threshold:
                stale.append({
                    "type": "wireframe",
                    "file": str(svg_file.relative_to(WIREFRAMES_DIR)),
                    "age_days": age.days,
                    "feature": feature_dir.name
                })

    return sorted(stale, key=lambda x: -x["age_days"])


def find_stale_issues(days: int = 7) -> list:
    """Find stale issue files"""
    stale = []
    threshold = timedelta(days=days)

    for feature_dir in WIREFRAMES_DIR.iterdir():
        if not feature_dir.is_dir():
            continue

        for issue_file in feature_dir.glob("*.issues.md"):
            age = get_file_age(issue_file)
            if age and age > threshold:
                stale.append({
                    "type": "issue",
                    "file": str(issue_file.relative_to(WIREFRAMES_DIR)),
                    "age_days": age.days,
                    "feature": feature_dir.name
                })

    return sorted(stale, key=lambda x: -x["age_days"])


def find_stale_queue_items() -> list:
    """Find items that have been in queue too long"""
    if not STATUS_FILE.exists():
        return []

    with open(STATUS_FILE, "r") as f:
        data = json.load(f)

    queue = data.get("queue", [])
    stale = []

    # Items at positions 5+ are considered potentially stale
    for i, item in enumerate(queue):
        if i >= 5:
            stale.append({
                "type": "queue_item",
                "feature": item.get("feature", "unknown"),
                "action": item.get("action"),
                "position": i,
                "assigned_to": item.get("assignedTo")
            })

    return stale


def find_old_audits(days: int = 30) -> list:
    """Find old audit files"""
    old = []
    threshold = timedelta(days=days)

    if not AUDITS_DIR.exists():
        return old

    for audit_file in AUDITS_DIR.glob("*.md"):
        age = get_file_age(audit_file)
        if age and age > threshold:
            old.append({
                "type": "audit",
                "file": audit_file.name,
                "age_days": age.days
            })

    return sorted(old, key=lambda x: -x["age_days"])


def find_all_stale(days: int = 7) -> dict:
    """Find all stale items"""
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "threshold_days": days,
        "wireframes": find_stale_wireframes(days),
        "issues": find_stale_issues(days),
        "queue": find_stale_queue_items(),
        "audits": find_old_audits(days * 4)  # Audits use 4x threshold
    }

    result["total"] = (
        len(result["wireframes"]) +
        len(result["issues"]) +
        len(result["queue"]) +
        len(result["audits"])
    )

    return result


# Command handlers

def cmd_all(args):
    """Find all stale items"""
    result = find_all_stale(args.days)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| STALE FINDER (threshold: {args.days}d){' ' * 48}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Stale wireframes: {len(result['wireframes']):<57} |")
    print(f"| Stale issue files: {len(result['issues']):<56} |")
    print(f"| Stale queue items: {len(result['queue']):<56} |")
    print(f"| Old audits: {len(result['audits']):<63} |")
    print("+" + "-" * 78 + "+")
    print(f"| TOTAL: {result['total']} stale items{' ' * 57}|"[:80])
    print("+" + "=" * 78 + "+")


def cmd_wireframes(args):
    """Show stale wireframes"""
    stale = find_stale_wireframes(args.days)

    if args.json:
        print(json.dumps(stale, indent=2))
        return

    print(f"Stale Wireframes ({len(stale)}, threshold: {args.days}d):")
    if not stale:
        print("  None")
    else:
        for s in stale[:20]:
            print(f"  [{s['age_days']}d] {s['file']}")


def cmd_issues(args):
    """Show stale issue files"""
    stale = find_stale_issues(args.days)

    if args.json:
        print(json.dumps(stale, indent=2))
        return

    print(f"Stale Issue Files ({len(stale)}, threshold: {args.days}d):")
    if not stale:
        print("  None")
    else:
        for s in stale[:20]:
            print(f"  [{s['age_days']}d] {s['file']}")


def cmd_queue(args):
    """Show stale queue items"""
    stale = find_stale_queue_items()

    if args.json:
        print(json.dumps(stale, indent=2))
        return

    print(f"Stale Queue Items ({len(stale)}):")
    if not stale:
        print("  None")
    else:
        for s in stale:
            print(f"  [pos {s['position']}] {s['feature']} ({s['action']})")


def cmd_audits(args):
    """Show old audits"""
    old = find_old_audits(args.days * 4)

    if args.json:
        print(json.dumps(old, indent=2))
        return

    print(f"Old Audit Files ({len(old)}, threshold: {args.days * 4}d):")
    if not old:
        print("  None")
    else:
        for o in old[:20]:
            print(f"  [{o['age_days']}d] {o['file']}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    result = find_all_stale(7)
    status = "STALE" if result["total"] > 10 else "OK"
    return f"Stale: {status} | {result['total']} items | {len(result['wireframes'])} SVGs | {len(result['queue'])} queued"


def main():
    parser = argparse.ArgumentParser(
        description="Stale Finder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="all",
                       choices=["all", "wireframes", "issues", "queue", "audits"],
                       help="Command")
    parser.add_argument("--days", type=int, default=7,
                       help="Stale threshold in days")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "all":
        cmd_all(args)
    elif args.command == "wireframes":
        cmd_wireframes(args)
    elif args.command == "issues":
        cmd_issues(args)
    elif args.command == "queue":
        cmd_queue(args)
    elif args.command == "audits":
        cmd_audits(args)


if __name__ == "__main__":
    main()
