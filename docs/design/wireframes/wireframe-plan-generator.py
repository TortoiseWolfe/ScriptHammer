#!/usr/bin/env python3
"""
Wireframe Plan Generator - Spec parsing and assignment creation

Parses feature specs to extract requirements, suggests SVG count,
and creates assignments.json templates.

Usage: python3 wireframe-plan-generator.py <command> [args]

Commands:
  parse <feature>               Parse spec.md and extract requirements
  suggest <feature>             Suggest SVG count and names
  create <feature>              Create assignments.json template
  assign <feature> [generator]  Assign to generator and update queue
  summary <feature>             Show planning summary
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

SCRIPT_DIR = Path(__file__).parent
WIREFRAMES_DIR = SCRIPT_DIR
FEATURES_DIR = SCRIPT_DIR.parent.parent.parent / "features"
QUEUE_MANAGER = SCRIPT_DIR / "queue_manager.py"


def find_feature_dir(feature_num: str) -> Optional[Path]:
    """Find feature directory by number prefix"""
    for category_dir in FEATURES_DIR.iterdir():
        if not category_dir.is_dir():
            continue
        for feature_dir in category_dir.iterdir():
            if feature_dir.is_dir() and feature_dir.name.startswith(f"{feature_num}-"):
                return feature_dir
    return None


def find_spec_file(feature_num: str) -> Optional[Path]:
    """Find spec.md for a feature"""
    feature_dir = find_feature_dir(feature_num)
    if feature_dir:
        spec_file = feature_dir / "spec.md"
        if spec_file.exists():
            return spec_file
    return None


def get_wireframe_dir(feature_num: str) -> Path:
    """Get or create wireframe directory for feature"""
    feature_dir = find_feature_dir(feature_num)
    if not feature_dir:
        raise ValueError(f"Feature {feature_num} not found")

    wireframe_dir = WIREFRAMES_DIR / feature_dir.name
    return wireframe_dir


def parse_spec(feature_num: str) -> Dict[str, Any]:
    """Parse spec.md and extract structured data"""
    spec_file = find_spec_file(feature_num)
    if not spec_file:
        raise ValueError(f"No spec.md found for feature {feature_num}")

    content = spec_file.read_text()

    # Extract feature name from first heading
    name_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    feature_name = name_match.group(1) if name_match else "Unknown"

    # Extract User Stories (US-NNN)
    user_stories = []
    us_pattern = r'(US-\d+)[:\s]+(.+?)(?=\n(?:US-|\n|$))'
    for match in re.finditer(us_pattern, content, re.DOTALL):
        user_stories.append({
            "id": match.group(1),
            "description": match.group(2).strip()[:100]
        })

    # Also try bullet format: - **US-001**: Description
    us_bullet = r'\*\*(US-\d+)\*\*[:\s]+(.+?)(?=\n)'
    for match in re.finditer(us_bullet, content):
        if not any(us["id"] == match.group(1) for us in user_stories):
            user_stories.append({
                "id": match.group(1),
                "description": match.group(2).strip()[:100]
            })

    # Extract Functional Requirements (FR-NNN)
    requirements = []
    fr_pattern = r'(FR-\d+)[:\s]+(.+?)(?=\n(?:FR-|\n|$))'
    for match in re.finditer(fr_pattern, content, re.DOTALL):
        requirements.append({
            "id": match.group(1),
            "description": match.group(2).strip()[:100]
        })

    fr_bullet = r'\*\*(FR-\d+)\*\*[:\s]+(.+?)(?=\n)'
    for match in re.finditer(fr_bullet, content):
        if not any(fr["id"] == match.group(1) for fr in requirements):
            requirements.append({
                "id": match.group(1),
                "description": match.group(2).strip()[:100]
            })

    # Extract Success Criteria (SC-NNN)
    criteria = []
    sc_pattern = r'(SC-\d+)[:\s]+(.+?)(?=\n(?:SC-|\n|$))'
    for match in re.finditer(sc_pattern, content, re.DOTALL):
        criteria.append({
            "id": match.group(1),
            "description": match.group(2).strip()[:100]
        })

    sc_bullet = r'\*\*(SC-\d+)\*\*[:\s]+(.+?)(?=\n)'
    for match in re.finditer(sc_bullet, content):
        if not any(sc["id"] == match.group(1) for sc in criteria):
            criteria.append({
                "id": match.group(1),
                "description": match.group(2).strip()[:100]
            })

    return {
        "feature_name": feature_name,
        "spec_file": str(spec_file),
        "user_stories": user_stories,
        "requirements": requirements,
        "criteria": criteria,
        "us_count": len(user_stories),
        "fr_count": len(requirements),
        "sc_count": len(criteria)
    }


def suggest_svgs(feature_num: str) -> Dict[str, Any]:
    """Suggest SVG count and names based on spec analysis"""
    parsed = parse_spec(feature_num)

    us_count = parsed["us_count"]
    fr_count = parsed["fr_count"]

    # Heuristics for SVG count
    if us_count <= 2 and fr_count <= 5:
        svg_count = 1
        complexity = "simple"
    elif us_count <= 4 and fr_count <= 10:
        svg_count = 2
        complexity = "moderate"
    elif us_count <= 6 and fr_count <= 15:
        svg_count = 3
        complexity = "complex"
    else:
        svg_count = 4
        complexity = "very complex"

    # Generate suggested SVG names based on user stories
    suggestions = []
    if parsed["user_stories"]:
        for i, us in enumerate(parsed["user_stories"][:svg_count], 1):
            # Create kebab-case name from description
            desc = us["description"][:40]
            name = re.sub(r'[^a-zA-Z0-9\s]', '', desc)
            name = re.sub(r'\s+', '-', name.strip().lower())
            name = name[:30]  # Truncate
            suggestions.append({
                "svg": f"{i:02d}-{name}.svg",
                "focus": us["description"][:80],
                "linked_us": [us["id"]]
            })
    else:
        # Fallback generic names
        suggestions.append({
            "svg": "01-overview.svg",
            "focus": "Feature overview and main flow",
            "linked_us": []
        })
        if svg_count >= 2:
            suggestions.append({
                "svg": "02-details.svg",
                "focus": "Detailed interactions and states",
                "linked_us": []
            })

    return {
        "feature_num": feature_num,
        "feature_name": parsed["feature_name"],
        "complexity": complexity,
        "suggested_count": svg_count,
        "suggestions": suggestions,
        "parsed": parsed
    }


def create_assignments(feature_num: str) -> Dict[str, Any]:
    """Create assignments.json template"""
    suggestion = suggest_svgs(feature_num)
    feature_dir = find_feature_dir(feature_num)

    if not feature_dir:
        raise ValueError(f"Feature {feature_num} not found")

    assignments = {
        "feature": feature_dir.name,
        "plannedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "svgCount": suggestion["suggested_count"],
        "assignments": []
    }

    for sug in suggestion["suggestions"]:
        assignments["assignments"].append({
            "svg": sug["svg"],
            "focus": sug["focus"],
            "userStories": sug["linked_us"],
            "requirements": [],
            "mode": "new"
        })

    return assignments


def save_assignments(feature_num: str) -> Path:
    """Create assignments.json and save to wireframe directory"""
    assignments = create_assignments(feature_num)

    wireframe_dir = get_wireframe_dir(feature_num)
    wireframe_dir.mkdir(exist_ok=True)

    assignments_file = wireframe_dir / "assignments.json"
    with open(assignments_file, "w") as f:
        json.dump(assignments, f, indent=2)
        f.write("\n")

    return assignments_file


def find_least_loaded_generator() -> str:
    """Call queue_manager.py to find least loaded generator"""
    result = subprocess.run(
        ["python3", str(QUEUE_MANAGER), "find-least-loaded"],
        capture_output=True,
        text=True,
        cwd=SCRIPT_DIR
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return "generator-1"  # Default


def assign_to_generator(feature_num: str, generator: Optional[str] = None) -> Dict[str, Any]:
    """Assign feature to generator and update queue"""
    # Create assignments if not exist
    wireframe_dir = get_wireframe_dir(feature_num)
    assignments_file = wireframe_dir / "assignments.json"

    if not assignments_file.exists():
        save_assignments(feature_num)

    with open(assignments_file) as f:
        assignments = json.load(f)

    # Find generator if not specified
    if not generator:
        generator = find_least_loaded_generator()

    # Use queue_manager.py to claim feature
    feature_name = assignments["feature"]
    result = subprocess.run(
        ["python3", str(QUEUE_MANAGER), "claim-feature", feature_num, generator],
        capture_output=True,
        text=True,
        cwd=SCRIPT_DIR
    )

    # If claim didn't work (no queue items), add them first
    if "No unassigned" in result.stderr or result.returncode != 0:
        # Add items to queue manually
        for assignment in assignments["assignments"]:
            subprocess.run(
                ["python3", str(QUEUE_MANAGER), "add-item",
                 feature_name, assignment["svg"], "GENERATE", generator],
                capture_output=True,
                text=True,
                cwd=SCRIPT_DIR
            )

    return {
        "feature": feature_name,
        "generator": generator,
        "svg_count": len(assignments["assignments"]),
        "assignments": assignments["assignments"]
    }


def show_parse(feature_num: str) -> None:
    """Show parsed spec data"""
    parsed = parse_spec(feature_num)

    print(f"Feature: {parsed['feature_name']}")
    print(f"Spec: {parsed['spec_file']}")
    print()

    print(f"User Stories ({parsed['us_count']}):")
    for us in parsed["user_stories"]:
        print(f"  {us['id']}: {us['description'][:60]}...")

    print()
    print(f"Requirements ({parsed['fr_count']}):")
    for fr in parsed["requirements"]:
        print(f"  {fr['id']}: {fr['description'][:60]}...")

    print()
    print(f"Criteria ({parsed['sc_count']}):")
    for sc in parsed["criteria"]:
        print(f"  {sc['id']}: {sc['description'][:60]}...")


def show_suggest(feature_num: str) -> None:
    """Show SVG suggestions"""
    suggestion = suggest_svgs(feature_num)

    print(f"Feature: {suggestion['feature_name']}")
    print(f"Complexity: {suggestion['complexity']}")
    print(f"Suggested SVGs: {suggestion['suggested_count']}")
    print()

    print("Suggestions:")
    for sug in suggestion["suggestions"]:
        us_str = ", ".join(sug["linked_us"]) if sug["linked_us"] else "(none)"
        print(f"  {sug['svg']}")
        print(f"    Focus: {sug['focus']}")
        print(f"    User Stories: {us_str}")


def show_create(feature_num: str) -> None:
    """Create and show assignments.json"""
    assignments_file = save_assignments(feature_num)
    print(f"Created: {assignments_file}")
    print()

    with open(assignments_file) as f:
        assignments = json.load(f)

    print(json.dumps(assignments, indent=2))


def show_assign(feature_num: str, generator: Optional[str] = None) -> None:
    """Assign to generator and show result"""
    result = assign_to_generator(feature_num, generator)

    print("WIREFRAME PLAN COMPLETE")
    print()
    print(f"Feature: {result['feature']}")
    print(f"SVGs Planned: {result['svg_count']}")
    print(f"Assigned to: {result['generator']}")
    print()
    print("Assignments:")
    for a in result["assignments"]:
        us_str = ", ".join(a["userStories"]) if a["userStories"] else "(none)"
        print(f"  {a['svg']} → [{us_str}] - \"{a['focus'][:40]}...\"")
    print()
    print(f"Queue updated. Run /next in {result['generator'].title()} terminal to begin.")


def show_summary(feature_num: str) -> None:
    """Show full planning summary"""
    wireframe_dir = get_wireframe_dir(feature_num)
    assignments_file = wireframe_dir / "assignments.json"

    if not assignments_file.exists():
        print(f"No assignments.json for feature {feature_num}")
        print("Run: python3 wireframe-plan-generator.py create {feature_num}")
        return

    with open(assignments_file) as f:
        assignments = json.load(f)

    print(f"Feature: {assignments['feature']}")
    print(f"Planned: {assignments['plannedAt']}")
    print(f"SVG Count: {assignments['svgCount']}")
    print()

    # Check existing SVGs
    existing_svgs = list(wireframe_dir.glob("*.svg"))
    print(f"Existing SVGs: {len(existing_svgs)}/{assignments['svgCount']}")

    for a in assignments["assignments"]:
        svg_path = wireframe_dir / a["svg"]
        status = "✓" if svg_path.exists() else "✗"
        print(f"  {status} {a['svg']} - {a['focus'][:50]}...")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    try:
        if command == "parse":
            if not args:
                print("Usage: parse <feature>", file=sys.stderr)
                sys.exit(1)
            show_parse(args[0])

        elif command == "suggest":
            if not args:
                print("Usage: suggest <feature>", file=sys.stderr)
                sys.exit(1)
            show_suggest(args[0])

        elif command == "create":
            if not args:
                print("Usage: create <feature>", file=sys.stderr)
                sys.exit(1)
            show_create(args[0])

        elif command == "assign":
            if not args:
                print("Usage: assign <feature> [generator]", file=sys.stderr)
                sys.exit(1)
            generator = args[1] if len(args) > 1 else None
            show_assign(args[0], generator)

        elif command == "summary":
            if not args:
                print("Usage: summary <feature>", file=sys.stderr)
                sys.exit(1)
            show_summary(args[0])

        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            print(__doc__)
            sys.exit(1)

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
