#!/usr/bin/env python3
"""
RFC Consensus - Vote aggregation and consensus detection for RFCs

Replaces prompt-based RFC voting to reduce token usage across 7 council terminals.
Usage: python3 scripts/rfc-consensus.py [command] [options]

Commands:
  list                     List all RFCs with status
  pending                  List RFCs needing votes (default)
  tally <rfc>              Count votes for specific RFC
  cast <rfc> <voter> <vote> Record a vote
  check <rfc>              Check if consensus reached
  finalize <rfc>           Create DEC-XXX when consensus reached

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/rfc-consensus.py pending
  python3 scripts/rfc-consensus.py tally 006
  python3 scripts/rfc-consensus.py cast 006 CTO approve
  python3 scripts/rfc-consensus.py check 006 --json
  python3 scripts/rfc-consensus.py finalize 006
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

# Key paths
RFCS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "rfcs"
DECISIONS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "decisions"

# Council stakeholders (all must vote or abstain)
STAKEHOLDERS = [
    "CTO",
    "Architect",
    "Security Lead",
    "Toolsmith",
    "DevOps",
    "Product Owner",
    "UX Designer"
]

# Valid vote values
VALID_VOTES = ["approve", "reject", "abstain", "pending"]


def find_rfc_file(rfc_num: str) -> Path:
    """Find RFC file by number"""
    rfc_num = rfc_num.zfill(3)  # Pad to 3 digits

    for rfc_file in RFCS_DIR.glob(f"RFC-{rfc_num}*.md"):
        return rfc_file

    return None


def parse_rfc(rfc_file: Path) -> dict:
    """Parse RFC file and extract metadata"""
    content = rfc_file.read_text()

    rfc_data = {
        "file": rfc_file.name,
        "number": "",
        "title": "",
        "status": "unknown",
        "author": "",
        "created": "",
        "votes": {},
        "dissent": [],
        "summary": "",
        "raw_content": content
    }

    # Extract RFC number
    num_match = re.search(r'RFC-(\d+)', rfc_file.stem)
    if num_match:
        rfc_data["number"] = num_match.group(1)

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

    # Extract created date
    created_match = re.search(r'\*\*Created\*\*:\s*(.+)$', content, re.MULTILINE)
    if created_match:
        rfc_data["created"] = created_match.group(1).strip()

    # Extract summary
    summary_match = re.search(r'## Summary\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if summary_match:
        rfc_data["summary"] = summary_match.group(1).strip()[:200]

    # Parse vote table
    # Pattern: | Stakeholder | vote | date |
    vote_table_match = re.search(
        r'## Stakeholders.*?\n\|[^\n]+\|\n\|[-|\s]+\|\n((?:\|[^\n]+\|\n?)+)',
        content,
        re.DOTALL
    )

    if vote_table_match:
        table_content = vote_table_match.group(1)
        for line in table_content.strip().split('\n'):
            # Parse: | Stakeholder | vote | date |
            row_match = re.match(r'\|\s*([^|]+)\|\s*\*?\*?(\w+)\*?\*?\s*\|\s*([^|]*)\|', line)
            if row_match:
                stakeholder = row_match.group(1).strip()
                vote = row_match.group(2).strip().lower()
                date = row_match.group(3).strip()

                # Normalize stakeholder names
                for s in STAKEHOLDERS:
                    if s.lower() in stakeholder.lower():
                        rfc_data["votes"][s] = {
                            "vote": vote if vote in VALID_VOTES else "pending",
                            "date": date if date != "-" else None
                        }
                        break

    # Parse dissent log
    dissent_match = re.search(r'## Dissent Log.*?\n\|[^\n]+\|\n\|[-|\s]+\|\n((?:\|[^\n]+\|\n?)+)', content, re.DOTALL)
    if dissent_match:
        for line in dissent_match.group(1).strip().split('\n'):
            row_match = re.match(r'\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|', line)
            if row_match:
                rfc_data["dissent"].append({
                    "voter": row_match.group(1).strip(),
                    "reason": row_match.group(2).strip(),
                    "resolution": row_match.group(3).strip()
                })

    return rfc_data


def get_all_rfcs() -> list:
    """Get all RFC files parsed"""
    rfcs = []

    if not RFCS_DIR.exists():
        return rfcs

    for rfc_file in sorted(RFCS_DIR.glob("RFC-*.md")):
        try:
            rfcs.append(parse_rfc(rfc_file))
        except Exception as e:
            print(f"Warning: Error parsing {rfc_file}: {e}", file=sys.stderr)

    return rfcs


def tally_votes(rfc_data: dict) -> dict:
    """Tally votes for an RFC"""
    tally = {
        "approve": 0,
        "reject": 0,
        "abstain": 0,
        "pending": 0,
        "voters": {
            "approve": [],
            "reject": [],
            "abstain": [],
            "pending": []
        }
    }

    for stakeholder in STAKEHOLDERS:
        vote_info = rfc_data["votes"].get(stakeholder, {"vote": "pending"})
        vote = vote_info.get("vote", "pending")

        if vote in ["approve", "approved"]:
            tally["approve"] += 1
            tally["voters"]["approve"].append(stakeholder)
        elif vote in ["reject", "rejected"]:
            tally["reject"] += 1
            tally["voters"]["reject"].append(stakeholder)
        elif vote == "abstain":
            tally["abstain"] += 1
            tally["voters"]["abstain"].append(stakeholder)
        else:
            tally["pending"] += 1
            tally["voters"]["pending"].append(stakeholder)

    return tally


def check_consensus(rfc_data: dict) -> dict:
    """Check if RFC has reached consensus"""
    tally = tally_votes(rfc_data)

    result = {
        "rfc": rfc_data["number"],
        "status": rfc_data["status"],
        "tally": tally,
        "consensus": False,
        "rejected": False,
        "decision": None,
        "reason": ""
    }

    # Can't have consensus if pending votes remain
    if tally["pending"] > 0:
        result["reason"] = f"Awaiting votes from: {', '.join(tally['voters']['pending'])}"
        return result

    # Any reject = rejected
    if tally["reject"] > 0:
        result["rejected"] = True
        result["decision"] = "rejected"
        result["reason"] = f"Rejected by: {', '.join(tally['voters']['reject'])}"
        return result

    # All non-abstaining approved = consensus
    if tally["approve"] > 0:
        result["consensus"] = True
        result["decision"] = "approved"
        result["reason"] = f"Unanimous approval ({tally['approve']} approve, {tally['abstain']} abstain)"
        return result

    # All abstained (edge case)
    result["reason"] = "All stakeholders abstained - no decision possible"
    return result


def update_rfc_vote(rfc_file: Path, voter: str, vote: str) -> bool:
    """Update vote in RFC file"""
    content = rfc_file.read_text()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Normalize voter name
    voter_normalized = None
    for s in STAKEHOLDERS:
        if s.lower() == voter.lower() or voter.lower() in s.lower():
            voter_normalized = s
            break

    if not voter_normalized:
        print(f"Error: Unknown voter '{voter}'", file=sys.stderr)
        print(f"Valid voters: {', '.join(STAKEHOLDERS)}", file=sys.stderr)
        return False

    # Find and replace the vote row
    # Pattern: | Voter Name | pending/vote | date |
    pattern = rf'(\|\s*{re.escape(voter_normalized)}\s*\|)\s*\*?\*?\w+\*?\*?\s*(\|)\s*[^|]*(\|)'
    replacement = rf'\1 **{vote}** \2 {today} \3'

    new_content, count = re.subn(pattern, replacement, content, flags=re.IGNORECASE)

    if count == 0:
        print(f"Error: Could not find vote row for '{voter_normalized}'", file=sys.stderr)
        return False

    rfc_file.write_text(new_content)
    return True


def add_dissent(rfc_file: Path, voter: str, reason: str) -> bool:
    """Add dissent log entry"""
    content = rfc_file.read_text()

    # Find dissent log table and add entry
    dissent_entry = f"| {voter} | {reason} | - |\n"

    # Find the dissent log section
    dissent_match = re.search(r'(## Dissent Log.*?\n\|[^\n]+\|\n\|[-|\s]+\|\n)', content, re.DOTALL)

    if dissent_match:
        insert_pos = dissent_match.end()
        new_content = content[:insert_pos] + dissent_entry + content[insert_pos:]
        rfc_file.write_text(new_content)
        return True

    return False


def create_decision_record(rfc_data: dict, tally: dict) -> Path:
    """Create DEC-XXX decision record"""
    DECISIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Generate decision number
    existing = list(DECISIONS_DIR.glob("DEC-*.md"))
    next_num = len(existing) + 1
    dec_num = str(next_num).zfill(3)

    # Create slug from title
    slug = re.sub(r'[^a-z0-9]+', '-', rfc_data["title"].lower()).strip('-')[:50]

    dec_file = DECISIONS_DIR / f"DEC-{dec_num}-{slug}.md"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Build vote table
    vote_rows = []
    for stakeholder in STAKEHOLDERS:
        vote_info = rfc_data["votes"].get(stakeholder, {"vote": "pending", "date": "-"})
        vote_rows.append(f"| {stakeholder} | {vote_info['vote']} | {vote_info.get('date', '-')} |")
    vote_table = "\n".join(vote_rows)

    # Build dissent section
    if rfc_data["dissent"]:
        dissent_text = "\n".join([f"- **{d['voter']}**: {d['reason']}" for d in rfc_data["dissent"]])
    else:
        dissent_text = "None recorded."

    content = f"""# DEC-{dec_num}: {rfc_data['title']}

**Date**: {today}
**RFC**: RFC-{rfc_data['number']}
**Status**: active

## Stakeholder Votes

| Stakeholder | Vote | Date |
|-------------|------|------|
{vote_table}

**Result**: {tally['approve']} approve, {tally['abstain']} abstain, {tally['reject']} reject

## Decision

{rfc_data['summary']}

## Rationale

See RFC-{rfc_data['number']} for full motivation and proposal.

## Dissenting Views

{dissent_text}

## Implementation

- [ ] Update relevant documentation
- [ ] Notify affected terminals via /broadcast
- [ ] Track implementation in .terminal-status.json

---

*Generated by rfc-consensus.py*
"""

    dec_file.write_text(content)
    return dec_file


def update_rfc_status(rfc_file: Path, new_status: str, dec_num: str = None) -> bool:
    """Update RFC status"""
    content = rfc_file.read_text()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Update status line
    content = re.sub(
        r'\*\*Status\*\*:\s*\w+',
        f'**Status**: {new_status}',
        content
    )

    # Add decision record if approved
    if new_status == "decided" and dec_num:
        decision_section = f"""
## Decision Record

**Decided**: {today}
**Outcome**: approved
**Decision ID**: DEC-{dec_num}
"""
        # Insert before any existing Decision Record section or at end
        if "## Decision Record" not in content:
            content = content.rstrip() + "\n" + decision_section

    rfc_file.write_text(content)
    return True


# Command handlers

def cmd_list(args):
    """List all RFCs"""
    rfcs = get_all_rfcs()

    if args.json:
        output = [{
            "number": r["number"],
            "title": r["title"],
            "status": r["status"],
            "author": r["author"]
        } for r in rfcs]
        print(json.dumps(output, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| RFC LIST ({len(rfcs)} total){' ' * 58}|"[:80])
    print("+" + "-" * 78 + "+")
    print("| # | Title                                    | Status   | Author          |")
    print("+" + "-" * 78 + "+")

    for r in rfcs:
        num = r["number"].zfill(3)
        title = r["title"][:40].ljust(40)
        status = r["status"][:8].ljust(8)
        author = r["author"][:15].ljust(15)
        print(f"| {num} | {title} | {status} | {author} |")

    print("+" + "=" * 78 + "+")


def cmd_pending(args):
    """List RFCs needing votes"""
    rfcs = get_all_rfcs()
    pending = []

    for r in rfcs:
        if r["status"] in ["voting", "review", "proposed"]:
            tally = tally_votes(r)
            if tally["pending"] > 0:
                pending.append({
                    "rfc": r,
                    "tally": tally
                })

    if args.json:
        output = [{
            "number": p["rfc"]["number"],
            "title": p["rfc"]["title"],
            "status": p["rfc"]["status"],
            "pending_voters": p["tally"]["voters"]["pending"],
            "votes": {
                "approve": p["tally"]["approve"],
                "reject": p["tally"]["reject"],
                "abstain": p["tally"]["abstain"],
                "pending": p["tally"]["pending"]
            }
        } for p in pending]
        print(json.dumps(output, indent=2))
        return

    if not pending:
        print("No RFCs pending votes.")
        return

    print("+" + "=" * 78 + "+")
    print(f"| RFCs PENDING VOTES ({len(pending)}){' ' * 52}|"[:80])
    print("+" + "-" * 78 + "+")

    for p in pending:
        r = p["rfc"]
        t = p["tally"]
        print(f"| RFC-{r['number']}: {r['title'][:60]:<60} |"[:80])
        print(f"|   Status: {r['status']} | Votes: {t['approve']}✓ {t['reject']}✗ {t['abstain']}○ {t['pending']}?{' ' * 30}|"[:80])
        print(f"|   Awaiting: {', '.join(t['voters']['pending']):<62} |"[:80])
        print("+" + "-" * 78 + "+")

    print("+" + "=" * 78 + "+")


def cmd_tally(rfc_num: str, args):
    """Tally votes for specific RFC"""
    rfc_file = find_rfc_file(rfc_num)
    if not rfc_file:
        print(f"Error: RFC-{rfc_num} not found", file=sys.stderr)
        sys.exit(1)

    rfc_data = parse_rfc(rfc_file)
    tally = tally_votes(rfc_data)

    if args.json:
        output = {
            "rfc": rfc_data["number"],
            "title": rfc_data["title"],
            "status": rfc_data["status"],
            "tally": tally
        }
        print(json.dumps(output, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| RFC-{rfc_data['number']}: {rfc_data['title'][:60]:<60} |"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Status: {rfc_data['status']}{' ' * 67}|"[:80])
    print("+" + "-" * 78 + "+")
    print("| VOTE TALLY" + " " * 67 + "|")
    print(f"|   Approve: {tally['approve']} - {', '.join(tally['voters']['approve']) or 'none':<55} |"[:80])
    print(f"|   Reject:  {tally['reject']} - {', '.join(tally['voters']['reject']) or 'none':<55} |"[:80])
    print(f"|   Abstain: {tally['abstain']} - {', '.join(tally['voters']['abstain']) or 'none':<55} |"[:80])
    print(f"|   Pending: {tally['pending']} - {', '.join(tally['voters']['pending']) or 'none':<55} |"[:80])
    print("+" + "=" * 78 + "+")


def cmd_cast(rfc_num: str, voter: str, vote: str, reason: str, args):
    """Cast a vote"""
    if vote.lower() not in ["approve", "reject", "abstain"]:
        print(f"Error: Invalid vote '{vote}'", file=sys.stderr)
        print("Valid votes: approve, reject, abstain", file=sys.stderr)
        sys.exit(1)

    rfc_file = find_rfc_file(rfc_num)
    if not rfc_file:
        print(f"Error: RFC-{rfc_num} not found", file=sys.stderr)
        sys.exit(1)

    rfc_data = parse_rfc(rfc_file)

    # Check RFC is in votable state
    if rfc_data["status"] not in ["voting", "review", "proposed"]:
        print(f"Error: RFC-{rfc_num} is {rfc_data['status']}, not votable", file=sys.stderr)
        sys.exit(1)

    # Update vote
    if not update_rfc_vote(rfc_file, voter, vote.lower()):
        sys.exit(1)

    # Add dissent if rejecting
    if vote.lower() == "reject":
        if reason:
            add_dissent(rfc_file, voter, reason)
        else:
            print("Warning: Reject vote should include reason (--reason)", file=sys.stderr)

    # Re-parse to get updated tally
    rfc_data = parse_rfc(rfc_file)
    tally = tally_votes(rfc_data)
    consensus = check_consensus(rfc_data)

    if args.json:
        output = {
            "success": True,
            "rfc": rfc_num,
            "voter": voter,
            "vote": vote.lower(),
            "tally": tally,
            "consensus": consensus
        }
        print(json.dumps(output, indent=2))
        return

    print(f"Vote recorded: {voter} -> {vote} on RFC-{rfc_num}")
    print(f"Tally: {tally['approve']}✓ {tally['reject']}✗ {tally['abstain']}○ {tally['pending']}?")

    if consensus["consensus"]:
        print(f"\n*** CONSENSUS REACHED: {consensus['reason']} ***")
        print(f"Run: python3 scripts/rfc-consensus.py finalize {rfc_num}")
    elif consensus["rejected"]:
        print(f"\n*** RFC REJECTED: {consensus['reason']} ***")
    elif tally["pending"] > 0:
        print(f"\nAwaiting: {', '.join(tally['voters']['pending'])}")


def cmd_check(rfc_num: str, args):
    """Check consensus status"""
    rfc_file = find_rfc_file(rfc_num)
    if not rfc_file:
        print(f"Error: RFC-{rfc_num} not found", file=sys.stderr)
        sys.exit(1)

    rfc_data = parse_rfc(rfc_file)
    consensus = check_consensus(rfc_data)

    if args.json:
        print(json.dumps(consensus, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| RFC-{rfc_data['number']} CONSENSUS CHECK{' ' * 53}|"[:80])
    print("+" + "-" * 78 + "+")

    if consensus["consensus"]:
        print("| CONSENSUS REACHED" + " " * 60 + "|")
        print(f"| {consensus['reason']:<76} |")
        print("| Ready to finalize with: rfc-consensus.py finalize " + rfc_num + " " * 20 + "|"[:80])
    elif consensus["rejected"]:
        print("| RFC REJECTED" + " " * 65 + "|")
        print(f"| {consensus['reason']:<76} |")
    else:
        print("| PENDING" + " " * 70 + "|")
        print(f"| {consensus['reason']:<76} |")

    print("+" + "=" * 78 + "+")


def cmd_finalize(rfc_num: str, args):
    """Finalize RFC and create decision record"""
    rfc_file = find_rfc_file(rfc_num)
    if not rfc_file:
        print(f"Error: RFC-{rfc_num} not found", file=sys.stderr)
        sys.exit(1)

    rfc_data = parse_rfc(rfc_file)
    consensus = check_consensus(rfc_data)
    tally = tally_votes(rfc_data)

    if not consensus["consensus"] and not consensus["rejected"]:
        print(f"Error: RFC-{rfc_num} has not reached consensus", file=sys.stderr)
        print(f"Reason: {consensus['reason']}", file=sys.stderr)
        sys.exit(1)

    if consensus["rejected"]:
        # Update status to rejected
        update_rfc_status(rfc_file, "rejected")

        if args.json:
            print(json.dumps({"status": "rejected", "rfc": rfc_num}, indent=2))
        else:
            print(f"RFC-{rfc_num} marked as rejected.")
        return

    # Create decision record
    dec_file = create_decision_record(rfc_data, tally)
    dec_num = re.search(r'DEC-(\d+)', dec_file.name).group(1)

    # Update RFC status
    update_rfc_status(rfc_file, "decided", dec_num)

    if args.json:
        output = {
            "status": "decided",
            "rfc": rfc_num,
            "decision": f"DEC-{dec_num}",
            "file": str(dec_file.relative_to(PROJECT_ROOT))
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"RFC-{rfc_num} finalized!")
        print(f"Decision record: {dec_file.relative_to(PROJECT_ROOT)}")


def to_summary(args):
    """Generate one-line summary"""
    rfcs = get_all_rfcs()

    voting = [r for r in rfcs if r["status"] == "voting"]
    decided = [r for r in rfcs if r["status"] == "decided"]

    pending_votes = 0
    for r in voting:
        tally = tally_votes(r)
        pending_votes += tally["pending"]

    status = "OK"
    if pending_votes > 3:
        status = "VOTES_NEEDED"

    return f"RFC Consensus: {status} | {len(voting)} voting | {pending_votes} pending votes | {len(decided)} decided"


def main():
    parser = argparse.ArgumentParser(
        description="RFC Consensus Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="pending",
                       help="Command (list, pending, tally, cast, check, finalize)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")
    parser.add_argument("--reason", type=str, help="Reason for reject vote")

    args = parser.parse_args()

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "list":
        cmd_list(args)
    elif args.command == "pending":
        cmd_pending(args)
    elif args.command == "tally":
        if not args.args:
            print("Error: tally requires RFC number", file=sys.stderr)
            sys.exit(1)
        cmd_tally(args.args[0], args)
    elif args.command == "cast":
        if len(args.args) < 3:
            print("Error: cast requires <rfc> <voter> <vote>", file=sys.stderr)
            print("Example: cast 006 CTO approve", file=sys.stderr)
            sys.exit(1)
        cmd_cast(args.args[0], args.args[1], args.args[2], args.reason, args)
    elif args.command == "check":
        if not args.args:
            print("Error: check requires RFC number", file=sys.stderr)
            sys.exit(1)
        cmd_check(args.args[0], args)
    elif args.command == "finalize":
        if not args.args:
            print("Error: finalize requires RFC number", file=sys.stderr)
            sys.exit(1)
        cmd_finalize(args.args[0], args)
    else:
        # Assume it's an RFC number for tally
        cmd_tally(args.command, args)


if __name__ == "__main__":
    main()
