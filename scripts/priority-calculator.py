#!/usr/bin/env python3
"""
Priority Calculator - Calculate task priority based on dependencies

Determines optimal task ordering using dependency graph.
Usage: python3 scripts/priority-calculator.py [command] [options]

Commands:
  queue                    Prioritize current queue (default)
  feature <num>            Calculate priority for feature
  batch <features...>      Prioritize list of features
  blockers                 Show blocking features

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/priority-calculator.py
  python3 scripts/priority-calculator.py feature 003
  python3 scripts/priority-calculator.py batch 003 009 024
"""

import argparse
import json
import re
import sys
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
STATUS_FILE = PROJECT_ROOT / "docs" / "design" / "wireframes" / ".terminal-status.json"
IMPL_ORDER_FILE = PROJECT_ROOT / "features" / "IMPLEMENTATION_ORDER.md"


def load_status() -> dict:
    """Load terminal status"""
    if not STATUS_FILE.exists():
        return {"queue": []}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def parse_dependencies() -> dict:
    """Parse IMPLEMENTATION_ORDER.md for dependencies"""
    deps = {
        "features": {},  # feature -> {tier, order, depends_on, blocks}
        "tiers": defaultdict(list)
    }

    if not IMPL_ORDER_FILE.exists():
        return deps

    content = IMPL_ORDER_FILE.read_text()
    current_tier = None

    for line in content.split('\n'):
        tier_match = re.match(r'^### Tier (\d+):', line)
        if tier_match:
            current_tier = int(tier_match.group(1))
            continue

        row_match = re.match(
            r'\|\s*(\d+)\s*\|\s*\*?\*?(\d+)\*?\*?\s*\|\s*([^|]+)\|\s*([^|]*)\|',
            line
        )

        if row_match and current_tier:
            order = int(row_match.group(1))
            feature_num = row_match.group(2).zfill(3)
            depends_text = row_match.group(4).strip()

            depends_on = []
            if depends_text and depends_text != "-":
                depends_on = re.findall(r'(\d{3})', depends_text)

            deps["features"][feature_num] = {
                "tier": current_tier,
                "order": order,
                "depends_on": depends_on,
                "blocks": []
            }
            deps["tiers"][current_tier].append(feature_num)

    # Compute reverse dependencies
    for feature, data in deps["features"].items():
        for dep in data["depends_on"]:
            if dep in deps["features"]:
                deps["features"][dep]["blocks"].append(feature)

    return deps


def calculate_priority(feature: str, deps: dict) -> dict:
    """Calculate priority score for a feature"""
    feature = feature.zfill(3)

    if feature not in deps["features"]:
        return {"feature": feature, "score": 0, "reason": "not_found"}

    data = deps["features"][feature]

    # Priority factors:
    # 1. Tier (lower = higher priority)
    # 2. Number of features blocked
    # 3. Implementation order
    # 4. Dependencies satisfied

    tier_score = 100 - (data["tier"] * 10)
    blocks_score = len(data["blocks"]) * 5
    order_score = 50 - data["order"]

    # Check if dependencies are satisfied
    deps_satisfied = True
    missing_deps = []
    for dep in data["depends_on"]:
        if dep in deps["features"]:
            # In a real implementation, check if dep is completed
            pass
        else:
            deps_satisfied = False
            missing_deps.append(dep)

    deps_penalty = 0 if deps_satisfied else -50

    total_score = tier_score + blocks_score + order_score + deps_penalty

    return {
        "feature": feature,
        "score": total_score,
        "tier": data["tier"],
        "order": data["order"],
        "blocks_count": len(data["blocks"]),
        "depends_on": data["depends_on"],
        "deps_satisfied": deps_satisfied,
        "missing_deps": missing_deps,
        "breakdown": {
            "tier": tier_score,
            "blocks": blocks_score,
            "order": order_score,
            "deps_penalty": deps_penalty
        }
    }


def prioritize_queue() -> list:
    """Prioritize current queue items"""
    data = load_status()
    deps = parse_dependencies()
    queue = data.get("queue", [])

    # Get unique features from queue
    features = list(set(item.get("feature", "").split("-")[0].zfill(3)
                       for item in queue if item.get("feature")))

    # Calculate priorities
    priorities = []
    for feature in features:
        priority = calculate_priority(feature, deps)
        if priority["score"] > 0:
            priorities.append(priority)

    # Sort by score (descending)
    return sorted(priorities, key=lambda x: -x["score"])


def get_blockers(deps: dict) -> list:
    """Get features that block the most others"""
    blockers = []

    for feature, data in deps["features"].items():
        if len(data["blocks"]) > 0:
            blockers.append({
                "feature": feature,
                "blocks_count": len(data["blocks"]),
                "blocks": data["blocks"][:5],
                "tier": data["tier"]
            })

    return sorted(blockers, key=lambda x: -x["blocks_count"])


# Command handlers

def cmd_queue(args):
    """Prioritize current queue"""
    priorities = prioritize_queue()

    if args.json:
        print(json.dumps(priorities, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| QUEUE PRIORITIES" + " " * 61 + "|")
    print("+" + "-" * 78 + "+")
    print("| Feature | Score | Tier | Blocks | Deps OK | Order               |")
    print("+" + "-" * 78 + "+")

    for p in priorities[:15]:
        deps_ok = "✓" if p["deps_satisfied"] else "✗"
        print(f"| {p['feature']}     | {p['score']:5} | {p['tier']:4} | {p['blocks_count']:6} | {deps_ok:7} | {p['order']:<19} |")

    print("+" + "=" * 78 + "+")


def cmd_feature(feature: str, args):
    """Calculate priority for feature"""
    deps = parse_dependencies()
    priority = calculate_priority(feature, deps)

    if args.json:
        print(json.dumps(priority, indent=2))
        return

    print(f"Feature: {priority['feature']}")
    print(f"Priority Score: {priority['score']}")
    print()
    print("Breakdown:")
    print(f"  Tier ({priority['tier']}): {priority['breakdown']['tier']}")
    print(f"  Blocks ({priority['blocks_count']}): {priority['breakdown']['blocks']}")
    print(f"  Order ({priority['order']}): {priority['breakdown']['order']}")
    print(f"  Deps penalty: {priority['breakdown']['deps_penalty']}")
    print()
    print(f"Dependencies satisfied: {priority['deps_satisfied']}")
    if priority["missing_deps"]:
        print(f"Missing: {', '.join(priority['missing_deps'])}")


def cmd_batch(features: list, args):
    """Prioritize batch of features"""
    deps = parse_dependencies()
    priorities = []

    for feature in features:
        priority = calculate_priority(feature, deps)
        priorities.append(priority)

    # Sort by score
    priorities = sorted(priorities, key=lambda x: -x["score"])

    if args.json:
        print(json.dumps(priorities, indent=2))
        return

    print("Batch Priorities (sorted):")
    for i, p in enumerate(priorities, 1):
        deps_ok = "✓" if p["deps_satisfied"] else "✗"
        print(f"  {i}. {p['feature']} (score: {p['score']}, tier: {p['tier']}, deps: {deps_ok})")


def cmd_blockers(args):
    """Show blocking features"""
    deps = parse_dependencies()
    blockers = get_blockers(deps)

    if args.json:
        print(json.dumps(blockers, indent=2))
        return

    print("Blocking Features (most impact first):")
    for b in blockers[:15]:
        blocks_str = ", ".join(b["blocks"])
        print(f"  {b['feature']} (tier {b['tier']}): blocks {b['blocks_count']} - {blocks_str}")


def to_summary(args) -> str:
    """Generate one-line summary"""
    priorities = prioritize_queue()
    if not priorities:
        return "Priority: No queue items"

    top = priorities[0] if priorities else {"feature": "none", "score": 0}
    return f"Priority: Top={top['feature']} (score {top['score']}) | {len(priorities)} in queue"


def main():
    parser = argparse.ArgumentParser(
        description="Priority Calculator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="queue",
                       help="Command (queue, feature, batch, blockers)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    if args.summary:
        print(to_summary(args))
        return

    if args.command == "queue":
        cmd_queue(args)
    elif args.command == "feature":
        if not args.args:
            print("Error: feature requires feature number", file=sys.stderr)
            sys.exit(1)
        cmd_feature(args.args[0], args)
    elif args.command == "batch":
        if not args.args:
            print("Error: batch requires feature numbers", file=sys.stderr)
            sys.exit(1)
        cmd_batch(args.args, args)
    elif args.command == "blockers":
        cmd_blockers(args)
    else:
        # Assume it's a feature number
        cmd_feature(args.command, args)


if __name__ == "__main__":
    main()
