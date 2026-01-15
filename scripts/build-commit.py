#!/usr/bin/env python3
"""
Build Commit - Commit message builder with conventional commit format

Generates commit messages with proper format and footer.

Standard format:
  type(scope): description

  body (optional)

  footer

Usage:
    python build-commit.py --type feat --scope auth --message "Add OAuth support"
    python build-commit.py --from-staged
    python build-commit.py --interactive
    python build-commit.py --json
    python build-commit.py --summary
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Conventional commit types
COMMIT_TYPES = {
    'feat': 'A new feature',
    'fix': 'A bug fix',
    'docs': 'Documentation only changes',
    'style': 'Changes that do not affect the meaning of the code',
    'refactor': 'A code change that neither fixes a bug nor adds a feature',
    'perf': 'A code change that improves performance',
    'test': 'Adding missing tests or correcting existing tests',
    'build': 'Changes that affect the build system or external dependencies',
    'ci': 'Changes to CI configuration files and scripts',
    'chore': 'Other changes that do not modify src or test files',
    'revert': 'Reverts a previous commit',
}

# Standard footer
FOOTER = """
Co-Authored-By: Claude <noreply@anthropic.com>"""


def run_git_command(args: list) -> tuple:
    """Run a git command and return (stdout, stderr, returncode)"""
    try:
        result = subprocess.run(
            ['git'] + args,
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e:
        return '', str(e), 1


def get_staged_files() -> list:
    """Get list of staged files"""
    stdout, _, _ = run_git_command(['diff', '--cached', '--name-only'])
    if stdout:
        return stdout.split('\n')
    return []


def get_staged_diff() -> str:
    """Get diff of staged changes"""
    stdout, _, _ = run_git_command(['diff', '--cached', '--stat'])
    return stdout


def analyze_staged_changes() -> dict:
    """Analyze staged changes to suggest commit type and scope"""
    files = get_staged_files()

    if not files:
        return {
            'files': [],
            'suggested_type': None,
            'suggested_scope': None,
            'stats': {}
        }

    # Analyze file types and paths
    file_types = {
        'src': 0,
        'test': 0,
        'docs': 0,
        'config': 0,
        'ci': 0,
        'other': 0
    }

    scopes = set()

    for f in files:
        path = Path(f)

        # Categorize by path
        if 'test' in f.lower() or f.endswith('.test.ts') or f.endswith('.test.tsx'):
            file_types['test'] += 1
        elif f.startswith('src/'):
            file_types['src'] += 1
            # Extract scope from path
            parts = path.parts
            if len(parts) > 2:
                scopes.add(parts[1])
        elif f.endswith('.md'):
            file_types['docs'] += 1
        elif f.startswith('.github/') or f.startswith('.gitlab-ci'):
            file_types['ci'] += 1
        elif any(f.endswith(ext) for ext in ['.json', '.yaml', '.yml', '.toml', '.config.js']):
            file_types['config'] += 1
        else:
            file_types['other'] += 1

    # Suggest type based on file analysis
    suggested_type = 'chore'
    if file_types['test'] > file_types['src']:
        suggested_type = 'test'
    elif file_types['docs'] > 0 and file_types['src'] == 0:
        suggested_type = 'docs'
    elif file_types['ci'] > 0 and file_types['src'] == 0:
        suggested_type = 'ci'
    elif file_types['config'] > 0 and file_types['src'] == 0:
        suggested_type = 'build'
    elif file_types['src'] > 0:
        suggested_type = 'feat'  # Default to feat for src changes

    # Suggest scope
    suggested_scope = None
    if scopes:
        suggested_scope = sorted(scopes)[0]

    return {
        'files': files,
        'file_count': len(files),
        'suggested_type': suggested_type,
        'suggested_scope': suggested_scope,
        'file_types': file_types,
        'scopes': sorted(list(scopes))
    }


def build_commit_message(
    commit_type: str,
    scope: str = None,
    message: str = '',
    body: str = None,
    breaking: bool = False,
    issue: str = None
) -> str:
    """Build a conventional commit message"""
    # Build header
    header = commit_type
    if scope:
        header += f'({scope})'
    if breaking:
        header += '!'
    header += f': {message}'

    # Build full message
    parts = [header]

    if body:
        parts.append('')
        parts.append(body)

    if breaking:
        parts.append('')
        parts.append('BREAKING CHANGE: ' + (body or message))

    if issue:
        parts.append('')
        parts.append(f'Closes #{issue}')

    parts.append(FOOTER)

    return '\n'.join(parts)


def validate_commit_message(message: str) -> dict:
    """Validate a commit message against conventional commit format"""
    issues = []

    lines = message.split('\n')
    header = lines[0] if lines else ''

    # Check header format
    header_pattern = re.compile(r'^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$')
    match = header_pattern.match(header)

    if not match:
        issues.append('Header does not match conventional commit format')
    else:
        commit_type = match.group(1)
        if commit_type not in COMMIT_TYPES:
            issues.append(f'Unknown commit type: {commit_type}')

        description = match.group(4)
        if len(description) > 72:
            issues.append(f'Description too long ({len(description)} > 72 chars)')

        if description[0].isupper():
            issues.append('Description should start with lowercase')

        if description.endswith('.'):
            issues.append('Description should not end with period')

    # Check line lengths
    for i, line in enumerate(lines):
        if len(line) > 100 and not line.startswith('Co-Authored-By'):
            issues.append(f'Line {i+1} exceeds 100 characters')

    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'header': header
    }


def main():
    parser = argparse.ArgumentParser(
        description='Build conventional commit messages',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--type', '-t', choices=list(COMMIT_TYPES.keys()),
                        help='Commit type')
    parser.add_argument('--scope', '-s',
                        help='Commit scope')
    parser.add_argument('--message', '-m',
                        help='Commit message')
    parser.add_argument('--body', '-b',
                        help='Commit body')
    parser.add_argument('--breaking', action='store_true',
                        help='Mark as breaking change')
    parser.add_argument('--issue', '-i',
                        help='Issue number to close')
    parser.add_argument('--from-staged', action='store_true',
                        help='Analyze staged files to suggest type/scope')
    parser.add_argument('--validate',
                        help='Validate an existing commit message')
    parser.add_argument('--list-types', action='store_true',
                        help='List available commit types')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    # List types
    if args.list_types:
        if args.json:
            print(json.dumps(COMMIT_TYPES, indent=2))
        else:
            print("Conventional Commit Types:")
            for t, desc in COMMIT_TYPES.items():
                print(f"  {t:10} - {desc}")
        return

    # Validate existing message
    if args.validate:
        result = validate_commit_message(args.validate)
        if args.json:
            print(json.dumps(result, indent=2))
        elif args.summary:
            status = 'valid' if result['valid'] else f"{len(result['issues'])} issues"
            print(f"Status: {status}")
        else:
            if result['valid']:
                print("✓ Commit message is valid")
            else:
                print("✗ Commit message has issues:")
                for issue in result['issues']:
                    print(f"  - {issue}")
        return

    # Analyze staged files
    if args.from_staged:
        analysis = analyze_staged_changes()

        if args.summary:
            t = analysis['suggested_type'] or 'unknown'
            s = analysis['suggested_scope'] or 'none'
            print(f"Files: {analysis['file_count']} | Type: {t} | Scope: {s}")
            return

        if args.json:
            print(json.dumps(analysis, indent=2))
            return

        print("Staged File Analysis")
        print("=" * 40)
        print(f"Files: {analysis['file_count']}")
        if analysis['files']:
            for f in analysis['files'][:10]:
                print(f"  - {f}")
            if len(analysis['files']) > 10:
                print(f"  ... and {len(analysis['files']) - 10} more")
        print()
        print(f"Suggested type: {analysis['suggested_type']}")
        print(f"Suggested scope: {analysis['suggested_scope']}")
        if analysis['scopes']:
            print(f"Available scopes: {', '.join(analysis['scopes'])}")
        return

    # Build commit message
    if not args.type or not args.message:
        parser.print_help()
        print("\nRequired: --type and --message")
        sys.exit(1)

    commit_msg = build_commit_message(
        commit_type=args.type,
        scope=args.scope,
        message=args.message,
        body=args.body,
        breaking=args.breaking,
        issue=args.issue
    )

    result = {
        'type': args.type,
        'scope': args.scope,
        'message': args.message,
        'breaking': args.breaking,
        'commit_message': commit_msg
    }

    if args.summary:
        scope_str = f"({args.scope})" if args.scope else ""
        print(f"Type: {args.type}{scope_str} | Breaking: {args.breaking}")
        return

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print(commit_msg)


if __name__ == '__main__':
    main()
