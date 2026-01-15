#!/usr/bin/env python3
"""
Validate Contracts - Contract validator for OpenAPI specs

Validates OpenAPI/Swagger specifications and checks coverage against specs.

Usage:
    python validate-contracts.py contracts/auth-api.yaml
    python validate-contracts.py --coverage spec.md
    python validate-contracts.py --generate-tests
    python validate-contracts.py --json
    python validate-contracts.py --summary
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent


def parse_openapi_yaml(filepath: Path) -> dict:
    """Parse OpenAPI YAML file (basic parsing without PyYAML)"""
    if not filepath.exists():
        return {'error': f'File not found: {filepath}'}

    content = filepath.read_text()
    spec = {
        'file': str(filepath),
        'version': None,
        'title': None,
        'paths': [],
        'schemas': [],
        'issues': []
    }

    # Extract OpenAPI version
    version_match = re.search(r'openapi:\s*["\']?(\d+\.\d+\.\d+)["\']?', content)
    if version_match:
        spec['version'] = version_match.group(1)
    else:
        swagger_match = re.search(r'swagger:\s*["\']?(\d+\.\d+)["\']?', content)
        if swagger_match:
            spec['version'] = f'swagger-{swagger_match.group(1)}'
        else:
            spec['issues'].append('No OpenAPI/Swagger version found')

    # Extract title
    title_match = re.search(r'title:\s*["\']?([^"\'\n]+)["\']?', content)
    if title_match:
        spec['title'] = title_match.group(1).strip()

    # Extract paths
    paths_section = re.search(r'^paths:\s*\n((?:\s+.+\n)+)', content, re.MULTILINE)
    if paths_section:
        path_pattern = re.compile(r'^\s{2}(/[^:\s]+):\s*$', re.MULTILINE)
        method_pattern = re.compile(r'^\s{4}(get|post|put|patch|delete|options|head):\s*$', re.MULTILINE)

        section_content = paths_section.group(1)

        current_path = None
        for line in section_content.split('\n'):
            path_match = re.match(r'^\s{2}(/[^:\s]+):\s*$', line)
            if path_match:
                current_path = path_match.group(1)
                continue

            method_match = re.match(r'^\s{4}(get|post|put|patch|delete|options|head):\s*$', line)
            if method_match and current_path:
                spec['paths'].append({
                    'path': current_path,
                    'method': method_match.group(1).upper()
                })

    # Extract schemas/definitions
    schemas_pattern = re.compile(r'^\s{4}(\w+):\s*$.*?type:\s*(\w+)', re.MULTILINE | re.DOTALL)
    for match in schemas_pattern.finditer(content):
        schema_name = match.group(1)
        schema_type = match.group(2)
        if schema_name not in ['type', 'properties', 'items', 'required']:
            spec['schemas'].append({
                'name': schema_name,
                'type': schema_type
            })

    return spec


def validate_openapi_spec(spec: dict) -> list:
    """Validate OpenAPI specification"""
    issues = spec.get('issues', [])

    # Check version
    if not spec.get('version'):
        issues.append({'severity': 'error', 'message': 'Missing OpenAPI version'})
    elif spec['version'].startswith('swagger'):
        issues.append({'severity': 'warning', 'message': 'Using Swagger 2.0, consider upgrading to OpenAPI 3.x'})

    # Check title
    if not spec.get('title'):
        issues.append({'severity': 'warning', 'message': 'Missing API title'})

    # Check paths
    if not spec.get('paths'):
        issues.append({'severity': 'error', 'message': 'No paths defined'})
    else:
        # Check for common issues
        for path_info in spec['paths']:
            path = path_info['path']

            # Check path naming
            if not path.startswith('/'):
                issues.append({
                    'severity': 'error',
                    'message': f'Path must start with /: {path}'
                })

            # Check for version in path
            if re.search(r'/v\d+/', path):
                pass  # OK - versioned
            elif '/api/' not in path.lower():
                issues.append({
                    'severity': 'info',
                    'message': f'Consider adding /api/ prefix: {path}'
                })

    return issues


def check_spec_coverage(api_spec: dict, spec_file: Path) -> dict:
    """Check API coverage against requirements spec"""
    if not spec_file.exists():
        return {'error': f'Spec file not found: {spec_file}'}

    spec_content = spec_file.read_text()

    # Extract functional requirements
    fr_pattern = re.compile(r'FR[-\s]?(\d+)[:\s]+(.+?)(?=\n(?:FR[-\s]?\d|NFR[-\s]?\d|#|\Z))', re.IGNORECASE | re.DOTALL)
    requirements = []
    for match in fr_pattern.finditer(spec_content):
        requirements.append({
            'id': f'FR-{match.group(1).zfill(3)}',
            'text': match.group(2).strip()[:100]
        })

    # Map requirements to endpoints (heuristic)
    coverage = {
        'requirements': len(requirements),
        'endpoints': len(api_spec.get('paths', [])),
        'covered': [],
        'uncovered': [],
        'coverage_pct': 0
    }

    # Simple keyword matching
    endpoint_keywords = set()
    for path_info in api_spec.get('paths', []):
        path = path_info['path'].lower()
        method = path_info['method'].lower()
        # Extract keywords from path
        keywords = re.findall(r'/(\w+)', path)
        endpoint_keywords.update(keywords)
        endpoint_keywords.add(method)

    for req in requirements:
        text = req['text'].lower()
        matched = False

        for keyword in endpoint_keywords:
            if keyword in text and len(keyword) > 3:
                matched = True
                break

        if matched:
            coverage['covered'].append(req['id'])
        else:
            coverage['uncovered'].append(req['id'])

    if requirements:
        coverage['coverage_pct'] = round(len(coverage['covered']) / len(requirements) * 100, 1)

    return coverage


def generate_test_stubs(spec: dict) -> str:
    """Generate test stubs for API endpoints"""
    lines = [
        "import { describe, it, expect, beforeAll } from 'vitest'",
        "",
        f"// Generated tests for {spec.get('title', 'API')}",
        "",
        "const BASE_URL = process.env.API_URL || 'http://localhost:3000'",
        "",
        "describe('API Contract Tests', () => {",
        "  beforeAll(() => {",
        "    // Setup authentication if needed",
        "  })",
        ""
    ]

    for path_info in spec.get('paths', []):
        path = path_info['path']
        method = path_info['method']

        # Generate test name
        test_name = f"{method} {path}"
        safe_path = path.replace('/', '_').replace('{', '').replace('}', '')

        lines.extend([
            f"  describe('{test_name}', () => {{",
            f"    it('should return successful response', async () => {{",
            f"      const response = await fetch(`${{BASE_URL}}{path}`, {{",
            f"        method: '{method}',",
            f"        headers: {{ 'Content-Type': 'application/json' }}",
            f"      }})",
            f"      expect(response.ok).toBe(true)",
            f"    }})",
            f"",
            f"    it('should return correct content type', async () => {{",
            f"      const response = await fetch(`${{BASE_URL}}{path}`, {{",
            f"        method: '{method}'",
            f"      }})",
            f"      expect(response.headers.get('content-type')).toContain('application/json')",
            f"    }})",
            f"",
            f"    it('should handle unauthorized access', async () => {{",
            f"      // TODO: Test without auth token",
            f"    }})",
            f"  }})",
            f""
        ])

    lines.append("})")
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Validate OpenAPI/Swagger contracts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('file', nargs='?',
                        help='Path to OpenAPI/Swagger file')
    parser.add_argument('--coverage',
                        help='Check coverage against spec.md')
    parser.add_argument('--generate-tests', action='store_true',
                        help='Generate test stubs')
    parser.add_argument('--output', '-o',
                        help='Output file path')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--summary', action='store_true',
                        help='One-line summary')

    args = parser.parse_args()

    # Find contract file
    if not args.file:
        candidates = list(Path('.').glob('**/openapi.yaml')) + \
                     list(Path('.').glob('**/openapi.yml')) + \
                     list(Path('.').glob('**/swagger.yaml')) + \
                     list(Path('.').glob('contracts/*.yaml'))
        if candidates:
            args.file = str(candidates[0])
        else:
            parser.print_help()
            print("\nNo contract file specified or found")
            sys.exit(1)

    filepath = Path(args.file)
    spec = parse_openapi_yaml(filepath)

    if 'error' in spec:
        print(f"Error: {spec['error']}", file=sys.stderr)
        sys.exit(1)

    # Validate
    issues = validate_openapi_spec(spec)

    result = {
        'file': str(filepath),
        'version': spec.get('version'),
        'title': spec.get('title'),
        'endpoints': len(spec.get('paths', [])),
        'schemas': len(spec.get('schemas', [])),
        'issues': issues,
        'valid': not any(i.get('severity') == 'error' for i in issues)
    }

    # Coverage check
    if args.coverage:
        coverage = check_spec_coverage(spec, Path(args.coverage))
        result['coverage'] = coverage

    # Generate tests
    if args.generate_tests:
        test_code = generate_test_stubs(spec)
        if args.output:
            Path(args.output).write_text(test_code)
            print(f"Written to {args.output}")
        else:
            print(test_code)
        return

    # Summary
    if args.summary:
        status = 'valid' if result['valid'] else f"{len(issues)} issues"
        coverage_str = ''
        if 'coverage' in result:
            coverage_str = f" | Coverage: {result['coverage'].get('coverage_pct', 0)}%"
        print(f"File: {filepath.name} | Endpoints: {result['endpoints']} | Status: {status}{coverage_str}")
        return

    # JSON output
    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Human-readable output
    print(f"Contract Validation: {filepath}")
    print("=" * 50)
    print(f"Version: {result['version']}")
    print(f"Title: {result['title']}")
    print(f"Endpoints: {result['endpoints']}")
    print(f"Schemas: {result['schemas']}")
    print()

    if spec.get('paths'):
        print("Endpoints:")
        for path_info in spec['paths'][:10]:
            print(f"  {path_info['method']:6} {path_info['path']}")
        if len(spec['paths']) > 10:
            print(f"  ... and {len(spec['paths']) - 10} more")
        print()

    if issues:
        errors = [i for i in issues if i.get('severity') == 'error']
        warnings = [i for i in issues if i.get('severity') == 'warning']

        if errors:
            print(f"Errors ({len(errors)}):")
            for issue in errors:
                print(f"  ✗ {issue.get('message', issue)}")

        if warnings:
            print(f"Warnings ({len(warnings)}):")
            for issue in warnings:
                print(f"  ⚠ {issue.get('message', issue)}")
    else:
        print("✓ No validation issues")

    if 'coverage' in result:
        cov = result['coverage']
        print()
        print(f"Spec Coverage: {cov.get('coverage_pct', 0)}%")
        print(f"  Requirements: {cov.get('requirements', 0)}")
        print(f"  Covered: {len(cov.get('covered', []))}")
        print(f"  Uncovered: {len(cov.get('uncovered', []))}")
        if cov.get('uncovered'):
            for req_id in cov['uncovered'][:5]:
                print(f"    - {req_id}")


if __name__ == '__main__':
    main()
