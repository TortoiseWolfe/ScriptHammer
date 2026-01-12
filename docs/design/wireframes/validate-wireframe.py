#!/usr/bin/env python3
"""
SVG Wireframe Validator v2.0

Programmatically checks wireframe SVGs against ScriptHammer standards.
Catches issues Claude keeps forgetting: colors, collisions, boundaries,
header templates, font sizes, clickable badges.

Usage:
    python validate-wireframe.py 002-cookie-consent/01-consent-modal-flow.svg
    python validate-wireframe.py --all  # Validate all SVGs
"""

import sys
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional

# ============================================================
# COLOR STANDARDS
# ============================================================

ALLOWED_COLORS = {
    # Toggle states
    'toggle_off': '#6b7280',
    'toggle_on': '#22c55e',

    # Badges
    'badge_fr': '#2563eb',
    'badge_sc': '#ea580c',
    'badge_us': '#0891b2',
    'badge_p0': '#dc2626',
    'badge_p1': '#f59e0b',
    'badge_p2': '#3b82f6',

    # Buttons
    'button_primary': '#8b5cf6',
    'button_secondary_bg': '#f5f0e6',
    'button_tertiary_bg': '#dcc8a8',

    # Panels (light theme)
    'panel_bg': '#e8d4b8',
    'panel_secondary': '#dcc8a8',
    'input_bg': '#f5f0e6',

    # Borders
    'border_light': '#b8a080',
    'border_dark': '#475569',

    # Text
    'text_dark': '#374151',
    'text_light': '#ffffff',
    'text_muted': '#4b5563',
}

# Colors that should never appear (except in specific contexts)
FORBIDDEN_PANEL_COLORS = [
    '#ffffff',      # No white panels (use parchment)
    '#d1d5db',      # Wrong toggle grey
    '#e5e7eb',      # Wrong light grey
]

# Dark colors forbidden for mobile phone frames
FORBIDDEN_FRAME_COLORS = ['#1f2937', '#111827', '#0f172a']

# ============================================================
# HEADER TEMPLATE PATTERNS
# ============================================================

# Icon path fragments that indicate proper template usage
REQUIRED_ICON_PATTERNS = [
    r'M12 15a3 3 0 1 0 0-6',           # Eye icon (accessibility)
    r'M11\.0779 2\.25',                 # Gear icon start (settings)
    r'M3 6\.75A\.75\.75 0 0 1 3\.75 6', # Hamburger menu (mobile)
]

# ============================================================
# LAYOUT STANDARDS
# ============================================================

CANVAS_WIDTH = 1920
CANVAS_HEIGHT = 1080
MIN_FONT_SIZE = 14  # pixels (12 is too small for readability)
MAX_UNUSED_RIGHT_SPACE = 200  # pixels

# ============================================================
# VALIDATION CLASSES
# ============================================================

@dataclass
class Issue:
    severity: str  # ERROR, WARNING
    code: str
    message: str
    line: Optional[int] = None
    element: Optional[str] = None


@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float
    element_id: str = ""

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def overlaps(self, other: 'BoundingBox') -> bool:
        return (self.x < other.right and
                self.right > other.x and
                self.y < other.bottom and
                self.bottom > other.y)

    def gap_to(self, other: 'BoundingBox') -> float:
        h_gap = max(other.x - self.right, self.x - other.right)
        v_gap = max(other.y - self.bottom, self.y - other.bottom)
        return max(h_gap, v_gap)


class WireframeValidator:
    def __init__(self, svg_path: Path):
        self.svg_path = svg_path
        self.issues: List[Issue] = []
        self.tree = None
        self.root = None
        self.svg_content = ""
        self.ns = {'svg': 'http://www.w3.org/2000/svg'}

    def validate(self) -> List[Issue]:
        """Run all validation checks."""
        try:
            self.svg_content = self.svg_path.read_text()
            self.tree = ET.parse(self.svg_path)
            self.root = self.tree.getroot()
        except ET.ParseError as e:
            self.issues.append(Issue(
                severity="ERROR",
                code="PARSE",
                message=f"Failed to parse SVG: {e}"
            ))
            return self.issues

        # Check for common XML/SVG issues that cause browser errors
        self._check_xml_syntax()

        # Original checks
        self._check_svg_root()
        self._check_colors()
        self._check_boundaries()

        # New v2 checks
        self._check_header_templates()
        self._check_mobile_frame()
        self._check_font_sizes()
        self._check_clickable_badges()
        self._check_layout_usage()

        # v2.1 checks
        self._check_callout_collisions()
        self._check_annotation_structure()

        return self.issues

    def _check_xml_syntax(self):
        """XML-001: Check for common XML syntax issues that cause browser parse errors."""
        # Check for unescaped ampersands (not part of entities)
        amp_pattern = r'&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)'
        for match in re.finditer(amp_pattern, self.svg_content):
            line_num = self.svg_content[:match.start()].count('\n') + 1
            self.issues.append(Issue(
                severity="ERROR",
                code="XML-001",
                message=f"Unescaped '&' character (use &amp; instead)",
                line=line_num
            ))

        # Check for unescaped < inside attribute values or text
        # Pattern: look for < that's not starting a tag (followed by letter or /)
        bad_lt_pattern = r'<(?![a-zA-Z/?!])'
        for match in re.finditer(bad_lt_pattern, self.svg_content):
            line_num = self.svg_content[:match.start()].count('\n') + 1
            self.issues.append(Issue(
                severity="ERROR",
                code="XML-002",
                message=f"Unescaped '<' character (use &lt; instead)",
                line=line_num
            ))

        # Check for mismatched quotes in attributes
        # Look for patterns like attr="value' or attr='value"
        mismatched_quote_pattern = r'(\w+)="[^"]*\'|(\w+)=\'[^\']*"'
        for match in re.finditer(mismatched_quote_pattern, self.svg_content):
            line_num = self.svg_content[:match.start()].count('\n') + 1
            self.issues.append(Issue(
                severity="ERROR",
                code="XML-003",
                message=f"Mismatched quotes in attribute",
                line=line_num
            ))

        # Check for attributes without proper quoting
        # Pattern: attr=value (no quotes around value)
        unquoted_attr_pattern = r'\s(\w+)=([^"\'\s>][^\s>]*)\s'
        for match in re.finditer(unquoted_attr_pattern, self.svg_content):
            attr_name = match.group(1)
            attr_value = match.group(2)
            # Skip if it looks like a gradient reference
            if attr_value.startswith('url('):
                continue
            line_num = self.svg_content[:match.start()].count('\n') + 1
            self.issues.append(Issue(
                severity="ERROR",
                code="XML-004",
                message=f"Attribute '{attr_name}' has unquoted value '{attr_value}'",
                line=line_num
            ))

    def _check_svg_root(self):
        """Check SVG root element has required attributes."""
        viewbox = self.root.get('viewBox')
        if viewbox != '0 0 1920 1080':
            self.issues.append(Issue(
                severity="ERROR",
                code="SVG-001",
                message=f"viewBox should be '0 0 1920 1080', got '{viewbox}'"
            ))

        width = self.root.get('width')
        if width != '1920':
            self.issues.append(Issue(
                severity="ERROR",
                code="SVG-002",
                message=f"width attribute should be '1920', got '{width}'"
            ))

        height = self.root.get('height')
        if height != '1080':
            self.issues.append(Issue(
                severity="ERROR",
                code="SVG-003",
                message=f"height attribute should be '1080', got '{height}'"
            ))

    def _check_colors(self):
        """Check for forbidden colors."""
        for color in FORBIDDEN_PANEL_COLORS:
            pattern = rf'fill=["\']?{re.escape(color)}'
            matches = list(re.finditer(pattern, self.svg_content, re.IGNORECASE))
            for match in matches:
                line_num = self.svg_content[:match.start()].count('\n') + 1
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-001",
                    message=f"Forbidden panel color '{color}' found (use #e8d4b8 parchment)",
                    line=line_num
                ))

        # Check toggle colors
        self._check_toggle_colors()

    def _check_toggle_colors(self):
        """Check toggle switch colors are correct.
        Toggles have rx>=10 (typically rx=13-14). Badge pills have rx=4.
        """
        toggle_pattern = r'<rect[^>]*width=["\']?(?:4[0-9]|5[0-5])["\']?[^>]*height=["\']?(?:2[0-9])["\']?[^>]*>'
        for match in re.finditer(toggle_pattern, self.svg_content):
            rect_str = match.group()

            # Check rx - toggles have rx >= 10, badges have rx=4
            rx_match = re.search(r'rx=["\']?(\d+)', rect_str)
            if rx_match:
                rx = int(rx_match.group(1))
                if rx < 10:
                    continue  # Skip badge pills (rx=4)

            fill_match = re.search(r'fill=["\']?([^"\'\s>]+)', rect_str)
            if fill_match:
                fill = fill_match.group(1).lower()
                if fill not in ['#6b7280', '#22c55e', 'none', 'url(']:
                    line_num = self.svg_content[:match.start()].count('\n') + 1
                    self.issues.append(Issue(
                        severity="WARNING",
                        code="G-015",
                        message=f"Possible toggle with wrong color '{fill}' (should be #6b7280 OFF or #22c55e ON)",
                        line=line_num
                    ))

    def _check_header_templates(self):
        """HDR-001: Check that header templates from includes/ are properly injected."""
        has_desktop = 'id="desktop"' in self.svg_content or 'DESKTOP' in self.svg_content
        has_mobile = 'id="mobile"' in self.svg_content or 'MOBILE' in self.svg_content

        if not has_desktop and not has_mobile:
            return  # No viewports to check

        missing = []

        # Check for injected template group IDs
        if has_desktop:
            if 'id="desktop-header"' not in self.svg_content:
                missing.append("desktop-header (from includes/header-desktop.svg)")
            if 'id="site-footer"' not in self.svg_content:
                missing.append("site-footer (from includes/footer-desktop.svg)")

        if has_mobile:
            if 'id="mobile-header-group"' not in self.svg_content:
                missing.append("mobile-header-group (from includes/header-mobile.svg)")
            if 'id="mobile-bottom-nav"' not in self.svg_content:
                missing.append("mobile-bottom-nav (from includes/footer-mobile.svg)")

        if missing:
            self.issues.append(Issue(
                severity="ERROR",
                code="HDR-001",
                message=f"Missing template injections: {', '.join(missing)}"
            ))

        # Also check for required icon patterns as backup
        missing_icons = []

        # Eye icon (accessibility) - should be in both
        if not re.search(REQUIRED_ICON_PATTERNS[0], self.svg_content):
            missing_icons.append("eye icon")

        # Gear icon (settings) - should be in both
        if not re.search(REQUIRED_ICON_PATTERNS[1], self.svg_content):
            missing_icons.append("gear icon")

        # Hamburger menu - only required for mobile
        if has_mobile and not re.search(REQUIRED_ICON_PATTERNS[2], self.svg_content):
            missing_icons.append("hamburger menu")

        if missing_icons:
            self.issues.append(Issue(
                severity="WARNING",
                code="HDR-002",
                message=f"Missing icon paths (may indicate hand-drawn headers): {', '.join(missing_icons)}"
            ))

    def _check_mobile_frame(self):
        """MOB-001: Check mobile phone frame isn't using dark colors."""
        # Look for rects with large rx (rounded corners) that could be phone frames
        frame_pattern = r'<rect[^>]*rx=["\']?(?:2[0-9]|[3-9][0-9])["\']?[^>]*>'

        for match in re.finditer(frame_pattern, self.svg_content):
            rect_str = match.group()
            fill_match = re.search(r'fill=["\']?([^"\'\s>]+)', rect_str)
            if fill_match:
                fill = fill_match.group(1).lower()
                if fill in FORBIDDEN_FRAME_COLORS:
                    line_num = self.svg_content[:match.start()].count('\n') + 1
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="MOB-001",
                        message=f"Mobile frame uses dark color '{fill}' (use light color like #e8d4b8)",
                        line=line_num
                    ))

    def _check_font_sizes(self):
        """FONT-001: Check all text elements have font-size >= 14px.
        Exception: Text inside <a> tags (badge pills) can be smaller (min 11px).
        """
        BADGE_MIN_SIZE = 11  # Badge pill text can be smaller

        # Build parent map
        parent_map = {child: parent for parent in self.root.iter() for child in parent}

        for text in self.root.iter('{http://www.w3.org/2000/svg}text'):
            font_size_str = text.get('font-size', '14')
            # Remove 'px' suffix if present
            font_size_str = font_size_str.replace('px', '').strip()
            try:
                font_size = float(font_size_str)
                content = ''.join(text.itertext())[:30]

                # Check if inside an <a> tag (badge pill) - use different minimum
                parent = parent_map.get(text)
                is_badge = parent is not None and parent.tag == '{http://www.w3.org/2000/svg}a'

                min_size = BADGE_MIN_SIZE if is_badge else MIN_FONT_SIZE

                if font_size < min_size:
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="FONT-001",
                        message=f"Font size {font_size}px below minimum {min_size}px: '{content}'"
                    ))
            except ValueError:
                pass  # Can't parse font size

    def _check_clickable_badges(self):
        """LINK-001: Check FR/SC/US badges are wrapped in <a href>."""
        # Find all badge text patterns
        badge_pattern = r'<text[^>]*>([FSU][RCS]-\d+)</text>'

        for match in re.finditer(badge_pattern, self.svg_content):
            badge_id = match.group(1)
            # Check if this text is inside an <a> element
            # Look backwards for <a and forwards for </a>
            start = match.start()
            search_before = self.svg_content[max(0, start-200):start]
            search_after = self.svg_content[match.end():match.end()+50]

            has_link_before = '<a ' in search_before or '<a>' in search_before
            has_link_after = '</a>' in search_after

            if not (has_link_before and has_link_after):
                line_num = self.svg_content[:start].count('\n') + 1
                self.issues.append(Issue(
                    severity="ERROR",
                    code="LINK-001",
                    message=f"Badge '{badge_id}' is not clickable (wrap in <a href='...'>)",
                    line=line_num
                ))

    def _check_layout_usage(self):
        """LAYOUT-001: Check for excessive unused space on right side."""
        rightmost_x = 0

        # Find rightmost element
        for rect in self.root.iter('{http://www.w3.org/2000/svg}rect'):
            try:
                x = float(rect.get('x', 0))
                w = float(rect.get('width', 0))
                rightmost_x = max(rightmost_x, x + w)
            except (ValueError, TypeError):
                continue

        # Also check text elements
        for text in self.root.iter('{http://www.w3.org/2000/svg}text'):
            try:
                x = float(text.get('x', 0))
                rightmost_x = max(rightmost_x, x + 200)  # Estimate text width
            except (ValueError, TypeError):
                continue

        unused_space = CANVAS_WIDTH - rightmost_x
        if unused_space > MAX_UNUSED_RIGHT_SPACE:
            self.issues.append(Issue(
                severity="WARNING",
                code="LAYOUT-001",
                message=f"{int(unused_space)}px unused space on right (rightmost element at x={int(rightmost_x)})"
            ))

    def _check_callout_collisions(self):
        """COLL-001: Check that callout circles don't overlap important UI elements."""
        # Find all callout circles (red circles with r >= 14)
        callout_pattern = r'<circle[^>]*r=["\']?(\d+)["\']?[^>]*fill=["\']?#dc2626["\']?[^>]*>'
        alt_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?[^>]*r=["\']?(\d+)["\']?[^>]*>'

        callouts = []
        for pattern in [callout_pattern, alt_pattern]:
            for match in re.finditer(pattern, self.svg_content):
                r = int(match.group(1))
                if r >= 14:
                    line_num = self.svg_content[:match.start()].count('\n') + 1
                    callouts.append((line_num, match.group()))

        # For now, just warn about callouts that might be in problematic positions
        # Full collision detection would require computing absolute positions through transforms
        for line_num, callout_str in callouts:
            # Check if callout is positioned at edge of a container (common collision point)
            if 'transform="translate' in self.svg_content[max(0, self.svg_content.rfind('<g', 0, self.svg_content.find(callout_str))):self.svg_content.find(callout_str)]:
                # Check surrounding context for potential collisions
                context_start = max(0, self.svg_content.find(callout_str) - 500)
                context_end = self.svg_content.find(callout_str) + len(callout_str) + 200
                context = self.svg_content[context_start:context_end]

                # Warn if callout appears near footer or edge elements
                if 'footer' in context.lower() or 'site-footer' in context:
                    self.issues.append(Issue(
                        severity="WARNING",
                        code="COLL-001",
                        message=f"Callout circle near footer area - verify no overlap",
                        line=line_num
                    ))

    def _check_annotation_structure(self):
        """ANN-001: Check annotation panel has required structure."""
        # Check for annotation panel
        if 'id="annotations"' not in self.svg_content:
            self.issues.append(Issue(
                severity="WARNING",
                code="ANN-001",
                message="No annotation panel found (expected id='annotations')"
            ))
            return

        # Count annotation groups (circles with numbers in annotation area)
        # Look for callout circles in annotation panel (y > 800)
        annotation_section = self.svg_content[self.svg_content.find('id="annotations"'):]
        callout_count = annotation_section.count('fill="#dc2626"')

        if callout_count < 4:
            self.issues.append(Issue(
                severity="WARNING",
                code="ANN-002",
                message=f"Only {callout_count} annotation groups found (recommend 4-8 for complete coverage)"
            ))

        # Check for legend
        if 'Legend' not in self.svg_content and 'legend' not in self.svg_content.lower():
            self.issues.append(Issue(
                severity="WARNING",
                code="ANN-003",
                message="No legend found in annotation panel"
            ))

    def _check_boundaries(self):
        """Check content stays within canvas boundaries."""
        for rect in self.root.iter('{http://www.w3.org/2000/svg}rect'):
            try:
                x = float(rect.get('x', 0))
                y = float(rect.get('y', 0))
                w = float(rect.get('width', 0))
                h = float(rect.get('height', 0))

                if x + w > CANVAS_WIDTH:
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="G-018",
                        message=f"Element extends past canvas right edge (ends at {x+w})"
                    ))
                if y + h > CANVAS_HEIGHT:
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="G-018",
                        message=f"Element extends past canvas bottom (ends at {y+h})"
                    ))
            except (ValueError, TypeError):
                continue


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate-wireframe.py <svg-file-or-dir>")
        print("       python validate-wireframe.py --all")
        sys.exit(1)

    wireframes_dir = Path(__file__).parent

    if sys.argv[1] == '--all':
        svg_files = list(wireframes_dir.glob('**/*.svg'))
        svg_files = [f for f in svg_files if 'includes' not in str(f)]
    else:
        svg_path = wireframes_dir / sys.argv[1]
        if not svg_path.exists():
            print(f"ERROR: File not found: {svg_path}")
            sys.exit(1)
        svg_files = [svg_path]

    total_errors = 0
    total_warnings = 0

    for svg_file in svg_files:
        print(f"\n{'='*60}")
        print(f"Validating: {svg_file.relative_to(wireframes_dir)}")
        print('='*60)

        validator = WireframeValidator(svg_file)
        issues = validator.validate()

        errors = [i for i in issues if i.severity == "ERROR"]
        warnings = [i for i in issues if i.severity == "WARNING"]

        if not issues:
            print("PASS - No issues found")
        else:
            for issue in issues:
                prefix = "ERROR" if issue.severity == "ERROR" else "WARN "
                line_info = f" (line {issue.line})" if issue.line else ""
                print(f"  {prefix} [{issue.code}]{line_info}: {issue.message}")

            print(f"\n  Summary: {len(errors)} errors, {len(warnings)} warnings")

        total_errors += len(errors)
        total_warnings += len(warnings)

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_errors} errors, {total_warnings} warnings across {len(svg_files)} files")

    if total_errors > 0:
        print("STATUS: FAIL")
        sys.exit(1)
    elif total_warnings > 0:
        print("STATUS: PASS with warnings")
        sys.exit(0)
    else:
        print("STATUS: PASS")
        sys.exit(0)


if __name__ == '__main__':
    main()
