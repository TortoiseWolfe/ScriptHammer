#!/usr/bin/env python3
"""
Review Queue - CLI for wireframe review backlog

Replaces prompt-based /review-queue skill to reduce token usage.
Usage: python3 scripts/review-queue.py [command] [options]

Commands:
  list                     Show all items pending review (default)
  stale                    Show items older than 24 hours
  with-issues              Show items with .issues.md files
  detail <feature>         Show details for specific feature

Options:
  --json                   Output as JSON (machine-readable)
  --summary                One-line summary for CI

Examples:
  python3 scripts/review-queue.py
  python3 scripts/review-queue.py --json
  python3 scripts/review-queue.py stale
  python3 scripts/review-queue.py detail 001
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
STATUS_FILE = WIREFRAMES_DIR / ".terminal-status.json"


def load_status():
    """Load .terminal-status.json"""
    if not STATUS_FILE.exists():
        return {"terminals": {}, "queue": [], "completedToday": [], "lastUpdated": None}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_review_items(data):
    """Filter queue for REVIEW action items"""
    return [item for item in data.get("queue", [])
            if item.get("action", "").upper() == "REVIEW"]


def get_feature_svgs(feature):
    """Get SVG files for a feature"""
    feature_dir = None

    # Try exact match first
    exact = WIREFRAMES_DIR / feature
    if exact.exists():
        feature_dir = exact
    else:
        # Try prefix match (e.g., "001" matches "001-wcag-aa-compliance")
        for d in WIREFRAMES_DIR.iterdir():
            if d.is_dir() and d.name.startswith(f"{feature}-"):
                feature_dir = d
                break

    if not feature_dir or not feature_dir.exists():
        return [], None

    svgs = list(feature_dir.glob("*.svg"))
    return svgs, feature_dir


def get_issues_files(feature_dir):
    """Get .issues.md files for a feature directory"""
    if not feature_dir:
        return []
    return list(feature_dir.glob("*.issues.md"))


def get_file_age(filepath):
    """Get age of file as timedelta"""
    if not filepath.exists():
        return None
    mtime = datetime.fromtimestamp(filepath.stat().st_mtime, tz=timezone.utc)
    return datetime.now(timezone.utc) - mtime


def format_age(age):
    """Format timedelta as human-readable string"""
    if age is None:
        return "unknown"

    total_seconds = int(age.total_seconds())
    if total_seconds < 3600:
        return f"{total_seconds // 60}m"
    elif total_seconds < 86400:
        return f"{total_seconds // 3600}h"
    else:
        days = total_seconds // 86400
        hours = (total_seconds % 86400) // 3600
        return f"{days}d {hours}h"


def get_classification(issues_files):
    """Determine classification from issues files content"""
    has_regen = False
    has_patch = False

    for issues_file in issues_files:
        try:
            content = issues_file.read_text()
            if "REGEN" in content or "REGENERATE" in content:
                has_regen = True
            if "PATCH" in content:
                has_patch = True
        except Exception:
            pass

    if has_regen:
        return "REGEN"
    elif has_patch:
        return "PATCH"
    else:
        return "FRESH"


def build_review_data():
    """Build comprehensive review queue data"""
    data = load_status()
    review_items = get_review_items(data)
    last_updated = data.get("lastUpdated")

    # Parse last updated for age calculation
    queue_time = None
    if last_updated:
        try:
            queue_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
        except Exception:
            pass

    results = []

    for item in review_items:
        feature = item.get("feature", "unknown")
        svgs, feature_dir = get_feature_svgs(feature)
        issues_files = get_issues_files(feature_dir) if feature_dir else []

        # Calculate age from most recent SVG modification
        svg_ages = [get_file_age(svg) for svg in svgs]
        svg_ages = [a for a in svg_ages if a is not None]
        newest_age = min(svg_ages) if svg_ages else None

        classification = get_classification(issues_files)

        result = {
            "feature": feature,
            "svg_count": len(svgs),
            "issues_count": len(issues_files),
            "age": newest_age,
            "age_str": format_age(newest_age),
            "classification": classification,
            "assigned_to": item.get("assignedTo"),
            "reason": item.get("reason", ""),
            "svgs": [svg.name for svg in svgs],
            "issues_files": [f.name for f in issues_files],
            "is_stale": newest_age and newest_age > timedelta(hours=24)
        }
        results.append(result)

    return results, data


def cmd_list(args):
    """Show all review items"""
    results, data = build_review_data()

    if args.json:
        output = [{
            "feature": r["feature"],
            "svg_count": r["svg_count"],
            "issues_count": r["issues_count"],
            "age": r["age_str"],
            "classification": r["classification"],
            "is_stale": r["is_stale"]
        } for r in results]
        print(json.dumps(output, indent=2))
        return

    if not results:
        print("REVIEW QUEUE: Empty")
        print("No items pending review.")
        return

    total_svgs = sum(r["svg_count"] for r in results)

    print("+" + "=" * 78 + "+")
    print(f"| REVIEW QUEUE{' ' * 50}{len(results)} items pending |")
    print("+" + "-" * 78 + "+")
    print("| # | Feature                    | SVGs | Issues | Age      | Status         |")
    print("+" + "-" * 78 + "+")

    for i, r in enumerate(results, 1):
        feature = r["feature"][:26].ljust(26)
        status = r["classification"].ljust(14)
        if r["is_stale"]:
            status = "STALE " + r["classification"]
            status = status[:14].ljust(14)
        print(f"| {i} | {feature} | {r['svg_count']:4} | {r['issues_count']:6} | {r['age_str']:8} | {status} |")

    print("+" + "-" * 78 + "+")
    print(f"| Total: {total_svgs} SVGs across {len(results)} features{' ' * 38}|")
    print("+" + "=" * 78 + "+")


def cmd_stale(args):
    """Show stale items (>24 hours)"""
    results, _ = build_review_data()
    stale = [r for r in results if r["is_stale"]]

    if args.json:
        output = [{
            "feature": r["feature"],
            "age": r["age_str"],
            "classification": r["classification"]
        } for r in stale]
        print(json.dumps(output, indent=2))
        return

    if not stale:
        print("STALE REVIEWS: None")
        print("All review items are less than 24 hours old.")
        return

    print("+" + "=" * 78 + "+")
    print(f"| STALE REVIEWS (> 24 hours){' ' * 37}{len(stale)} items |")
    print("+" + "-" * 78 + "+")
    print("| # | Feature                    | SVGs | Age      | Reason                   |")
    print("+" + "-" * 78 + "+")

    for i, r in enumerate(stale, 1):
        feature = r["feature"][:26].ljust(26)
        reason = r["reason"][:24].ljust(24)
        print(f"| {i} | {feature} | {r['svg_count']:4} | {r['age_str']:8} | {reason} |")

    print("+" + "-" * 78 + "+")
    print("| These items need attention!" + " " * 50 + "|")
    print("+" + "=" * 78 + "+")


def cmd_with_issues(args):
    """Show items with issues files"""
    results, _ = build_review_data()
    with_issues = [r for r in results if r["issues_count"] > 0]

    if args.json:
        output = [{
            "feature": r["feature"],
            "issues_count": r["issues_count"],
            "classification": r["classification"],
            "issues_files": r["issues_files"]
        } for r in with_issues]
        print(json.dumps(output, indent=2))
        return

    if not with_issues:
        print("REVIEWS WITH ISSUES: None")
        print("No review items have issues files yet.")
        return

    print("+" + "=" * 78 + "+")
    print(f"| REVIEWS WITH ISSUES{' ' * 44}{len(with_issues)} items |")
    print("+" + "-" * 78 + "+")
    print("| Feature                    | Issue Files | Last Modified | Classification   |")
    print("+" + "-" * 78 + "+")

    for r in with_issues:
        feature = r["feature"][:26].ljust(26)
        classification = r["classification"].ljust(16)
        print(f"| {feature} | {r['issues_count']:11} | {r['age_str']:13} | {classification} |")

    print("+" + "=" * 78 + "+")


def cmd_detail(feature, args):
    """Show details for specific feature"""
    results, _ = build_review_data()

    # Find matching feature
    match = None
    for r in results:
        if r["feature"] == feature or r["feature"].startswith(f"{feature}-"):
            match = r
            break

    if not match:
        print(f"Feature '{feature}' not found in review queue.")
        return

    if args.json:
        print(json.dumps(match, indent=2, default=str))
        return

    print("+" + "=" * 78 + "+")
    print(f"| REVIEW DETAIL: {match['feature'][:60]:<61} |")
    print("+" + "-" * 78 + "+")
    print(f"| Assigned To: {(match['assigned_to'] or 'unassigned'):<63} |")
    print(f"| Reason: {match['reason'][:68]:<68} |")
    print(f"| Added to queue: {match['age_str']:<60} |")
    print("+" + "-" * 78 + "+")
    print(f"| SVG FILES ({match['svg_count']}):{' ' * 61} |")

    for svg in match["svgs"]:
        issues_name = svg.replace(".svg", ".issues.md")
        has_issues = issues_name in match["issues_files"]
        status = "Has issues" if has_issues else "No issues"
        print(f"|   - {svg[:50]:<50} [{status}]      |")

    print("+" + "-" * 78 + "+")
    print("| Actions:" + " " * 69 + "|")
    print(f"|   /wireframe-screenshots {feature}     - Generate screenshots" + " " * 12 + "|")
    print(f"|   /wireframe-status {feature} approved - Mark as approved" + " " * 15 + "|")
    print("+" + "=" * 78 + "+")


def to_summary(results):
    """Generate one-line summary"""
    if not results:
        return "Review Queue: EMPTY | 0 items"

    total_svgs = sum(r["svg_count"] for r in results)
    stale_count = len([r for r in results if r["is_stale"]])

    status = "OK"
    if stale_count > 0:
        status = "STALE"

    return f"Review Queue: {status} | {len(results)} features | {total_svgs} SVGs | {stale_count} stale"


def main():
    parser = argparse.ArgumentParser(
        description="Review Queue Dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="list",
                       help="Command (list, stale, with-issues, detail)")
    parser.add_argument("feature", nargs="?",
                       help="Feature number for detail command")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Handle summary flag
    if args.summary:
        results, _ = build_review_data()
        print(to_summary(results))
        return

    # Handle commands
    if args.command == "list":
        cmd_list(args)
    elif args.command == "stale":
        cmd_stale(args)
    elif args.command == "with-issues":
        cmd_with_issues(args)
    elif args.command == "detail":
        if not args.feature:
            print("Error: detail command requires feature number")
            print("Usage: review-queue.py detail <feature>")
            sys.exit(1)
        cmd_detail(args.feature, args)
    else:
        # Assume it's a feature number for detail
        cmd_detail(args.command, args)


if __name__ == "__main__":
    main()
