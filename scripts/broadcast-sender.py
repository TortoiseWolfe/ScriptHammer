#!/usr/bin/env python3
"""
Broadcast Sender - Send announcements to all terminals

Automates broadcast creation for council announcements.
Usage: python3 scripts/broadcast-sender.py [command] [options]

Commands:
  send <title>             Create broadcast announcement
  list                     List recent broadcasts
  templates                Show available templates

Options:
  --from <terminal>        Sender (council member)
  --template <name>        Use template (decision, rfc, urgent)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/broadcast-sender.py send "RFC-006 Approved"
  python3 scripts/broadcast-sender.py send "System Update" --template urgent
  python3 scripts/broadcast-sender.py list --json
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Broadcast directory
BROADCAST_DIR = PROJECT_ROOT / "docs" / "interoffice" / "broadcast"
BROADCAST_FILE = BROADCAST_DIR / "announcements.md"

# Templates
TEMPLATES = {
    "decision": {
        "format": """## {title}

**Decision**: DEC-{num} has been approved
**Date**: {date}
**Author**: {author}

{body}

**Affected Terminals**: All
**Action Required**: Review decision and update workflows as needed
""",
        "required": ["num", "body"]
    },
    "rfc": {
        "format": """## {title}

**RFC**: RFC-{num} is now in voting state
**Date**: {date}
**Author**: {author}

{body}

**Council Members**: Please vote using `/rfc-vote {num} <vote>`
**Deadline**: {deadline}
""",
        "required": ["num", "body", "deadline"]
    },
    "urgent": {
        "format": """## 🚨 URGENT: {title}

**Date**: {date}
**From**: {author}

{body}

**Immediate Action Required**: {action}
**Contact**: {author} for questions
""",
        "required": ["body", "action"]
    },
    "update": {
        "format": """## {title}

**Date**: {date}
**From**: {author}

{body}

**No action required** - informational only.
""",
        "required": ["body"]
    }
}


def create_broadcast(title: str, author: str, template: str = None, **kwargs) -> str:
    """Create broadcast content"""
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if template and template in TEMPLATES:
        tmpl = TEMPLATES[template]
        content = tmpl["format"].format(
            title=title,
            date=date,
            author=author,
            **kwargs
        )
    else:
        content = f"""## {title}

**Date**: {date}
**From**: {author}

{kwargs.get('body', '[Announcement body]')}

---
"""
    return content


def append_broadcast(content: str) -> bool:
    """Append broadcast to announcements file"""
    BROADCAST_DIR.mkdir(parents=True, exist_ok=True)

    if not BROADCAST_FILE.exists():
        header = """# Broadcast Announcements

<!-- Newest first. All terminals should check on /prime -->

"""
        BROADCAST_FILE.write_text(header + content + "\n")
    else:
        existing = BROADCAST_FILE.read_text()
        # Insert after header
        insert_pos = existing.find("<!-- Newest first")
        if insert_pos != -1:
            insert_pos = existing.find("-->", insert_pos) + 3
            new_content = existing[:insert_pos] + "\n\n" + content + existing[insert_pos:]
        else:
            new_content = existing + "\n\n" + content
        BROADCAST_FILE.write_text(new_content)

    return True


def get_recent_broadcasts(limit: int = 10) -> list:
    """Get recent broadcasts"""
    if not BROADCAST_FILE.exists():
        return []

    content = BROADCAST_FILE.read_text()
    broadcasts = []

    # Parse broadcasts (## Title followed by content)
    pattern = r'^## ([^\n]+)\n\n\*\*Date\*\*: ([^\n]+)\n\*\*From\*\*: ([^\n]+)'

    for match in re.finditer(pattern, content, re.MULTILINE):
        broadcasts.append({
            "title": match.group(1),
            "date": match.group(2),
            "from": match.group(3)
        })

    return broadcasts[:limit]


# Command handlers

def cmd_send(title: str, args):
    """Send broadcast"""
    author = args.sender or "Council"
    template = args.template

    # Gather template-specific data
    kwargs = {"body": args.body or "[Announcement body - please edit]"}

    if template == "decision":
        kwargs["num"] = args.num or "XXX"
    elif template == "rfc":
        kwargs["num"] = args.num or "XXX"
        kwargs["deadline"] = args.deadline or "TBD"
    elif template == "urgent":
        kwargs["action"] = args.action or "[Specify required action]"

    content = create_broadcast(title, author, template, **kwargs)

    if args.json:
        output = {
            "title": title,
            "author": author,
            "template": template,
            "content": content
        }
        print(json.dumps(output, indent=2))
        return

    if append_broadcast(content):
        print(f"Broadcast sent: {title}")
        print(f"From: {author}")
        if template:
            print(f"Template: {template}")
    else:
        print("Error: Failed to send broadcast", file=sys.stderr)
        sys.exit(1)


def cmd_list(args):
    """List recent broadcasts"""
    broadcasts = get_recent_broadcasts()

    if args.json:
        print(json.dumps(broadcasts, indent=2))
        return

    print(f"Recent Broadcasts ({len(broadcasts)}):")
    if not broadcasts:
        print("  None")
    else:
        for b in broadcasts:
            print(f"  [{b['date'][:10]}] {b['title'][:50]} (from {b['from']})")


def cmd_templates(args):
    """Show available templates"""
    if args.json:
        output = {name: {"required": t["required"]} for name, t in TEMPLATES.items()}
        print(json.dumps(output, indent=2))
        return

    print("Available Templates:")
    for name, tmpl in TEMPLATES.items():
        required = ", ".join(tmpl["required"])
        print(f"  {name}: requires {required}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    broadcasts = get_recent_broadcasts()
    return f"Broadcasts: {len(broadcasts)} recent announcements"


def main():
    parser = argparse.ArgumentParser(
        description="Broadcast Sender",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="list",
                       help="Command (send, list, templates)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--from", dest="sender", type=str, help="Sender")
    parser.add_argument("--template", type=str, choices=list(TEMPLATES.keys()),
                       help="Use template")
    parser.add_argument("--body", type=str, help="Announcement body")
    parser.add_argument("--num", type=str, help="RFC/DEC number")
    parser.add_argument("--deadline", type=str, help="Deadline (for RFC)")
    parser.add_argument("--action", type=str, help="Required action (for urgent)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "send":
        if not args.args:
            print("Error: send requires title", file=sys.stderr)
            sys.exit(1)
        cmd_send(" ".join(args.args), args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "templates":
        cmd_templates(args)
    else:
        # Assume it's a title for send
        cmd_send(args.command + " " + " ".join(args.args), args)


if __name__ == "__main__":
    main()
