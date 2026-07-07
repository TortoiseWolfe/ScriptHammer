#!/usr/bin/env python3
"""
Scaffold Test - Test file scaffolder for TDD workflow

Generates test file boilerplate for unit, integration, e2e, and accessibility tests.

Usage:
    python scaffold-test.py Button --type unit
    python scaffold-test.py UserService --type integration
    python scaffold-test.py LoginForm --type e2e --framework playwright
    python scaffold-test.py --from data-model.md
    python scaffold-test.py Button --json
    python scaffold-test.py Button --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent


def to_kebab_case(name: str) -> str:
    """Convert PascalCase to kebab-case"""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()


def generate_unit_test(name: str, framework: str = 'vitest') -> str:
    """Generate unit test boilerplate"""
    kebab = to_kebab_case(name)

    if framework == 'jest':
        return f"""import {{ {name} }} from './{name}'

describe('{name}', () => {{
  beforeEach(() => {{
    // Setup before each test
  }})

  afterEach(() => {{
    // Cleanup after each test
  }})

  describe('initialization', () => {{
    it('should create instance correctly', () => {{
      // TODO: Test initialization
      expect(true).toBe(true)
    }})
  }})

  describe('core functionality', () => {{
    it('should handle happy path', () => {{
      // TODO: Test main functionality
    }})

    it('should handle edge cases', () => {{
      // TODO: Test edge cases
    }})

    it('should handle error conditions', () => {{
      // TODO: Test error handling
    }})
  }})
}})
"""

    # Default to vitest
    return f"""import {{ describe, it, expect, beforeEach, afterEach, vi }} from 'vitest'
import {{ {name} }} from './{name}'

describe('{name}', () => {{
  beforeEach(() => {{
    // Setup before each test
  }})

  afterEach(() => {{
    // Cleanup after each test
    vi.restoreAllMocks()
  }})

  describe('initialization', () => {{
    it('should create instance correctly', () => {{
      // TODO: Test initialization
      expect(true).toBe(true)
    }})
  }})

  describe('core functionality', () => {{
    it('should handle happy path', () => {{
      // TODO: Test main functionality
    }})

    it('should handle edge cases', () => {{
      // TODO: Test edge cases
    }})

    it('should handle error conditions', () => {{
      // TODO: Test error handling
    }})
  }})
}})
"""


def generate_component_test(name: str, framework: str = 'vitest') -> str:
    """Generate React component test boilerplate"""
    kebab = to_kebab_case(name)

    return f"""import {{ describe, it, expect, beforeEach }} from 'vitest'
import {{ render, screen, fireEvent, waitFor }} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {{ {name} }} from './{name}'

describe('{name}', () => {{
  const defaultProps = {{
    // Add default props here
  }}

  beforeEach(() => {{
    // Setup before each test
  }})

  describe('rendering', () => {{
    it('should render correctly', () => {{
      render(<{name} {{...defaultProps}} />)
      expect(screen.getByTestId('{kebab}')).toBeInTheDocument()
    }})

    it('should render with custom props', () => {{
      render(<{name} {{...defaultProps}} />)
      // TODO: Assert custom props rendering
    }})
  }})

  describe('user interactions', () => {{
    it('should handle click events', async () => {{
      const user = userEvent.setup()
      render(<{name} {{...defaultProps}} />)

      // TODO: Test click interactions
      // await user.click(screen.getByRole('button'))
    }})

    it('should handle keyboard navigation', async () => {{
      const user = userEvent.setup()
      render(<{name} {{...defaultProps}} />)

      // TODO: Test keyboard interactions
      // await user.tab()
    }})
  }})

  describe('state changes', () => {{
    it('should update state correctly', async () => {{
      render(<{name} {{...defaultProps}} />)

      // TODO: Test state changes
      await waitFor(() => {{
        // assertions
      }})
    }})
  }})
}})
"""


def generate_integration_test(name: str, framework: str = 'vitest') -> str:
    """Generate integration test boilerplate"""
    return f"""import {{ describe, it, expect, beforeAll, afterAll, beforeEach }} from 'vitest'

describe('{name} Integration', () => {{
  // Shared test state
  let testContext: any

  beforeAll(async () => {{
    // Setup once before all tests
    // Initialize database connection, API client, etc.
  }})

  afterAll(async () => {{
    // Cleanup after all tests
    // Close connections, clean up test data
  }})

  beforeEach(async () => {{
    // Reset state before each test
  }})

  describe('API interactions', () => {{
    it('should create resource successfully', async () => {{
      // TODO: Test create operation
    }})

    it('should read resource successfully', async () => {{
      // TODO: Test read operation
    }})

    it('should update resource successfully', async () => {{
      // TODO: Test update operation
    }})

    it('should delete resource successfully', async () => {{
      // TODO: Test delete operation
    }})
  }})

  describe('error handling', () => {{
    it('should handle network errors', async () => {{
      // TODO: Test network error handling
    }})

    it('should handle validation errors', async () => {{
      // TODO: Test validation error handling
    }})

    it('should handle unauthorized access', async () => {{
      // TODO: Test auth error handling
    }})
  }})

  describe('data consistency', () => {{
    it('should maintain data integrity', async () => {{
      // TODO: Test data consistency
    }})

    it('should handle concurrent operations', async () => {{
      // TODO: Test concurrency
    }})
  }})
}})
"""


def generate_e2e_test(name: str, framework: str = 'playwright') -> str:
    """Generate E2E test boilerplate"""
    if framework == 'cypress':
        return f"""describe('{name} E2E', () => {{
  beforeEach(() => {{
    cy.visit('/')
  }})

  it('should complete user flow successfully', () => {{
    // TODO: Implement user flow
    cy.get('[data-testid="{to_kebab_case(name)}"]').should('be.visible')
  }})

  it('should handle error states gracefully', () => {{
    // TODO: Test error handling
  }})

  it('should work on mobile viewport', () => {{
    cy.viewport('iphone-x')
    // TODO: Test mobile experience
  }})
}})
"""

    # Default to Playwright
    return f"""import {{ test, expect }} from '@playwright/test'

test.describe('{name} E2E', () => {{
  test.beforeEach(async ({{ page }}) => {{
    await page.goto('/')
  }})

  test('should complete user flow successfully', async ({{ page }}) => {{
    // TODO: Implement user flow
    await expect(page.getByTestId('{to_kebab_case(name)}')).toBeVisible()
  }})

  test('should handle error states gracefully', async ({{ page }}) => {{
    // TODO: Test error handling
  }})

  test('should work on mobile viewport', async ({{ page }}) => {{
    await page.setViewportSize({{ width: 375, height: 667 }})
    // TODO: Test mobile experience
  }})

  test('should be accessible', async ({{ page }}) => {{
    // TODO: Add accessibility checks
  }})
}})
"""


def generate_a11y_test(name: str) -> str:
    """Generate accessibility test boilerplate"""
    return f"""import {{ describe, it, expect }} from 'vitest'
import {{ render }} from '@testing-library/react'
import {{ axe, toHaveNoViolations }} from 'jest-axe'
import {{ {name} }} from './{name}'

expect.extend(toHaveNoViolations)

describe('{name} Accessibility', () => {{
  const defaultProps = {{
    // Add default props
  }}

  it('should have no accessibility violations', async () => {{
    const {{ container }} = render(<{name} {{...defaultProps}} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }})

  it('should support keyboard navigation', () => {{
    render(<{name} {{...defaultProps}} />)
    // TODO: Test keyboard navigation
    // - Tab order is logical
    // - All interactive elements are reachable
    // - Focus indicators are visible
  }})

  it('should have proper ARIA attributes', () => {{
    render(<{name} {{...defaultProps}} />)
    // TODO: Verify ARIA attributes
    // - Roles are correct
    // - Labels are descriptive
    // - States are communicated
  }})

  it('should work with screen readers', () => {{
    render(<{name} {{...defaultProps}} />)
    // TODO: Test screen reader announcements
    // - Live regions work correctly
    // - Headings hierarchy is logical
  }})

  it('should have sufficient color contrast', () => {{
    // Note: This is typically covered by axe
    // Add manual checks if needed for dynamic styles
  }})
}})
"""


def extract_entities_from_data_model(filepath: Path) -> list:
    """Extract entity names from data-model.md"""
    if not filepath.exists():
        return []

    content = filepath.read_text()
    entities = []

    # Look for entity definitions
    patterns = [
        re.compile(r'#{1,3}\s*(?:Entity|Model)[:\s]+(\w+)', re.IGNORECASE),
        re.compile(r'interface\s+(\w+)\s*\{', re.IGNORECASE),
        re.compile(r'type\s+(\w+)\s*=', re.IGNORECASE),
        re.compile(r'CREATE\s+TABLE\s+(\w+)', re.IGNORECASE),
    ]

    seen = set()
    for pattern in patterns:
        for match in pattern.finditer(content):
            name = match.group(1)
            if name not in seen and name.lower() not in ['if', 'not', 'exists']:
                seen.add(name)
                entities.append(name)

    return entities


def main():
    parser = argparse.ArgumentParser(
        description='Generate test file scaffolding for TDD workflow',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('name', nargs='?',
                        help='Name of component/module to test')
    parser.add_argument('--type', choices=['unit', 'component', 'integration', 'e2e', 'a11y'],
                        default='unit', help='Type of test (default: unit)')
    parser.add_argument('--framework', choices=['vitest', 'jest', 'playwright', 'cypress'],
                        default='vitest', help='Test framework (default: vitest)')
    parser.add_argument('--from', dest='data_model',
                        help='Generate entity tests from data-model.md')
    parser.add_argument('--output', '-o',
                        help='Output file path')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview without writing')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    # Handle --from flag
    if args.data_model:
        entities = extract_entities_from_data_model(Path(args.data_model))
        if not entities:
            print(f"No entities found in {args.data_model}", file=sys.stderr)
            sys.exit(1)

        result = {
            'source': args.data_model,
            'entities': entities,
            'tests': []
        }

        for entity in entities:
            content = generate_unit_test(entity, args.framework)
            result['tests'].append({
                'entity': entity,
                'filename': f'{entity}.test.ts',
                'content': content
            })

        if args.summary:
            print(f"Source: {args.data_model} | Entities: {len(entities)} | Framework: {args.framework}")
            return

        if args.json:
            print(json.dumps({k: v for k, v in result.items() if k != 'content'}, indent=2))
            return

        print(f"Generated tests for {len(entities)} entities from {args.data_model}")
        for test in result['tests']:
            print(f"  - {test['filename']}")
        return

    # Require name for single test generation
    if not args.name:
        parser.print_help()
        sys.exit(1)

    # Generate test content based on type
    generators = {
        'unit': generate_unit_test,
        'component': generate_component_test,
        'integration': generate_integration_test,
        'e2e': generate_e2e_test,
        'a11y': generate_a11y_test,
    }

    generator = generators.get(args.type, generate_unit_test)

    if args.type in ['unit', 'e2e']:
        content = generator(args.name, args.framework)
    else:
        content = generator(args.name)

    # Determine output filename
    ext = '.spec.ts' if args.type == 'e2e' else '.test.tsx' if args.type in ['component', 'a11y'] else '.test.ts'
    suffix = f'.{args.type}' if args.type not in ['unit', 'component'] else ''
    filename = f'{args.name}{suffix}{ext}'

    result = {
        'name': args.name,
        'type': args.type,
        'framework': args.framework,
        'filename': filename,
        'content': content
    }

    if args.summary:
        lines = len(content.split('\n'))
        print(f"Test: {filename} | Type: {args.type} | Framework: {args.framework} | Lines: {lines}")
        return

    if args.json:
        # Don't include full content in JSON
        output = {k: v for k, v in result.items() if k != 'content'}
        output['lines'] = len(content.split('\n'))
        print(json.dumps(output, indent=2))
        return

    if args.dry_run:
        print(f"Would create: {filename}")
        print(f"Type: {args.type}")
        print(f"Framework: {args.framework}")
        print(f"Lines: {len(content.split(chr(10)))}")
        return

    if args.output:
        Path(args.output).write_text(content)
        print(f"Written to {args.output}")
    else:
        print(content)


if __name__ == '__main__':
    main()
