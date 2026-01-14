#!/usr/bin/env python3
"""
Queue Manager - CLI for .terminal-status.json operations

Replaces jq patterns in skill files to reduce token usage.
Usage: python3 queue_manager.py <command> [args]

Commands:
  get-queue <role>              Get queue items for a role
  get-feature <feature>         Get queue items for a feature
  count-generators              Count items per generator
  find-least-loaded             Find generator with fewest items
  get-status <role>             Get terminal status for a role
  add-item <feature> <svg> <action> <assignedTo>  Add queue item
  update-status <role> <status> [feature] [task]  Update terminal status
  remove-item <feature> <svg>   Remove queue item
  log-completed <message>       Add to completedToday
  claim-feature <feature> <generator>  Claim all SVGs for a feature
  summary                       Full queue summary
"""

import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# Find the .terminal-status.json file
SCRIPT_DIR = Path(__file__).parent
STATUS_FILE = SCRIPT_DIR / ".terminal-status.json"

GENERATORS = ["generator-1", "generator-2", "generator-3"]


def load_status():
    """Load and parse .terminal-status.json"""
    if not STATUS_FILE.exists():
        print(f"Error: {STATUS_FILE} not found", file=sys.stderr)
        sys.exit(1)
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def save_status(data):
    """Save .terminal-status.json with validation"""
    # Update timestamp
    data["lastUpdated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Validate before writing
    try:
        json.dumps(data)  # Test serialization
    except (TypeError, ValueError) as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        sys.exit(1)

    with open(STATUS_FILE, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def get_queue_by_role(role):
    """Get queue items assigned to a specific role"""
    data = load_status()
    items = [item for item in data["queue"] if item.get("assignedTo") == role]
    print(json.dumps(items, indent=2))


def get_queue_by_feature(feature):
    """Get queue items for a specific feature"""
    data = load_status()
    # Handle both "002" and "002-cookie-consent" formats
    items = [item for item in data["queue"]
             if item["feature"] == feature or item["feature"].startswith(f"{feature}-")]
    print(json.dumps(items, indent=2))


def count_generators():
    """Count queue items per generator"""
    data = load_status()
    counts = defaultdict(int)

    # Initialize all generators to 0
    for gen in GENERATORS:
        counts[gen] = 0

    # Count assigned items
    for item in data["queue"]:
        assignee = item.get("assignedTo")
        if assignee in GENERATORS:
            counts[assignee] += 1

    # Also include terminal status
    result = {}
    for gen in GENERATORS:
        terminal = data["terminals"].get(gen, {})
        result[gen] = {
            "queue_count": counts[gen],
            "status": terminal.get("status", "idle"),
            "feature": terminal.get("feature"),
        }

    print(json.dumps(result, indent=2))


def find_least_loaded():
    """Find generator with fewest items, preferring idle ones"""
    data = load_status()
    counts = defaultdict(int)

    for gen in GENERATORS:
        counts[gen] = 0

    for item in data["queue"]:
        assignee = item.get("assignedTo")
        if assignee in GENERATORS:
            counts[assignee] += 1

    # Prefer idle generators
    idle_gens = []
    for gen in GENERATORS:
        terminal = data["terminals"].get(gen, {})
        if terminal.get("status") == "idle" and counts[gen] == 0:
            idle_gens.append(gen)

    if idle_gens:
        # Return first idle generator with no work (round-robin order)
        print(idle_gens[0])
        return

    # Otherwise find least loaded
    min_count = min(counts.values())
    for gen in GENERATORS:  # Maintains round-robin order
        if counts[gen] == min_count:
            print(gen)
            return


def get_terminal_status(role):
    """Get terminal status for a specific role"""
    data = load_status()
    terminal = data["terminals"].get(role, {})
    print(json.dumps(terminal, indent=2))


def add_queue_item(feature, svg, action, assigned_to):
    """Add a new item to the queue"""
    data = load_status()

    new_item = {
        "feature": feature,
        "svg": svg,
        "action": action,
        "reason": f"Added by queue_manager at {datetime.now(timezone.utc).strftime('%H:%M')}",
        "assignedTo": assigned_to if assigned_to != "null" else None
    }

    data["queue"].append(new_item)
    save_status(data)
    print(f"Added: {feature}/{svg} -> {assigned_to}")


def update_terminal_status(role, status, feature=None, task=None):
    """Update terminal status"""
    data = load_status()

    if role not in data["terminals"]:
        print(f"Error: Unknown role '{role}'", file=sys.stderr)
        sys.exit(1)

    data["terminals"][role] = {
        "status": status,
        "feature": feature,
        "task": task
    }

    save_status(data)
    print(f"Updated: {role} -> {status}")


def remove_queue_item(feature, svg):
    """Remove an item from the queue"""
    data = load_status()

    original_len = len(data["queue"])
    data["queue"] = [
        item for item in data["queue"]
        if not (item["feature"] == feature and item.get("svg") == svg)
    ]

    if len(data["queue"]) < original_len:
        save_status(data)
        print(f"Removed: {feature}/{svg}")
    else:
        print(f"Not found: {feature}/{svg}", file=sys.stderr)


def log_completed(message):
    """Add a message to completedToday"""
    data = load_status()
    data["completedToday"].append(message)
    save_status(data)
    print(f"Logged: {message}")


def claim_feature(feature, generator):
    """Claim all SVGs for a feature (assign to generator)"""
    data = load_status()

    claimed = 0
    for item in data["queue"]:
        if (item["feature"] == feature or item["feature"].startswith(f"{feature}-")) \
           and item.get("assignedTo") is None:
            item["assignedTo"] = generator
            claimed += 1

    if claimed > 0:
        # Update terminal status
        full_feature = None
        for item in data["queue"]:
            if item["feature"].startswith(f"{feature}-") or item["feature"] == feature:
                full_feature = item["feature"]
                break

        data["terminals"][generator] = {
            "status": "working",
            "feature": full_feature,
            "task": f"Generating {claimed} SVGs"
        }

        save_status(data)
        print(f"Claimed {claimed} items for {generator}: {full_feature}")
    else:
        print(f"No unassigned items for feature {feature}", file=sys.stderr)


def summary():
    """Print full queue summary"""
    data = load_status()

    print("=" * 50)
    print("QUEUE SUMMARY")
    print("=" * 50)
    print(f"Last updated: {data.get('lastUpdated', 'unknown')}")
    print()

    # Generator status
    print("GENERATORS:")
    for gen in GENERATORS:
        terminal = data["terminals"].get(gen, {})
        count = sum(1 for item in data["queue"] if item.get("assignedTo") == gen)
        status = terminal.get("status", "idle")
        feature = terminal.get("feature") or "-"
        print(f"  {gen}: {status}, {count} items, feature: {feature}")

    print()

    # Queue breakdown
    print("QUEUE BY ASSIGNEE:")
    by_assignee = defaultdict(list)
    for item in data["queue"]:
        assignee = item.get("assignedTo") or "unassigned"
        by_assignee[assignee].append(item)

    for assignee, items in sorted(by_assignee.items()):
        features = set(item["feature"] for item in items)
        print(f"  {assignee}: {len(items)} items ({', '.join(features)})")

    print()

    # Unassigned work
    unassigned = [item for item in data["queue"] if item.get("assignedTo") is None]
    if unassigned:
        print(f"UNASSIGNED: {len(unassigned)} items")
        features = set(item["feature"] for item in unassigned)
        for f in features:
            count = sum(1 for item in unassigned if item["feature"] == f)
            print(f"  {f}: {count} SVGs")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "get-queue": lambda: get_queue_by_role(args[0]) if args else print("Usage: get-queue <role>"),
        "get-feature": lambda: get_queue_by_feature(args[0]) if args else print("Usage: get-feature <feature>"),
        "count-generators": count_generators,
        "find-least-loaded": find_least_loaded,
        "get-status": lambda: get_terminal_status(args[0]) if args else print("Usage: get-status <role>"),
        "add-item": lambda: add_queue_item(*args) if len(args) >= 4 else print("Usage: add-item <feature> <svg> <action> <assignedTo>"),
        "update-status": lambda: update_terminal_status(*args) if len(args) >= 2 else print("Usage: update-status <role> <status> [feature] [task]"),
        "remove-item": lambda: remove_queue_item(*args) if len(args) >= 2 else print("Usage: remove-item <feature> <svg>"),
        "log-completed": lambda: log_completed(" ".join(args)) if args else print("Usage: log-completed <message>"),
        "claim-feature": lambda: claim_feature(*args) if len(args) >= 2 else print("Usage: claim-feature <feature> <generator>"),
        "summary": summary,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
