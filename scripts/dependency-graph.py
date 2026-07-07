#!/usr/bin/env python3
"""
Dependency Graph - Feature dependency resolution from IMPLEMENTATION_ORDER.md

Eliminates AI re-parsing of dependency markdown. Provides deterministic lookups.
Usage: python3 scripts/dependency-graph.py [command] [options]

Commands:
  show                     Full dependency graph (default)
  deps <feature>           What <feature> depends on
  blocks <feature>         What <feature> blocks
  next                     Next implementable feature(s)
  tier <n>                 Features in tier N
  path <from> <to>         Dependency path between features

Options:
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/dependency-graph.py
  python3 scripts/dependency-graph.py deps 003
  python3 scripts/dependency-graph.py blocks 009
  python3 scripts/dependency-graph.py next --json
  python3 scripts/dependency-graph.py tier 3
"""

import argparse
import json
import re
import sys
from collections import defaultdict, deque
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
IMPL_ORDER_FILE = PROJECT_ROOT / "features" / "IMPLEMENTATION_ORDER.md"
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"
FEATURES_DIR = PROJECT_ROOT / "features"


def parse_implementation_order() -> dict:
    """Parse IMPLEMENTATION_ORDER.md and build dependency graph"""
    graph = {
        "features": {},  # feature_num -> {name, tier, order, depends_on, blocks}
        "tiers": defaultdict(list),  # tier_num -> [feature_nums]
        "order": [],  # Implementation order
    }

    if not IMPL_ORDER_FILE.exists():
        return graph

    content = IMPL_ORDER_FILE.read_text()

    current_tier = None
    current_order = 0

    for line in content.split('\n'):
        # Detect tier headers
        tier_match = re.match(r'^### Tier (\d+):', line)
        if tier_match:
            current_tier = int(tier_match.group(1))
            continue

        # Parse table rows: | Order | Feature | Name | Why/Depends |
        # Or: | Order | **Feature** | Name | Depends On |
        row_match = re.match(
            r'\|\s*(\d+)\s*\|\s*\*?\*?(\d+)\*?\*?\s*\|\s*([^|]+)\|\s*([^|]*)\|',
            line
        )

        if row_match and current_tier:
            order = int(row_match.group(1))
            feature_num = row_match.group(2).zfill(3)
            feature_name = row_match.group(3).strip()
            depends_text = row_match.group(4).strip()

            # Parse dependencies from text like "003 (auth)" or "009, 011"
            depends_on = []
            if depends_text and depends_text != "-":
                dep_nums = re.findall(r'(\d{3})', depends_text)
                depends_on = [d.zfill(3) for d in dep_nums]

            graph["features"][feature_num] = {
                "num": feature_num,
                "name": feature_name,
                "tier": current_tier,
                "order": order,
                "depends_on": depends_on,
                "blocks": []  # Will be computed after
            }

            graph["tiers"][current_tier].append(feature_num)
            graph["order"].append(feature_num)
            current_order = order

    # Compute reverse dependencies (what each feature blocks)
    for feature_num, feature_data in graph["features"].items():
        for dep in feature_data["depends_on"]:
            if dep in graph["features"]:
                graph["features"][dep]["blocks"].append(feature_num)

    return graph


def get_feature_status(feature_num: str) -> dict:
    """Get implementation status of a feature"""
    status = {
        "has_spec": False,
        "has_plan": False,
        "has_tasks": False,
        "has_wireframes": False,
        "wireframe_count": 0,
        "implemented": False
    }

    # Check for feature directory
    for category in FEATURES_DIR.iterdir():
        if not category.is_dir():
            continue
        for feature_dir in category.iterdir():
            if feature_dir.is_dir() and feature_dir.name.startswith(f"{feature_num}-"):
                spec_dir = feature_dir / "spec"
                if (spec_dir / "spec.md").exists():
                    status["has_spec"] = True
                if (spec_dir / "plan.md").exists():
                    status["has_plan"] = True
                if (spec_dir / "tasks.md").exists():
                    status["has_tasks"] = True
                break

    # Check wireframes
    for wf_dir in WIREFRAMES_DIR.iterdir():
        if wf_dir.is_dir() and wf_dir.name.startswith(f"{feature_num}-"):
            svgs = list(wf_dir.glob("*.svg"))
            status["has_wireframes"] = len(svgs) > 0
            status["wireframe_count"] = len(svgs)
            break

    return status


def find_next_implementable(graph: dict) -> list:
    """Find features that can be implemented next"""
    implementable = []

    for feature_num, feature_data in graph["features"].items():
        status = get_feature_status(feature_num)

        # Skip if already implemented
        if status["implemented"]:
            continue

        # Check if all dependencies are satisfied
        deps_satisfied = True
        for dep in feature_data["depends_on"]:
            dep_status = get_feature_status(dep)
            # For now, consider a dependency satisfied if it has wireframes
            # In a real implementation, you'd check for actual completion
            if not dep_status["has_wireframes"]:
                deps_satisfied = False
                break

        if deps_satisfied:
            implementable.append({
                "feature": feature_num,
                "name": feature_data["name"],
                "tier": feature_data["tier"],
                "order": feature_data["order"],
                "status": status
            })

    # Sort by implementation order
    implementable.sort(key=lambda x: x["order"])

    return implementable


def find_path(graph: dict, from_feature: str, to_feature: str) -> list:
    """Find dependency path between two features using BFS"""
    from_feature = from_feature.zfill(3)
    to_feature = to_feature.zfill(3)

    if from_feature not in graph["features"] or to_feature not in graph["features"]:
        return []

    # BFS to find path
    queue = deque([(from_feature, [from_feature])])
    visited = {from_feature}

    while queue:
        current, path = queue.popleft()

        if current == to_feature:
            return path

        # Check dependencies (going "up" the tree)
        for dep in graph["features"][current].get("depends_on", []):
            if dep not in visited:
                visited.add(dep)
                queue.append((dep, path + [dep]))

        # Check blocks (going "down" the tree)
        for blocked in graph["features"][current].get("blocks", []):
            if blocked not in visited:
                visited.add(blocked)
                queue.append((blocked, path + [blocked]))

    return []


# Command handlers

def cmd_show(graph: dict, args):
    """Show full dependency graph"""
    if args.json:
        output = {
            "features": graph["features"],
            "tiers": dict(graph["tiers"]),
            "order": graph["order"]
        }
        print(json.dumps(output, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| DEPENDENCY GRAPH ({len(graph['features'])} features){' ' * 48}|"[:80])
    print("+" + "=" * 78 + "+")

    for tier_num in sorted(graph["tiers"].keys()):
        features = graph["tiers"][tier_num]
        print(f"| TIER {tier_num}{' ' * 71}|"[:80])
        print("+" + "-" * 78 + "+")
        print("| Feature | Name                           | Depends On       | Blocks           |")
        print("+" + "-" * 78 + "+")

        for feature_num in features:
            f = graph["features"][feature_num]
            name = f["name"][:30].ljust(30)
            deps = ", ".join(f["depends_on"][:3])[:16].ljust(16)
            blocks = ", ".join(f["blocks"][:3])[:16].ljust(16)
            print(f"| {feature_num}     | {name} | {deps} | {blocks} |")

        print("+" + "-" * 78 + "+")
        print("")


def cmd_deps(feature_num: str, graph: dict, args):
    """Show what a feature depends on"""
    feature_num = feature_num.zfill(3)

    if feature_num not in graph["features"]:
        print(f"Error: Feature {feature_num} not found", file=sys.stderr)
        sys.exit(1)

    f = graph["features"][feature_num]
    deps = f["depends_on"]

    # Get transitive dependencies
    all_deps = set()
    queue = list(deps)
    while queue:
        dep = queue.pop(0)
        if dep not in all_deps and dep in graph["features"]:
            all_deps.add(dep)
            queue.extend(graph["features"][dep]["depends_on"])

    if args.json:
        output = {
            "feature": feature_num,
            "name": f["name"],
            "direct_dependencies": deps,
            "transitive_dependencies": sorted(all_deps),
            "total": len(all_deps)
        }
        print(json.dumps(output, indent=2))
        return

    print(f"Feature {feature_num}: {f['name']}")
    print(f"Tier: {f['tier']}")
    print()
    print(f"Direct dependencies ({len(deps)}):")
    for dep in deps:
        if dep in graph["features"]:
            print(f"  {dep} - {graph['features'][dep]['name']}")
        else:
            print(f"  {dep} - (not in graph)")

    print()
    print(f"All transitive dependencies ({len(all_deps)}):")
    for dep in sorted(all_deps):
        if dep in graph["features"]:
            print(f"  {dep} - {graph['features'][dep]['name']}")


def cmd_blocks(feature_num: str, graph: dict, args):
    """Show what a feature blocks"""
    feature_num = feature_num.zfill(3)

    if feature_num not in graph["features"]:
        print(f"Error: Feature {feature_num} not found", file=sys.stderr)
        sys.exit(1)

    f = graph["features"][feature_num]
    blocks = f["blocks"]

    # Get transitive blocks
    all_blocks = set()
    queue = list(blocks)
    while queue:
        blocked = queue.pop(0)
        if blocked not in all_blocks and blocked in graph["features"]:
            all_blocks.add(blocked)
            queue.extend(graph["features"][blocked]["blocks"])

    if args.json:
        output = {
            "feature": feature_num,
            "name": f["name"],
            "directly_blocks": blocks,
            "transitively_blocks": sorted(all_blocks),
            "total": len(all_blocks)
        }
        print(json.dumps(output, indent=2))
        return

    print(f"Feature {feature_num}: {f['name']}")
    print(f"Tier: {f['tier']}")
    print()
    print(f"Directly blocks ({len(blocks)}):")
    for blocked in blocks:
        if blocked in graph["features"]:
            print(f"  {blocked} - {graph['features'][blocked]['name']}")

    print()
    print(f"Transitively blocks ({len(all_blocks)}):")
    for blocked in sorted(all_blocks):
        if blocked in graph["features"]:
            print(f"  {blocked} - {graph['features'][blocked]['name']}")


def cmd_next(graph: dict, args):
    """Show next implementable features"""
    implementable = find_next_implementable(graph)

    if args.json:
        print(json.dumps(implementable, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| NEXT IMPLEMENTABLE ({len(implementable)} features ready){' ' * 43}|"[:80])
    print("+" + "-" * 78 + "+")

    if not implementable:
        print("| No features are currently implementable (dependencies not met)" + " " * 15 + "|")
    else:
        print("| Order | Feature | Name                           | Tier | Wireframes     |")
        print("+" + "-" * 78 + "+")

        for f in implementable[:15]:  # Show top 15
            name = f["name"][:30].ljust(30)
            wf_status = f"{f['status']['wireframe_count']} SVGs" if f['status']['has_wireframes'] else "none"
            wf_status = wf_status.ljust(14)
            print(f"| {f['order']:5} | {f['feature']}     | {name} | {f['tier']:4} | {wf_status} |")

        if len(implementable) > 15:
            print(f"| ... and {len(implementable) - 15} more" + " " * 62 + "|")

    print("+" + "=" * 78 + "+")


def cmd_tier(tier_num: int, graph: dict, args):
    """Show features in a specific tier"""
    if tier_num not in graph["tiers"]:
        print(f"Error: Tier {tier_num} not found", file=sys.stderr)
        print(f"Available tiers: {sorted(graph['tiers'].keys())}", file=sys.stderr)
        sys.exit(1)

    features = graph["tiers"][tier_num]

    if args.json:
        output = {
            "tier": tier_num,
            "count": len(features),
            "features": [graph["features"][f] for f in features]
        }
        print(json.dumps(output, indent=2))
        return

    print(f"TIER {tier_num} ({len(features)} features)")
    print("=" * 60)
    print("| Order | Feature | Name                           | Dependencies       |")
    print("-" * 60)

    for feature_num in features:
        f = graph["features"][feature_num]
        name = f["name"][:30].ljust(30)
        deps = ", ".join(f["depends_on"][:3])[:18].ljust(18)
        print(f"| {f['order']:5} | {feature_num}     | {name} | {deps} |")


def cmd_path(from_feature: str, to_feature: str, graph: dict, args):
    """Show dependency path between features"""
    path = find_path(graph, from_feature, to_feature)

    if args.json:
        output = {
            "from": from_feature.zfill(3),
            "to": to_feature.zfill(3),
            "path": path,
            "length": len(path)
        }
        print(json.dumps(output, indent=2))
        return

    if not path:
        print(f"No path found between {from_feature} and {to_feature}")
        return

    print(f"Dependency path from {from_feature} to {to_feature}:")
    print()
    for i, feature_num in enumerate(path):
        if feature_num in graph["features"]:
            f = graph["features"][feature_num]
            prefix = "  " if i == 0 else "  └─> "
            print(f"{prefix}{feature_num}: {f['name']}")
        else:
            print(f"  {feature_num}: (not in graph)")


def to_summary(graph: dict) -> str:
    """Generate one-line summary"""
    total = len(graph["features"])
    tier_counts = {t: len(f) for t, f in graph["tiers"].items()}
    implementable = len(find_next_implementable(graph))

    tier_str = ", ".join([f"T{t}:{c}" for t, c in sorted(tier_counts.items())])

    return f"Dependency Graph: {total} features | {len(tier_counts)} tiers | {implementable} ready | {tier_str}"


def main():
    parser = argparse.ArgumentParser(
        description="Feature Dependency Graph",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="show",
                       help="Command (show, deps, blocks, next, tier, path)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Parse the implementation order
    graph = parse_implementation_order()

    # Handle summary
    if args.summary:
        print(to_summary(graph))
        return

    # Handle commands
    if args.command == "show":
        cmd_show(graph, args)
    elif args.command == "deps":
        if not args.args:
            print("Error: deps requires feature number", file=sys.stderr)
            sys.exit(1)
        cmd_deps(args.args[0], graph, args)
    elif args.command == "blocks":
        if not args.args:
            print("Error: blocks requires feature number", file=sys.stderr)
            sys.exit(1)
        cmd_blocks(args.args[0], graph, args)
    elif args.command == "next":
        cmd_next(graph, args)
    elif args.command == "tier":
        if not args.args:
            print("Error: tier requires tier number", file=sys.stderr)
            sys.exit(1)
        cmd_tier(int(args.args[0]), graph, args)
    elif args.command == "path":
        if len(args.args) < 2:
            print("Error: path requires <from> <to>", file=sys.stderr)
            sys.exit(1)
        cmd_path(args.args[0], args.args[1], graph, args)
    else:
        # Assume it's a feature number for deps lookup
        cmd_deps(args.command, graph, args)


if __name__ == "__main__":
    main()
