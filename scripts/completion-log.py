#!/usr/bin/env python3
"""
Completion Log - Track and query completed tasks

Provides history and analytics on completed work.
Usage: python3 scripts/completion-log.py [command] [options]

Commands:
  today                    Today's completions (default)
  add <entry>              Add completion entry
  search <term>            Search completions
  stats                    Completion statistics

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/completion-log.py
  python3 scripts/completion-log.py add "Fixed auth bug"
  python3 scripts/completion-log.py search "wireframe"
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

# Status file
STATUS_FILE = PROJECT_ROOT / "docs" / "design" / "wireframes" / ".terminal-status.json"


def load_status() -> dict:
    """Load terminal status"""
    if not STATUS_FILE.exists():
        return {"completedToday": [], "lastUpdated": None}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def save_status(data: dict):
    """Save terminal status"""
    data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    with open(STATUS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_completions() -> list:
    """Get today's completions"""
    data = load_status()
    return data.get("completedToday", [])


def add_completion(entry: str) -> bool:
    """Add completion entry"""
    data = load_status()
    completions = data.get("completedToday", [])
    completions.append(entry)
    data["completedToday"] = completions
    save_status(data)
    return True


def search_completions(term: str) -> list:
    """Search completions"""
    completions = get_completions()
    term_lower = term.lower()
    return [c for c in completions if term_lower in c.lower()]


def get_stats() -> dict:
    """Get completion statistics"""
    completions = get_completions()

    stats = {
        "total": len(completions),
        "by_terminal": defaultdict(int),
        "by_type": defaultdict(int)
    }

    for c in completions:
        # Extract terminal from "Terminal: action" pattern
        if ":" in c:
            terminal = c.split(":")[0].strip().lower()
            stats["by_terminal"][terminal] += 1

        # Categorize by type
        c_lower = c.lower()
        if "wireframe" in c_lower or "svg" in c_lower:
            stats["by_type"]["wireframe"] += 1
        elif "fix" in c_lower or "patch" in c_lower:
            stats["by_type"]["fix"] += 1
        elif "script" in c_lower:
            stats["by_type"]["script"] += 1
        elif "review" in c_lower or "inspect" in c_lower:
            stats["by_type"]["review"] += 1
        else:
            stats["by_type"]["other"] += 1

    stats["by_terminal"] = dict(stats["by_terminal"])
    stats["by_type"] = dict(stats["by_type"])

    return stats


# Command handlers

def cmd_today(args):
    """Show today's completions"""
    completions = get_completions()

    if args.json:
        print(json.dumps(completions, indent=2))
        return

    print(f"Today's Completions ({len(completions)}):")
    if not completions:
        print("  None yet")
    else:
        for i, c in enumerate(completions, 1):
            print(f"  {i}. {c}")


def cmd_add(entry: str, args):
    """Add completion entry"""
    if add_completion(entry):
        if args.json:
            print(json.dumps({"success": True, "entry": entry}, indent=2))
        else:
            print(f"Added: {entry}")
    else:
        print("Error: Failed to add entry", file=sys.stderr)
        sys.exit(1)


def cmd_search(term: str, args):
    """Search completions"""
    results = search_completions(term)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    print(f"Search results for '{term}' ({len(results)}):")
    for r in results:
        print(f"  - {r}")


def cmd_stats(args):
    """Show statistics"""
    stats = get_stats()

    if args.json:
        print(json.dumps(stats, indent=2))
        return

    print(f"Completion Statistics:")
    print(f"  Total: {stats['total']}")
    print()
    print("  By Terminal:")
    for terminal, count in sorted(stats["by_terminal"].items(), key=lambda x: -x[1]):
        print(f"    {terminal}: {count}")
    print()
    print("  By Type:")
    for typ, count in sorted(stats["by_type"].items(), key=lambda x: -x[1]):
        print(f"    {typ}: {count}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    completions = get_completions()
    return f"Completions: {len(completions)} today"


def main():
    parser = argparse.ArgumentParser(
        description="Completion Log",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="today",
                       help="Command (today, add, search, stats)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "today":
        cmd_today(args)
    elif args.command == "add":
        if not args.args:
            print("Error: add requires entry text", file=sys.stderr)
            sys.exit(1)
        cmd_add(" ".join(args.args), args)
    elif args.command == "search":
        if not args.args:
            print("Error: search requires term", file=sys.stderr)
            sys.exit(1)
        cmd_search(args.args[0], args)
    elif args.command == "stats":
        cmd_stats(args)
    else:
        cmd_today(args)


if __name__ == "__main__":
    main()
