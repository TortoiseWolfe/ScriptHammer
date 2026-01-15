#!/usr/bin/env python3
"""
Secrets Scanner - Detect exposed credentials in codebase

Security-critical tool for finding API keys, tokens, and secrets.
Usage: python3 scripts/secrets-scan.py [options] [path]

Options:
  --staged                 Scan only staged git files (pre-commit mode)
  --json                   Output as JSON
  --summary                One-line pass/fail for CI
  --no-allowlist           Ignore .secrets-allowlist file

Allowlist:
  Create .secrets-allowlist in project root to ignore false positives.
  Format: one entry per line, supports:
    - file:scripts/secrets-scan.py     # Ignore entire file
    - line:scripts/secrets-scan.py:59  # Ignore specific line
    - pattern:test-users               # Ignore files matching pattern
    - # comments start with hash

Examples:
  python3 scripts/secrets-scan.py                    # Full codebase scan
  python3 scripts/secrets-scan.py src/               # Scan directory
  python3 scripts/secrets-scan.py --staged           # Pre-commit check
  python3 scripts/secrets-scan.py --json             # JSON output
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Tuple

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Patterns to detect (pattern, severity, description)
SECRET_PATTERNS = [
    # Supabase
    (r'SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*["\']?ey[A-Za-z0-9_-]+', 'CRITICAL', 'Supabase service role key'),
    (r'service_role["\']?\s*[=:]\s*["\']?ey[A-Za-z0-9_-]+', 'CRITICAL', 'Supabase service role key'),

    # AWS
    (r'AKIA[0-9A-Z]{16}', 'CRITICAL', 'AWS Access Key ID'),
    (r'aws_secret_access_key\s*[=:]\s*["\'][^"\']{20,}', 'CRITICAL', 'AWS Secret Key'),

    # GitHub
    (r'ghp_[a-zA-Z0-9]{36}', 'HIGH', 'GitHub Personal Access Token'),
    (r'gho_[a-zA-Z0-9]{36}', 'HIGH', 'GitHub OAuth Token'),
    (r'github_token\s*[=:]\s*["\'][^"\']{20,}', 'HIGH', 'GitHub Token'),

    # Stripe
    (r'sk_live_[a-zA-Z0-9]{24,}', 'CRITICAL', 'Stripe Live Secret Key'),
    (r'sk_test_[a-zA-Z0-9]{24,}', 'MEDIUM', 'Stripe Test Secret Key'),
    (r'pk_live_[a-zA-Z0-9]{24,}', 'LOW', 'Stripe Live Public Key'),

    # Generic API Keys
    (r'api[_-]?key\s*[=:]\s*["\'][a-zA-Z0-9_-]{20,}["\']', 'HIGH', 'Generic API Key'),
    (r'api[_-]?secret\s*[=:]\s*["\'][a-zA-Z0-9_-]{20,}["\']', 'HIGH', 'Generic API Secret'),

    # Private Keys
    (r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', 'CRITICAL', 'Private Key'),
    (r'-----BEGIN PGP PRIVATE KEY BLOCK-----', 'CRITICAL', 'PGP Private Key'),

    # Connection Strings
    (r'postgres://[^:]+:[^@]+@[^/\s]+', 'HIGH', 'PostgreSQL Connection String'),
    (r'mysql://[^:]+:[^@]+@[^/\s]+', 'HIGH', 'MySQL Connection String'),
    (r'mongodb(\+srv)?://[^:]+:[^@]+@[^/\s]+', 'HIGH', 'MongoDB Connection String'),
    (r'redis://:[^@]+@[^/\s]+', 'HIGH', 'Redis Connection String'),

    # JWT Tokens (hardcoded)
    (r'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+', 'MEDIUM', 'Hardcoded JWT Token'),

    # Generic Secrets
    (r'secret[_-]?key\s*[=:]\s*["\'][^"\']{16,}["\']', 'HIGH', 'Generic Secret Key'),
    (r'password\s*[=:]\s*["\'][^"\']{8,}["\']', 'MEDIUM', 'Hardcoded Password'),
    (r'token\s*[=:]\s*["\'][a-zA-Z0-9_-]{20,}["\']', 'MEDIUM', 'Generic Token'),
]

# Files to skip
SKIP_PATTERNS = [
    r'node_modules/',
    r'\.git/',
    r'\.env\.example',
    r'\.env\.sample',
    r'\.env\.template',
    r'__pycache__/',
    r'\.pyc$',
    r'\.min\.js$',
    r'\.min\.css$',
    r'package-lock\.json',
    r'pnpm-lock\.yaml',
    r'yarn\.lock',
]

# Known false positive patterns
FALSE_POSITIVES = [
    r'process\.env\.',           # Environment variable references
    r'\$\{.*\}',                 # Template literals
    r'your[_-]?api[_-]?key',     # Placeholder text
    r'xxx+',                     # Masked values
    r'\*\*\*',                   # Masked values
    r'<[A-Z_]+>',                # Placeholder tokens
    r'example\.com',             # Example domains
    r'localhost',                # Local development
]

# Sensitive files that should not be committed
SENSITIVE_FILES = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '*.pem',
    '*.key',
    'id_rsa',
    'id_ed25519',
    'credentials.json',
    'service-account.json',
    'secrets.json',
]

# Global allowlist (loaded at runtime)
ALLOWLIST = {
    'files': set(),      # Files to ignore entirely
    'lines': set(),      # file:line pairs to ignore
    'patterns': set(),   # Patterns to ignore in file paths
}


def load_allowlist(root: Path) -> Dict:
    """Load .secrets-allowlist file"""
    allowlist = {
        'files': set(),
        'lines': set(),
        'patterns': set(),
    }

    allowlist_file = root / '.secrets-allowlist'
    if not allowlist_file.exists():
        return allowlist

    for line in allowlist_file.read_text().strip().split('\n'):
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith('#'):
            continue

        if line.startswith('file:'):
            allowlist['files'].add(line[5:].strip())
        elif line.startswith('line:'):
            allowlist['lines'].add(line[5:].strip())
        elif line.startswith('pattern:'):
            allowlist['patterns'].add(line[8:].strip())
        else:
            # Default: treat as file pattern
            allowlist['patterns'].add(line)

    return allowlist


def is_allowlisted(filepath: str, line_num: int = 0) -> bool:
    """Check if file or file:line is in allowlist"""
    # Normalize path
    rel_path = filepath.replace(str(PROJECT_ROOT) + '/', '')

    # Check file allowlist
    if rel_path in ALLOWLIST['files']:
        return True

    # Check line allowlist
    if f"{rel_path}:{line_num}" in ALLOWLIST['lines']:
        return True

    # Check pattern allowlist
    for pattern in ALLOWLIST['patterns']:
        if pattern in rel_path:
            return True

    return False


def should_skip_file(filepath: str) -> bool:
    """Check if file should be skipped"""
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, filepath):
            return True
    return False


def is_false_positive(line: str) -> bool:
    """Check if match is a known false positive"""
    for pattern in FALSE_POSITIVES:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def scan_file(filepath: Path) -> List[Dict]:
    """Scan a single file for secrets"""
    findings = []

    try:
        content = filepath.read_text(errors='ignore')
    except Exception as e:
        return findings

    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        # Skip comments and empty lines
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or stripped.startswith('//'):
            continue

        for pattern, severity, description in SECRET_PATTERNS:
            matches = re.finditer(pattern, line, re.IGNORECASE)
            for match in matches:
                # Check for false positives
                if is_false_positive(line):
                    continue

                # Check allowlist
                if is_allowlisted(str(filepath), line_num):
                    continue

                # Extract matched text (truncate for safety)
                matched_text = match.group()
                if len(matched_text) > 50:
                    matched_text = matched_text[:20] + "..." + matched_text[-10:]

                findings.append({
                    'file': str(filepath),
                    'line': line_num,
                    'severity': severity,
                    'pattern': description,
                    'match': matched_text
                })

    return findings


def check_sensitive_files(root: Path) -> List[Dict]:
    """Check for sensitive files that shouldn't be committed"""
    findings = []

    for pattern in SENSITIVE_FILES:
        if '*' in pattern:
            # Glob pattern
            for match in root.rglob(pattern):
                if not should_skip_file(str(match)) and not is_allowlisted(str(match)):
                    findings.append({
                        'file': str(match),
                        'line': 0,
                        'severity': 'CRITICAL',
                        'pattern': 'Sensitive file in repo',
                        'match': pattern
                    })
        else:
            # Exact file
            target = root / pattern
            if target.exists() and not is_allowlisted(str(target)):
                findings.append({
                    'file': str(target),
                    'line': 0,
                    'severity': 'CRITICAL',
                    'pattern': 'Sensitive file in repo',
                    'match': pattern
                })

    return findings


def check_gitignore(root: Path) -> List[str]:
    """Check .gitignore for required patterns"""
    missing = []
    required = ['.env*', '*.pem', '*.key', 'credentials.json']

    gitignore = root / '.gitignore'
    if not gitignore.exists():
        return required

    content = gitignore.read_text()

    for pattern in required:
        # Normalize pattern check
        if pattern not in content and pattern.replace('*', '') not in content:
            missing.append(pattern)

    return missing


def get_staged_files() -> List[Path]:
    """Get list of staged files from git"""
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only'],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        files = [PROJECT_ROOT / f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
        return [f for f in files if f.exists()]
    except Exception:
        return []


def scan_directory(root: Path, extensions: List[str] = None) -> Tuple[List[Dict], int]:
    """Scan directory for secrets"""
    findings = []
    files_scanned = 0

    if extensions is None:
        extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yaml', '.yml', '.py', '.sh']

    for filepath in root.rglob('*'):
        if not filepath.is_file():
            continue

        if should_skip_file(str(filepath)):
            continue

        # Check extension
        if filepath.suffix not in extensions and not any(filepath.name.startswith('.env') for _ in [1]):
            if not filepath.name.startswith('.env'):
                continue

        files_scanned += 1
        file_findings = scan_file(filepath)
        findings.extend(file_findings)

    return findings, files_scanned


def format_findings(findings: List[Dict]) -> str:
    """Format findings as text report"""
    if not findings:
        return ""

    lines = []

    # Group by severity
    by_severity = {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}
    for f in findings:
        severity = f['severity']
        if severity in by_severity:
            by_severity[severity].append(f)

    for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
        items = by_severity[severity]
        if not items:
            continue

        lines.append(f"\n### {severity} ({len(items)})")
        lines.append("")
        lines.append("| File | Line | Pattern | Match |")
        lines.append("|------|------|---------|-------|")

        for f in items[:20]:  # Limit output
            file_short = f['file'].replace(str(PROJECT_ROOT) + '/', '')[:30]
            match_safe = f['match'][:20]
            lines.append(f"| {file_short} | {f['line']} | {f['pattern']} | `{match_safe}` |")

        if len(items) > 20:
            lines.append(f"| ... and {len(items) - 20} more | | | |")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Secrets Scanner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("path", nargs="?", default=".",
                       help="Path to scan (default: current directory)")
    parser.add_argument("--staged", action="store_true",
                       help="Scan only staged git files")
    parser.add_argument("--json", action="store_true",
                       help="Output as JSON")
    parser.add_argument("--summary", action="store_true",
                       help="One-line summary")
    parser.add_argument("--no-allowlist", action="store_true",
                       help="Ignore .secrets-allowlist file")

    args = parser.parse_args()

    # Load allowlist
    global ALLOWLIST
    if not args.no_allowlist:
        ALLOWLIST = load_allowlist(PROJECT_ROOT)

    # Determine scan scope
    if args.staged:
        files = get_staged_files()
        findings = []
        for f in files:
            findings.extend(scan_file(f))
        files_scanned = len(files)
    else:
        scan_root = Path(args.path)
        if not scan_root.is_absolute():
            scan_root = PROJECT_ROOT / scan_root
        findings, files_scanned = scan_directory(scan_root)

        # Also check for sensitive files and gitignore
        findings.extend(check_sensitive_files(scan_root))

    # Check gitignore
    missing_gitignore = check_gitignore(PROJECT_ROOT)

    # Count by severity
    counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for f in findings:
        if f['severity'] in counts:
            counts[f['severity']] += 1

    total_issues = sum(counts.values())
    status = 'PASS' if total_issues == 0 else 'FAIL'

    # Output
    if args.summary:
        print(f"Secrets Scan: {status} | {files_scanned} files | {total_issues} issues | {counts['CRITICAL']} critical")
        sys.exit(0 if status == 'PASS' else 1)

    if args.json:
        result = {
            'status': status,
            'files_scanned': files_scanned,
            'total_issues': total_issues,
            'counts': counts,
            'findings': findings,
            'missing_gitignore': missing_gitignore
        }
        print(json.dumps(result, indent=2))
        sys.exit(0 if status == 'PASS' else 1)

    # Text report
    print("=" * 60)
    print("SECRETS SCAN REPORT")
    print("=" * 60)
    print(f"Scope: {args.path if not args.staged else 'staged files'}")
    print(f"Files scanned: {files_scanned}")
    print(f"Status: {status}")
    print()

    print("SUMMARY")
    print("-" * 40)
    print(f"| Category        | Found | Risk     |")
    print(f"|-----------------|-------|----------|")
    print(f"| CRITICAL        | {counts['CRITICAL']:5} | CRITICAL |")
    print(f"| HIGH            | {counts['HIGH']:5} | HIGH     |")
    print(f"| MEDIUM          | {counts['MEDIUM']:5} | MEDIUM   |")
    print(f"| LOW             | {counts['LOW']:5} | LOW      |")
    print()

    if findings:
        print("FINDINGS")
        print("-" * 40)
        print(format_findings(findings))
        print()

    if missing_gitignore:
        print("GITIGNORE WARNINGS")
        print("-" * 40)
        print("Missing patterns in .gitignore:")
        for pattern in missing_gitignore:
            print(f"  - {pattern}")
        print()

    if total_issues > 0:
        print("RECOMMENDATIONS")
        print("-" * 40)
        if counts['CRITICAL'] > 0:
            print("1. IMMEDIATELY rotate any exposed credentials")
            print("2. Remove secrets from code and use environment variables")
            print("3. Add sensitive patterns to .gitignore")
        else:
            print("1. Review findings and remove hardcoded values")
            print("2. Use environment variables for secrets")
        print()

    print("=" * 60)

    sys.exit(0 if status == 'PASS' else 1)


if __name__ == "__main__":
    main()
