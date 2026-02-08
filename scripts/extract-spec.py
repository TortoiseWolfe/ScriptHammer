#!/usr/bin/env python3
"""
Extract Spec - Spec section extractor for spec.md files

Extracts structured data from specification files including
user stories, requirements, entities, and acceptance criteria.

Usage:
    python extract-spec.py spec.md --user-stories
    python extract-spec.py spec.md --requirements
    python extract-spec.py spec.md --entities
    python extract-spec.py spec.md --all
    python extract-spec.py spec.md --json
    python extract-spec.py spec.md --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent


def extract_user_stories(content: str) -> list:
    """Extract user stories with priorities"""
    stories = []

    # Pattern: US# or User Story # with priority
    patterns = [
        # US1 [P0]: As a user...
        re.compile(r'(?:US|User\s*Story)\s*(\d+)\s*\[?(P[012])?\]?\s*[:\-]?\s*(.+?)(?=\n(?:US|User\s*Story|\#|\Z))', re.IGNORECASE | re.DOTALL),
        # ### US1: Title
        re.compile(r'#{1,3}\s*US(\d+)[:\s]+(.+?)(?=\n#{1,3}|\Z)', re.IGNORECASE | re.DOTALL),
    ]

    for pattern in patterns:
        for match in pattern.finditer(content):
            groups = match.groups()
            if len(groups) == 3:
                num, priority, text = groups
            else:
                num, text = groups
                priority = None

            # Extract priority from text if not in pattern
            if not priority:
                p_match = re.search(r'\[(P[012])\]', text)
                if p_match:
                    priority = p_match.group(1)
                    text = text.replace(p_match.group(0), '')

            # Clean up text
            text = text.strip()
            if len(text) > 200:
                text = text[:200] + '...'

            stories.append({
                'id': f'US{num}',
                'priority': priority or 'P2',
                'text': text
            })

    # Deduplicate by ID
    seen = set()
    unique = []
    for s in stories:
        if s['id'] not in seen:
            seen.add(s['id'])
            unique.append(s)

    return sorted(unique, key=lambda x: (x['priority'], x['id']))


def extract_requirements(content: str) -> dict:
    """Extract functional and non-functional requirements"""
    fr_list = []
    nfr_list = []

    # Functional requirements: FR-001 or FR001
    fr_pattern = re.compile(r'FR[-\s]?(\d+)[:\s]+(.+?)(?=\n(?:FR[-\s]?\d|NFR[-\s]?\d|#|\Z))', re.IGNORECASE | re.DOTALL)
    for match in fr_pattern.finditer(content):
        num, text = match.groups()
        fr_list.append({
            'id': f'FR-{num.zfill(3)}',
            'text': text.strip()[:150]
        })

    # Non-functional requirements: NFR-001 or NFR001
    nfr_pattern = re.compile(r'NFR[-\s]?(\d+)[:\s]+(.+?)(?=\n(?:FR[-\s]?\d|NFR[-\s]?\d|#|\Z))', re.IGNORECASE | re.DOTALL)
    for match in nfr_pattern.finditer(content):
        num, text = match.groups()
        nfr_list.append({
            'id': f'NFR-{num.zfill(3)}',
            'text': text.strip()[:150]
        })

    return {
        'functional': fr_list,
        'non_functional': nfr_list
    }


def extract_entities(content: str) -> list:
    """Extract key entities (data models)"""
    entities = []

    # Look for entity definitions in various formats
    patterns = [
        # ### Entity: Name
        re.compile(r'#{1,3}\s*(?:Entity|Model)[:\s]+(\w+)', re.IGNORECASE),
        # **Entity**: Description
        re.compile(r'\*\*(\w+)\*\*\s*(?:entity|model|table)', re.IGNORECASE),
        # - Entity: Name with fields
        re.compile(r'^\s*[-*]\s*(\w+)\s*(?:entity|table|model)', re.IGNORECASE | re.MULTILINE),
        # CREATE TABLE entity_name
        re.compile(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', re.IGNORECASE),
        # interface EntityName {
        re.compile(r'interface\s+(\w+)\s*\{', re.IGNORECASE),
        # type EntityName = {
        re.compile(r'type\s+(\w+)\s*=\s*\{', re.IGNORECASE),
    ]

    seen = set()
    for pattern in patterns:
        for match in pattern.finditer(content):
            name = match.group(1)
            # Filter out common non-entity words
            if name.lower() not in ['the', 'a', 'an', 'if', 'not', 'exists', 'table', 'public']:
                if name not in seen:
                    seen.add(name)
                    entities.append({'name': name})

    return entities


def extract_acceptance_criteria(content: str) -> list:
    """Extract acceptance criteria (Given/When/Then)"""
    criteria = []

    # Given/When/Then patterns
    gwt_pattern = re.compile(
        r'(Given\s+.+?)\s*(When\s+.+?)\s*(Then\s+.+?)(?=\n(?:Given|When|Then|#|-|\Z))',
        re.IGNORECASE | re.DOTALL
    )

    for match in gwt_pattern.finditer(content):
        given, when, then = match.groups()
        criteria.append({
            'given': given.strip()[:100],
            'when': when.strip()[:100],
            'then': then.strip()[:100]
        })

    # Also look for bullet-style criteria
    bullet_pattern = re.compile(r'^\s*[-*]\s*(?:AC|Acceptance)[:\s]+(.+?)$', re.IGNORECASE | re.MULTILINE)
    for match in bullet_pattern.finditer(content):
        criteria.append({
            'text': match.group(1).strip()[:150]
        })

    return criteria


def extract_edge_cases(content: str) -> list:
    """Extract documented edge cases"""
    edge_cases = []

    # Look for edge case sections
    ec_section = re.search(r'(?:Edge\s+Cases?|Boundary\s+Conditions?)[:\s]*\n((?:[-*].+\n?)+)', content, re.IGNORECASE)
    if ec_section:
        for line in ec_section.group(1).split('\n'):
            line = line.strip()
            if line.startswith(('-', '*')):
                edge_cases.append(line.lstrip('-* ').strip()[:100])

    return edge_cases


def extract_all(filepath: Path) -> dict:
    """Extract all sections from spec file"""
    if not filepath.exists():
        return {'error': f'File not found: {filepath}'}

    content = filepath.read_text()

    return {
        'file': str(filepath),
        'user_stories': extract_user_stories(content),
        'requirements': extract_requirements(content),
        'entities': extract_entities(content),
        'acceptance_criteria': extract_acceptance_criteria(content),
        'edge_cases': extract_edge_cases(content)
    }


def main():
    parser = argparse.ArgumentParser(
        description='Extract structured data from spec.md files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('file', nargs='?', default='spec.md',
                        help='Path to spec.md file')
    parser.add_argument('--user-stories', action='store_true',
                        help='Extract user stories')
    parser.add_argument('--requirements', action='store_true',
                        help='Extract FR/NFR requirements')
    parser.add_argument('--entities', action='store_true',
                        help='Extract key entities')
    parser.add_argument('--acceptance-criteria', action='store_true',
                        help='Extract acceptance criteria')
    parser.add_argument('--edge-cases', action='store_true',
                        help='Extract edge cases')
    parser.add_argument('--all', action='store_true',
                        help='Extract all sections')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()
    filepath = Path(args.file)

    if not filepath.exists():
        print(f"Error: {filepath} not found", file=sys.stderr)
        sys.exit(1)

    content = filepath.read_text()

    # Determine what to extract
    extract_all_flag = args.all or not any([
        args.user_stories, args.requirements, args.entities,
        args.acceptance_criteria, args.edge_cases
    ])

    result = {'file': str(filepath)}

    if extract_all_flag or args.user_stories:
        result['user_stories'] = extract_user_stories(content)

    if extract_all_flag or args.requirements:
        result['requirements'] = extract_requirements(content)

    if extract_all_flag or args.entities:
        result['entities'] = extract_entities(content)

    if extract_all_flag or args.acceptance_criteria:
        result['acceptance_criteria'] = extract_acceptance_criteria(content)

    if extract_all_flag or args.edge_cases:
        result['edge_cases'] = extract_edge_cases(content)

    # Summary output
    if args.summary:
        us_count = len(result.get('user_stories', []))
        fr_count = len(result.get('requirements', {}).get('functional', []))
        nfr_count = len(result.get('requirements', {}).get('non_functional', []))
        entity_count = len(result.get('entities', []))
        ac_count = len(result.get('acceptance_criteria', []))
        print(f"File: {filepath.name} | US: {us_count} | FR: {fr_count} | NFR: {nfr_count} | Entities: {entity_count} | AC: {ac_count}")
        return

    # JSON output
    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Human-readable output
    print(f"Spec Extraction: {filepath}")
    print("=" * 50)

    if 'user_stories' in result:
        print(f"\nUser Stories ({len(result['user_stories'])}):")
        for us in result['user_stories']:
            print(f"  [{us['priority']}] {us['id']}: {us['text'][:60]}...")

    if 'requirements' in result:
        fr = result['requirements'].get('functional', [])
        nfr = result['requirements'].get('non_functional', [])
        print(f"\nFunctional Requirements ({len(fr)}):")
        for r in fr[:5]:
            print(f"  {r['id']}: {r['text'][:60]}...")
        if len(fr) > 5:
            print(f"  ... and {len(fr) - 5} more")

        print(f"\nNon-Functional Requirements ({len(nfr)}):")
        for r in nfr[:5]:
            print(f"  {r['id']}: {r['text'][:60]}...")

    if 'entities' in result and result['entities']:
        print(f"\nEntities ({len(result['entities'])}):")
        for e in result['entities']:
            print(f"  - {e['name']}")

    if 'acceptance_criteria' in result and result['acceptance_criteria']:
        print(f"\nAcceptance Criteria ({len(result['acceptance_criteria'])}):")
        for ac in result['acceptance_criteria'][:3]:
            if 'given' in ac:
                print(f"  Given: {ac['given'][:50]}...")
            else:
                print(f"  - {ac.get('text', '')[:60]}...")

    if 'edge_cases' in result and result['edge_cases']:
        print(f"\nEdge Cases ({len(result['edge_cases'])}):")
        for ec in result['edge_cases'][:5]:
            print(f"  - {ec}")


if __name__ == '__main__':
    main()
