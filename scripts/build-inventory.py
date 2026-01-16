#!/usr/bin/env python3
"""
Build Inventory - Spec inventory builder for ScriptHammer features

Generates structured inventory of all feature specifications with metadata.
Usage: python3 scripts/build-inventory.py [command] [options]

Commands:
  list                     List all specs with summary (default)
  status                   Show spec completion status
  search <term>            Search specs by keyword
  export                   Export full inventory to JSON file
  tier <n>                 Features in implementation tier N

Options:
  --json                   Output as JSON (machine-readable)
  --summary                One-line summary for CI
  --output <file>          Output file path (for export command)
  --incomplete             Show only incomplete specs

Examples:
  python3 scripts/build-inventory.py
  python3 scripts/build-inventory.py --json
  python3 scripts/build-inventory.py search auth
  python3 scripts/build-inventory.py tier 1
  python3 scripts/build-inventory.py export --output inventory.json
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Find project root (parent of scripts/)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
FEATURES_DIR = PROJECT_ROOT / "features"
IMPLEMENTATION_ORDER = FEATURES_DIR / "IMPLEMENTATION_ORDER.md"
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
INVENTORIES_DIR = PROJECT_ROOT / ".claude" / "inventories"


def parse_spec_file(spec_path: Path) -> dict:
    """Parse a spec.md file and extract metadata"""
    if not spec_path.exists():
        return {}

    content = spec_path.read_text(encoding="utf-8")

    # Extract feature number and name from path
    feature_dir = spec_path.parent.name
    match = re.match(r"(\d{3})-(.+)", feature_dir)
    feature_num = match.group(1) if match else "000"
    feature_slug = match.group(2) if match else feature_dir

    spec = {
        "number": feature_num,
        "slug": feature_slug,
        "path": str(spec_path.relative_to(PROJECT_ROOT)),
        "title": "",
        "status": "draft",
        "priority": "",
        "sections": [],
        "acceptance_criteria": 0,
        "user_stories": 0,
        "dependencies": [],
        "blocks": [],
        "wireframe_count": 0,
        "has_plan": False,
        "has_tasks": False,
        "line_count": len(content.splitlines()),
    }

    # Extract title from first heading
    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if title_match:
        spec["title"] = title_match.group(1).strip()

    # Extract status/priority from metadata section
    status_match = re.search(r"Status:\s*(\w+)", content, re.IGNORECASE)
    if status_match:
        spec["status"] = status_match.group(1).lower()

    priority_match = re.search(r"Priority:\s*(P\d|Critical|High|Medium|Low)", content, re.IGNORECASE)
    if priority_match:
        spec["priority"] = priority_match.group(1)

    # Count sections
    sections = re.findall(r"^##\s+(.+)$", content, re.MULTILINE)
    spec["sections"] = sections

    # Count acceptance criteria (checkbox items in AC section)
    ac_section = re.search(r"## Acceptance Criteria(.+?)(?=^##|\Z)", content, re.MULTILINE | re.DOTALL)
    if ac_section:
        spec["acceptance_criteria"] = len(re.findall(r"^\s*-\s*\[[ x]\]", ac_section.group(1), re.MULTILINE))

    # Count user stories
    stories_section = re.search(r"## User Stories(.+?)(?=^##|\Z)", content, re.MULTILINE | re.DOTALL)
    if stories_section:
        spec["user_stories"] = len(re.findall(r"^\s*-\s+As a", stories_section.group(1), re.MULTILINE))

    # Extract dependencies
    deps_match = re.search(r"Dependencies:\s*(.+)", content, re.IGNORECASE)
    if deps_match:
        deps_text = deps_match.group(1)
        spec["dependencies"] = [d.strip() for d in re.findall(r"(\d{3})", deps_text)]

    # Check for related files
    feature_path = spec_path.parent
    spec["has_plan"] = (feature_path / "plan.md").exists()
    spec["has_tasks"] = (feature_path / "tasks.md").exists()

    # Count wireframes
    wireframe_dir = WIREFRAMES_DIR / feature_dir
    if wireframe_dir.exists():
        spec["wireframe_count"] = len(list(wireframe_dir.glob("*.svg")))

    return spec


def get_implementation_tiers() -> dict[str, int]:
    """Parse IMPLEMENTATION_ORDER.md and return feature -> tier mapping"""
    tiers = {}
    if not IMPLEMENTATION_ORDER.exists():
        return tiers

    content = IMPLEMENTATION_ORDER.read_text(encoding="utf-8")
    current_tier = 0

    for line in content.splitlines():
        # Match "### Tier N:" or "## Tier N" patterns
        tier_match = re.match(r"#{2,3}\s+Tier\s*(\d+)", line, re.IGNORECASE)
        if tier_match:
            current_tier = int(tier_match.group(1))
            continue

        # Match feature numbers: "**000**" (bold format in tier tables)
        feature_match = re.search(r"\*\*(\d{3})\*\*", line)
        if feature_match and current_tier > 0:
            tiers[feature_match.group(1)] = current_tier

    return tiers


def build_inventory() -> list[dict]:
    """Build complete spec inventory"""
    specs = []
    tiers = get_implementation_tiers()

    if not FEATURES_DIR.exists():
        return specs

    # Recursively find all spec.md files in features directory
    # Structure: features/<category>/<NNN-feature>/spec.md
    for spec_path in sorted(FEATURES_DIR.rglob("*/spec.md")):
        feature_dir = spec_path.parent
        if not re.match(r"\d{3}-", feature_dir.name):
            continue

        spec = parse_spec_file(spec_path)
        # Store category for context
        spec["category"] = feature_dir.parent.name if feature_dir.parent != FEATURES_DIR else ""
        spec["tier"] = tiers.get(spec["number"], 0)
        specs.append(spec)

    # Sort by feature number
    specs.sort(key=lambda s: s.get("number", "999"))

    return specs


def calc_completion(spec: dict) -> float:
    """Calculate spec completion percentage"""
    score = 0
    max_score = 5

    if spec.get("title"):
        score += 1
    if spec.get("acceptance_criteria", 0) > 0:
        score += 1
    if spec.get("user_stories", 0) > 0:
        score += 1
    if spec.get("has_plan"):
        score += 1
    if spec.get("has_tasks"):
        score += 1

    return round(score / max_score * 100)


def cmd_list(specs: list[dict], args) -> dict:
    """List all specs with summary"""
    results = []
    for spec in specs:
        completion = calc_completion(spec)
        results.append({
            "number": spec["number"],
            "title": spec["title"],
            "tier": spec["tier"],
            "ac": spec["acceptance_criteria"],
            "stories": spec["user_stories"],
            "wireframes": spec["wireframe_count"],
            "completion": completion,
        })

    if args.incomplete:
        results = [r for r in results if r["completion"] < 100]

    return {
        "command": "list",
        "total": len(results),
        "specs": results,
    }


def cmd_status(specs: list[dict], args) -> dict:
    """Show spec completion status"""
    status_counts = defaultdict(int)
    tier_counts = defaultdict(lambda: {"total": 0, "complete": 0})

    for spec in specs:
        completion = calc_completion(spec)
        status_counts["total"] += 1

        if completion == 100:
            status_counts["complete"] += 1
        elif completion >= 60:
            status_counts["partial"] += 1
        else:
            status_counts["draft"] += 1

        tier = spec.get("tier", 0)
        tier_counts[tier]["total"] += 1
        if completion == 100:
            tier_counts[tier]["complete"] += 1

    return {
        "command": "status",
        "summary": dict(status_counts),
        "by_tier": dict(tier_counts),
        "overall_completion": round(status_counts.get("complete", 0) / max(status_counts.get("total", 1), 1) * 100),
    }


def cmd_search(specs: list[dict], args) -> dict:
    """Search specs by keyword"""
    term = args.args[0].lower() if args.args else ""
    if not term:
        return {"command": "search", "error": "Search term required", "results": []}

    results = []
    for spec in specs:
        # Search in title, slug, and sections
        searchable = f"{spec['title']} {spec['slug']} {' '.join(spec.get('sections', []))}".lower()
        if term in searchable:
            results.append({
                "number": spec["number"],
                "title": spec["title"],
                "path": spec["path"],
                "match_context": spec["slug"],
            })

    return {
        "command": "search",
        "term": term,
        "results": results,
        "count": len(results),
    }


def cmd_tier(specs: list[dict], args) -> dict:
    """Show features in specific tier"""
    try:
        tier_num = int(args.args[0]) if args.args else 1
    except ValueError:
        tier_num = 1

    results = [
        {
            "number": spec["number"],
            "title": spec["title"],
            "completion": calc_completion(spec),
        }
        for spec in specs
        if spec.get("tier") == tier_num
    ]

    return {
        "command": "tier",
        "tier": tier_num,
        "features": results,
        "count": len(results),
    }


def cmd_export(specs: list[dict], args) -> dict:
    """Export full inventory to file"""
    output_path = args.output or "spec-inventory.json"

    export_data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "project": "ScriptHammer",
        "total_specs": len(specs),
        "specs": specs,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2)

    return {
        "command": "export",
        "output": output_path,
        "specs_exported": len(specs),
    }


def format_output(result: dict, args) -> str:
    """Format result for display"""
    if args.json:
        return json.dumps(result, indent=2)

    if args.summary:
        cmd = result.get("command", "")
        if cmd == "list":
            return f"Specs: {result['total']} total"
        elif cmd == "status":
            s = result["summary"]
            return f"Specs: {s.get('complete', 0)}/{s.get('total', 0)} complete ({result['overall_completion']}%)"
        elif cmd == "search":
            return f"Found: {result['count']} specs matching '{result.get('term', '')}'"
        elif cmd == "tier":
            return f"Tier {result['tier']}: {result['count']} features"
        elif cmd == "export":
            return f"Exported: {result['specs_exported']} specs to {result['output']}"
        return str(result)

    # Human-readable format
    lines = []
    cmd = result.get("command", "")

    if cmd == "list":
        lines.append(f"# Spec Inventory ({result['total']} specs)")
        lines.append("")
        lines.append("| # | Title | Tier | AC | Stories | SVGs | Complete |")
        lines.append("|---|-------|------|----|---------| -----|----------|")
        for spec in result["specs"]:
            lines.append(
                f"| {spec['number']} | {spec['title'][:40]} | {spec['tier']} | "
                f"{spec['ac']} | {spec['stories']} | {spec['wireframes']} | {spec['completion']}% |"
            )

    elif cmd == "status":
        s = result["summary"]
        lines.append("# Spec Status")
        lines.append("")
        lines.append(f"**Overall**: {result['overall_completion']}% complete")
        lines.append("")
        lines.append(f"- Complete: {s.get('complete', 0)}")
        lines.append(f"- Partial: {s.get('partial', 0)}")
        lines.append(f"- Draft: {s.get('draft', 0)}")
        lines.append("")
        lines.append("**By Tier:**")
        for tier, counts in sorted(result["by_tier"].items()):
            lines.append(f"- Tier {tier}: {counts['complete']}/{counts['total']} complete")

    elif cmd == "search":
        lines.append(f"# Search Results: '{result['term']}'")
        lines.append("")
        if result["results"]:
            for r in result["results"]:
                lines.append(f"- **{r['number']}** {r['title']}")
                lines.append(f"  {r['path']}")
        else:
            lines.append("No results found.")

    elif cmd == "tier":
        lines.append(f"# Tier {result['tier']} Features ({result['count']})")
        lines.append("")
        for f in result["features"]:
            lines.append(f"- **{f['number']}** {f['title']} ({f['completion']}%)")

    elif cmd == "export":
        lines.append(f"Exported {result['specs_exported']} specs to {result['output']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Spec Inventory Builder")
    parser.add_argument("command", nargs="?", default="list",
                        help="Command (list, status, search, export, tier)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")
    parser.add_argument("--output", help="Output file path (for export)")
    parser.add_argument("--incomplete", action="store_true", help="Show only incomplete specs")

    args = parser.parse_args()

    # Build inventory
    specs = build_inventory()

    # Execute command
    commands = {
        "list": cmd_list,
        "status": cmd_status,
        "search": cmd_search,
        "tier": cmd_tier,
        "export": cmd_export,
    }

    cmd_func = commands.get(args.command, cmd_list)
    result = cmd_func(specs, args)

    print(format_output(result, args))
    return 0


if __name__ == "__main__":
    sys.exit(main())
