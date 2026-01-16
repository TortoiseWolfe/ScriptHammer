#!/usr/bin/env python3
"""
SIGNATURE-003 Batch Fix: Left-align signature blocks

Fixes:
- Change x="960" to x="40" on signature text elements at y="1060"
- Remove text-anchor="middle" attribute

Usage:
    python fix-signature-003.py [--dry-run] [svg_file ...]

If no SVG files specified, processes all SVGs in docs/design/wireframes/
"""

import re
import sys
from pathlib import Path


def fix_signature(svg_content: str) -> tuple[str, list[str]]:
    """Fix signature line to be left-aligned at x=40.

    Returns (fixed_content, list_of_changes)
    """
    changes = []

    # Pattern to match signature text at y=1060 with x=960 and/or text-anchor="middle"
    # The signature is always at y="1060" (or y='1060')
    signature_pattern = r'(<text[^>]*\by=["\']1060["\'][^>]*>)'

    def fix_match(match):
        element = match.group(1)
        original = element
        modified = element

        # Fix x="960" -> x="40"
        if re.search(r'\bx=["\']960["\']', element):
            modified = re.sub(r'\bx=["\']960["\']', 'x="40"', modified)

        # Remove text-anchor="middle" (with various quote styles)
        if 'text-anchor' in element:
            modified = re.sub(r'\s*text-anchor=["\']middle["\']', '', modified)

        if modified != original:
            changes.append(f"Fixed: {original[:80]}... -> {modified[:80]}...")
            return modified
        return element

    fixed_content = re.sub(signature_pattern, fix_match, svg_content)

    return fixed_content, changes


def process_file(svg_path: Path, dry_run: bool = False) -> bool:
    """Process a single SVG file. Returns True if changes were made."""
    try:
        content = svg_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"ERROR reading {svg_path}: {e}")
        return False

    fixed_content, changes = fix_signature(content)

    if not changes:
        return False

    print(f"\n{svg_path.relative_to(svg_path.parent.parent.parent)}:")
    for change in changes:
        print(f"  {change}")

    if not dry_run:
        try:
            svg_path.write_text(fixed_content, encoding='utf-8')
            print(f"  ✓ Written")
        except Exception as e:
            print(f"  ✗ ERROR writing: {e}")
            return False
    else:
        print(f"  (dry-run, not written)")

    return True


def main():
    dry_run = '--dry-run' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('--')]

    if args:
        # Process specified files
        svg_files = [Path(f) for f in args if f.endswith('.svg')]
    else:
        # Process all feature wireframes
        wireframes_dir = Path(__file__).parent.parent.parent / 'docs' / 'design' / 'wireframes'
        svg_files = []
        for feature_dir in wireframes_dir.iterdir():
            if feature_dir.is_dir() and feature_dir.name[0].isdigit():
                svg_files.extend(feature_dir.glob('*.svg'))

    print(f"SIGNATURE-003 Batch Fix")
    print(f"{'DRY RUN - ' if dry_run else ''}Processing {len(svg_files)} SVG files...")
    print("=" * 60)

    fixed_count = 0
    for svg_path in sorted(svg_files):
        if process_file(svg_path, dry_run):
            fixed_count += 1

    print("=" * 60)
    print(f"Fixed: {fixed_count} / {len(svg_files)} files")

    return 0 if fixed_count > 0 or not svg_files else 1


if __name__ == '__main__':
    sys.exit(main())
