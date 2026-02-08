#!/usr/bin/env python3
"""
Wireframe Status Manager - CLI for wireframe-status.json operations

Replaces Claude logic in /wireframe-status.md skill to reduce token usage.
Usage: python3 wireframe-status-manager.py <command> [args]

Commands:
  summary                       Show status counts by type
  get <feature>                 Get status for a feature (by number or name)
  set <feature> <status>        Update feature + all SVGs to status
  set-svg <feature> <svg> <status>  Update single SVG status
  list <status>                 List features with given status
  features                      List all tracked features
  validate                      Check JSON structure integrity
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter
from typing import Dict, Any, Optional, List

SCRIPT_DIR = Path(__file__).parent
STATUS_FILE = SCRIPT_DIR / "wireframe-status.json"

# Valid status values
VALID_STATUSES = [
    "draft",        # Initial /wireframe generation
    "regenerating", # Being regenerated after issues
    "review",       # Under /wireframe-review
    "reviewed",     # Completed review (legacy, maps to approved)
    "issues",       # Review found problems (needs regenerate)
    "patchable",    # Minor fixes only
    "approved",     # Passed review
    "pass",         # SVG-level: passed validation
    "planning",     # In /speckit.plan phase
    "tasked",       # Has tasks.md
    "inprogress",   # /speckit.implement started
    "complete",     # Implementation done
    "blocked",      # Waiting on dependency
]

# Status display info
STATUS_INFO = {
    "draft": ("📝", "Initial generation"),
    "regenerating": ("🔄", "Being regenerated"),
    "review": ("👁️", "Under review"),
    "reviewed": ("✅", "Review completed"),
    "issues": ("🔴", "Has problems"),
    "patchable": ("🟡", "Minor fixes needed"),
    "approved": ("✅", "Passed review"),
    "pass": ("✅", "Validation passed"),
    "planning": ("📋", "In planning phase"),
    "tasked": ("📝", "Has tasks.md"),
    "inprogress": ("🚧", "Implementation started"),
    "complete": ("✅", "Implementation done"),
    "blocked": ("⛔", "Waiting on dependency"),
}


def load_status() -> Dict[str, Any]:
    """Load wireframe-status.json"""
    if not STATUS_FILE.exists():
        return {}
    with open(STATUS_FILE) as f:
        return json.load(f)


def save_status(data: Dict[str, Any]) -> None:
    """Save wireframe-status.json with validation"""
    try:
        json.dumps(data)  # Validate
    except (TypeError, ValueError) as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        sys.exit(1)

    with open(STATUS_FILE, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def find_feature(data: Dict, query: str) -> Optional[str]:
    """Find feature by number or name prefix"""
    # Exact match
    if query in data:
        return query

    # Match by number prefix (e.g., "000" matches "000-rls-implementation")
    for key in data.keys():
        if key.startswith(f"{query}-") or key == query:
            return key

    # Partial match
    for key in data.keys():
        if query in key:
            return key

    return None


def summary() -> None:
    """Show status counts by type"""
    data = load_status()

    if not data:
        print("No features tracked.")
        return

    # Count feature-level statuses
    counts = Counter()
    for feature_data in data.values():
        status = feature_data.get("status", "draft")
        counts[status] += 1

    # Format output
    parts = []
    for status in ["approved", "reviewed", "pass", "patchable", "issues", "review", "draft", "regenerating", "blocked"]:
        if counts[status] > 0:
            emoji, _ = STATUS_INFO.get(status, ("", ""))
            parts.append(f"{counts[status]} {status}")

    total = sum(counts.values())
    print(f"Status: {', '.join(parts)}. ({total} features)")


def get_feature(feature_query: str) -> None:
    """Get status for a feature"""
    data = load_status()
    feature_key = find_feature(data, feature_query)

    if not feature_key:
        print(f"Error: Feature '{feature_query}' not found", file=sys.stderr)
        print("Available features:", file=sys.stderr)
        for k in sorted(data.keys()):
            print(f"  {k}", file=sys.stderr)
        sys.exit(1)

    feature_data = data[feature_key]
    status = feature_data.get("status", "draft")
    emoji, desc = STATUS_INFO.get(status, ("", ""))

    print(f"{feature_key}")
    print(f"  Status: {status} {emoji}")

    svgs = feature_data.get("svgs", {})
    if svgs:
        print(f"  SVGs ({len(svgs)}):")
        for svg_name, svg_status in svgs.items():
            svg_emoji, _ = STATUS_INFO.get(svg_status, ("", ""))
            print(f"    {svg_name}: {svg_status} {svg_emoji}")

    notes = feature_data.get("notes")
    if notes:
        # Truncate long notes
        if len(notes) > 100:
            notes = notes[:97] + "..."
        print(f"  Notes: {notes}")

    validation = feature_data.get("validation")
    if validation:
        errors = sum(v for k, v in validation.items() if k.endswith("_errors") and isinstance(v, int))
        review_date = validation.get("review_date", "unknown")
        print(f"  Validation: {errors} errors (reviewed {review_date})")


def set_feature_status(feature_query: str, new_status: str) -> None:
    """Update feature + all SVGs to status"""
    if new_status not in VALID_STATUSES:
        print(f"Error: Invalid status '{new_status}'", file=sys.stderr)
        print(f"Valid: {', '.join(VALID_STATUSES)}", file=sys.stderr)
        sys.exit(1)

    data = load_status()
    feature_key = find_feature(data, feature_query)

    if not feature_key:
        print(f"Error: Feature '{feature_query}' not found", file=sys.stderr)
        sys.exit(1)

    old_status = data[feature_key].get("status", "draft")
    data[feature_key]["status"] = new_status

    # Update all SVGs to match
    svg_count = 0
    svgs = data[feature_key].get("svgs", {})
    for svg_name in svgs:
        svgs[svg_name] = new_status
        svg_count += 1

    save_status(data)

    emoji, _ = STATUS_INFO.get(new_status, ("", ""))
    print(f"Updated {feature_key}: {old_status} → {new_status} {emoji}")
    if svg_count > 0:
        print(f"  {svg_count} SVGs updated to {new_status}")


def set_svg_status(feature_query: str, svg_query: str, new_status: str) -> None:
    """Update single SVG status"""
    if new_status not in VALID_STATUSES:
        print(f"Error: Invalid status '{new_status}'", file=sys.stderr)
        print(f"Valid: {', '.join(VALID_STATUSES)}", file=sys.stderr)
        sys.exit(1)

    data = load_status()
    feature_key = find_feature(data, feature_query)

    if not feature_key:
        print(f"Error: Feature '{feature_query}' not found", file=sys.stderr)
        sys.exit(1)

    svgs = data[feature_key].get("svgs", {})

    # Find SVG by number or name
    svg_key = None
    for name in svgs:
        if name == svg_query or name.startswith(f"{svg_query}-") or svg_query in name:
            svg_key = name
            break

    if not svg_key:
        print(f"Error: SVG '{svg_query}' not found in {feature_key}", file=sys.stderr)
        print("Available SVGs:", file=sys.stderr)
        for k in svgs:
            print(f"  {k}", file=sys.stderr)
        sys.exit(1)

    old_status = svgs[svg_key]
    svgs[svg_key] = new_status

    save_status(data)

    emoji, _ = STATUS_INFO.get(new_status, ("", ""))
    print(f"Updated {feature_key}/{svg_key}: {old_status} → {new_status} {emoji}")


def list_by_status(status_filter: str) -> None:
    """List features with given status"""
    if status_filter not in VALID_STATUSES:
        print(f"Warning: '{status_filter}' not a standard status", file=sys.stderr)

    data = load_status()
    matches = []

    for feature_key, feature_data in data.items():
        if feature_data.get("status") == status_filter:
            matches.append(feature_key)

    if not matches:
        print(f"No features with status '{status_filter}'")
        return

    emoji, desc = STATUS_INFO.get(status_filter, ("", ""))
    print(f"{status_filter} {emoji} ({len(matches)} features):")
    for feature in sorted(matches):
        svg_count = len(data[feature].get("svgs", {}))
        print(f"  {feature} ({svg_count} SVGs)")


def list_features() -> None:
    """List all tracked features"""
    data = load_status()

    if not data:
        print("No features tracked.")
        return

    print(f"Tracked features ({len(data)}):")
    for feature_key in sorted(data.keys()):
        feature_data = data[feature_key]
        status = feature_data.get("status", "draft")
        emoji, _ = STATUS_INFO.get(status, ("", ""))
        svg_count = len(feature_data.get("svgs", {}))
        print(f"  {feature_key}: {status} {emoji} ({svg_count} SVGs)")


def validate_json() -> None:
    """Check JSON structure integrity"""
    data = load_status()
    errors = []

    for feature_key, feature_data in data.items():
        # Check feature has status
        if "status" not in feature_data:
            errors.append(f"{feature_key}: missing 'status' field")

        # Check status is valid
        status = feature_data.get("status")
        if status and status not in VALID_STATUSES:
            errors.append(f"{feature_key}: invalid status '{status}'")

        # Check SVGs structure
        svgs = feature_data.get("svgs", {})
        if not isinstance(svgs, dict):
            errors.append(f"{feature_key}: 'svgs' should be object, got {type(svgs).__name__}")
            continue

        for svg_name, svg_status in svgs.items():
            if svg_status not in VALID_STATUSES:
                errors.append(f"{feature_key}/{svg_name}: invalid status '{svg_status}'")

    if errors:
        print(f"Validation FAILED ({len(errors)} errors):")
        for err in errors:
            print(f"  {err}")
        sys.exit(1)
    else:
        print(f"Validation PASSED ({len(data)} features)")


def show_menu(feature_query: str) -> None:
    """Show status options for a feature (for Claude to use with AskUserQuestion)"""
    data = load_status()
    feature_key = find_feature(data, feature_query)

    if not feature_key:
        print(f"Error: Feature '{feature_query}' not found", file=sys.stderr)
        sys.exit(1)

    current = data[feature_key].get("status", "draft")
    current_emoji, _ = STATUS_INFO.get(current, ("", ""))

    print(f"Current: {feature_key} → {current} {current_emoji}")
    print()
    print("Status options:")
    for i, status in enumerate(["draft", "regenerating", "review", "issues", "patchable", "approved", "planning", "tasked", "inprogress", "complete", "blocked"], 1):
        emoji, desc = STATUS_INFO.get(status, ("", ""))
        marker = " ← current" if status == current else ""
        print(f"  {i:2}. {status} {emoji} - {desc}{marker}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "summary": summary,
        "get": lambda: get_feature(args[0]) if args else print("Usage: get <feature>"),
        "set": lambda: set_feature_status(args[0], args[1]) if len(args) >= 2 else print("Usage: set <feature> <status>"),
        "set-svg": lambda: set_svg_status(args[0], args[1], args[2]) if len(args) >= 3 else print("Usage: set-svg <feature> <svg> <status>"),
        "list": lambda: list_by_status(args[0]) if args else print("Usage: list <status>"),
        "features": list_features,
        "validate": validate_json,
        "menu": lambda: show_menu(args[0]) if args else print("Usage: menu <feature>"),
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
