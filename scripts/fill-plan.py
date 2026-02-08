#!/usr/bin/env python3
"""
Fill Plan - Plan template filler for SpecKit workflow

Extracts technical context and generates plan template sections.

Sections:
  - Technical Context (language, deps, storage, testing)
  - Constitution Check (6 principles compliance)
  - Project Structure (tree diagrams)
  - Complexity Tracking

Usage:
    python fill-plan.py --tech-context package.json
    python fill-plan.py --constitution-check
    python fill-plan.py --structure-detect
    python fill-plan.py --all
    python fill-plan.py --json
    python fill-plan.py --summary
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Constitution principles
CONSTITUTION_PRINCIPLES = [
    {
        'id': 1,
        'name': '5-file pattern',
        'description': 'index.tsx, Component.tsx, test, stories, a11y',
        'check': 'Component directories follow 5-file structure'
    },
    {
        'id': 2,
        'name': 'TDD',
        'description': 'Tests before implementation',
        'check': 'Test files exist before/with implementation'
    },
    {
        'id': 3,
        'name': 'SpecKit',
        'description': 'Complete workflow, no skipped steps',
        'check': 'spec.md → plan.md → tasks.md sequence'
    },
    {
        'id': 4,
        'name': 'Docker-first',
        'description': 'No local package installs',
        'check': 'Dockerfile or docker-compose.yml exists'
    },
    {
        'id': 5,
        'name': 'Progressive enhancement',
        'description': 'PWA, a11y, mobile-first',
        'check': 'Accessibility tests and responsive design'
    },
    {
        'id': 6,
        'name': 'Privacy first',
        'description': 'GDPR, consent before tracking',
        'check': 'No analytics without consent mechanisms'
    },
]


def extract_package_json(filepath: Path) -> dict:
    """Extract tech context from package.json"""
    if not filepath.exists():
        return None

    with open(filepath, 'r') as f:
        pkg = json.load(f)

    deps = pkg.get('dependencies', {})
    dev_deps = pkg.get('devDependencies', {})
    all_deps = {**deps, **dev_deps}

    # Detect frameworks and tools
    context = {
        'name': pkg.get('name', 'unknown'),
        'version': pkg.get('version', '0.0.0'),
        'language': 'TypeScript' if 'typescript' in all_deps else 'JavaScript',
        'frameworks': [],
        'testing': [],
        'build': [],
        'storage': [],
        'styling': [],
    }

    # Framework detection
    framework_patterns = {
        'react': 'React',
        'next': 'Next.js',
        'vue': 'Vue.js',
        'nuxt': 'Nuxt.js',
        'angular': 'Angular',
        'svelte': 'Svelte',
        'express': 'Express',
        'fastify': 'Fastify',
        'nest': 'NestJS',
    }

    for pattern, name in framework_patterns.items():
        if any(pattern in dep.lower() for dep in all_deps):
            context['frameworks'].append(name)

    # Testing detection
    testing_patterns = {
        'vitest': 'Vitest',
        'jest': 'Jest',
        'playwright': 'Playwright',
        'cypress': 'Cypress',
        'testing-library': 'Testing Library',
        'mocha': 'Mocha',
    }

    for pattern, name in testing_patterns.items():
        if any(pattern in dep.lower() for dep in all_deps):
            context['testing'].append(name)

    # Build tools
    build_patterns = {
        'vite': 'Vite',
        'webpack': 'Webpack',
        'esbuild': 'esbuild',
        'rollup': 'Rollup',
        'parcel': 'Parcel',
        'turbo': 'Turborepo',
    }

    for pattern, name in build_patterns.items():
        if any(pattern in dep.lower() for dep in all_deps):
            context['build'].append(name)

    # Storage/Database
    storage_patterns = {
        'supabase': 'Supabase',
        'prisma': 'Prisma',
        'mongoose': 'MongoDB',
        'pg': 'PostgreSQL',
        'mysql': 'MySQL',
        'redis': 'Redis',
        'firebase': 'Firebase',
    }

    for pattern, name in storage_patterns.items():
        if any(pattern in dep.lower() for dep in all_deps):
            context['storage'].append(name)

    # Styling
    styling_patterns = {
        'tailwind': 'Tailwind CSS',
        'styled-components': 'Styled Components',
        'emotion': 'Emotion',
        'sass': 'Sass',
        'less': 'Less',
        'chakra': 'Chakra UI',
        'mui': 'Material UI',
    }

    for pattern, name in styling_patterns.items():
        if any(pattern in dep.lower() for dep in all_deps):
            context['styling'].append(name)

    return context


def detect_project_structure(root: Path, max_depth: int = 3) -> dict:
    """Detect project structure and generate tree"""
    structure = {
        'root': str(root),
        'directories': [],
        'key_files': [],
        'tree': []
    }

    # Important directories
    important_dirs = ['src', 'lib', 'app', 'pages', 'components', 'features',
                      'tests', 'test', '__tests__', 'docs', 'public', 'assets']

    # Important files
    important_files = ['package.json', 'tsconfig.json', 'vite.config.ts',
                       'next.config.js', 'docker-compose.yml', 'Dockerfile',
                       '.env.example', 'README.md']

    def build_tree(path: Path, prefix: str = '', depth: int = 0):
        if depth > max_depth:
            return

        items = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name))

        for i, item in enumerate(items):
            if item.name.startswith('.') and item.name not in ['.env.example']:
                continue
            if item.name in ['node_modules', '__pycache__', 'dist', 'build', '.git']:
                continue

            is_last = i == len(items) - 1
            connector = '└── ' if is_last else '├── '
            structure['tree'].append(f'{prefix}{connector}{item.name}')

            if item.is_dir():
                structure['directories'].append(str(item.relative_to(root)))
                extension = '    ' if is_last else '│   '
                build_tree(item, prefix + extension, depth + 1)
            elif item.name in important_files:
                structure['key_files'].append(str(item.relative_to(root)))

    # Find important directories at root
    for d in important_dirs:
        dir_path = root / d
        if dir_path.exists():
            structure['directories'].append(d)

    # Build tree from root
    build_tree(root)

    return structure


def check_constitution_compliance(root: Path) -> list:
    """Check constitution principles compliance"""
    results = []

    for principle in CONSTITUTION_PRINCIPLES:
        status = 'unknown'
        notes = []

        if principle['id'] == 1:  # 5-file pattern
            # Check for component directories with all 5 files
            components_dir = root / 'src' / 'components'
            if components_dir.exists():
                for comp_dir in components_dir.rglob('*'):
                    if comp_dir.is_dir():
                        files = list(comp_dir.glob('*'))
                        file_names = [f.name for f in files]
                        has_index = 'index.tsx' in file_names or 'index.ts' in file_names
                        has_test = any('.test.' in f for f in file_names)
                        has_stories = any('.stories.' in f for f in file_names)
                        if has_index and has_test and has_stories:
                            status = 'compliant'
                            break
                if status != 'compliant':
                    status = 'non-compliant'
                    notes.append('No component directories follow 5-file pattern')
            else:
                status = 'not-applicable'
                notes.append('No src/components directory found')

        elif principle['id'] == 2:  # TDD
            # Check for test files
            test_files = list(root.rglob('*.test.*')) + list(root.rglob('*.spec.*'))
            if test_files:
                status = 'compliant'
                notes.append(f'Found {len(test_files)} test files')
            else:
                status = 'non-compliant'
                notes.append('No test files found')

        elif principle['id'] == 3:  # SpecKit
            # Check for spec.md, plan.md, tasks.md
            features_dir = root / 'features'
            if features_dir.exists():
                specs = list(features_dir.rglob('spec.md'))
                plans = list(features_dir.rglob('plan.md'))
                tasks = list(features_dir.rglob('tasks.md'))
                if specs and plans and tasks:
                    status = 'compliant'
                else:
                    status = 'partial'
                    notes.append(f'Specs: {len(specs)}, Plans: {len(plans)}, Tasks: {len(tasks)}')
            else:
                status = 'not-applicable'

        elif principle['id'] == 4:  # Docker-first
            has_dockerfile = (root / 'Dockerfile').exists()
            has_compose = (root / 'docker-compose.yml').exists() or (root / 'docker-compose.yaml').exists()
            if has_dockerfile or has_compose:
                status = 'compliant'
            else:
                status = 'non-compliant'
                notes.append('No Dockerfile or docker-compose.yml found')

        elif principle['id'] == 5:  # Progressive enhancement
            # Check for a11y tests
            a11y_tests = list(root.rglob('*.accessibility.test.*'))
            manifest = (root / 'public' / 'manifest.json').exists()
            if a11y_tests:
                status = 'compliant'
                notes.append(f'Found {len(a11y_tests)} a11y test files')
            else:
                status = 'partial'
                notes.append('No dedicated a11y test files')

        elif principle['id'] == 6:  # Privacy first
            # Check for consent mechanisms (basic heuristic)
            status = 'unknown'
            notes.append('Requires manual review of analytics/tracking code')

        results.append({
            'principle': principle['name'],
            'description': principle['description'],
            'status': status,
            'notes': notes
        })

    return results


def format_plan_section(section: str, data: dict) -> str:
    """Format a plan section as markdown"""
    lines = []

    if section == 'tech-context':
        lines.append('## Technical Context')
        lines.append('')
        lines.append(f"**Project**: {data.get('name', 'unknown')} v{data.get('version', '0.0.0')}")
        lines.append(f"**Language**: {data.get('language', 'unknown')}")
        lines.append('')
        if data.get('frameworks'):
            lines.append(f"**Frameworks**: {', '.join(data['frameworks'])}")
        if data.get('testing'):
            lines.append(f"**Testing**: {', '.join(data['testing'])}")
        if data.get('build'):
            lines.append(f"**Build**: {', '.join(data['build'])}")
        if data.get('storage'):
            lines.append(f"**Storage**: {', '.join(data['storage'])}")
        if data.get('styling'):
            lines.append(f"**Styling**: {', '.join(data['styling'])}")

    elif section == 'constitution':
        lines.append('## Constitution Compliance')
        lines.append('')
        lines.append('| Principle | Status | Notes |')
        lines.append('|-----------|--------|-------|')
        for r in data:
            status_icon = '✓' if r['status'] == 'compliant' else '⚠' if r['status'] == 'partial' else '✗'
            notes = '; '.join(r['notes']) if r['notes'] else '-'
            lines.append(f"| {r['principle']} | {status_icon} {r['status']} | {notes} |")

    elif section == 'structure':
        lines.append('## Project Structure')
        lines.append('')
        lines.append('```')
        lines.append(data.get('root', '.') + '/')
        for line in data.get('tree', [])[:30]:
            lines.append(line)
        if len(data.get('tree', [])) > 30:
            lines.append('... (truncated)')
        lines.append('```')

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Fill plan template sections for SpecKit workflow',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--tech-context',
                        help='Extract tech context from package.json')
    parser.add_argument('--constitution-check', action='store_true',
                        help='Check constitution compliance')
    parser.add_argument('--structure-detect', action='store_true',
                        help='Detect project structure')
    parser.add_argument('--all', action='store_true',
                        help='Generate all sections')
    parser.add_argument('--root', default='.',
                        help='Project root directory')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()
    root = Path(args.root).resolve()

    result = {}

    # Tech context
    if args.tech_context or args.all:
        pkg_path = Path(args.tech_context) if args.tech_context else root / 'package.json'
        if pkg_path.exists():
            result['tech_context'] = extract_package_json(pkg_path)
        else:
            result['tech_context'] = {'error': f'File not found: {pkg_path}'}

    # Constitution check
    if args.constitution_check or args.all:
        result['constitution'] = check_constitution_compliance(root)

    # Structure detect
    if args.structure_detect or args.all:
        result['structure'] = detect_project_structure(root)

    # Default to all if nothing specified
    if not any([args.tech_context, args.constitution_check, args.structure_detect, args.all]):
        result['tech_context'] = extract_package_json(root / 'package.json')
        result['constitution'] = check_constitution_compliance(root)
        result['structure'] = detect_project_structure(root)

    # Summary
    if args.summary:
        parts = []
        if 'tech_context' in result and result['tech_context']:
            tc = result['tech_context']
            parts.append(f"Lang: {tc.get('language', '?')}")
            if tc.get('frameworks'):
                parts.append(f"Frameworks: {','.join(tc['frameworks'][:2])}")
        if 'constitution' in result:
            compliant = len([c for c in result['constitution'] if c['status'] == 'compliant'])
            parts.append(f"Constitution: {compliant}/6")
        print(' | '.join(parts))
        return

    # JSON output
    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Markdown output
    if 'tech_context' in result and result['tech_context']:
        print(format_plan_section('tech-context', result['tech_context']))
        print()

    if 'constitution' in result:
        print(format_plan_section('constitution', result['constitution']))
        print()

    if 'structure' in result:
        print(format_plan_section('structure', result['structure']))


if __name__ == '__main__':
    main()
