#!/usr/bin/env python3
"""
G-044 Batch Fix: Add rounded corners to footer/nav rect elements

Fixes:
- Add rx="8" to desktop footer rect elements (y=640-720, width ~1280)
- Add rx="8" to mobile bottom nav rect elements (y=664-720, width ~360)

Note: This only adds rx where missing. SVGs using <path> for rounded corners
(like the includes) are already correct.

Usage:
    python fix-g044-footer-corners.py [--dry-run] [svg_file ...]

If no SVG files specified, processes all SVGs in docs/design/wireframes/
"""

import re
import sys
from pathlib import Path


def fix_footer_corners(svg_content: str) -> tuple[str, list[str]]:
    """Add rx="8" to footer/nav rect elements missing rounded corners.

    Returns (fixed_content, list_of_changes)
    """
    changes = []

    # Pattern for desktop footer rects (large width, y near bottom of 720px desktop viewport)
    # Desktop viewport ends at y=720, footer typically at y=640-700 range
    # Looking for rects with width 1000-1300 (footer-width) without rx
    desktop_footer_pattern = r'(<rect\b[^>]*\bwidth=["\']1[0-2]\d\d["\'][^>]*\by=["\']6[4-9]\d["\'][^>]*)(/?>)'

    def add_rx_desktop(match):
        element = match.group(1)
        closing = match.group(2)

        # Skip if already has rx
        if 'rx=' in element:
            return match.group(0)

        # Add rx="8" before closing
        modified = element + ' rx="8"' + closing
        changes.append(f"Desktop footer: added rx=\"8\"")
        return modified

    # Also match the reverse order (y before width)
    desktop_footer_pattern2 = r'(<rect\b[^>]*\by=["\']6[4-9]\d["\'][^>]*\bwidth=["\']1[0-2]\d\d["\'][^>]*)(/?>)'

    svg_content = re.sub(desktop_footer_pattern, add_rx_desktop, svg_content)
    svg_content = re.sub(desktop_footer_pattern2, add_rx_desktop, svg_content)

    # Pattern for mobile bottom nav rects (width ~360, y=664-720)
    # Mobile nav at y=664 relative to mobile group
    mobile_nav_pattern = r'(<rect\b[^>]*\bwidth=["\']3[4-6]\d["\'][^>]*\by=["\']66[4-9]["\'][^>]*)(/?>)'

    def add_rx_mobile(match):
        element = match.group(1)
        closing = match.group(2)

        # Skip if already has rx
        if 'rx=' in element:
            return match.group(0)

        # Add rx="8" before closing
        modified = element + ' rx="8"' + closing
        changes.append(f"Mobile nav: added rx=\"8\"")
        return modified

    # Also match reverse order
    mobile_nav_pattern2 = r'(<rect\b[^>]*\by=["\']66[4-9]["\'][^>]*\bwidth=["\']3[4-6]\d["\'][^>]*)(/?>)'

    svg_content = re.sub(mobile_nav_pattern, add_rx_mobile, svg_content)
    svg_content = re.sub(mobile_nav_pattern2, add_rx_mobile, svg_content)

    return svg_content, changes


def process_file(svg_path: Path, dry_run: bool = False) -> bool:
    """Process a single SVG file. Returns True if changes were made."""
    try:
        content = svg_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"ERROR reading {svg_path}: {e}")
        return False

    fixed_content, changes = fix_footer_corners(content)

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

    print(f"G-044 Batch Fix: Footer/Nav Rounded Corners")
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
