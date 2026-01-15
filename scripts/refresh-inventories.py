#!/usr/bin/env python3
"""
Refresh Inventories - Regenerate .claude/inventories/ files

Scans codebase and updates inventory files for different terminal roles.
Usage: python3 scripts/refresh-inventories.py [inventory] [options]

Inventories:
  all                      Regenerate all inventories (default)
  skills                   skill-index.md only
  dependencies             dependency-graph.md only
  workflows                workflow-status.md only
  security                 security-touchpoints.md only
  screens                  screen-inventory.md only
  acceptance               acceptance-criteria.md only

Options:
  --check                  Validate without writing
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/refresh-inventories.py
  python3 scripts/refresh-inventories.py skills
  python3 scripts/refresh-inventories.py --check
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
INVENTORIES_DIR = PROJECT_ROOT / ".claude" / "inventories"
SKILLS_DIR = Path.home() / ".claude" / "commands"
PROJECT_SKILLS_DIR = PROJECT_ROOT / ".claude" / "commands"
FEATURES_DIR = PROJECT_ROOT / "features"
WORKFLOWS_DIR = PROJECT_ROOT / ".github" / "workflows"
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"


def ensure_inventories_dir():
    """Ensure inventories directory exists"""
    INVENTORIES_DIR.mkdir(parents=True, exist_ok=True)


def refresh_skill_index() -> dict:
    """Generate skill-index.md from skill files"""
    skills = []

    # Scan user skills
    if SKILLS_DIR.exists():
        for skill_file in sorted(SKILLS_DIR.glob("*.md")):
            if skill_file.name == "CLAUDE.md":
                continue

            name = skill_file.stem
            description = ""

            try:
                content = skill_file.read_text()
                # Extract description from frontmatter
                desc_match = re.search(r'^description:\s*(.+)$', content, re.MULTILINE)
                if desc_match:
                    description = desc_match.group(1).strip()
                elif content.startswith('#'):
                    # Use first heading as description
                    heading = content.split('\n')[0].replace('#', '').strip()
                    description = heading[:60]
            except Exception:
                pass

            skills.append({
                'name': name,
                'description': description,
                'location': 'user'
            })

    # Scan project skills
    if PROJECT_SKILLS_DIR.exists():
        for skill_file in sorted(PROJECT_SKILLS_DIR.glob("*.md")):
            if skill_file.name == "CLAUDE.md":
                continue

            name = skill_file.stem
            description = ""

            try:
                content = skill_file.read_text()
                desc_match = re.search(r'^description:\s*(.+)$', content, re.MULTILINE)
                if desc_match:
                    description = desc_match.group(1).strip()
            except Exception:
                pass

            skills.append({
                'name': name,
                'description': description,
                'location': 'project'
            })

    return {'skills': skills, 'count': len(skills)}


def refresh_dependency_graph() -> dict:
    """Generate dependency-graph.md from IMPLEMENTATION_ORDER.md"""
    features = []
    tiers = defaultdict(list)

    impl_order = FEATURES_DIR / "IMPLEMENTATION_ORDER.md"
    if not impl_order.exists():
        return {'features': [], 'tiers': {}, 'count': 0}

    try:
        content = impl_order.read_text()

        # Parse tier tables
        current_tier = None
        for line in content.split('\n'):
            tier_match = re.match(r'^##\s+Tier\s+(\d+)', line)
            if tier_match:
                current_tier = int(tier_match.group(1))
                continue

            # Parse table rows
            row_match = re.match(r'\|\s*(\d+)\s*\|\s*([^|]+)\|', line)
            if row_match and current_tier:
                feature_num = row_match.group(1).strip()
                feature_name = row_match.group(2).strip()
                features.append({
                    'number': feature_num,
                    'name': feature_name,
                    'tier': current_tier
                })
                tiers[current_tier].append(feature_num)

    except Exception as e:
        print(f"Warning: Error parsing IMPLEMENTATION_ORDER.md: {e}", file=sys.stderr)

    return {
        'features': features,
        'tiers': dict(tiers),
        'count': len(features)
    }


def refresh_workflow_status() -> dict:
    """Generate workflow-status.md from .github/workflows/"""
    workflows = []

    if not WORKFLOWS_DIR.exists():
        return {'workflows': [], 'count': 0}

    for workflow_file in sorted(WORKFLOWS_DIR.glob("*.yml")) + list(WORKFLOWS_DIR.glob("*.yaml")):
        workflow = {
            'name': workflow_file.stem,
            'file': workflow_file.name,
            'triggers': [],
            'jobs': []
        }

        try:
            content = workflow_file.read_text()

            # Extract name
            name_match = re.search(r'^name:\s*(.+)$', content, re.MULTILINE)
            if name_match:
                workflow['name'] = name_match.group(1).strip()

            # Extract triggers
            if 'push:' in content:
                workflow['triggers'].append('push')
            if 'pull_request:' in content:
                workflow['triggers'].append('pull_request')
            if 'schedule:' in content:
                workflow['triggers'].append('schedule')
            if 'workflow_dispatch:' in content:
                workflow['triggers'].append('manual')

            # Extract job names
            jobs_match = re.findall(r'^  ([a-zA-Z0-9_-]+):\s*$', content, re.MULTILINE)
            workflow['jobs'] = jobs_match

        except Exception as e:
            print(f"Warning: Error parsing {workflow_file}: {e}", file=sys.stderr)

        workflows.append(workflow)

    return {'workflows': workflows, 'count': len(workflows)}


def refresh_security_touchpoints() -> dict:
    """Generate security-touchpoints.md from keyword scan"""
    touchpoints = []
    keywords = [
        'auth', 'authentication', 'authorization',
        'security', 'secure',
        'privacy', 'GDPR', 'consent',
        'RLS', 'row level security',
        'OWASP', 'vulnerability',
        'password', 'credential', 'session', 'token',
        'encryption', 'hash'
    ]

    pattern = '|'.join(keywords)

    if not FEATURES_DIR.exists():
        return {'touchpoints': [], 'count': 0}

    for spec_file in FEATURES_DIR.rglob("spec.md"):
        try:
            content = spec_file.read_text()
            if re.search(pattern, content, re.IGNORECASE):
                feature_dir = spec_file.parent.parent
                feature_name = feature_dir.name

                # Extract title
                title_match = re.search(r'^#\s*Feature Specification:\s*(.+)$', content, re.MULTILINE)
                title = title_match.group(1).strip() if title_match else feature_name

                # Find which keywords match
                found_keywords = [kw for kw in keywords if re.search(kw, content, re.IGNORECASE)]

                touchpoints.append({
                    'feature': feature_name,
                    'title': title,
                    'keywords': found_keywords,
                    'path': str(spec_file.relative_to(PROJECT_ROOT))
                })
        except Exception:
            pass

    return {'touchpoints': touchpoints, 'count': len(touchpoints)}


def refresh_screen_inventory() -> dict:
    """Generate screen-inventory.md from wireframe directories"""
    features = []
    total_svgs = 0

    if not WIREFRAMES_DIR.exists():
        return {'features': [], 'total_svgs': 0, 'count': 0}

    for feature_dir in sorted(WIREFRAMES_DIR.iterdir()):
        if not feature_dir.is_dir():
            continue
        if feature_dir.name.startswith(('.', 'includes', 'templates', 'png', 'node_modules')):
            continue

        svgs = list(feature_dir.glob("*.svg"))
        if svgs:
            features.append({
                'feature': feature_dir.name,
                'svg_count': len(svgs),
                'svgs': [svg.name for svg in sorted(svgs)]
            })
            total_svgs += len(svgs)

    return {
        'features': features,
        'total_svgs': total_svgs,
        'count': len(features)
    }


def refresh_acceptance_criteria() -> dict:
    """Generate acceptance-criteria.md from spec files"""
    features = []
    total_scenarios = 0

    if not FEATURES_DIR.exists():
        return {'features': [], 'total_scenarios': 0, 'count': 0}

    for spec_file in FEATURES_DIR.rglob("spec.md"):
        try:
            content = spec_file.read_text()

            # Count Given/When/Then patterns
            gwt_count = len(re.findall(r'Given\s+.+\s+When\s+.+\s+Then', content, re.IGNORECASE | re.DOTALL))

            # Alternative: count scenario markers
            if gwt_count == 0:
                gwt_count = len(re.findall(r'^\s*-\s*Given', content, re.MULTILINE | re.IGNORECASE))

            if gwt_count > 0:
                feature_dir = spec_file.parent.parent
                feature_name = feature_dir.name

                # Detect priority from path or content
                priority = "P2"  # Default
                if "foundation" in str(spec_file):
                    priority = "P0"
                elif "core" in str(spec_file):
                    priority = "P1"

                features.append({
                    'feature': feature_name,
                    'scenarios': gwt_count,
                    'priority': priority,
                    'path': str(spec_file.relative_to(PROJECT_ROOT))
                })
                total_scenarios += gwt_count
        except Exception:
            pass

    # Sort by priority
    priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
    features.sort(key=lambda x: (priority_order.get(x['priority'], 9), x['feature']))

    return {
        'features': features,
        'total_scenarios': total_scenarios,
        'count': len(features)
    }


def write_inventory(name: str, data: dict, check_only: bool = False) -> bool:
    """Write inventory file"""
    ensure_inventories_dir()

    filepath = INVENTORIES_DIR / f"{name}.md"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if name == "skill-index":
        content = f"""# Skill Index

Generated: {timestamp} | Refresh: `/refresh-inventories skills`

## Skills ({data['count']})

| Skill | Description | Location |
|-------|-------------|----------|
"""
        for skill in data['skills']:
            desc = skill['description'][:50] + "..." if len(skill['description']) > 50 else skill['description']
            content += f"| `/{skill['name']}` | {desc} | {skill['location']} |\n"

    elif name == "dependency-graph":
        content = f"""# Dependency Graph

Generated: {timestamp} | Source: `features/IMPLEMENTATION_ORDER.md`

## Features ({data['count']})

| Tier | Features |
|------|----------|
"""
        for tier, features in sorted(data['tiers'].items()):
            content += f"| {tier} | {', '.join(features)} |\n"

    elif name == "workflow-status":
        content = f"""# GitHub Workflows Status

Generated: {timestamp} | Source: `.github/workflows/`

## Active Workflows ({data['count']})

| Workflow | File | Triggers | Jobs |
|----------|------|----------|------|
"""
        for wf in data['workflows']:
            triggers = ', '.join(wf['triggers'])
            jobs = ', '.join(wf['jobs'][:3])
            if len(wf['jobs']) > 3:
                jobs += f" +{len(wf['jobs'])-3}"
            content += f"| {wf['name']} | `{wf['file']}` | {triggers} | {jobs} |\n"

    elif name == "security-touchpoints":
        content = f"""# Security Touchpoints

Generated: {timestamp} | Refresh: `/refresh-inventories security`

## Features with Security Impact ({data['count']})

| Feature | Keywords |
|---------|----------|
"""
        for tp in data['touchpoints']:
            keywords = ', '.join(tp['keywords'][:5])
            content += f"| {tp['feature']} | {keywords} |\n"

    elif name == "screen-inventory":
        content = f"""# Screen Inventory

Generated: {timestamp} | Source: `docs/design/wireframes/`

## Wireframes ({data['total_svgs']} SVGs across {data['count']} features)

| Feature | SVG Count |
|---------|-----------|
"""
        for f in data['features']:
            content += f"| {f['feature']} | {f['svg_count']} |\n"

    elif name == "acceptance-criteria":
        content = f"""# Acceptance Criteria

Generated: {timestamp} | Source: `features/*/*/spec.md`

## Features with AC ({data['total_scenarios']} scenarios across {data['count']} features)

| Feature | Priority | Scenarios |
|---------|----------|-----------|
"""
        for f in data['features']:
            content += f"| {f['feature']} | {f['priority']} | {f['scenarios']} |\n"

    else:
        return False

    if check_only:
        return True

    filepath.write_text(content)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Refresh Inventory Files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("inventory", nargs="?", default="all",
                       choices=["all", "skills", "dependencies", "workflows",
                               "security", "screens", "acceptance"],
                       help="Inventory to refresh (default: all)")
    parser.add_argument("--check", action="store_true",
                       help="Validate without writing")
    parser.add_argument("--json", action="store_true",
                       help="Output as JSON")
    parser.add_argument("--summary", action="store_true",
                       help="One-line summary")

    args = parser.parse_args()

    # Map inventory names to functions
    inventory_map = {
        'skills': ('skill-index', refresh_skill_index),
        'dependencies': ('dependency-graph', refresh_dependency_graph),
        'workflows': ('workflow-status', refresh_workflow_status),
        'security': ('security-touchpoints', refresh_security_touchpoints),
        'screens': ('screen-inventory', refresh_screen_inventory),
        'acceptance': ('acceptance-criteria', refresh_acceptance_criteria),
    }

    results = {}

    if args.inventory == "all":
        inventories_to_run = list(inventory_map.keys())
    else:
        inventories_to_run = [args.inventory]

    for inv_key in inventories_to_run:
        name, func = inventory_map[inv_key]
        data = func()
        results[name] = data

        if not args.json and not args.summary:
            write_inventory(name, data, check_only=args.check)

    # Output
    if args.summary:
        counts = [f"{k}: {v.get('count', 0)}" for k, v in results.items()]
        status = "CHECK" if args.check else "REFRESHED"
        print(f"Inventories {status} | {' | '.join(counts)}")
        return

    if args.json:
        print(json.dumps(results, indent=2))
        return

    # Text output
    print("=" * 60)
    print(f"INVENTORY REFRESH {'(check mode)' if args.check else ''}")
    print("=" * 60)

    for name, data in results.items():
        count = data.get('count', 0)
        print(f"  {name}.md: {count} items")

    print()
    if args.check:
        print("Check complete. No files written.")
    else:
        print(f"Written to: {INVENTORIES_DIR}")


if __name__ == "__main__":
    main()
