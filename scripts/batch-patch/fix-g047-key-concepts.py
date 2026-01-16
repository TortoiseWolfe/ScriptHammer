#!/usr/bin/env python3
"""
G-047 Batch Fix: Add "Key Concepts" row to annotation panel

Inserts a Key Concepts row at y=730 before the signature block.

Template:
  <text x="40" y="730" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
  <text x="140" y="730" font-family="system-ui, sans-serif" font-size="14" fill="#6b7280">[feature-specific terms]</text>

This script:
1. Detects if Key Concepts row already exists (skips if found)
2. Extracts feature name from directory/SVG name for placeholder terms
3. Inserts the row before the signature block

Usage:
    python fix-g047-key-concepts.py [--dry-run] [svg_file ...]

If no SVG files specified, processes all SVGs in docs/design/wireframes/
"""

import re
import sys
from pathlib import Path

# Feature-specific key concepts mapping
# Format: feature_prefix -> "term1 | term2 | term3"
FEATURE_CONCEPTS = {
    "000-landing-page": "hero section | feature cards | CTA buttons | responsive grid",
    "000-rls-implementation": "Row Level Security | Supabase policies | user context | data isolation",
    "001-wcag-aa-compliance": "WCAG 2.1 | 4.5:1 contrast | focus indicators | screen readers",
    "002-cookie-consent": "GDPR compliance | consent management | cookie categories | preference storage",
    "003-user-authentication": "Supabase Auth | OAuth providers | session management | password reset",
    "004-mobile-first-design": "44x44px touch targets | responsive breakpoints | mobile-first CSS",
    "005-security-hardening": "CSP headers | rate limiting | session timeout | audit logging",
    "006-template-fork-experience": "environment setup | service configuration | rebrand automation",
    "007-e2e-testing-framework": "Playwright | CI/CD pipeline | test coverage | visual regression",
    "008-on-the-account": "avatar upload | image processing | storage bucket | profile updates",
    "009-user-messaging-system": "real-time messaging | WebSocket | conversation threads | notifications",
    "010-unified-blog-content": "MDX editor | conflict resolution | autosave | version history",
    "011-group-chats": "group creation | member management | admin roles | message threading",
    "012-welcome-message-architecture": "onboarding flow | welcome email | first-time user | admin setup",
    "013-oauth-messaging-password": "OAuth password | secure messaging | encrypted storage",
    "014-admin-welcome-email-gate": "email verification | admin approval | user activation",
    "015-oauth-display-name": "OAuth profile | display name | profile population | user metadata",
    "016-messaging-critical-fixes": "message input | conversation view | error states | OAuth setup",
    "017-colorblind-mode": "accessibility settings | color blindness | contrast modes | visual preferences",
    "019-google-analytics": "GA4 integration | consent flow | privacy controls | analytics dashboard",
    "021-geolocation-map": "Leaflet.js | location permission | markers | map accessibility",
    "022-web3forms-integration": "contact form | form validation | submission states | spam protection",
}


def get_key_concepts(svg_path: Path) -> str:
    """Get feature-specific key concepts or generate placeholder."""
    feature_name = svg_path.parent.name

    if feature_name in FEATURE_CONCEPTS:
        return FEATURE_CONCEPTS[feature_name]

    # Generate placeholder from feature name
    words = feature_name.replace("-", " ").title()
    return f"{words} | implementation | user flow | validation"


def has_key_concepts(svg_content: str) -> bool:
    """Check if SVG already has a Key Concepts row."""
    # Look for "Key Concepts" text near y=730 or any y in 720-750 range
    pattern = r'Key\s*Concepts'
    return bool(re.search(pattern, svg_content, re.IGNORECASE))


def fix_key_concepts(svg_content: str, svg_path: Path) -> tuple[str, list[str]]:
    """Add Key Concepts row before signature block.

    Returns (fixed_content, list_of_changes)
    """
    changes = []

    # Skip if already has Key Concepts
    if has_key_concepts(svg_content):
        return svg_content, []

    # Find signature block (text at y="1060")
    signature_pattern = r'(\n\s*)(<!-- SIGNATURE|<text[^>]*\by=["\']1060["\'][^>]*>)'

    match = re.search(signature_pattern, svg_content)
    if not match:
        # Try without comment marker
        signature_pattern = r'(\n\s*)(<text[^>]*\by=["\']1060["\'][^>]*>)'
        match = re.search(signature_pattern, svg_content)

    if not match:
        changes.append("WARNING: Could not find signature block at y=1060")
        return svg_content, changes

    # Get the key concepts for this feature
    concepts = get_key_concepts(svg_path)

    # Build the Key Concepts row
    indent = match.group(1)
    key_concepts_block = f'''{indent}<!-- Key Concepts Row (G-047) -->
{indent}<text x="40" y="730" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
{indent}<text x="140" y="730" font-family="system-ui, sans-serif" font-size="14" fill="#6b7280">{concepts}</text>
'''

    # Insert before signature
    insert_pos = match.start()
    fixed_content = svg_content[:insert_pos] + key_concepts_block + svg_content[insert_pos:]

    changes.append(f"Added Key Concepts: {concepts[:50]}...")

    return fixed_content, changes


def process_file(svg_path: Path, dry_run: bool = False) -> bool:
    """Process a single SVG file. Returns True if changes were made."""
    try:
        content = svg_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"ERROR reading {svg_path}: {e}")
        return False

    fixed_content, changes = fix_key_concepts(content, svg_path)

    if not changes:
        return False

    relative_path = svg_path.relative_to(svg_path.parent.parent.parent)
    print(f"\n{relative_path}:")
    for change in changes:
        print(f"  {change}")

    if "WARNING" in str(changes):
        return False

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

    print(f"G-047 Batch Fix: Key Concepts Row")
    print(f"{'DRY RUN - ' if dry_run else ''}Processing {len(svg_files)} SVG files...")
    print("=" * 60)

    fixed_count = 0
    skipped_count = 0
    for svg_path in sorted(svg_files):
        # Check if already has key concepts before processing
        try:
            content = svg_path.read_text(encoding='utf-8')
            if has_key_concepts(content):
                skipped_count += 1
                continue
        except Exception:
            pass

        if process_file(svg_path, dry_run):
            fixed_count += 1

    print("=" * 60)
    print(f"Fixed: {fixed_count} files")
    print(f"Skipped (already has Key Concepts): {skipped_count} files")
    print(f"Total: {len(svg_files)} files")

    return 0 if fixed_count > 0 or not svg_files else 1


if __name__ == '__main__':
    sys.exit(main())
