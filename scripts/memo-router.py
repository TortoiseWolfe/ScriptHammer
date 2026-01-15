#!/usr/bin/env python3
"""
Memo Router - Route and manage interoffice memos

Automates memo routing based on topic keywords.
Usage: python3 scripts/memo-router.py [command] [options]

Commands:
  route <topic>            Suggest best recipient for topic
  send <to> <subject>      Create memo entry
  list <recipient>         List memos for recipient
  unread                   Show unread memos

Options:
  --from <terminal>        Sender terminal
  --priority <level>       Priority (normal, urgent, fyi)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/memo-router.py route "CI pipeline failing"
  python3 scripts/memo-router.py send architect "Dependency issue"
  python3 scripts/memo-router.py list cto --json
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

# Memo directories
MEMOS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "memos"

# Routing rules
ROUTING_RULES = {
    "cto": {
        "keywords": ["strategic", "priority", "risk", "timeline", "resource", "budget", "leadership"],
        "file": "to-cto.md"
    },
    "architect": {
        "keywords": ["architecture", "pattern", "dependency", "design", "system", "integration", "structure"],
        "file": "to-architect.md"
    },
    "security-lead": {
        "keywords": ["security", "auth", "owasp", "secrets", "vulnerability", "compliance", "encryption"],
        "file": "to-security-lead.md"
    },
    "toolsmith": {
        "keywords": ["skill", "script", "command", "automation", "tool", "cli", "prompt"],
        "file": "to-toolsmith.md"
    },
    "devops": {
        "keywords": ["ci", "cd", "docker", "deployment", "workflow", "github", "pipeline", "build"],
        "file": "to-devops.md"
    },
    "coordinator": {
        "keywords": ["queue", "dispatch", "terminal", "assign", "coordinate", "workflow"],
        "file": "to-coordinator.md"
    }
}


def route_topic(topic: str) -> dict:
    """Determine best recipient for a topic"""
    topic_lower = topic.lower()

    scores = {}
    for recipient, rules in ROUTING_RULES.items():
        score = sum(1 for kw in rules["keywords"] if kw in topic_lower)
        if score > 0:
            scores[recipient] = score

    if not scores:
        return {"recipient": "coordinator", "confidence": "low", "reason": "No keyword match, defaulting to coordinator"}

    best = max(scores, key=scores.get)
    confidence = "high" if scores[best] >= 2 else "medium"

    return {
        "recipient": best,
        "confidence": confidence,
        "score": scores[best],
        "matched_keywords": [kw for kw in ROUTING_RULES[best]["keywords"] if kw in topic_lower],
        "alternatives": {r: s for r, s in scores.items() if r != best}
    }


def create_memo(to: str, subject: str, sender: str, priority: str, body: str = None) -> str:
    """Create memo content"""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    memo = f"""
---

## {timestamp} - From: {sender}
**Priority**: {priority}
**Re**: {subject}

{body or "[Message body here]"}

**Action Requested**: [None / Specify action]
"""
    return memo.strip()


def append_memo(recipient: str, memo_content: str) -> bool:
    """Append memo to recipient's file"""
    if recipient not in ROUTING_RULES:
        return False

    memo_file = MEMOS_DIR / ROUTING_RULES[recipient]["file"]

    if not memo_file.exists():
        # Create file with header
        header = f"""# Memos to {recipient.title()}

<!-- Newest first. Check on /prime -->

"""
        memo_file.parent.mkdir(parents=True, exist_ok=True)
        memo_file.write_text(header + memo_content + "\n")
    else:
        # Insert after header comment
        content = memo_file.read_text()
        insert_pos = content.find("<!-- Newest first")
        if insert_pos != -1:
            insert_pos = content.find("-->", insert_pos) + 3
            new_content = content[:insert_pos] + "\n" + memo_content + "\n" + content[insert_pos:]
        else:
            new_content = content + "\n" + memo_content + "\n"
        memo_file.write_text(new_content)

    return True


def get_memos(recipient: str) -> list:
    """Get memos for a recipient"""
    if recipient not in ROUTING_RULES:
        return []

    memo_file = MEMOS_DIR / ROUTING_RULES[recipient]["file"]
    if not memo_file.exists():
        return []

    content = memo_file.read_text()
    memos = []

    # Parse memo entries
    memo_pattern = r'## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) - From: ([^\n]+)\n\*\*Priority\*\*: (\w+)\n\*\*Re\*\*: ([^\n]+)'

    for match in re.finditer(memo_pattern, content):
        memos.append({
            "timestamp": match.group(1),
            "from": match.group(2),
            "priority": match.group(3),
            "subject": match.group(4)
        })

    return memos


def get_unread_count() -> dict:
    """Get unread memo counts per recipient"""
    counts = {}
    for recipient, rules in ROUTING_RULES.items():
        memo_file = MEMOS_DIR / rules["file"]
        if memo_file.exists():
            content = memo_file.read_text()
            # Count memo entries
            count = len(re.findall(r'^## \d{4}-\d{2}-\d{2}', content, re.MULTILINE))
            if count > 0:
                counts[recipient] = count
    return counts


# Command handlers

def cmd_route(topic: str, args):
    """Suggest recipient for topic"""
    result = route_topic(topic)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print(f"Topic: {topic}")
    print(f"Recommended: {result['recipient']} (confidence: {result['confidence']})")

    if result.get("matched_keywords"):
        print(f"Matched keywords: {', '.join(result['matched_keywords'])}")

    if result.get("alternatives"):
        print(f"Alternatives: {result['alternatives']}")


def cmd_send(to: str, subject: str, args):
    """Send a memo"""
    if to not in ROUTING_RULES:
        print(f"Error: Invalid recipient '{to}'", file=sys.stderr)
        print(f"Valid recipients: {', '.join(ROUTING_RULES.keys())}", file=sys.stderr)
        sys.exit(1)

    sender = args.sender or "unknown"
    priority = args.priority or "normal"

    memo_content = create_memo(to, subject, sender, priority)

    if args.json:
        output = {
            "to": to,
            "subject": subject,
            "from": sender,
            "priority": priority,
            "content": memo_content
        }
        print(json.dumps(output, indent=2))
        return

    # Actually append the memo
    if append_memo(to, memo_content):
        print(f"Memo sent to {to}")
        print(f"Subject: {subject}")
        print(f"From: {sender}")
        print(f"Priority: {priority}")
    else:
        print(f"Error: Failed to send memo", file=sys.stderr)
        sys.exit(1)


def cmd_list(recipient: str, args):
    """List memos for recipient"""
    memos = get_memos(recipient)

    if args.json:
        print(json.dumps(memos, indent=2))
        return

    print(f"Memos for {recipient} ({len(memos)}):")
    if not memos:
        print("  None")
    else:
        for m in memos[:10]:
            prio_mark = "!" if m["priority"] == "urgent" else " "
            print(f"  {prio_mark}[{m['timestamp']}] From {m['from']}: {m['subject']}")


def cmd_unread(args):
    """Show unread memo counts"""
    counts = get_unread_count()

    if args.json:
        print(json.dumps(counts, indent=2))
        return

    total = sum(counts.values())
    print(f"Unread Memos ({total} total):")
    if not counts:
        print("  None")
    else:
        for recipient, count in counts.items():
            print(f"  {recipient}: {count}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    counts = get_unread_count()
    total = sum(counts.values())
    return f"Memos: {total} total | {len(counts)} recipients with memos"


def main():
    parser = argparse.ArgumentParser(
        description="Memo Router",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="unread",
                       help="Command (route, send, list, unread)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--from", dest="sender", type=str, help="Sender terminal")
    parser.add_argument("--priority", type=str, choices=["normal", "urgent", "fyi"],
                       default="normal", help="Priority level")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "route":
        if not args.args:
            print("Error: route requires topic", file=sys.stderr)
            sys.exit(1)
        cmd_route(" ".join(args.args), args)
    elif args.command == "send":
        if len(args.args) < 2:
            print("Error: send requires <to> <subject>", file=sys.stderr)
            sys.exit(1)
        cmd_send(args.args[0], " ".join(args.args[1:]), args)
    elif args.command == "list":
        if not args.args:
            print("Error: list requires recipient", file=sys.stderr)
            sys.exit(1)
        cmd_list(args.args[0], args)
    elif args.command == "unread":
        cmd_unread(args)
    else:
        # Assume it's a recipient for list
        cmd_list(args.command, args)


if __name__ == "__main__":
    main()
