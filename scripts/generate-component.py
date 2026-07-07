#!/usr/bin/env python3
"""
Generate Component - 5-file component generator following constitution pattern

Creates the mandated 5-file structure:
  ComponentName/
  ├── index.tsx
  ├── ComponentName.tsx
  ├── ComponentName.test.tsx
  ├── ComponentName.stories.tsx
  └── ComponentName.accessibility.test.tsx

Usage:
    python generate-component.py Button --path src/components/atoms
    python generate-component.py UserCard --with-props "name:string,avatar:string"
    python generate-component.py LoginForm --dry-run
    python generate-component.py Button --json
    python generate-component.py Button --summary
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent


def to_kebab_case(name: str) -> str:
    """Convert PascalCase to kebab-case"""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()


def parse_props(props_str: str) -> list:
    """Parse props string like 'name:string,avatar:string' into list"""
    if not props_str:
        return []
    props = []
    for prop in props_str.split(','):
        if ':' in prop:
            name, type_ = prop.strip().split(':', 1)
            props.append({'name': name.strip(), 'type': type_.strip()})
    return props


def generate_index(name: str) -> str:
    """Generate index.tsx content"""
    return f"""export {{ default }} from './{name}'
export type {{ {name}Props }} from './{name}'
"""


def generate_component(name: str, props: list) -> str:
    """Generate Component.tsx content"""
    kebab = to_kebab_case(name)
    props_interface = ""
    if props:
        props_lines = "\n".join([f"  {p['name']}: {p['type']}" for p in props])
        props_interface = props_lines
    else:
        props_interface = "  // Add props here"

    return f"""import type {{ FC }} from 'react'

export interface {name}Props {{
{props_interface}
}}

export const {name}: FC<{name}Props> = (props) => {{
  return (
    <div data-testid="{kebab}">
      {{/* TODO: Implement {name} */}}
    </div>
  )
}}

export default {name}
"""


def generate_test(name: str) -> str:
    """Generate ComponentName.test.tsx content"""
    return f"""import {{ describe, it, expect, beforeEach }} from 'vitest'
import {{ render, screen }} from '@testing-library/react'
import {{ {name} }} from './{name}'

describe('{name}', () => {{
  beforeEach(() => {{
    // Setup before each test
  }})

  it('should render correctly', () => {{
    render(<{name} />)
    expect(screen.getByTestId('{to_kebab_case(name)}')).toBeInTheDocument()
  }})

  it('should handle user interaction', () => {{
    // TODO: Add interaction tests
  }})
}})
"""


def generate_stories(name: str, props: list) -> str:
    """Generate ComponentName.stories.tsx content"""
    default_args = ""
    if props:
        args_lines = ",\n    ".join([f"{p['name']}: ''" for p in props])
        default_args = f"""args: {{
    {args_lines}
  }},"""

    return f"""import type {{ Meta, StoryObj }} from '@storybook/react'
import {{ {name} }} from './{name}'

const meta: Meta<typeof {name}> = {{
  title: 'Components/{name}',
  component: {name},
  tags: ['autodocs'],
}}

export default meta
type Story = StoryObj<typeof {name}>

export const Default: Story = {{
  {default_args}
}}

export const WithProps: Story = {{
  args: {{
    // Add variant props here
  }},
}}
"""


def generate_a11y_test(name: str) -> str:
    """Generate ComponentName.accessibility.test.tsx content"""
    return f"""import {{ describe, it, expect }} from 'vitest'
import {{ render }} from '@testing-library/react'
import {{ axe, toHaveNoViolations }} from 'jest-axe'
import {{ {name} }} from './{name}'

expect.extend(toHaveNoViolations)

describe('{name} Accessibility', () => {{
  it('should have no accessibility violations', async () => {{
    const {{ container }} = render(<{name} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }})

  it('should support keyboard navigation', () => {{
    // TODO: Add keyboard navigation tests
  }})

  it('should have proper ARIA attributes', () => {{
    // TODO: Add ARIA tests
  }})
}})
"""


def generate_component_files(name: str, path: Path, props: list) -> dict:
    """Generate all 5 component files"""
    component_dir = path / name
    files = {
        'index.tsx': generate_index(name),
        f'{name}.tsx': generate_component(name, props),
        f'{name}.test.tsx': generate_test(name),
        f'{name}.stories.tsx': generate_stories(name, props),
        f'{name}.accessibility.test.tsx': generate_a11y_test(name),
    }
    return {
        'directory': str(component_dir),
        'files': {str(component_dir / fname): content for fname, content in files.items()}
    }


def write_files(result: dict) -> dict:
    """Write generated files to disk"""
    directory = Path(result['directory'])
    directory.mkdir(parents=True, exist_ok=True)

    written = []
    errors = []

    for filepath, content in result['files'].items():
        try:
            Path(filepath).write_text(content)
            written.append(filepath)
        except Exception as e:
            errors.append({'file': filepath, 'error': str(e)})

    return {
        'directory': result['directory'],
        'written': written,
        'errors': errors
    }


def main():
    parser = argparse.ArgumentParser(
        description='Generate 5-file component structure (Constitution Pattern)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('name', nargs='?', help='Component name in PascalCase')
    parser.add_argument('--path', default='src/components',
                        help='Base path for component (default: src/components)')
    parser.add_argument('--with-props', dest='props', default='',
                        help='Props in format "name:type,name:type"')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview files without writing')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    if not args.name:
        parser.print_help()
        sys.exit(1)

    # Validate component name (PascalCase)
    if not args.name[0].isupper():
        print(f"Error: Component name must be PascalCase (got: {args.name})", file=sys.stderr)
        sys.exit(1)

    props = parse_props(args.props)
    path = Path(args.path)
    result = generate_component_files(args.name, path, props)

    if args.summary:
        file_count = len(result['files'])
        print(f"Component: {args.name} | Files: {file_count} | Path: {result['directory']}")
        return

    if args.dry_run:
        result['dry_run'] = True
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Would create: {result['directory']}/")
            for filepath in result['files']:
                print(f"  - {Path(filepath).name}")
            if props:
                props_str = ', '.join([p['name'] + ': ' + p['type'] for p in props])
                print(f"\nProps: {props_str}")
        return

    write_result = write_files(result)

    if args.json:
        print(json.dumps(write_result, indent=2))
    else:
        print(f"Created: {write_result['directory']}/")
        for filepath in write_result['written']:
            print(f"  ✓ {Path(filepath).name}")
        if write_result['errors']:
            for err in write_result['errors']:
                print(f"  ✗ {Path(err['file']).name}: {err['error']}")


if __name__ == '__main__':
    main()
