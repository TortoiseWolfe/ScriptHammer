#!/usr/bin/env python3
"""
Generate Ignores - Ignore file generator for various tech stacks

Auto-detects or manually specifies tech stack and generates
appropriate .gitignore, .dockerignore, .eslintignore files.

Usage:
    python generate-ignores.py --detect
    python generate-ignores.py --stack node,docker,python
    python generate-ignores.py --gitignore --dockerignore
    python generate-ignores.py --verify
    python generate-ignores.py --json
    python generate-ignores.py --summary
"""

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Ignore patterns by technology
PATTERNS = {
    'node': {
        'gitignore': [
            'node_modules/',
            'dist/',
            'build/',
            '.next/',
            '.nuxt/',
            '*.log',
            'npm-debug.log*',
            'yarn-debug.log*',
            'yarn-error.log*',
            '.pnpm-debug.log*',
            '.env',
            '.env.local',
            '.env.*.local',
            'coverage/',
            '.nyc_output/',
        ],
        'dockerignore': [
            'node_modules/',
            'dist/',
            '.next/',
            '.nuxt/',
            '*.log',
            '.env*',
            'coverage/',
            '.git/',
            '.gitignore',
            'README.md',
            'Dockerfile*',
            'docker-compose*',
        ],
        'eslintignore': [
            'node_modules/',
            'dist/',
            'build/',
            '.next/',
            'coverage/',
        ],
    },
    'python': {
        'gitignore': [
            '__pycache__/',
            '*.py[cod]',
            '*$py.class',
            '*.so',
            '.Python',
            'build/',
            'develop-eggs/',
            'dist/',
            'downloads/',
            'eggs/',
            '.eggs/',
            'lib/',
            'lib64/',
            'parts/',
            'sdist/',
            'var/',
            'wheels/',
            '*.egg-info/',
            '.installed.cfg',
            '*.egg',
            '.venv/',
            'venv/',
            'ENV/',
            '.pytest_cache/',
            '.coverage',
            'htmlcov/',
            '.mypy_cache/',
        ],
        'dockerignore': [
            '__pycache__/',
            '*.py[cod]',
            '.venv/',
            'venv/',
            '.git/',
            '.gitignore',
            'README.md',
            '.pytest_cache/',
            '.coverage',
            'htmlcov/',
            '.mypy_cache/',
        ],
    },
    'docker': {
        'gitignore': [
            '.docker/',
            '*.tar',
            '*.tar.gz',
        ],
        'dockerignore': [
            '.git/',
            '.gitignore',
            'README.md',
            'LICENSE',
            '*.md',
            'Makefile',
            'Dockerfile*',
            'docker-compose*',
            '.dockerignore',
        ],
    },
    'rust': {
        'gitignore': [
            'target/',
            'Cargo.lock',
            '*.rs.bk',
            '*.pdb',
        ],
        'dockerignore': [
            'target/',
            '.git/',
            '.gitignore',
            'README.md',
        ],
    },
    'go': {
        'gitignore': [
            '*.exe',
            '*.exe~',
            '*.dll',
            '*.so',
            '*.dylib',
            '*.test',
            '*.out',
            'vendor/',
            'bin/',
        ],
        'dockerignore': [
            '*.exe',
            'vendor/',
            'bin/',
            '.git/',
            '.gitignore',
            'README.md',
        ],
    },
    'java': {
        'gitignore': [
            'target/',
            '*.class',
            '*.jar',
            '*.war',
            '*.ear',
            '*.log',
            '.gradle/',
            'build/',
            '.idea/',
            '*.iml',
        ],
        'dockerignore': [
            'target/',
            '*.class',
            '.gradle/',
            'build/',
            '.idea/',
            '.git/',
        ],
    },
    'ide': {
        'gitignore': [
            '.idea/',
            '.vscode/',
            '*.swp',
            '*.swo',
            '*~',
            '.DS_Store',
            'Thumbs.db',
        ],
    },
    'secrets': {
        'gitignore': [
            '.env',
            '.env.*',
            '*.pem',
            '*.key',
            'secrets/',
            'credentials.json',
            '.gcp-credentials.json',
            '.aws/',
        ],
    },
}


def detect_stack(root: Path) -> list:
    """Detect tech stack from project files"""
    detected = []

    # Node.js
    if (root / 'package.json').exists():
        detected.append('node')

    # Python
    if any((root / f).exists() for f in ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile']):
        detected.append('python')

    # Docker
    if any(root.glob('Dockerfile*')) or (root / 'docker-compose.yml').exists():
        detected.append('docker')

    # Rust
    if (root / 'Cargo.toml').exists():
        detected.append('rust')

    # Go
    if (root / 'go.mod').exists():
        detected.append('go')

    # Java
    if (root / 'pom.xml').exists() or (root / 'build.gradle').exists():
        detected.append('java')

    # Always add IDE and secrets
    detected.extend(['ide', 'secrets'])

    return list(set(detected))


def merge_patterns(stacks: list, file_type: str) -> list:
    """Merge patterns from multiple stacks"""
    patterns = []
    seen = set()

    for stack in stacks:
        if stack in PATTERNS and file_type in PATTERNS[stack]:
            for pattern in PATTERNS[stack][file_type]:
                if pattern not in seen:
                    patterns.append(pattern)
                    seen.add(pattern)

    return patterns


def generate_content(patterns: list, header: str = '') -> str:
    """Generate ignore file content"""
    lines = []
    if header:
        lines.append(f'# {header}')
        lines.append(f'# Generated by generate-ignores.py')
        lines.append('')

    lines.extend(patterns)
    lines.append('')

    return '\n'.join(lines)


def verify_existing(root: Path, stacks: list) -> dict:
    """Verify existing ignore files against expected patterns"""
    results = {}

    for file_type in ['gitignore', 'dockerignore', 'eslintignore']:
        filename = f'.{file_type}'
        filepath = root / filename
        expected = set(merge_patterns(stacks, file_type))

        if not filepath.exists():
            results[file_type] = {
                'exists': False,
                'missing': list(expected),
                'extra': [],
                'status': 'missing' if expected else 'ok'
            }
            continue

        content = filepath.read_text()
        existing = set()
        for line in content.split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                existing.add(line)

        missing = expected - existing
        extra = existing - expected

        results[file_type] = {
            'exists': True,
            'missing': sorted(list(missing)),
            'extra': sorted(list(extra)),
            'status': 'ok' if not missing else 'incomplete'
        }

    return results


def main():
    parser = argparse.ArgumentParser(
        description='Generate ignore files for detected/specified tech stack',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--detect', action='store_true',
                        help='Auto-detect tech stack from project')
    parser.add_argument('--stack', default='',
                        help='Comma-separated list of stacks (node,python,docker,rust,go,java)')
    parser.add_argument('--gitignore', action='store_true',
                        help='Generate .gitignore')
    parser.add_argument('--dockerignore', action='store_true',
                        help='Generate .dockerignore')
    parser.add_argument('--eslintignore', action='store_true',
                        help='Generate .eslintignore')
    parser.add_argument('--all', action='store_true',
                        help='Generate all ignore files')
    parser.add_argument('--verify', action='store_true',
                        help='Verify existing ignore files')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview without writing')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')
    parser.add_argument('--root', default='.',
                        help='Project root directory')

    args = parser.parse_args()
    root = Path(args.root).resolve()

    # Determine stacks
    if args.detect or (not args.stack and not args.verify):
        stacks = detect_stack(root)
    else:
        stacks = [s.strip() for s in args.stack.split(',') if s.strip()]

    # Default to detect if no stack specified
    if not stacks:
        stacks = detect_stack(root)

    # Handle verify mode
    if args.verify:
        results = verify_existing(root, stacks)
        if args.summary:
            statuses = [f"{k}:{v['status']}" for k, v in results.items()]
            print(f"Stacks: {','.join(stacks)} | {' | '.join(statuses)}")
            return
        if args.json:
            print(json.dumps({'stacks': stacks, 'verification': results}, indent=2))
        else:
            print(f"Detected stacks: {', '.join(stacks)}")
            print()
            for file_type, result in results.items():
                status_icon = '✓' if result['status'] == 'ok' else '✗'
                exists_str = 'exists' if result['exists'] else 'missing'
                print(f"{status_icon} .{file_type} ({exists_str})")
                if result['missing']:
                    print(f"  Missing patterns: {len(result['missing'])}")
                    for p in result['missing'][:5]:
                        print(f"    - {p}")
                    if len(result['missing']) > 5:
                        print(f"    ... and {len(result['missing']) - 5} more")
        return

    # Determine which files to generate
    generate_files = []
    if args.all:
        generate_files = ['gitignore', 'dockerignore', 'eslintignore']
    else:
        if args.gitignore:
            generate_files.append('gitignore')
        if args.dockerignore:
            generate_files.append('dockerignore')
        if args.eslintignore:
            generate_files.append('eslintignore')

    # Default to gitignore if nothing specified
    if not generate_files:
        generate_files = ['gitignore']

    # Generate content
    result = {
        'stacks': stacks,
        'files': {}
    }

    for file_type in generate_files:
        patterns = merge_patterns(stacks, file_type)
        if patterns:
            content = generate_content(patterns, f'.{file_type}')
            result['files'][f'.{file_type}'] = {
                'patterns': patterns,
                'content': content
            }

    if args.summary:
        file_list = ', '.join(result['files'].keys())
        pattern_count = sum(len(f['patterns']) for f in result['files'].values())
        print(f"Stacks: {','.join(stacks)} | Files: {file_list} | Patterns: {pattern_count}")
        return

    if args.dry_run:
        if args.json:
            # Don't include full content in dry-run JSON
            output = {
                'stacks': stacks,
                'files': {k: {'patterns': v['patterns']} for k, v in result['files'].items()}
            }
            print(json.dumps(output, indent=2))
        else:
            print(f"Detected stacks: {', '.join(stacks)}")
            print()
            for filename, data in result['files'].items():
                print(f"Would create {filename} ({len(data['patterns'])} patterns)")
        return

    # Write files
    written = []
    for filename, data in result['files'].items():
        filepath = root / filename
        filepath.write_text(data['content'])
        written.append(str(filepath))

    if args.json:
        print(json.dumps({'stacks': stacks, 'written': written}, indent=2))
    else:
        print(f"Generated for stacks: {', '.join(stacks)}")
        for filepath in written:
            print(f"  ✓ {filepath}")


if __name__ == '__main__':
    main()
