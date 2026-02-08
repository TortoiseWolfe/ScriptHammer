#!/usr/bin/env python3
"""
Project Status - CLI dashboard for ScriptHammer project health

Replaces prompt-based /status skill to reduce token usage.
Usage: python3 scripts/project-status.py [command] [options]

Commands:
  dashboard                Full project dashboard (default)
  terminals                Terminal status grid only
  queue                    Queue status only
  rfcs                     RFC voting status only
  today                    Today's activity only
  wireframes               Wireframe metrics only

Options:
  --json                   Output as JSON (machine-readable)
  --summary                One-line summary for CI

Examples:
  python3 scripts/project-status.py
  python3 scripts/project-status.py --json
  python3 scripts/project-status.py terminals
  python3 scripts/project-status.py rfcs --json
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Find project root (parent of scripts/)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
STATUS_FILE = WIREFRAMES_DIR / ".terminal-status.json"
RFCS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "rfcs"
DECISIONS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "decisions"
FEATURES_DIR = PROJECT_ROOT / "features"

# Terminal groups
COUNCIL = ["cto", "architect", "security-lead", "toolsmith", "devops", "product-owner"]
GENERATORS = ["generator-1", "generator-2", "generator-3"]
PIPELINE = ["planner", "preview-host", "wireframe-qa", "validator", "inspector"]
SUPPORT = ["coordinator", "author", "qa-lead", "tech-writer"]
IMPLEMENTATION = ["developer", "test-engineer", "auditor"]


def load_status():
    """Load .terminal-status.json"""
    if not STATUS_FILE.exists():
        return {"terminals": {}, "queue": [], "completedToday": [], "lastUpdated": None}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def count_svgs():
    """Count SVG files per feature"""
    svg_counts = {}
    total = 0

    if not WIREFRAMES_DIR.exists():
        return svg_counts, total, 0

    for feature_dir in WIREFRAMES_DIR.iterdir():
        if feature_dir.is_dir() and not feature_dir.name.startswith(('.', 'includes', 'templates', 'png', 'node_modules')):
            svgs = list(feature_dir.glob("*.svg"))
            if svgs:
                svg_counts[feature_dir.name] = len(svgs)
                total += len(svgs)

    return svg_counts, total, len(svg_counts)


def parse_rfcs():
    """Parse RFC files for status and votes"""
    rfcs = []

    if not RFCS_DIR.exists():
        return rfcs

    for rfc_file in sorted(RFCS_DIR.glob("RFC-*.md")):
        # Extract number from filename like "RFC-005-p0-implementation-approval.md"
        number_match = re.search(r'RFC-(\d+)', rfc_file.stem)
        rfc_data = {
            "number": number_match.group(1) if number_match else "?",
            "file": rfc_file.name,
            "title": "",
            "status": "unknown",
            "votes": {"approve": 0, "reject": 0, "abstain": 0, "pending": 0},
            "author": ""
        }

        try:
            content = rfc_file.read_text()

            # Extract title
            title_match = re.search(r'^# RFC-\d+:\s*(.+)$', content, re.MULTILINE)
            if title_match:
                rfc_data["title"] = title_match.group(1).strip()

            # Extract status
            status_match = re.search(r'\*\*Status\*\*:\s*(\w+)', content)
            if status_match:
                rfc_data["status"] = status_match.group(1).lower()

            # Extract author
            author_match = re.search(r'\*\*Author\*\*:\s*(.+)$', content, re.MULTILINE)
            if author_match:
                rfc_data["author"] = author_match.group(1).strip()

            # Count votes from stakeholder table
            vote_pattern = r'\|\s*\w+[^|]*\|\s*\*?\*?(\w+)\*?\*?\s*\|'
            for match in re.finditer(vote_pattern, content):
                vote = match.group(1).lower()
                if vote in ["approve", "approved"]:
                    rfc_data["votes"]["approve"] += 1
                elif vote in ["reject", "rejected"]:
                    rfc_data["votes"]["reject"] += 1
                elif vote == "abstain":
                    rfc_data["votes"]["abstain"] += 1
                elif vote == "pending":
                    rfc_data["votes"]["pending"] += 1

            rfcs.append(rfc_data)
        except Exception as e:
            print(f"Warning: Error parsing {rfc_file}: {e}", file=sys.stderr)

    return rfcs


def count_decisions():
    """Count decision files"""
    if not DECISIONS_DIR.exists():
        return 0
    return len(list(DECISIONS_DIR.glob("DEC-*.md")))


def get_terminal_counts(data):
    """Count terminals by status"""
    counts = {"active": 0, "idle": 0, "blocked": 0}

    for terminal, info in data.get("terminals", {}).items():
        status = info.get("status", "idle").lower()
        if status == "idle":
            counts["idle"] += 1
        elif status == "blocked":
            counts["blocked"] += 1
        else:
            counts["active"] += 1

    return counts


def format_terminal_grid(data):
    """Format terminal status as ASCII grid"""
    lines = []

    def format_group(name, terminals):
        group_lines = [f"  {name}"]
        row = "  "
        for i, t in enumerate(terminals):
            info = data.get("terminals", {}).get(t, {})
            status = info.get("status", "idle")[:8]
            row += f"{t}: {status}".ljust(20)
            if (i + 1) % 3 == 0:
                group_lines.append(row)
                row = "  "
        if row.strip():
            group_lines.append(row)
        return group_lines

    lines.extend(format_group("COUNCIL", COUNCIL))
    lines.append("")
    lines.extend(format_group("GENERATORS", GENERATORS))
    lines.append("")
    lines.extend(format_group("PIPELINE", PIPELINE))
    lines.append("")
    lines.extend(format_group("IMPLEMENTATION", IMPLEMENTATION))

    return lines


def format_queue(data):
    """Format queue as list"""
    lines = []
    queue = data.get("queue", [])

    if not queue:
        lines.append("  (empty)")
        return lines

    for i, item in enumerate(queue[:10], 1):  # Show first 10
        feature = item.get("feature", "?")
        action = item.get("action", "?")
        assigned = item.get("assignedTo") or "unassigned"
        lines.append(f"  {i}. {feature} -> {assigned} ({action})")

    if len(queue) > 10:
        lines.append(f"  ... and {len(queue) - 10} more")

    return lines


def format_rfcs(rfcs):
    """Format RFC status"""
    lines = []

    voting = [r for r in rfcs if r["status"] == "voting"]
    decided = [r for r in rfcs if r["status"] == "decided"]

    if voting:
        lines.append("  VOTING:")
        for r in voting:
            v = r["votes"]
            lines.append(f"    RFC-{r['number']}: {r['title'][:40]}")
            lines.append(f"      Votes: {v['approve']} approve, {v['reject']} reject, {v['pending']} pending")

    if decided:
        lines.append("  DECIDED:")
        for r in decided[-3:]:  # Last 3
            lines.append(f"    RFC-{r['number']}: {r['title'][:40]}")

    if not voting and not decided:
        lines.append("  (no RFCs)")

    return lines


def dashboard(data, svg_counts, svg_total, feature_count, rfcs):
    """Generate full ASCII dashboard"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    term_counts = get_terminal_counts(data)
    queue_len = len(data.get("queue", []))
    completed_today = len(data.get("completedToday", []))
    voting_rfcs = len([r for r in rfcs if r["status"] == "voting"])

    lines = [
        "+" + "=" * 78 + "+",
        f"| PROJECT STATUS{' ' * 47}{now[:19]} |",
        "+" + "=" * 78 + "+",
        "| WIREFRAMES" + " " * 67 + "|",
        f"|   Features with SVGs: {feature_count}/46{' ' * 52}|"[:80],
        f"|   Total SVGs: {svg_total}{' ' * 62}|"[:80],
        "+" + "-" * 78 + "+",
        "| TERMINALS" + " " * 68 + "|",
    ]

    for line in format_terminal_grid(data):
        lines.append(f"| {line:<76} |")

    lines.append(f"|   Active: {term_counts['active']}  |  Idle: {term_counts['idle']}  |  Blocked: {term_counts['blocked']}{' ' * 40}|"[:80])
    lines.append("+" + "-" * 78 + "+")
    lines.append(f"| QUEUE ({queue_len} items){' ' * 60}|"[:80])

    for line in format_queue(data):
        lines.append(f"| {line:<76} |")

    lines.append("+" + "-" * 78 + "+")
    lines.append(f"| RFCs (voting: {voting_rfcs}){' ' * 58}|"[:80])

    for line in format_rfcs(rfcs):
        lines.append(f"| {line:<76} |")

    lines.append("+" + "-" * 78 + "+")
    lines.append(f"| TODAY'S ACTIVITY: {completed_today} completions{' ' * 43}|"[:80])

    completed = data.get("completedToday", [])
    for item in completed[-3:]:  # Last 3
        lines.append(f"|   - {item[:70]:<71} |")

    lines.append("+" + "=" * 78 + "+")

    return "\n".join(lines)


def to_json(data, svg_counts, svg_total, feature_count, rfcs):
    """Generate JSON output"""
    term_counts = get_terminal_counts(data)

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "wireframes": {
            "features_with_svgs": feature_count,
            "total_features": 46,
            "total_svgs": svg_total,
            "by_feature": svg_counts
        },
        "terminals": {
            "active": term_counts["active"],
            "idle": term_counts["idle"],
            "blocked": term_counts["blocked"],
            "details": data.get("terminals", {})
        },
        "queue": {
            "count": len(data.get("queue", [])),
            "items": data.get("queue", [])
        },
        "rfcs": {
            "voting": [r for r in rfcs if r["status"] == "voting"],
            "decided": [r for r in rfcs if r["status"] == "decided"],
            "total": len(rfcs)
        },
        "today": {
            "completions": len(data.get("completedToday", [])),
            "items": data.get("completedToday", [])
        }
    }

    return json.dumps(result, indent=2)


def to_summary(data, svg_counts, svg_total, feature_count, rfcs):
    """Generate one-line summary"""
    term_counts = get_terminal_counts(data)
    queue_len = len(data.get("queue", []))
    voting_rfcs = len([r for r in rfcs if r["status"] == "voting"])

    status = "OK"
    if queue_len > 10:
        status = "BUSY"
    if term_counts["blocked"] > 0:
        status = "BLOCKED"

    return f"Status: {status} | SVGs: {svg_total} | Queue: {queue_len} | Active: {term_counts['active']} | RFCs voting: {voting_rfcs}"


def cmd_terminals(data, args):
    """Terminal status only"""
    if args.json:
        print(json.dumps(data.get("terminals", {}), indent=2))
    else:
        print("TERMINAL STATUS")
        print("=" * 60)
        for line in format_terminal_grid(data):
            print(line)
        counts = get_terminal_counts(data)
        print(f"\nActive: {counts['active']} | Idle: {counts['idle']} | Blocked: {counts['blocked']}")


def cmd_queue(data, args):
    """Queue status only"""
    if args.json:
        print(json.dumps(data.get("queue", []), indent=2))
    else:
        queue = data.get("queue", [])
        print(f"QUEUE ({len(queue)} items)")
        print("=" * 60)
        for line in format_queue(data):
            print(line)


def cmd_rfcs(rfcs, args):
    """RFC status only"""
    if args.json:
        print(json.dumps(rfcs, indent=2))
    else:
        print("RFC STATUS")
        print("=" * 60)
        for line in format_rfcs(rfcs):
            print(line)


def cmd_today(data, args):
    """Today's activity only"""
    completed = data.get("completedToday", [])
    if args.json:
        print(json.dumps({"count": len(completed), "items": completed}, indent=2))
    else:
        print(f"TODAY'S ACTIVITY ({len(completed)} completions)")
        print("=" * 60)
        for item in completed:
            print(f"  - {item}")


def cmd_wireframes(svg_counts, svg_total, feature_count, args):
    """Wireframe metrics only"""
    if args.json:
        print(json.dumps({
            "total_svgs": svg_total,
            "features_with_svgs": feature_count,
            "total_features": 46,
            "by_feature": svg_counts
        }, indent=2))
    else:
        print("WIREFRAME METRICS")
        print("=" * 60)
        print(f"  Total SVGs: {svg_total}")
        print(f"  Features with SVGs: {feature_count}/46")
        print()
        for feature, count in sorted(svg_counts.items()):
            print(f"  {feature}: {count} SVGs")


def main():
    parser = argparse.ArgumentParser(
        description="Project Status Dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="dashboard",
                       choices=["dashboard", "terminals", "queue", "rfcs", "today", "wireframes"],
                       help="Status view (default: dashboard)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Load data
    data = load_status()
    svg_counts, svg_total, feature_count = count_svgs()
    rfcs = parse_rfcs()

    # Handle summary flag (overrides command)
    if args.summary:
        print(to_summary(data, svg_counts, svg_total, feature_count, rfcs))
        return

    # Handle commands
    if args.command == "dashboard":
        if args.json:
            print(to_json(data, svg_counts, svg_total, feature_count, rfcs))
        else:
            print(dashboard(data, svg_counts, svg_total, feature_count, rfcs))
    elif args.command == "terminals":
        cmd_terminals(data, args)
    elif args.command == "queue":
        cmd_queue(data, args)
    elif args.command == "rfcs":
        cmd_rfcs(rfcs, args)
    elif args.command == "today":
        cmd_today(data, args)
    elif args.command == "wireframes":
        cmd_wireframes(svg_counts, svg_total, feature_count, args)


if __name__ == "__main__":
    main()
