#!/usr/bin/env python3
"""
Implementation Order Parser - CLI for features/IMPLEMENTATION_ORDER.md

Parses the implementation order and checks planning status.
Usage: python3 implementation_order.py <command> [args]

Commands:
  list                          List all features in order
  tier <N>                      List features in tier N (1-9)
  next-unplanned                Find first feature without assignments.json
  is-planned <feature>          Check if feature has assignments.json
  status                        Show planning status for all tiers
"""

import json
import re
import sys
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
IMPL_ORDER_FILE = PROJECT_ROOT / "features" / "IMPLEMENTATION_ORDER.md"
WIREFRAMES_DIR = SCRIPT_DIR


def parse_implementation_order():
    """Parse IMPLEMENTATION_ORDER.md and return ordered list of features"""
    if not IMPL_ORDER_FILE.exists():
        print(f"Error: {IMPL_ORDER_FILE} not found", file=sys.stderr)
        sys.exit(1)

    content = IMPL_ORDER_FILE.read_text()

    # Extract features from tables
    # Pattern matches: | N | **NNN** | Name | ...
    pattern = r'\|\s*(\d+)\s*\|\s*\*\*(\d{3})\*\*\s*\|\s*([^|]+)\s*\|'

    features = []
    current_tier = 0
    tier_pattern = r'### Tier (\d+):'

    for line in content.split('\n'):
        # Check for tier header
        tier_match = re.search(tier_pattern, line)
        if tier_match:
            current_tier = int(tier_match.group(1))
            continue

        # Check for feature row
        feature_match = re.search(pattern, line)
        if feature_match:
            order = int(feature_match.group(1))
            code = feature_match.group(2)
            name = feature_match.group(3).strip()
            features.append({
                "order": order,
                "code": code,
                "name": name,
                "tier": current_tier
            })

    return sorted(features, key=lambda x: x["order"])


def find_feature_folder(code):
    """Find the full feature folder path for a code like '002'"""
    features_dir = PROJECT_ROOT / "features"

    # Search all category folders
    for category in features_dir.iterdir():
        if not category.is_dir():
            continue
        for feature in category.iterdir():
            if feature.is_dir() and feature.name.startswith(f"{code}-"):
                return feature

    return None


def check_feature_planned(code):
    """Check if a feature has assignments.json"""
    # Check in wireframes folder
    for folder in WIREFRAMES_DIR.iterdir():
        if folder.is_dir() and folder.name.startswith(f"{code}-"):
            assignments = folder / "assignments.json"
            if assignments.exists():
                return True, folder.name
    return False, None


def list_features():
    """List all features in implementation order"""
    features = parse_implementation_order()
    print(f"{'Order':<6} {'Code':<5} {'Tier':<5} {'Name'}")
    print("-" * 60)
    for f in features:
        print(f"{f['order']:<6} {f['code']:<5} {f['tier']:<5} {f['name']}")


def list_tier(tier_num):
    """List features in a specific tier"""
    features = parse_implementation_order()
    tier_features = [f for f in features if f["tier"] == tier_num]

    if not tier_features:
        print(f"No features found in tier {tier_num}")
        return

    print(f"Tier {tier_num}: {len(tier_features)} features")
    print("-" * 50)
    for f in tier_features:
        planned, folder = check_feature_planned(f["code"])
        status = "[x]" if planned else "[ ]"
        print(f"{status} {f['code']} - {f['name']}")


def find_next_unplanned():
    """Find first feature in order without assignments.json"""
    features = parse_implementation_order()

    for f in features:
        planned, _ = check_feature_planned(f["code"])
        if not planned:
            # Find full folder name
            feature_folder = find_feature_folder(f["code"])
            if feature_folder:
                print(feature_folder.name)
            else:
                print(f"{f['code']}-{f['name'].lower().replace(' ', '-')}")
            return

    print("All features are planned!")


def is_planned(feature_code):
    """Check if a specific feature is planned"""
    # Handle both "002" and "002-cookie-consent" formats
    code = feature_code.split("-")[0] if "-" in feature_code else feature_code

    planned, folder = check_feature_planned(code)
    if planned:
        print(f"true: {folder}/assignments.json exists")
    else:
        print(f"false: no assignments.json for {code}")


def show_status():
    """Show planning status for all tiers"""
    features = parse_implementation_order()

    # Group by tier
    tiers = {}
    for f in features:
        tier = f["tier"]
        if tier not in tiers:
            tiers[tier] = []
        planned, _ = check_feature_planned(f["code"])
        f["planned"] = planned
        tiers[tier].append(f)

    print("IMPLEMENTATION ORDER STATUS")
    print("=" * 50)

    for tier_num in sorted(tiers.keys()):
        tier_features = tiers[tier_num]
        planned_count = sum(1 for f in tier_features if f["planned"])
        total = len(tier_features)

        print(f"\nTier {tier_num}: {planned_count}/{total} planned")
        print("-" * 30)
        for f in tier_features:
            status = "[x]" if f["planned"] else "[ ]"
            print(f"  {status} {f['code']} - {f['name']}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "list": list_features,
        "tier": lambda: list_tier(int(args[0])) if args else print("Usage: tier <N>"),
        "next-unplanned": find_next_unplanned,
        "is-planned": lambda: is_planned(args[0]) if args else print("Usage: is-planned <feature>"),
        "status": show_status,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
