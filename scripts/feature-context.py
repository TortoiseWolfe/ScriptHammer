#!/usr/bin/env python3
"""
Feature Context - Load feature context for skills as structured JSON

Eliminates AI re-parsing of spec files. Single parse, consistent data model.
Usage: python3 scripts/feature-context.py <feature> [options]

Commands:
  <feature>                Load full context for feature (default)
  list                     List all features
  search <term>            Search features by name/description

Options:
  --spec                   Spec.md parsed content only
  --stories                User stories only
  --wireframes             Wireframe status only
  --deps                   Dependencies only
  --full                   Everything combined (default)
  --json                   Output as JSON (default for scripts)
  --summary                One-line summary

Examples:
  python3 scripts/feature-context.py 003
  python3 scripts/feature-context.py 003-user-authentication
  python3 scripts/feature-context.py 003 --spec
  python3 scripts/feature-context.py 003 --wireframes --json
  python3 scripts/feature-context.py list
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
FEATURES_DIR = PROJECT_ROOT / "features"
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
IMPL_ORDER_FILE = FEATURES_DIR / "IMPLEMENTATION_ORDER.md"
CACHE_DIR = PROJECT_ROOT / ".cache" / "feature-context"

# Feature categories (subdirectories)
CATEGORIES = [
    "foundation",
    "core-features",
    "auth-oauth",
    "enhancements",
    "integrations",
    "polish",
    "testing",
    "payments",
    "code-quality"
]


def find_feature_dir(feature_id: str) -> tuple:
    """Find feature directory by number or name"""
    feature_id = feature_id.lstrip("0") if feature_id.isdigit() else feature_id
    feature_num = feature_id.zfill(3) if feature_id.isdigit() else None

    for category in CATEGORIES:
        category_dir = FEATURES_DIR / category
        if not category_dir.exists():
            continue

        for feature_dir in category_dir.iterdir():
            if not feature_dir.is_dir():
                continue

            # Match by number prefix
            if feature_num and feature_dir.name.startswith(f"{feature_num}-"):
                return feature_dir, category

            # Match by full name
            if feature_dir.name == feature_id:
                return feature_dir, category

            # Match by partial name
            if feature_id.lower() in feature_dir.name.lower():
                return feature_dir, category

    return None, None


def parse_spec_file(spec_file: Path) -> dict:
    """Parse spec.md and extract structured content"""
    spec = {
        "title": "",
        "overview": "",
        "functional_requirements": [],
        "technical_requirements": [],
        "user_stories": [],
        "acceptance_criteria": [],
        "out_of_scope": [],
        "dependencies": [],
        "risks": [],
        "raw_length": 0
    }

    if not spec_file.exists():
        return spec

    content = spec_file.read_text()
    spec["raw_length"] = len(content)

    # Extract title
    title_match = re.search(r'^# Feature Specification:\s*(.+)$', content, re.MULTILINE)
    if title_match:
        spec["title"] = title_match.group(1).strip()

    # Extract overview/summary
    overview_match = re.search(r'## (?:Overview|Summary)\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if overview_match:
        spec["overview"] = overview_match.group(1).strip()[:500]

    # Extract functional requirements
    fr_match = re.search(r'## Functional Requirements\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if fr_match:
        for line in fr_match.group(1).split('\n'):
            req_match = re.match(r'[-*]\s*\*?\*?(FR-\d+)\*?\*?[:\s]+(.+)', line)
            if req_match:
                spec["functional_requirements"].append({
                    "id": req_match.group(1),
                    "description": req_match.group(2).strip()
                })

    # Extract user stories
    us_match = re.search(r'## User Stories\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if us_match:
        us_text = us_match.group(1)

        # Pattern: ### US-XXX: Title\n**Priority**: P0\n**As a**...
        story_pattern = r'###\s*(US-\d+)[:\s]+(.+?)(?=\n###|\Z)'
        for story_match in re.finditer(story_pattern, us_text, re.DOTALL):
            story_id = story_match.group(1)
            story_content = story_match.group(2)

            story = {
                "id": story_id,
                "title": "",
                "priority": "",
                "as_a": "",
                "i_want": "",
                "so_that": "",
                "criteria": []
            }

            # Extract priority
            prio_match = re.search(r'\*\*Priority\*\*:\s*(\w+)', story_content)
            if prio_match:
                story["priority"] = prio_match.group(1)

            # Extract As a/I want/So that
            asa_match = re.search(r'\*\*As a\*\*\s+(.+?)(?:\*\*|$)', story_content)
            if asa_match:
                story["as_a"] = asa_match.group(1).strip()

            iwant_match = re.search(r'\*\*I want\*\*\s+(.+?)(?:\*\*|$)', story_content)
            if iwant_match:
                story["i_want"] = iwant_match.group(1).strip()

            sothat_match = re.search(r'\*\*So that\*\*\s+(.+?)(?:\*\*|$)', story_content)
            if sothat_match:
                story["so_that"] = sothat_match.group(1).strip()

            # Extract acceptance criteria
            ac_match = re.search(r'\*\*Acceptance Criteria\*\*[:\s]+(.+?)(?=\n###|\n##|\Z)', story_content, re.DOTALL)
            if ac_match:
                for line in ac_match.group(1).split('\n'):
                    crit = line.strip()
                    if crit.startswith(('-', '*', '[')):
                        crit = re.sub(r'^[-*\[\]x\s]+', '', crit).strip()
                        if crit:
                            story["criteria"].append(crit)

            spec["user_stories"].append(story)

    # Extract dependencies
    deps_match = re.search(r'## Dependencies\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if deps_match:
        for line in deps_match.group(1).split('\n'):
            dep_match = re.match(r'[-*]\s*(\d{3})[:\s-]+(.+)', line)
            if dep_match:
                spec["dependencies"].append({
                    "feature": dep_match.group(1),
                    "description": dep_match.group(2).strip()
                })

    # Extract out of scope
    oos_match = re.search(r'## Out of Scope\s+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    if oos_match:
        for line in oos_match.group(1).split('\n'):
            if line.strip().startswith(('-', '*')):
                item = re.sub(r'^[-*\s]+', '', line).strip()
                if item:
                    spec["out_of_scope"].append(item)

    return spec


def get_wireframe_status(feature_num: str) -> dict:
    """Get wireframe status for a feature"""
    status = {
        "count": 0,
        "svgs": [],
        "has_issues": False,
        "issue_files": [],
        "directory": None
    }

    # Find wireframe directory
    for wf_dir in WIREFRAMES_DIR.iterdir():
        if wf_dir.is_dir() and wf_dir.name.startswith(f"{feature_num}-"):
            status["directory"] = str(wf_dir.relative_to(PROJECT_ROOT))

            svgs = list(wf_dir.glob("*.svg"))
            status["count"] = len(svgs)
            status["svgs"] = [svg.name for svg in sorted(svgs)]

            issues = list(wf_dir.glob("*.issues.md"))
            status["has_issues"] = len(issues) > 0
            status["issue_files"] = [f.name for f in sorted(issues)]

            break

    return status


def get_dependencies(feature_num: str) -> dict:
    """Get dependencies from IMPLEMENTATION_ORDER.md"""
    deps = {
        "depends_on": [],
        "blocks": [],
        "tier": None,
        "order": None
    }

    if not IMPL_ORDER_FILE.exists():
        return deps

    content = IMPL_ORDER_FILE.read_text()

    current_tier = None
    for line in content.split('\n'):
        tier_match = re.match(r'^### Tier (\d+):', line)
        if tier_match:
            current_tier = int(tier_match.group(1))

        # Look for this feature in table rows
        row_match = re.match(
            rf'\|\s*(\d+)\s*\|\s*\*?\*?{feature_num}\*?\*?\s*\|[^|]+\|\s*([^|]*)\|',
            line
        )
        if row_match:
            deps["tier"] = current_tier
            deps["order"] = int(row_match.group(1))

            # Parse dependencies
            deps_text = row_match.group(2).strip()
            if deps_text and deps_text != "-":
                dep_nums = re.findall(r'(\d{3})', deps_text)
                deps["depends_on"] = dep_nums

    # Find what this feature blocks (look for it in other features' dependencies)
    for line in content.split('\n'):
        row_match = re.match(r'\|\s*\d+\s*\|\s*\*?\*?(\d{3})\*?\*?\s*\|[^|]+\|\s*([^|]*)\|', line)
        if row_match:
            other_feature = row_match.group(1)
            other_deps = row_match.group(2)
            if feature_num in other_deps:
                deps["blocks"].append(other_feature)

    return deps


def get_cache_path(feature_num: str) -> Path:
    """Get cache file path for a feature"""
    return CACHE_DIR / f"{feature_num}.json"


def get_source_mtime(feature_dir: Path, feature_num: str) -> float:
    """Get newest mtime from all source files for cache invalidation"""
    mtimes = []

    # Check spec.md
    spec_file = feature_dir / "spec" / "spec.md"
    if spec_file.exists():
        mtimes.append(spec_file.stat().st_mtime)

    # Check feature file
    for f in feature_dir.glob("*_feature.md"):
        mtimes.append(f.stat().st_mtime)

    # Check IMPLEMENTATION_ORDER.md
    if IMPL_ORDER_FILE.exists():
        mtimes.append(IMPL_ORDER_FILE.stat().st_mtime)

    # Check wireframe directory
    wf_dir = None
    for d in WIREFRAMES_DIR.iterdir():
        if d.is_dir() and d.name.startswith(f"{feature_num}-"):
            wf_dir = d
            break

    if wf_dir:
        for f in wf_dir.glob("*.svg"):
            mtimes.append(f.stat().st_mtime)
        for f in wf_dir.glob("*.issues.md"):
            mtimes.append(f.stat().st_mtime)

    return max(mtimes) if mtimes else 0


def is_cache_valid(cache_path: Path, feature_dir: Path, feature_num: str) -> bool:
    """Check if cache is still valid (source files haven't changed)"""
    if not cache_path.exists():
        return False

    cache_mtime = cache_path.stat().st_mtime
    source_mtime = get_source_mtime(feature_dir, feature_num)

    return cache_mtime > source_mtime


def load_from_cache(feature_num: str) -> dict:
    """Load feature context from cache if valid"""
    cache_path = get_cache_path(feature_num)
    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def save_to_cache(feature_num: str, context: dict) -> None:
    """Save feature context to cache"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = get_cache_path(feature_num)

    try:
        with open(cache_path, "w") as f:
            json.dump(context, f, indent=2)
    except IOError as e:
        print(f"Warning: Could not write cache: {e}", file=sys.stderr)


def clear_cache(feature_num: str = None) -> int:
    """Clear cache for a feature or all features"""
    if not CACHE_DIR.exists():
        return 0

    cleared = 0
    if feature_num:
        cache_path = get_cache_path(feature_num)
        if cache_path.exists():
            cache_path.unlink()
            cleared = 1
    else:
        for cache_file in CACHE_DIR.glob("*.json"):
            cache_file.unlink()
            cleared += 1

    return cleared


def build_feature_context(feature_id: str, use_cache: bool = True) -> dict:
    """Build complete feature context (with caching)"""
    feature_dir, category = find_feature_dir(feature_id)

    if not feature_dir:
        return None

    # Extract feature number from directory name
    feature_num = feature_dir.name.split('-')[0].zfill(3)

    # Check cache first
    if use_cache:
        cache_path = get_cache_path(feature_num)
        if is_cache_valid(cache_path, feature_dir, feature_num):
            cached = load_from_cache(feature_num)
            if cached:
                cached["_from_cache"] = True
                return cached

    context = {
        "feature_id": feature_num,
        "feature_name": feature_dir.name,
        "category": category,
        "path": str(feature_dir.relative_to(PROJECT_ROOT)),
        "spec": {},
        "wireframes": {},
        "dependencies": {},
        "files": {
            "feature_file": None,
            "spec_file": None,
            "plan_file": None,
            "tasks_file": None
        }
    }

    # Find files
    feature_files = list(feature_dir.glob("*_feature.md"))
    if feature_files:
        context["files"]["feature_file"] = feature_files[0].name

    spec_dir = feature_dir / "spec"
    if (spec_dir / "spec.md").exists():
        context["files"]["spec_file"] = "spec/spec.md"
        context["spec"] = parse_spec_file(spec_dir / "spec.md")

    if (spec_dir / "plan.md").exists():
        context["files"]["plan_file"] = "spec/plan.md"

    if (spec_dir / "tasks.md").exists():
        context["files"]["tasks_file"] = "spec/tasks.md"

    # Get wireframe status
    context["wireframes"] = get_wireframe_status(feature_num)

    # Get dependencies
    context["dependencies"] = get_dependencies(feature_num)

    # Save to cache for next time
    if use_cache:
        save_to_cache(feature_num, context)
        context["_from_cache"] = False

    return context


def list_features() -> list:
    """List all features"""
    features = []

    for category in CATEGORIES:
        category_dir = FEATURES_DIR / category
        if not category_dir.exists():
            continue

        for feature_dir in sorted(category_dir.iterdir()):
            if not feature_dir.is_dir():
                continue

            feature_num = feature_dir.name.split('-')[0].zfill(3)
            wf_status = get_wireframe_status(feature_num)

            features.append({
                "number": feature_num,
                "name": feature_dir.name,
                "category": category,
                "wireframe_count": wf_status["count"]
            })

    return features


def search_features(term: str) -> list:
    """Search features by name or description"""
    results = []
    term_lower = term.lower()

    for category in CATEGORIES:
        category_dir = FEATURES_DIR / category
        if not category_dir.exists():
            continue

        for feature_dir in category_dir.iterdir():
            if not feature_dir.is_dir():
                continue

            # Check name
            if term_lower in feature_dir.name.lower():
                context = build_feature_context(feature_dir.name)
                if context:
                    results.append(context)
                continue

            # Check spec content
            spec_file = feature_dir / "spec" / "spec.md"
            if spec_file.exists():
                content = spec_file.read_text().lower()
                if term_lower in content:
                    context = build_feature_context(feature_dir.name)
                    if context:
                        results.append(context)

    return results


# Command handlers

def cmd_context(feature_id: str, args, use_cache: bool = True):
    """Load feature context"""
    context = build_feature_context(feature_id, use_cache=use_cache)

    if not context:
        print(f"Error: Feature '{feature_id}' not found", file=sys.stderr)
        sys.exit(1)

    # Show cache status in text output
    from_cache = context.pop("_from_cache", None)

    # Filter output based on flags
    output = context

    if args.spec:
        output = {"feature_id": context["feature_id"], "spec": context["spec"]}
    elif args.stories:
        output = {"feature_id": context["feature_id"], "user_stories": context["spec"].get("user_stories", [])}
    elif args.wireframes:
        output = {"feature_id": context["feature_id"], "wireframes": context["wireframes"]}
    elif args.deps:
        output = {"feature_id": context["feature_id"], "dependencies": context["dependencies"]}

    if args.json:
        print(json.dumps(output, indent=2))
    else:
        # Text format
        cache_note = " (cached)" if from_cache else " (fresh)" if from_cache is not None else ""
        print(f"Feature: {context['feature_name']}{cache_note}")
        print(f"Category: {context['category']}")
        print(f"Path: {context['path']}")
        print()

        if context["spec"].get("title"):
            print(f"Title: {context['spec']['title']}")
            print(f"Overview: {context['spec']['overview'][:200]}...")
            print()

        print(f"Tier: {context['dependencies'].get('tier', '?')}")
        print(f"Order: {context['dependencies'].get('order', '?')}")
        print(f"Depends on: {', '.join(context['dependencies'].get('depends_on', []))}")
        print(f"Blocks: {', '.join(context['dependencies'].get('blocks', []))}")
        print()

        print(f"Wireframes: {context['wireframes']['count']} SVGs")
        if context['wireframes']['svgs']:
            for svg in context['wireframes']['svgs'][:5]:
                print(f"  - {svg}")
        print()

        print(f"User Stories: {len(context['spec'].get('user_stories', []))}")
        for story in context['spec'].get('user_stories', [])[:3]:
            print(f"  - {story['id']}: {story.get('i_want', '')[:50]}...")


def cmd_list(args):
    """List all features"""
    features = list_features()

    if args.json:
        print(json.dumps(features, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| FEATURES ({len(features)} total){' ' * 57}|"[:80])
    print("+" + "-" * 78 + "+")
    print("| # | Name                                    | Category       | Wireframes |")
    print("+" + "-" * 78 + "+")

    for f in features:
        name = f["name"][:39].ljust(39)
        category = f["category"][:14].ljust(14)
        wf = f"{f['wireframe_count']} SVGs".ljust(10)
        print(f"| {f['number']} | {name} | {category} | {wf} |")

    print("+" + "=" * 78 + "+")


def cmd_search(term: str, args):
    """Search features"""
    results = search_features(term)

    if args.json:
        output = [{
            "feature_id": r["feature_id"],
            "name": r["feature_name"],
            "category": r["category"]
        } for r in results]
        print(json.dumps(output, indent=2))
        return

    print(f"Search results for '{term}': {len(results)} found")
    print()
    for r in results:
        print(f"  {r['feature_id']}: {r['feature_name']} ({r['category']})")


def to_summary(args) -> str:
    """Generate one-line summary"""
    features = list_features()
    with_wireframes = len([f for f in features if f["wireframe_count"] > 0])
    total_wireframes = sum(f["wireframe_count"] for f in features)

    return f"Features: {len(features)} total | {with_wireframes} with wireframes | {total_wireframes} SVGs"


def main():
    parser = argparse.ArgumentParser(
        description="Feature Context Loader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="list",
                       help="Feature number/name, 'list', or 'search'")
    parser.add_argument("args", nargs="*", help="Additional arguments")

    # Output filters
    parser.add_argument("--spec", action="store_true", help="Spec content only")
    parser.add_argument("--stories", action="store_true", help="User stories only")
    parser.add_argument("--wireframes", action="store_true", help="Wireframe status only")
    parser.add_argument("--deps", action="store_true", help="Dependencies only")
    parser.add_argument("--full", action="store_true", help="Full context (default)")

    # Output format
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    # Cache control
    parser.add_argument("--no-cache", action="store_true", help="Skip cache, parse fresh")
    parser.add_argument("--clear-cache", action="store_true", help="Clear cache (all or specific feature)")

    args = parser.parse_args()

    # Handle cache clear
    if args.clear_cache:
        feature_num = args.command if args.command not in ["list", "search"] else None
        cleared = clear_cache(feature_num)
        print(f"Cleared {cleared} cache file(s)")
        return

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "list":
        cmd_list(args)
    elif args.command == "search":
        if not args.args:
            print("Error: search requires a term", file=sys.stderr)
            sys.exit(1)
        cmd_search(args.args[0], args)
    else:
        # Assume it's a feature identifier
        cmd_context(args.command, args, use_cache=not args.no_cache)


if __name__ == "__main__":
    main()
