#!/usr/bin/env python3
"""
Scaffold Checklist - Generate checklists with standard categories

Creates checklists following the CHK### pattern with standard or custom categories.

Standard categories:
  - Requirement Completeness
  - Requirement Clarity
  - Requirement Consistency
  - Acceptance Criteria Quality
  - Scenario Coverage
  - Edge Case Coverage
  - Non-Functional Requirements
  - Dependencies & Assumptions

Usage:
    python scaffold-checklist.py --type ux
    python scaffold-checklist.py --type api
    python scaffold-checklist.py --type security
    python scaffold-checklist.py --from spec.md
    python scaffold-checklist.py --template custom.json
    python scaffold-checklist.py --json
    python scaffold-checklist.py --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Standard checklist templates
TEMPLATES = {
    'default': {
        'name': 'Default Specification Checklist',
        'categories': [
            {
                'name': 'Requirement Completeness',
                'items': [
                    'All user stories have clear acceptance criteria',
                    'Edge cases are documented',
                    'Error scenarios are specified',
                    'Happy path is clearly defined',
                ]
            },
            {
                'name': 'Requirement Clarity',
                'items': [
                    'No ambiguous terms (should, may, might)',
                    'Technical terms are defined',
                    'Scope boundaries are explicit',
                    'Out-of-scope items are listed',
                ]
            },
            {
                'name': 'Requirement Consistency',
                'items': [
                    'No contradicting requirements',
                    'Terminology is consistent throughout',
                    'Data types match across sections',
                    'Validation rules are consistent',
                ]
            },
            {
                'name': 'Acceptance Criteria Quality',
                'items': [
                    'Criteria are testable',
                    'Success metrics are quantifiable',
                    'Given/When/Then format used',
                    'Negative cases included',
                ]
            },
        ]
    },
    'ux': {
        'name': 'UX Design Checklist',
        'categories': [
            {
                'name': 'User Research',
                'items': [
                    'Target personas identified',
                    'User journey mapped',
                    'Pain points documented',
                    'Competitive analysis complete',
                ]
            },
            {
                'name': 'Interaction Design',
                'items': [
                    'Touch targets meet 44px minimum',
                    'Feedback on all interactive elements',
                    'Loading states designed',
                    'Error states designed',
                ]
            },
            {
                'name': 'Accessibility',
                'items': [
                    'Color contrast meets WCAG AA',
                    'Focus indicators visible',
                    'Screen reader text provided',
                    'Keyboard navigation supported',
                ]
            },
            {
                'name': 'Responsive Design',
                'items': [
                    'Mobile breakpoint defined',
                    'Tablet breakpoint defined',
                    'Desktop breakpoint defined',
                    'Content prioritization documented',
                ]
            },
        ]
    },
    'api': {
        'name': 'API Design Checklist',
        'categories': [
            {
                'name': 'Endpoint Design',
                'items': [
                    'RESTful naming conventions followed',
                    'HTTP methods appropriate for actions',
                    'Versioning strategy defined',
                    'URL structure documented',
                ]
            },
            {
                'name': 'Request/Response',
                'items': [
                    'Request schema defined',
                    'Response schema defined',
                    'Error response format consistent',
                    'Pagination strategy documented',
                ]
            },
            {
                'name': 'Security',
                'items': [
                    'Authentication method specified',
                    'Authorization rules documented',
                    'Rate limiting defined',
                    'Input validation specified',
                ]
            },
            {
                'name': 'Documentation',
                'items': [
                    'OpenAPI/Swagger spec exists',
                    'Example requests provided',
                    'Example responses provided',
                    'Error codes documented',
                ]
            },
        ]
    },
    'security': {
        'name': 'Security Checklist',
        'categories': [
            {
                'name': 'Authentication',
                'items': [
                    'Password requirements defined',
                    'MFA support specified',
                    'Session management documented',
                    'Token expiration configured',
                ]
            },
            {
                'name': 'Authorization',
                'items': [
                    'Role definitions complete',
                    'Permission matrix documented',
                    'Resource-level access defined',
                    'Default deny policy in place',
                ]
            },
            {
                'name': 'Data Protection',
                'items': [
                    'PII handling documented',
                    'Encryption at rest specified',
                    'Encryption in transit required',
                    'Data retention policy defined',
                ]
            },
            {
                'name': 'OWASP Top 10',
                'items': [
                    'Injection prevention addressed',
                    'XSS prevention addressed',
                    'CSRF protection implemented',
                    'Security headers configured',
                ]
            },
        ]
    },
    'testing': {
        'name': 'Testing Checklist',
        'categories': [
            {
                'name': 'Unit Testing',
                'items': [
                    'Happy path covered',
                    'Edge cases covered',
                    'Error conditions tested',
                    'Mocks properly isolated',
                ]
            },
            {
                'name': 'Integration Testing',
                'items': [
                    'API contracts verified',
                    'Database interactions tested',
                    'External services mocked',
                    'Error propagation tested',
                ]
            },
            {
                'name': 'E2E Testing',
                'items': [
                    'Critical user flows covered',
                    'Cross-browser testing planned',
                    'Mobile testing planned',
                    'Performance thresholds defined',
                ]
            },
            {
                'name': 'Accessibility Testing',
                'items': [
                    'Automated a11y scans configured',
                    'Screen reader testing planned',
                    'Keyboard navigation tested',
                    'Color contrast verified',
                ]
            },
        ]
    },
}


def generate_checklist_id(index: int) -> str:
    """Generate CHK### format ID"""
    return f'CHK{index:03d}'


def format_checklist(template: dict, spec_ref: str = 'Spec') -> str:
    """Format checklist as markdown"""
    lines = [f"# {template['name']}", ""]
    item_num = 1

    for category in template['categories']:
        lines.append(f"## {category['name']}")
        lines.append("")

        for item in category['items']:
            chk_id = generate_checklist_id(item_num)
            lines.append(f"- [ ] {chk_id} - {item} [Quality, {spec_ref}]")
            item_num += 1

        lines.append("")

    return '\n'.join(lines)


def extract_from_spec(spec_path: Path) -> dict:
    """Extract checklist items from a spec.md file"""
    if not spec_path.exists():
        return None

    content = spec_path.read_text()
    template = {
        'name': f'Checklist from {spec_path.name}',
        'categories': []
    }

    # Extract user stories
    user_stories = []
    us_pattern = re.compile(r'(?:US\d+|User Story \d+)[:\s]+(.+?)(?:\n|$)', re.IGNORECASE)
    for match in us_pattern.finditer(content):
        user_stories.append(f"User story verified: {match.group(1)[:50]}")

    if user_stories:
        template['categories'].append({
            'name': 'User Story Verification',
            'items': user_stories[:10]  # Limit to 10
        })

    # Extract functional requirements
    fr_items = []
    fr_pattern = re.compile(r'FR[-\s]*(\d+)[:\s]+(.+?)(?:\n|$)', re.IGNORECASE)
    for match in fr_pattern.finditer(content):
        fr_items.append(f"FR-{match.group(1)} implemented: {match.group(2)[:40]}")

    if fr_items:
        template['categories'].append({
            'name': 'Functional Requirements',
            'items': fr_items[:15]
        })

    # Extract acceptance criteria
    ac_items = []
    ac_pattern = re.compile(r'(?:Given|When|Then)\s+(.+?)(?:\n|$)', re.IGNORECASE)
    for match in ac_pattern.finditer(content):
        ac_items.append(f"Acceptance criteria met: {match.group(1)[:50]}")

    if ac_items:
        template['categories'].append({
            'name': 'Acceptance Criteria',
            'items': ac_items[:10]
        })

    # Add default category if nothing found
    if not template['categories']:
        template['categories'].append({
            'name': 'General Verification',
            'items': [
                'Spec requirements understood',
                'Implementation matches spec',
                'Edge cases handled',
                'Tests cover requirements',
            ]
        })

    return template


def load_custom_template(template_path: Path) -> dict:
    """Load custom template from JSON file"""
    if not template_path.exists():
        return None

    with open(template_path, 'r') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description='Generate specification checklists with CHK### IDs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--type', choices=['default', 'ux', 'api', 'security', 'testing'],
                        default='default', help='Checklist type (default: default)')
    parser.add_argument('--from', dest='spec_file',
                        help='Extract checklist from spec.md file')
    parser.add_argument('--template',
                        help='Load custom template from JSON file')
    parser.add_argument('--output', '-o',
                        help='Output file path (default: stdout)')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    # Determine template source
    template = None
    source = args.type

    if args.template:
        template = load_custom_template(Path(args.template))
        if not template:
            print(f"Error: Could not load template {args.template}", file=sys.stderr)
            sys.exit(1)
        source = args.template

    elif args.spec_file:
        template = extract_from_spec(Path(args.spec_file))
        if not template:
            print(f"Error: Could not extract from {args.spec_file}", file=sys.stderr)
            sys.exit(1)
        source = args.spec_file

    else:
        template = TEMPLATES.get(args.type, TEMPLATES['default'])

    # Count items
    total_items = sum(len(cat['items']) for cat in template['categories'])
    total_categories = len(template['categories'])

    if args.summary:
        print(f"Type: {source} | Categories: {total_categories} | Items: {total_items}")
        return

    if args.json:
        # Add IDs to items for JSON output
        output = {
            'name': template['name'],
            'source': source,
            'total_items': total_items,
            'categories': []
        }
        item_num = 1
        for cat in template['categories']:
            cat_output = {
                'name': cat['name'],
                'items': []
            }
            for item in cat['items']:
                cat_output['items'].append({
                    'id': generate_checklist_id(item_num),
                    'text': item,
                    'checked': False
                })
                item_num += 1
            output['categories'].append(cat_output)

        print(json.dumps(output, indent=2))
        return

    # Generate markdown
    markdown = format_checklist(template)

    if args.output:
        Path(args.output).write_text(markdown)
        print(f"Written {total_items} items to {args.output}")
    else:
        print(markdown)


if __name__ == '__main__':
    main()
