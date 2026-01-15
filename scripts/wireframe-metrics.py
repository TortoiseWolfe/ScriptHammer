#!/usr/bin/env python3
"""
Wireframe Metrics - Statistics and health metrics for wireframe pipeline

Provides deterministic metrics without AI parsing.
Usage: python3 scripts/wireframe-metrics.py [command] [options]

Commands:
  overview                 Full metrics dashboard (default)
  by-feature               Breakdown by feature
  by-status                Breakdown by status
  issues                   Issue file summary
  coverage                 Feature coverage report

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/wireframe-metrics.py
  python3 scripts/wireframe-metrics.py by-feature
  python3 scripts/wireframe-metrics.py issues --json
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
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
FEATURES_DIR = PROJECT_ROOT / "features"
STATUS_FILE = WIREFRAMES_DIR / ".terminal-status.json"


def load_status() -> dict:
    """Load terminal status"""
    if not STATUS_FILE.exists():
        return {"queue": [], "completedToday": [], "wireframeStatus": "unknown"}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def get_all_features() -> list:
    """Get all feature directories"""
    features = []
    for category in FEATURES_DIR.iterdir():
        if not category.is_dir():
            continue
        for feature_dir in category.iterdir():
            if feature_dir.is_dir() and feature_dir.name[0].isdigit():
                features.append(feature_dir.name.split('-')[0].zfill(3))
    return sorted(set(features))


def get_wireframe_dirs() -> list:
    """Get all wireframe directories"""
    dirs = []
    for d in WIREFRAMES_DIR.iterdir():
        if d.is_dir() and not d.name.startswith(('.', 'includes', 'templates', 'png', 'node_modules')):
            dirs.append(d)
    return sorted(dirs)


def analyze_feature(feature_dir: Path) -> dict:
    """Analyze a single feature's wireframes"""
    svgs = list(feature_dir.glob("*.svg"))
    issues = list(feature_dir.glob("*.issues.md"))

    # Get file ages
    svg_ages = []
    for svg in svgs:
        mtime = datetime.fromtimestamp(svg.stat().st_mtime, tz=timezone.utc)
        age = datetime.now(timezone.utc) - mtime
        svg_ages.append(age)

    newest_age = min(svg_ages) if svg_ages else None
    oldest_age = max(svg_ages) if svg_ages else None

    return {
        "feature": feature_dir.name,
        "svg_count": len(svgs),
        "svgs": [s.name for s in svgs],
        "issue_count": len(issues),
        "issues": [i.name for i in issues],
        "has_issues": len(issues) > 0,
        "newest_age_hours": newest_age.total_seconds() / 3600 if newest_age else None,
        "oldest_age_hours": oldest_age.total_seconds() / 3600 if oldest_age else None,
        "is_stale": oldest_age and oldest_age > timedelta(days=7) if oldest_age else False
    }


def get_overview_metrics() -> dict:
    """Get overview metrics"""
    dirs = get_wireframe_dirs()
    all_features = get_all_features()
    status = load_status()

    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_features": len(all_features),
        "features_with_wireframes": len(dirs),
        "total_svgs": 0,
        "total_issues": 0,
        "features_with_issues": 0,
        "stale_features": 0,
        "coverage_percent": 0,
        "queue_depth": len(status.get("queue", [])),
        "completed_today": len(status.get("completedToday", [])),
        "wireframe_status": status.get("wireframeStatus", "unknown")
    }

    for d in dirs:
        analysis = analyze_feature(d)
        metrics["total_svgs"] += analysis["svg_count"]
        metrics["total_issues"] += analysis["issue_count"]
        if analysis["has_issues"]:
            metrics["features_with_issues"] += 1
        if analysis["is_stale"]:
            metrics["stale_features"] += 1

    if metrics["total_features"] > 0:
        metrics["coverage_percent"] = round(
            metrics["features_with_wireframes"] / metrics["total_features"] * 100, 1
        )

    return metrics


def get_by_feature() -> list:
    """Get metrics broken down by feature"""
    dirs = get_wireframe_dirs()
    return [analyze_feature(d) for d in dirs]


def get_by_status() -> dict:
    """Get metrics grouped by status"""
    status = load_status()
    queue = status.get("queue", [])

    by_action = defaultdict(list)
    for item in queue:
        action = item.get("action", "UNKNOWN")
        by_action[action].append({
            "feature": item.get("feature"),
            "svg": item.get("svg"),
            "assignedTo": item.get("assignedTo")
        })

    return dict(by_action)


def get_issue_summary() -> dict:
    """Get summary of issue files"""
    dirs = get_wireframe_dirs()
    issues = {
        "total_files": 0,
        "by_feature": {},
        "issue_types": defaultdict(int)
    }

    for d in dirs:
        issue_files = list(d.glob("*.issues.md"))
        if issue_files:
            feature_issues = []
            for issue_file in issue_files:
                content = issue_file.read_text()
                # Count issue types
                if "REGEN" in content or "REGENERATE" in content:
                    issues["issue_types"]["REGEN"] += 1
                if "PATCH" in content:
                    issues["issue_types"]["PATCH"] += 1
                if "PASS" in content:
                    issues["issue_types"]["PASS"] += 1

                feature_issues.append(issue_file.name)
                issues["total_files"] += 1

            issues["by_feature"][d.name] = feature_issues

    issues["issue_types"] = dict(issues["issue_types"])
    return issues


def get_coverage() -> dict:
    """Get feature coverage report"""
    all_features = get_all_features()
    dirs = get_wireframe_dirs()
    wireframe_features = {d.name.split('-')[0].zfill(3) for d in dirs}

    covered = []
    missing = []

    for f in all_features:
        if f in wireframe_features:
            covered.append(f)
        else:
            missing.append(f)

    return {
        "total": len(all_features),
        "covered": len(covered),
        "missing": len(missing),
        "coverage_percent": round(len(covered) / len(all_features) * 100, 1) if all_features else 0,
        "covered_features": covered,
        "missing_features": missing
    }


# Command handlers

def cmd_overview(args):
    """Show overview dashboard"""
    metrics = get_overview_metrics()

    if args.json:
        print(json.dumps(metrics, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| WIREFRAME METRICS" + " " * 60 + "|")
    print("+" + "-" * 78 + "+")
    print(f"| Total Features: {metrics['total_features']:<60} |")
    print(f"| Features with Wireframes: {metrics['features_with_wireframes']:<46} |")
    print(f"| Coverage: {metrics['coverage_percent']}%{' ' * 63}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Total SVGs: {metrics['total_svgs']:<64} |")
    print(f"| Total Issue Files: {metrics['total_issues']:<56} |")
    print(f"| Features with Issues: {metrics['features_with_issues']:<53} |")
    print(f"| Stale Features (>7d): {metrics['stale_features']:<53} |")
    print("+" + "-" * 78 + "+")
    print(f"| Queue Depth: {metrics['queue_depth']:<63} |")
    print(f"| Completed Today: {metrics['completed_today']:<58} |")
    print(f"| Status: {metrics['wireframe_status']:<67} |")
    print("+" + "=" * 78 + "+")


def cmd_by_feature(args):
    """Show breakdown by feature"""
    features = get_by_feature()

    if args.json:
        print(json.dumps(features, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| BY FEATURE" + " " * 67 + "|")
    print("+" + "-" * 78 + "+")
    print("| Feature                          | SVGs | Issues | Age (h) | Status   |")
    print("+" + "-" * 78 + "+")

    for f in features:
        name = f["feature"][:32].ljust(32)
        age = f"{f['newest_age_hours']:.0f}" if f["newest_age_hours"] else "-"
        age = age[:7].ljust(7)
        status = "STALE" if f["is_stale"] else ("ISSUES" if f["has_issues"] else "OK")
        print(f"| {name} | {f['svg_count']:4} | {f['issue_count']:6} | {age} | {status:<8} |")

    print("+" + "=" * 78 + "+")


def cmd_by_status(args):
    """Show breakdown by status"""
    by_status = get_by_status()

    if args.json:
        print(json.dumps(by_status, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| BY STATUS" + " " * 68 + "|")
    print("+" + "-" * 78 + "+")

    for status, items in by_status.items():
        print(f"| {status}: {len(items)} items{' ' * 60}|"[:80])
        for item in items[:5]:
            feature = item.get("feature", "?")[:30]
            assigned = item.get("assignedTo") or "unassigned"
            print(f"|   - {feature} -> {assigned}{' ' * 40}|"[:80])
        if len(items) > 5:
            print(f"|   ... and {len(items) - 5} more{' ' * 55}|"[:80])
        print("+" + "-" * 78 + "+")


def cmd_issues(args):
    """Show issue summary"""
    issues = get_issue_summary()

    if args.json:
        print(json.dumps(issues, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| ISSUE FILES ({issues['total_files']} total){' ' * 52}|"[:80])
    print("+" + "-" * 78 + "+")

    print("| Issue Types:" + " " * 65 + "|")
    for itype, count in issues["issue_types"].items():
        print(f"|   {itype}: {count}{' ' * 65}|"[:80])

    print("+" + "-" * 78 + "+")

    print("| By Feature:" + " " * 66 + "|")
    for feature, files in list(issues["by_feature"].items())[:10]:
        print(f"|   {feature[:30]}: {len(files)} files{' ' * 35}|"[:80])

    print("+" + "=" * 78 + "+")


def cmd_coverage(args):
    """Show coverage report"""
    coverage = get_coverage()

    if args.json:
        print(json.dumps(coverage, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| COVERAGE REPORT ({coverage['coverage_percent']}%){' ' * 54}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Covered: {coverage['covered']}/{coverage['total']}{' ' * 62}|"[:80])
    print(f"| Missing: {coverage['missing']}{' ' * 66}|"[:80])
    print("+" + "-" * 78 + "+")

    if coverage["missing_features"]:
        print("| Missing Features:" + " " * 60 + "|")
        for i in range(0, len(coverage["missing_features"]), 10):
            chunk = coverage["missing_features"][i:i+10]
            print(f"|   {', '.join(chunk):<72} |")

    print("+" + "=" * 78 + "+")


def to_summary(args) -> str:
    """Generate one-line summary"""
    metrics = get_overview_metrics()
    status = "OK" if metrics["features_with_issues"] == 0 else "ISSUES"
    return f"Wireframes: {status} | {metrics['total_svgs']} SVGs | {metrics['coverage_percent']}% coverage | {metrics['queue_depth']} queued"


def main():
    parser = argparse.ArgumentParser(
        description="Wireframe Metrics",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="overview",
                       choices=["overview", "by-feature", "by-status", "issues", "coverage"],
                       help="Command")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "overview":
        cmd_overview(args)
    elif args.command == "by-feature":
        cmd_by_feature(args)
    elif args.command == "by-status":
        cmd_by_status(args)
    elif args.command == "issues":
        cmd_issues(args)
    elif args.command == "coverage":
        cmd_coverage(args)


if __name__ == "__main__":
    main()
