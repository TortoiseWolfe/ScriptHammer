#!/usr/bin/env python3
"""
Council Agenda - Generate council meeting agenda from pending items

Aggregates RFCs, memos, and issues into agenda format.
Usage: python3 scripts/council-agenda.py [command] [options]

Commands:
  generate                 Generate agenda (default)
  items                    List pending items only
  priorities               Show priority breakdown

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/council-agenda.py
  python3 scripts/council-agenda.py items --json
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
RFCS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "rfcs"
MEMOS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "memos"
AUDITS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "audits"


def get_voting_rfcs() -> list:
    """Get RFCs in voting state"""
    rfcs = []
    if not RFCS_DIR.exists():
        return rfcs

    for rfc_file in RFCS_DIR.glob("RFC-*.md"):
        content = rfc_file.read_text()
        status_match = re.search(r'\*\*Status\*\*:\s*(\w+)', content)
        if status_match and status_match.group(1).lower() == "voting":
            title_match = re.search(r'^# RFC-\d+:\s*(.+)$', content, re.MULTILINE)
            num_match = re.search(r'RFC-(\d+)', rfc_file.stem)

            rfcs.append({
                "type": "RFC",
                "number": num_match.group(1) if num_match else "?",
                "title": title_match.group(1).strip() if title_match else rfc_file.stem,
                "file": rfc_file.name,
                "priority": "high"
            })

    return rfcs


def get_urgent_memos() -> list:
    """Get urgent memos"""
    memos = []
    if not MEMOS_DIR.exists():
        return memos

    for memo_file in MEMOS_DIR.glob("to-*.md"):
        content = memo_file.read_text()

        # Find urgent memos
        pattern = r'## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) - From: ([^\n]+)\n\*\*Priority\*\*: urgent\n\*\*Re\*\*: ([^\n]+)'

        for match in re.finditer(pattern, content):
            memos.append({
                "type": "MEMO",
                "date": match.group(1),
                "from": match.group(2),
                "subject": match.group(3),
                "to": memo_file.stem.replace("to-", ""),
                "priority": "urgent"
            })

    return memos


def get_recent_audits() -> list:
    """Get audits from today"""
    audits = []
    if not AUDITS_DIR.exists():
        return audits

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for audit_file in AUDITS_DIR.glob(f"{today}*.md"):
        content = audit_file.read_text()

        # Extract author and scope
        author_match = re.search(r'\*\*Author\*\*:\s*(.+)$', content, re.MULTILINE)
        scope_match = re.search(r'\*\*Scope\*\*:\s*(.+)$', content, re.MULTILINE)

        audits.append({
            "type": "AUDIT",
            "file": audit_file.name,
            "author": author_match.group(1).strip() if author_match else "unknown",
            "scope": scope_match.group(1).strip() if scope_match else audit_file.stem,
            "priority": "normal"
        })

    return audits


def collect_agenda_items() -> dict:
    """Collect all agenda items"""
    items = {
        "rfcs": get_voting_rfcs(),
        "urgent_memos": get_urgent_memos(),
        "audits": get_recent_audits()
    }

    items["total"] = len(items["rfcs"]) + len(items["urgent_memos"]) + len(items["audits"])

    return items


def generate_agenda(items: dict) -> str:
    """Generate agenda markdown"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines = [
        f"# Council Agenda - {today}",
        "",
        f"**Generated**: {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
        f"**Items**: {items['total']}",
        "",
        "---",
        ""
    ]

    # RFCs requiring votes
    if items["rfcs"]:
        lines.extend([
            "## 1. RFCs Requiring Votes",
            ""
        ])
        for rfc in items["rfcs"]:
            lines.append(f"- [ ] RFC-{rfc['number']}: {rfc['title']}")
        lines.append("")

    # Urgent memos
    if items["urgent_memos"]:
        lines.extend([
            "## 2. Urgent Memos",
            ""
        ])
        for memo in items["urgent_memos"]:
            lines.append(f"- [ ] [{memo['to']}] From {memo['from']}: {memo['subject']}")
        lines.append("")

    # Today's audits
    if items["audits"]:
        lines.extend([
            "## 3. Today's Audits",
            ""
        ])
        for audit in items["audits"]:
            lines.append(f"- [ ] {audit['author']}: {audit['scope']}")
        lines.append("")

    # Standing items
    lines.extend([
        "## 4. Standing Items",
        "",
        "- [ ] Queue status review",
        "- [ ] Blocked terminals",
        "- [ ] Next sprint planning",
        "",
        "---",
        "",
        "*Generated by council-agenda.py*"
    ])

    return "\n".join(lines)


# Command handlers

def cmd_generate(args):
    """Generate full agenda"""
    items = collect_agenda_items()

    if args.json:
        print(json.dumps(items, indent=2))
        return

    agenda = generate_agenda(items)
    print(agenda)


def cmd_items(args):
    """List pending items"""
    items = collect_agenda_items()

    if args.json:
        all_items = items["rfcs"] + items["urgent_memos"] + items["audits"]
        print(json.dumps(all_items, indent=2))
        return

    print(f"Pending Items ({items['total']}):")
    print()

    if items["rfcs"]:
        print("RFCs:")
        for rfc in items["rfcs"]:
            print(f"  RFC-{rfc['number']}: {rfc['title']}")

    if items["urgent_memos"]:
        print("\nUrgent Memos:")
        for memo in items["urgent_memos"]:
            print(f"  [{memo['to']}] {memo['subject']}")

    if items["audits"]:
        print("\nToday's Audits:")
        for audit in items["audits"]:
            print(f"  {audit['author']}: {audit['scope']}")


def cmd_priorities(args):
    """Show priority breakdown"""
    items = collect_agenda_items()

    priorities = defaultdict(list)
    for rfc in items["rfcs"]:
        priorities["high"].append(f"RFC-{rfc['number']}")
    for memo in items["urgent_memos"]:
        priorities["urgent"].append(memo["subject"][:30])
    for audit in items["audits"]:
        priorities["normal"].append(audit["file"][:30])

    if args.json:
        print(json.dumps(dict(priorities), indent=2))
        return

    print("Priority Breakdown:")
    for priority in ["urgent", "high", "normal"]:
        if priorities[priority]:
            print(f"\n{priority.upper()}:")
            for item in priorities[priority]:
                print(f"  - {item}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    items = collect_agenda_items()
    return f"Agenda: {items['total']} items | {len(items['rfcs'])} RFCs | {len(items['urgent_memos'])} urgent"


def main():
    parser = argparse.ArgumentParser(
        description="Council Agenda Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="generate",
                       choices=["generate", "items", "priorities"],
                       help="Command")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "generate":
        cmd_generate(args)
    elif args.command == "items":
        cmd_items(args)
    elif args.command == "priorities":
        cmd_priorities(args)


if __name__ == "__main__":
    main()
