#!/usr/bin/env python3
"""
Validate Tasks - Task ID validator for tasks.md files

Validates task format, IDs, dependencies, and can auto-fix issues.

Required format:
  - [ ] T001 [P] [US1] Description with file path
        │     │    │
        │     │    └── Story label (required for story phases)
        │     └── Parallel marker (optional)
        └── Sequential ID (required)

Usage:
    python validate-tasks.py tasks.md
    python validate-tasks.py tasks.md --fix
    python validate-tasks.py tasks.md --renumber
    python validate-tasks.py tasks.md --check-deps
    python validate-tasks.py tasks.md --json
    python validate-tasks.py tasks.md --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Task line pattern
TASK_PATTERN = re.compile(
    r'^(\s*)-\s*\[([xX ])\]\s+'
    r'(T\d{3})'
    r'(?:\s+\[P\])?'
    r'(?:\s+\[US\d+\])?'
    r'\s+(.+)$'
)

# Relaxed pattern for detecting malformed tasks
LOOSE_TASK_PATTERN = re.compile(
    r'^(\s*)-\s*\[([xX ])\]\s+'
    r'(?:(T\d+)|([A-Z]+\d*))?\s*'
    r'(.*)$'
)


def parse_task(line: str, line_num: int) -> dict:
    """Parse a task line and return structured data"""
    match = TASK_PATTERN.match(line)
    if match:
        indent, status, task_id, description = match.groups()
        return {
            'line_num': line_num,
            'original': line,
            'valid': True,
            'indent': len(indent),
            'status': 'done' if status.lower() == 'x' else 'pending',
            'task_id': task_id,
            'parallel': '[P]' in line,
            'story': re.search(r'\[US(\d+)\]', line),
            'description': description.strip(),
            'issues': []
        }

    # Check if it looks like a task but is malformed
    loose_match = LOOSE_TASK_PATTERN.match(line)
    if loose_match and line.strip().startswith('-'):
        indent, status, task_id, bad_id, description = loose_match.groups()
        issues = []

        if bad_id and not task_id:
            issues.append(f'Invalid ID format: {bad_id} (expected T###)')
        if not task_id and not bad_id:
            issues.append('Missing task ID (expected T###)')

        return {
            'line_num': line_num,
            'original': line,
            'valid': False,
            'indent': len(indent) if indent else 0,
            'status': 'done' if status and status.lower() == 'x' else 'pending',
            'task_id': task_id or bad_id,
            'parallel': '[P]' in line,
            'story': re.search(r'\[US(\d+)\]', line),
            'description': (description or '').strip(),
            'issues': issues
        }

    return None


def validate_tasks(filepath: Path) -> dict:
    """Validate all tasks in a file"""
    if not filepath.exists():
        return {
            'file': str(filepath),
            'exists': False,
            'tasks': [],
            'issues': [{'type': 'error', 'message': 'File not found'}]
        }

    content = filepath.read_text()
    lines = content.split('\n')

    tasks = []
    issues = []
    seen_ids = {}
    expected_next = 1

    for i, line in enumerate(lines, 1):
        task = parse_task(line, i)
        if task:
            tasks.append(task)

            # Check for duplicate IDs
            if task['task_id']:
                if task['task_id'] in seen_ids:
                    task['issues'].append(f"Duplicate ID (first at line {seen_ids[task['task_id']]})")
                else:
                    seen_ids[task['task_id']] = i

            # Check sequential order
            if task['task_id'] and task['task_id'].startswith('T'):
                try:
                    num = int(task['task_id'][1:])
                    if num != expected_next:
                        task['issues'].append(f'Expected T{expected_next:03d}, got {task["task_id"]}')
                    expected_next = num + 1
                except ValueError:
                    pass

    # Aggregate issues
    for task in tasks:
        if task['issues']:
            for issue in task['issues']:
                issues.append({
                    'type': 'warning' if task['valid'] else 'error',
                    'line': task['line_num'],
                    'task_id': task['task_id'],
                    'message': issue
                })

    return {
        'file': str(filepath),
        'exists': True,
        'total_tasks': len(tasks),
        'valid_tasks': len([t for t in tasks if t['valid']]),
        'invalid_tasks': len([t for t in tasks if not t['valid']]),
        'completed': len([t for t in tasks if t['status'] == 'done']),
        'pending': len([t for t in tasks if t['status'] == 'pending']),
        'tasks': tasks,
        'issues': issues
    }


def check_dependencies(filepath: Path) -> dict:
    """Check task dependencies for cycles and missing references"""
    result = validate_tasks(filepath)
    if not result['exists']:
        return result

    content = filepath.read_text()
    dep_pattern = re.compile(r'depends\s+on\s+(T\d{3})', re.IGNORECASE)
    after_pattern = re.compile(r'after\s+(T\d{3})', re.IGNORECASE)
    blocks_pattern = re.compile(r'blocks\s+(T\d{3})', re.IGNORECASE)

    known_ids = {t['task_id'] for t in result['tasks'] if t['task_id']}
    dependencies = []

    for task in result['tasks']:
        if not task['task_id']:
            continue

        line = task['original']
        deps = dep_pattern.findall(line) + after_pattern.findall(line)
        blocks = blocks_pattern.findall(line)

        for dep in deps:
            if dep not in known_ids:
                result['issues'].append({
                    'type': 'error',
                    'line': task['line_num'],
                    'task_id': task['task_id'],
                    'message': f'Depends on unknown task {dep}'
                })
            dependencies.append({'from': task['task_id'], 'to': dep, 'type': 'depends'})

        for blocked in blocks:
            if blocked not in known_ids:
                result['issues'].append({
                    'type': 'warning',
                    'line': task['line_num'],
                    'task_id': task['task_id'],
                    'message': f'Blocks unknown task {blocked}'
                })
            dependencies.append({'from': task['task_id'], 'to': blocked, 'type': 'blocks'})

    result['dependencies'] = dependencies
    return result


def renumber_tasks(filepath: Path, dry_run: bool = False) -> dict:
    """Renumber all tasks sequentially"""
    if not filepath.exists():
        return {'error': 'File not found'}

    content = filepath.read_text()
    lines = content.split('\n')
    new_lines = []
    task_num = 1
    id_map = {}

    for line in lines:
        task = parse_task(line, 0)
        if task and task['task_id']:
            old_id = task['task_id']
            new_id = f'T{task_num:03d}'
            id_map[old_id] = new_id

            # Replace the ID in the line
            new_line = re.sub(r'T\d{3}', new_id, line, count=1)
            new_lines.append(new_line)
            task_num += 1
        else:
            new_lines.append(line)

    new_content = '\n'.join(new_lines)

    # Update any dependency references
    for old_id, new_id in id_map.items():
        if old_id != new_id:
            new_content = new_content.replace(f'depends on {old_id}', f'depends on {new_id}')
            new_content = new_content.replace(f'after {old_id}', f'after {new_id}')
            new_content = new_content.replace(f'blocks {old_id}', f'blocks {new_id}')

    if not dry_run:
        filepath.write_text(new_content)

    return {
        'file': str(filepath),
        'renumbered': len(id_map),
        'mapping': id_map,
        'dry_run': dry_run
    }


def main():
    parser = argparse.ArgumentParser(
        description='Validate and manage task IDs in tasks.md files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('file', nargs='?', default='tasks.md',
                        help='Path to tasks.md file')
    parser.add_argument('--fix', action='store_true',
                        help='Auto-fix simple issues')
    parser.add_argument('--renumber', action='store_true',
                        help='Renumber all tasks sequentially')
    parser.add_argument('--check-deps', action='store_true',
                        help='Check dependency references')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without writing')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()
    filepath = Path(args.file)

    if args.renumber:
        result = renumber_tasks(filepath, args.dry_run)
        if args.json:
            print(json.dumps(result, indent=2))
        elif args.summary:
            print(f"File: {filepath.name} | Renumbered: {result.get('renumbered', 0)} | Dry-run: {args.dry_run}")
        else:
            if 'error' in result:
                print(f"Error: {result['error']}")
                sys.exit(1)
            print(f"Renumbered {result['renumbered']} tasks")
            if args.dry_run:
                print("(dry-run - no changes written)")
            for old, new in list(result['mapping'].items())[:10]:
                if old != new:
                    print(f"  {old} → {new}")
        return

    if args.check_deps:
        result = check_dependencies(filepath)
    else:
        result = validate_tasks(filepath)

    if args.summary:
        status = 'OK' if not result['issues'] else f"{len(result['issues'])} issues"
        completion = f"{result.get('completed', 0)}/{result.get('total_tasks', 0)}"
        print(f"File: {filepath.name} | Tasks: {result.get('total_tasks', 0)} | Done: {completion} | Status: {status}")
        return

    if args.json:
        # Remove task details for cleaner JSON
        output = {k: v for k, v in result.items() if k != 'tasks'}
        output['task_ids'] = [t['task_id'] for t in result.get('tasks', []) if t.get('task_id')]
        print(json.dumps(output, indent=2))
        return

    # Human-readable output
    if not result['exists']:
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print(f"Task Validation: {filepath}")
    print("=" * 50)
    print(f"Total tasks: {result['total_tasks']}")
    print(f"  Valid: {result['valid_tasks']}")
    print(f"  Invalid: {result['invalid_tasks']}")
    print(f"  Completed: {result['completed']}")
    print(f"  Pending: {result['pending']}")

    if result['issues']:
        print(f"\nIssues ({len(result['issues'])}):")
        for issue in result['issues']:
            icon = '✗' if issue['type'] == 'error' else '⚠'
            line_info = f"L{issue['line']}" if issue.get('line') else ''
            task_info = issue.get('task_id', '')
            print(f"  {icon} {line_info} {task_info}: {issue['message']}")
    else:
        print("\n✓ All tasks valid")

    if args.check_deps and result.get('dependencies'):
        print(f"\nDependencies ({len(result['dependencies'])}):")
        for dep in result['dependencies'][:10]:
            print(f"  {dep['from']} {dep['type']} {dep['to']}")


if __name__ == '__main__':
    main()
