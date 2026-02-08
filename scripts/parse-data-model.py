#!/usr/bin/env python3
"""
Parse Data Model - Data model parser for spec and SQL files

Extracts entities, relationships, and generates TypeScript types or SQL DDL.

Usage:
    python parse-data-model.py data-model.md --entities
    python parse-data-model.py data-model.md --relations
    python parse-data-model.py data-model.md --typescript
    python parse-data-model.py data-model.md --sql
    python parse-data-model.py data-model.md --json
    python parse-data-model.py data-model.md --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent


def parse_entity_markdown(content: str) -> list:
    """Parse entities from markdown table format"""
    entities = []

    # Pattern for entity sections: ### Entity: Name or ## EntityName
    entity_pattern = re.compile(
        r'(?:#{2,3})\s*(?:Entity[:\s]+)?(\w+)\s*\n((?:.*\n)*?)(?=#{2,3}|\Z)',
        re.IGNORECASE
    )

    for match in entity_pattern.finditer(content):
        name = match.group(1)
        section = match.group(2)

        entity = {
            'name': name,
            'fields': [],
            'description': ''
        }

        # Look for markdown table
        table_pattern = re.compile(
            r'\|\s*(\w+)\s*\|\s*(\w+(?:\[\])?(?:\?)?)\s*\|\s*([^|]*)\s*\|',
            re.IGNORECASE
        )

        for field_match in table_pattern.finditer(section):
            field_name = field_match.group(1)
            field_type = field_match.group(2)
            description = field_match.group(3).strip()

            # Skip header row
            if field_name.lower() in ['field', 'name', 'column', '---', '-']:
                continue

            entity['fields'].append({
                'name': field_name,
                'type': field_type,
                'nullable': '?' in field_type,
                'description': description
            })

        # Look for bullet list format
        bullet_pattern = re.compile(
            r'[-*]\s*`?(\w+)`?\s*[:\-]\s*(\w+(?:\[\])?)\s*(?:[,-]\s*(.+))?$',
            re.MULTILINE
        )

        for field_match in bullet_pattern.finditer(section):
            field_name = field_match.group(1)
            field_type = field_match.group(2)
            description = field_match.group(3) or ''

            entity['fields'].append({
                'name': field_name,
                'type': field_type,
                'nullable': False,
                'description': description.strip()
            })

        if entity['fields']:
            entities.append(entity)

    return entities


def parse_sql_schema(content: str) -> list:
    """Parse entities from SQL CREATE TABLE statements"""
    entities = []

    # Pattern for CREATE TABLE
    table_pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\);',
        re.IGNORECASE | re.DOTALL
    )

    for match in table_pattern.finditer(content):
        name = match.group(1)
        columns_str = match.group(2)

        entity = {
            'name': name,
            'fields': [],
            'constraints': []
        }

        # Parse columns
        column_pattern = re.compile(
            r'(\w+)\s+([\w\(\),]+)(?:\s+(NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|DEFAULT\s+[^,]+|REFERENCES\s+\w+))*',
            re.IGNORECASE
        )

        for col_match in column_pattern.finditer(columns_str):
            col_name = col_match.group(1)
            col_type = col_match.group(2)
            constraints = col_match.group(3) or ''

            # Skip SQL keywords that might be caught
            if col_name.upper() in ['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK']:
                continue

            entity['fields'].append({
                'name': col_name,
                'type': sql_type_to_ts(col_type),
                'sql_type': col_type,
                'nullable': 'NOT NULL' not in constraints.upper(),
                'primary_key': 'PRIMARY KEY' in constraints.upper(),
                'unique': 'UNIQUE' in constraints.upper()
            })

        # Parse constraints
        constraint_pattern = re.compile(
            r'CONSTRAINT\s+(\w+)\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\s*\(([^)]+)\)',
            re.IGNORECASE
        )

        for con_match in constraint_pattern.finditer(columns_str):
            entity['constraints'].append({
                'name': con_match.group(1),
                'type': con_match.group(2).strip(),
                'columns': con_match.group(3).strip()
            })

        if entity['fields']:
            entities.append(entity)

    return entities


def sql_type_to_ts(sql_type: str) -> str:
    """Convert SQL type to TypeScript type"""
    sql_type = sql_type.upper()

    type_map = {
        'INT': 'number',
        'INTEGER': 'number',
        'BIGINT': 'number',
        'SMALLINT': 'number',
        'SERIAL': 'number',
        'BIGSERIAL': 'number',
        'DECIMAL': 'number',
        'NUMERIC': 'number',
        'REAL': 'number',
        'FLOAT': 'number',
        'DOUBLE': 'number',
        'VARCHAR': 'string',
        'CHAR': 'string',
        'TEXT': 'string',
        'UUID': 'string',
        'BOOLEAN': 'boolean',
        'BOOL': 'boolean',
        'TIMESTAMP': 'Date',
        'TIMESTAMPTZ': 'Date',
        'DATE': 'Date',
        'TIME': 'string',
        'JSON': 'Record<string, unknown>',
        'JSONB': 'Record<string, unknown>',
    }

    for sql, ts in type_map.items():
        if sql in sql_type:
            return ts

    return 'unknown'


def extract_relations(entities: list, content: str) -> list:
    """Extract relationships between entities"""
    relations = []

    # Look for FK references in SQL
    fk_pattern = re.compile(
        r'(\w+)\s+(?:UUID|INT|BIGINT)\s+(?:NOT\s+NULL\s+)?REFERENCES\s+(\w+)\s*\((\w+)\)',
        re.IGNORECASE
    )

    for match in fk_pattern.finditer(content):
        relations.append({
            'type': 'foreign_key',
            'from_field': match.group(1),
            'to_table': match.group(2),
            'to_field': match.group(3)
        })

    # Look for relationship descriptions in markdown
    rel_patterns = [
        re.compile(r'(\w+)\s+(?:has\s+many|hasMany)\s+(\w+)', re.IGNORECASE),
        re.compile(r'(\w+)\s+(?:belongs\s+to|belongsTo)\s+(\w+)', re.IGNORECASE),
        re.compile(r'(\w+)\s+(?:has\s+one|hasOne)\s+(\w+)', re.IGNORECASE),
    ]

    for pattern in rel_patterns:
        for match in pattern.finditer(content):
            relations.append({
                'type': 'association',
                'from': match.group(1),
                'to': match.group(2)
            })

    return relations


def generate_typescript(entities: list) -> str:
    """Generate TypeScript interfaces from entities"""
    lines = ['// Generated TypeScript interfaces', '']

    for entity in entities:
        lines.append(f'export interface {entity["name"]} {{')

        for field in entity['fields']:
            ts_type = field['type']
            nullable = '?' if field.get('nullable') else ''
            desc = f'  // {field["description"]}' if field.get('description') else ''
            lines.append(f'  {field["name"]}{nullable}: {ts_type}{desc}')

        lines.append('}')
        lines.append('')

    return '\n'.join(lines)


def generate_sql(entities: list) -> str:
    """Generate SQL DDL from entities"""
    lines = ['-- Generated SQL DDL', '']

    ts_to_sql = {
        'string': 'TEXT',
        'number': 'INTEGER',
        'boolean': 'BOOLEAN',
        'Date': 'TIMESTAMPTZ',
        'Record<string, unknown>': 'JSONB',
        'unknown': 'TEXT'
    }

    for entity in entities:
        lines.append(f'CREATE TABLE IF NOT EXISTS {entity["name"].lower()} (')

        field_lines = []
        for field in entity['fields']:
            sql_type = field.get('sql_type') or ts_to_sql.get(field['type'], 'TEXT')
            nullable = '' if field.get('nullable') else ' NOT NULL'
            pk = ' PRIMARY KEY' if field.get('primary_key') else ''
            field_lines.append(f'  {field["name"]} {sql_type}{nullable}{pk}')

        lines.append(',\n'.join(field_lines))
        lines.append(');')
        lines.append('')

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Parse data models and generate types/DDL',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('file', nargs='?',
                        help='Path to data-model.md or SQL file')
    parser.add_argument('--entities', action='store_true',
                        help='List entities')
    parser.add_argument('--relations', action='store_true',
                        help='List relationships')
    parser.add_argument('--typescript', action='store_true',
                        help='Generate TypeScript interfaces')
    parser.add_argument('--sql', action='store_true',
                        help='Generate SQL DDL')
    parser.add_argument('--output', '-o',
                        help='Output file path')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    if not args.file:
        # Try to find data-model.md in common locations
        candidates = [
            Path('data-model.md'),
            Path('docs/data-model.md'),
            Path('spec/data-model.md'),
        ]
        for c in candidates:
            if c.exists():
                args.file = str(c)
                break

        if not args.file:
            parser.print_help()
            print("\nNo data model file specified or found")
            sys.exit(1)

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"Error: {filepath} not found", file=sys.stderr)
        sys.exit(1)

    content = filepath.read_text()

    # Detect file type and parse
    if filepath.suffix == '.sql':
        entities = parse_sql_schema(content)
    else:
        # Try SQL parsing first (for mixed files)
        entities = parse_sql_schema(content)
        if not entities:
            entities = parse_entity_markdown(content)

    relations = extract_relations(entities, content)

    # Summary
    if args.summary:
        total_fields = sum(len(e['fields']) for e in entities)
        print(f"File: {filepath.name} | Entities: {len(entities)} | Fields: {total_fields} | Relations: {len(relations)}")
        return

    # JSON output
    if args.json:
        output = {
            'file': str(filepath),
            'entities': entities,
            'relations': relations
        }
        print(json.dumps(output, indent=2))
        return

    # TypeScript generation
    if args.typescript:
        ts_code = generate_typescript(entities)
        if args.output:
            Path(args.output).write_text(ts_code)
            print(f"Written to {args.output}")
        else:
            print(ts_code)
        return

    # SQL generation
    if args.sql:
        sql_code = generate_sql(entities)
        if args.output:
            Path(args.output).write_text(sql_code)
            print(f"Written to {args.output}")
        else:
            print(sql_code)
        return

    # Default: list entities
    print(f"Data Model: {filepath}")
    print("=" * 50)
    print(f"Entities: {len(entities)}")
    print()

    for entity in entities:
        print(f"### {entity['name']} ({len(entity['fields'])} fields)")
        for field in entity['fields'][:5]:
            nullable = '?' if field.get('nullable') else ''
            print(f"  - {field['name']}{nullable}: {field['type']}")
        if len(entity['fields']) > 5:
            print(f"  ... and {len(entity['fields']) - 5} more fields")
        print()

    if args.relations or relations:
        print(f"Relations: {len(relations)}")
        for rel in relations:
            if rel['type'] == 'foreign_key':
                print(f"  - {rel['from_field']} -> {rel['to_table']}.{rel['to_field']}")
            else:
                print(f"  - {rel['from']} -> {rel['to']}")


if __name__ == '__main__':
    main()
