#!/usr/bin/env python3
"""
SVG Wireframe Validator v5.4

Programmatically checks wireframe SVGs against ScriptHammer standards.
All checks are errors - either it passes or it fails. No ambiguous warnings.

NEW in v5.4: Added G-044 (footer/nav rounded corners) check.
NEW in v5.3: Added --json and --summary output modes for CI integration (RFC-004).
NEW in v5.2: Added G-036 (badge containment) and G-037 (annotation text readability) checks.
NEW in v5.1: Added MOBILE-001 check for mobile content overlapping header (G-034).
NEW in v5.0: Auto-logs issues to feature-specific .issues.md files.
Issues only escalate to GENERAL_ISSUES.md when seen in 2+ features.

Checks: XML syntax, SVG structure, colors, fonts, headers, modals, callouts,
        annotations, title, signature, background gradient, paint order, mobile safe area,
        badge containment, annotation text readability, footer/nav rounded corners.

Usage:
    python validate-wireframe.py 002-cookie-consent/01-consent-modal-flow.svg
    python validate-wireframe.py --all              # Validate all SVGs
    python validate-wireframe.py --all --json       # JSON output for CI
    python validate-wireframe.py --all --summary    # One-line summary for PR comments
    python validate-wireframe.py --check-escalation # Check for patterns to escalate
"""

import bisect
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Set

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
# INCLUDE REFERENCES (resolved at runtime by viewer)
# ============================================================

REQUIRED_INCLUDES = {
    'desktop': [
        'includes/header-desktop.svg#desktop-header',
        'includes/footer-desktop.svg#site-footer',
    ],
    'mobile': [
        'includes/header-mobile.svg#mobile-header-group',
        'includes/footer-mobile.svg#mobile-bottom-nav',
    ],
}

# ============================================================
# THEME ANALYSIS KEYWORDS
# ============================================================

BACKEND_KEYWORDS = [
    'rls', 'row-level', 'isolation', 'policy', 'policies',
    'csrf', 'token', 'oauth', 'session', 'callback',
    'injection', 'sanitiz', 'validation', 'xss', 'sql',
    'pre-commit', 'hook', 'ci/cd', 'pipeline', 'scan',
    'audit log', 'compliance', 'retention',
    'rate limit', 'brute force', 'lockout', 'server-side',
    'database', 'migration', 'schema', 'trigger',
]

UX_KEYWORDS = [
    'form', 'button', 'modal', 'toast', 'dialog',
    'dashboard', 'list', 'view', 'page', 'screen',
    'input', 'toggle', 'checkbox', 'dropdown',
    'settings', 'profile', 'preferences',
    'feedback', 'indicator', 'strength', 'meter',
    'warning', 'error message', 'recovery',
    'display', 'show', 'see', 'click', 'tap',
]

# ============================================================
# LAYOUT STANDARDS
# ============================================================

CANVAS_WIDTH = 1920
CANVAS_HEIGHT = 1080
MIN_FONT_SIZE = 14  # pixels (12 is too small for readability)
MAX_UNUSED_RIGHT_SPACE = 200  # pixels

# Mobile content safe area (G-034)
MOBILE_HEADER_HEIGHT = 78   # header-mobile.svg total height (status bar + nav)
MOBILE_FOOTER_Y = 664       # footer-mobile.svg starts here
MOBILE_CONTENT_MIN_Y = MOBILE_HEADER_HEIGHT  # Content must start at y >= 78

# Annotation panel layout (4-column grid)
ANNOTATION_COLUMNS = [(20, 470), (470, 920), (920, 1370), (1370, 1820)]
ANNOTATION_PANEL_MAX_X = 1800  # Content should not exceed this x position
ANNOTATION_PANEL_MAX_Y = 200   # Content should not exceed this y position (relative to panel)

# Mockup boundaries
DESKTOP_MOCKUP_RIGHT = 1320   # 40 + 1280
MOBILE_MOCKUP_RIGHT = 1720    # 1360 + 360
ANNOTATION_PANEL_RIGHT = 1880  # 40 + 1840

# ============================================================
# VALIDATION CLASSES
# ============================================================

@dataclass
class Issue:
    severity: str  # ERROR only - no warnings, they're useless
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
        self._line_offsets: List[int] = []  # Cumulative line offsets for O(log n) lookups
        # Cached sections (computed lazily on first access)
        self._annotation_start: Optional[int] = None
        self._annotation_section: Optional[str] = None
        self._mockup_section: Optional[str] = None
        self._parent_map: Optional[Dict] = None

    @property
    def annotation_start(self) -> int:
        """Cached position of annotation section start."""
        if self._annotation_start is None:
            pos = self.svg_content.find('id="annotations"')
            self._annotation_start = pos if pos != -1 else len(self.svg_content)
        return self._annotation_start

    @property
    def annotation_section(self) -> str:
        """Cached annotation section content."""
        if self._annotation_section is None:
            if 'id="annotations"' in self.svg_content:
                self._annotation_section = self.svg_content[self.annotation_start:]
            else:
                self._annotation_section = ""
        return self._annotation_section

    @property
    def mockup_section(self) -> str:
        """Cached mockup section (everything before annotations)."""
        if self._mockup_section is None:
            self._mockup_section = self.svg_content[:self.annotation_start]
        return self._mockup_section

    @property
    def parent_map(self) -> Dict:
        """Cached ElementTree parent map."""
        if self._parent_map is None:
            self._parent_map = {child: parent for parent in self.root.iter() for child in parent}
        return self._parent_map

    def _build_line_offsets(self) -> None:
        """Build cumulative line offset map for O(log n) line number lookups.

        Instead of counting newlines via svg_content[:pos].count('\\n') for each
        issue (O(n) per lookup = O(n²) total), we build this once and use binary search.
        """
        self._line_offsets = [0]
        for i, char in enumerate(self.svg_content):
            if char == '\n':
                self._line_offsets.append(i + 1)

    def _get_line_number(self, pos: int) -> int:
        """Get line number for a character position using binary search. O(log n)."""
        return bisect.bisect_right(self._line_offsets, pos)

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

        # Build line offset map for O(log n) line lookups (instead of O(n²) repeated counting)
        self._build_line_offsets()

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

        # v3 checks (from plan analysis)
        self._check_title_format()
        self._check_section_labels()
        self._check_clutter()
        self._check_callout_coverage()
        self._check_button_fills()
        self._check_signature()
        self._check_annotation_spacing()

        # v4 checks (User Story support)
        self._check_user_story_coverage()

        # v5 checks (Design principle validation - 2026-01-12)
        self._check_modal_overlay()
        self._check_callout_positioning()
        self._check_annotation_columns()
        self._check_annotation_containment()
        self._check_section_separation()

        # v6 checks (G-019, G-020, G-021 - 2026-01-12)
        self._check_annotation_group_spacing()
        self._check_footer_paint_order()

        # v7 checks (G-022 to G-029 - 2026-01-12)
        self._check_background_gradient()
        self._check_title_exists()
        self._check_signature_exists()
        self._check_callouts_on_mockups()

        # v8 checks (G-034 - 2026-01-12)
        self._check_mobile_content_position()

        # v9 checks (G-036, G-037 - 2026-01-12)
        self._check_badge_containment()
        self._check_annotation_text_readability()

        # v10 checks (G-044 - 2026-01-15)
        self._check_footer_nav_corners()

        return self.issues

    def _check_xml_syntax(self):
        """XML-001: Check for common XML syntax issues that cause browser parse errors."""
        # Check for unescaped ampersands (not part of entities)
        amp_pattern = r'&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)'
        for match in re.finditer(amp_pattern, self.svg_content):
            line_num = self._get_line_number(match.start())
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
            line_num = self._get_line_number(match.start())
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
            line_num = self._get_line_number(match.start())
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
            line_num = self._get_line_number(match.start())
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
        """Check for forbidden colors on PANELS (rect elements only, not text)."""
        for color in FORBIDDEN_PANEL_COLORS:
            # Only match <rect elements with forbidden fill - text can use #ffffff
            pattern = rf'<rect[^>]*fill=["\']?{re.escape(color)}'
            matches = list(re.finditer(pattern, self.svg_content, re.IGNORECASE))
            for match in matches:
                line_num = self._get_line_number(match.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-001",
                    message=f"Forbidden panel color '{color}' on rect (use #e8d4b8 parchment)",
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
                    line_num = self._get_line_number(match.start())
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="G-015",
                        message=f"Toggle has wrong color '{fill}' (must be #6b7280 OFF or #22c55e ON)",
                        line=line_num
                    ))

    def _check_header_templates(self):
        """HDR-001: Check that include references are present (viewer resolves at runtime)."""
        has_desktop = 'id="desktop"' in self.svg_content or 'DESKTOP' in self.svg_content
        has_mobile = 'id="mobile"' in self.svg_content or 'MOBILE' in self.svg_content

        if not has_desktop and not has_mobile:
            return  # No viewports to check

        missing = []

        # Check for <use> references to include files
        if has_desktop:
            if 'href="includes/header-desktop.svg#desktop-header"' not in self.svg_content:
                missing.append("header-desktop.svg#desktop-header")
            if 'href="includes/footer-desktop.svg#site-footer"' not in self.svg_content:
                missing.append("footer-desktop.svg#site-footer")

        if has_mobile:
            if 'href="includes/header-mobile.svg#mobile-header-group"' not in self.svg_content:
                missing.append("header-mobile.svg#mobile-header-group")
            if 'href="includes/footer-mobile.svg#mobile-bottom-nav"' not in self.svg_content:
                missing.append("footer-mobile.svg#mobile-bottom-nav")

        if missing:
            self.issues.append(Issue(
                severity="ERROR",
                code="HDR-001",
                message=f"Missing include references: {', '.join(missing)}. Use <use href=\"includes/...\"/>"
            ))

        # Note: Icon patterns are NOT checked here because they live in the include files,
        # not in the wireframe SVG itself. The viewer resolves includes at runtime.

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
                    line_num = self._get_line_number(match.start())
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

        for text in self.root.iter('{http://www.w3.org/2000/svg}text'):
            font_size_str = text.get('font-size', '14')
            # Remove 'px' suffix if present
            font_size_str = font_size_str.replace('px', '').strip()
            try:
                font_size = float(font_size_str)
                content = ''.join(text.itertext())[:30]

                # Check if inside an <a> tag (badge pill) - use different minimum
                parent = self.parent_map.get(text)
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
                line_num = self._get_line_number(start)
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
                severity="ERROR",
                code="LAYOUT-001",
                message=f"{int(unused_space)}px unused space on right (rightmost element at x={int(rightmost_x)})"
            ))

    def _check_callout_collisions(self):
        """COLL-001: Check that callout circles don't overlap footer areas.

        Uses geometric coordinates to detect actual overlap, not text proximity.
        Desktop footer starts at y=640, mobile footer at y=664 (within their groups).
        """
        # Footer Y positions (relative to viewport groups)
        DESKTOP_FOOTER_Y = 640
        MOBILE_FOOTER_Y = 664
        FOOTER_MARGIN = 30  # Callouts should stay this far from footer

        # Find mockup section (before annotations)
        if 'id="annotations"' in self.svg_content:
            mockup_section = self.mockup_section
        else:
            mockup_section = self.svg_content

        # Find desktop and mobile sections
        desktop_start = mockup_section.find('id="desktop"')
        mobile_start = mockup_section.find('id="mobile"')

        def check_section_callouts(section_content: str, section_offset: int, footer_y: int, section_name: str):
            """Check callouts in a viewport section against footer position."""
            callout_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?[^>]*>'

            for match in re.finditer(callout_pattern, section_content):
                callout_str = match.group()
                # Extract cy from the circle
                cy_match = re.search(r'cy=["\']?(\d+)', callout_str)
                r_match = re.search(r'\br=["\']?(\d+)', callout_str)
                if not cy_match:
                    continue

                cy = int(cy_match.group(1))
                r = int(r_match.group(1)) if r_match else 14

                # Check if callout overlaps or is too close to footer
                callout_bottom = cy + r
                if callout_bottom >= footer_y - FOOTER_MARGIN:
                    line_num = self._get_line_number(section_offset + match.start())
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="COLL-001",
                        message=f"Callout at cy={cy} too close to {section_name} footer (y={footer_y}) - move up",
                        line=line_num
                    ))

        # Check desktop section
        if desktop_start != -1:
            desktop_end = mobile_start if mobile_start > desktop_start else len(mockup_section)
            desktop_section = mockup_section[desktop_start:desktop_end]
            check_section_callouts(desktop_section, desktop_start, DESKTOP_FOOTER_Y, "desktop")

        # Check mobile section
        if mobile_start != -1:
            mobile_section = mockup_section[mobile_start:]
            check_section_callouts(mobile_section, mobile_start, MOBILE_FOOTER_Y, "mobile")

    def _check_annotation_structure(self):
        """ANN-001: Check annotation panel has required structure."""
        # Check for annotation panel
        if 'id="annotations"' not in self.svg_content:
            self.issues.append(Issue(
                severity="ERROR",
                code="ANN-001",
                message="No annotation panel found (expected id='annotations')"
            ))
            return

        # Count callout CIRCLES specifically (not P0 badges which are rects)
        # Look for <circle elements with red fill in annotation panel
        annotation_section = self.annotation_section
        callout_pattern = r'<circle[^>]*fill=["\']?#dc2626'
        callout_count = len(re.findall(callout_pattern, annotation_section))

        if callout_count < 4:
            self.issues.append(Issue(
                severity="ERROR",
                code="ANN-002",
                message=f"Only {callout_count} callout circles in annotation panel (minimum 4 required)"
            ))
        # Note: Legend check moved to _check_clutter() as CLUTTER-001 (inverted - now warns if legend EXISTS)

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

    # ============================================================
    # v3 CHECKS (from plan analysis - 2026-01-11)
    # ============================================================

    def _check_title_format(self):
        """TITLE-001/002/003: Title must be centered and human-readable."""
        # Find title text (y < 50, large font)
        title_pattern = r'<text[^>]*y=["\']?(\d+)["\']?[^>]*>([^<]+)</text>'
        for match in re.finditer(title_pattern, self.svg_content[:2000]):
            try:
                y = int(match.group(1))
                text_content = match.group(2).strip()
                if y < 50 and len(text_content) > 5:  # Likely a title
                    # Check for pipe character (indicates wrong format)
                    if '|' in text_content:
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="TITLE-001",
                            message=f"Title contains '|' - use human-readable format: '{text_content[:50]}...'"
                        ))
                    # Check for "Page X of Y"
                    if 'Page' in text_content and 'of' in text_content:
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="TITLE-002",
                            message="Remove 'Page X of Y' from title"
                        ))
                    # Check centering - search within the text element, not before it
                    tag_start = self.svg_content.rfind('<text', 0, match.start())
                    if tag_start != -1:
                        text_element = self.svg_content[tag_start:match.end()]
                        if 'text-anchor="middle"' not in text_element and 'text-anchor:middle' not in text_element:
                            self.issues.append(Issue(
                                severity="ERROR",
                                code="TITLE-003",
                                message="Title must be centered (text-anchor='middle')"
                            ))
                    break
            except (ValueError, TypeError):
                continue

    def _check_section_labels(self):
        """SECTION-001/002: Must have DESKTOP and MOBILE section labels."""
        # Look for section labels at y ~52 (just below title)
        has_desktop_label = bool(re.search(r'DESKTOP.*?y=["\']?5[0-9]', self.svg_content[:4000], re.DOTALL) or
                                  re.search(r'y=["\']?5[0-9]["\']?.*?>.*?DESKTOP', self.svg_content[:4000], re.DOTALL))
        has_mobile_label = bool(re.search(r'MOBILE.*?y=["\']?5[0-9]', self.svg_content, re.DOTALL) or
                                 re.search(r'y=["\']?5[0-9]["\']?.*?>.*?MOBILE', self.svg_content, re.DOTALL))

        if not has_desktop_label:
            self.issues.append(Issue(
                severity="ERROR",
                code="SECTION-001",
                message="Missing DESKTOP section label (e.g., 'DESKTOP (16:9)' at y=52)"
            ))
        if not has_mobile_label:
            self.issues.append(Issue(
                severity="ERROR",
                code="SECTION-002",
                message="Missing MOBILE section label"
            ))

    def _check_clutter(self):
        """CLUTTER-001/002/003: No Legend/Coverage/Integration rows."""
        if 'Legend:' in self.svg_content:
            self.issues.append(Issue(
                severity="ERROR",
                code="CLUTTER-001",
                message="Remove 'Legend:' row - badge colors are self-explanatory"
            ))
        if 'Coverage:' in self.svg_content:
            self.issues.append(Issue(
                severity="ERROR",
                code="CLUTTER-002",
                message="Remove 'Coverage:' row - internal tracking, not wireframe content"
            ))
        if 'Integration:' in self.svg_content:
            self.issues.append(Issue(
                severity="ERROR",
                code="CLUTTER-003",
                message="Remove 'Integration:' row - shows nothing visual"
            ))

    def _check_callout_coverage(self):
        """CALLOUT-002: Mockup must illustrate ALL annotation concepts."""
        if 'id="annotations"' not in self.svg_content:
            return  # No annotation panel to check

        # Count callouts on mockups (before annotations section)
        annotation_start = self.annotation_start
        mockup_section = self.mockup_section
        mockup_callouts = len(re.findall(r'<circle[^>]*fill=["\']?#dc2626["\']?', mockup_section))

        # Count callouts in annotation panel
        annotation_section = self.svg_content[annotation_start:]
        annotation_callouts = len(re.findall(r'<circle[^>]*fill=["\']?#dc2626["\']?', annotation_section))

        if mockup_callouts < annotation_callouts:
            missing = annotation_callouts - mockup_callouts
            self.issues.append(Issue(
                severity="ERROR",
                code="CALLOUT-002",
                message=f"Mockup missing {missing} callout circles (annotation has {annotation_callouts} concepts, mockup only illustrates {mockup_callouts})"
            ))

    def _check_button_fills(self):
        """BTN-001: Buttons should have solid fill colors, not faded/transparent.

        Valid button colors per G-035:
        - Primary: #8b5cf6 (violet)
        - Secondary: #f5f0e6 (cream)
        - Tertiary: #dcc8a8 (tan)

        Invalid:
        - #e8d4b8 (panel parchment - blends with background)
        - none/transparent
        """
        # Only flag panel background color - buttons disappear against it
        # Note: #dcc8a8 is VALID for tertiary buttons, don't flag it
        faded_colors = ['#e8d4b8']
        transparent_values = ['none', 'transparent']

        # Find button-sized rects (width 80-300, height 35-60)
        button_pattern = r'<rect[^>]*width=["\']?(\d+)["\']?[^>]*height=["\']?(\d+)["\']?[^>]*fill=["\']?([^"\'>\s]+)'
        alt_pattern = r'<rect[^>]*fill=["\']?([^"\'>\s]+)["\']?[^>]*width=["\']?(\d+)["\']?[^>]*height=["\']?(\d+)'

        for pattern in [button_pattern, alt_pattern]:
            for match in re.finditer(pattern, self.svg_content):
                try:
                    if pattern == button_pattern:
                        width = int(match.group(1))
                        height = int(match.group(2))
                        fill = match.group(3).lower()
                    else:
                        fill = match.group(1).lower()
                        width = int(match.group(2))
                        height = int(match.group(3))

                    # Check if this looks like a button (reasonable dimensions)
                    if 80 <= width <= 300 and 35 <= height <= 60:
                        if fill in faded_colors:
                            line_num = self._get_line_number(match.start())
                            self.issues.append(Issue(
                                severity="ERROR",
                                code="BTN-001",
                                message=f"Button uses panel background color ({fill}) - use solid fill for prominence",
                                line=line_num
                            ))
                        elif fill in transparent_values:
                            line_num = self._get_line_number(match.start())
                            self.issues.append(Issue(
                                severity="ERROR",
                                code="BTN-001",
                                message=f"Button has transparent fill ({fill}) - buttons must have solid fills",
                                line=line_num
                            ))
                except (ValueError, TypeError):
                    continue

    def _check_signature(self):
        """SIGNATURE-001/002/003/004: Signature must be 18px+, bold, left-aligned, correct format."""
        # Find signature (y > 1040)
        sig_pattern = r'<text[^>]*y=["\']?(10[4-9]\d|1[1-9]\d\d)["\']?[^>]*'
        match = re.search(sig_pattern, self.svg_content)
        if match:
            sig_element = match.group()
            # Check font size
            size_match = re.search(r'font-size=["\']?(\d+)', sig_element)
            if size_match:
                font_size = int(size_match.group(1))
                if font_size < 18:
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="SIGNATURE-001",
                        message=f"Signature font too small ({font_size}px) - use 18px"
                    ))
            # Check for bold
            if 'font-weight="bold"' not in sig_element and 'font-weight:bold' not in sig_element:
                self.issues.append(Issue(
                    severity="ERROR",
                    code="SIGNATURE-002",
                    message="Signature must be bold"
                ))
            # Check for left-alignment (x="40", NOT centered)
            x_match = re.search(r'\bx=["\']?(\d+)', sig_element)
            if x_match:
                x_pos = int(x_match.group(1))
                if x_pos != 40:
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="SIGNATURE-003",
                        message=f"Signature must be left-aligned at x=40, got x={x_pos}"
                    ))
            if 'text-anchor="middle"' in sig_element or 'text-anchor:middle' in sig_element:
                self.issues.append(Issue(
                    severity="ERROR",
                    code="SIGNATURE-003",
                    message="Signature must NOT use text-anchor=\"middle\" - use left-alignment at x=40"
                ))
        # Check signature format (SIGNATURE-004)
        # Find the text content of signature element
        sig_text_pattern = r'<text[^>]*y=["\']?(10[4-9]\d|1[1-9]\d\d)["\']?[^>]*>([^<]+)</text>'
        text_match = re.search(sig_text_pattern, self.svg_content)
        if text_match:
            sig_text = text_match.group(2).strip()
            # Must match format: NNN:NN | Feature Name | ScriptHammer
            valid_format = re.match(r'^\d{3}:\d{2}\s*\|\s*.+\s*\|\s*ScriptHammer$', sig_text)
            if not valid_format:
                self.issues.append(Issue(
                    severity="ERROR",
                    code="SIGNATURE-004",
                    message=f"Signature format wrong: '{sig_text[:40]}...' - must be 'NNN:NN | Feature Name | ScriptHammer'"
                ))

    def _check_annotation_spacing(self):
        """LAYOUT-002: Annotation panel must not clip into signature."""
        # Find annotation panel position
        ann_pattern = r'id="annotations"[^>]*transform="translate\(\s*\d+\s*,\s*(\d+)'
        match = re.search(ann_pattern, self.svg_content)
        if match:
            ann_y = int(match.group(1))
            # Find annotation panel height
            # Look for first rect after id="annotations"
            start_pos = match.end()
            height_match = re.search(r'<rect[^>]*height=["\']?(\d+)', self.svg_content[start_pos:start_pos+500])
            if height_match:
                ann_height = int(height_match.group(1))
                ann_bottom = ann_y + ann_height
                if ann_bottom > 1020:  # Needs 40px gap to signature at 1060
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="LAYOUT-002",
                        message=f"Annotation panel clips into signature area (ends at y={ann_bottom}, need gap before y=1040)"
                    ))

    # ============================================================
    # v4 CHECKS (User Story support - 2026-01-11)
    # ============================================================

    def _check_user_story_coverage(self):
        """US-001/002: Check that User Story badges are present in annotations.

        Each annotation group should be anchored by a User Story (US-XXX).
        User Stories provide the narrative context that makes wireframes meaningful.
        """
        if 'id="annotations"' not in self.svg_content:
            return  # No annotation panel to check

        annotation_section = self.annotation_section
        us_badges = re.findall(r'US-\d{3}', annotation_section)
        unique_us = set(us_badges)

        if len(unique_us) == 0:
            self.issues.append(Issue(
                severity="ERROR",
                code="US-001",
                message="No User Story badges found in annotation panel - each group should be anchored by a US"
            ))
        elif len(unique_us) < 3:
            self.issues.append(Issue(
                severity="ERROR",
                code="US-002",
                message=f"Only {len(unique_us)} User Story badges found - need at least 3 User Stories"
            ))

    # ============================================================
    # v5 CHECKS (Design principle validation - 2026-01-12)
    # ============================================================

    def _check_modal_overlay(self):
        """MODAL-001: Modals must have DARK dimmed background overlay.

        A modal should have a semi-transparent DARK overlay behind it to dim the
        background content. Using the same light color (e.g., parchment) with
        opacity is not a proper modal overlay - it should be dark grey/black.

        MODAL-001 FIX (2026-01-16): Added PAGE vs MODAL detection to prevent
        false positives on settings pages that contain modal-related keywords.
        """
        # STEP 1: Check if this is a PAGE, not a modal
        # Pages have these indicators in the title or filename
        page_indicators = ['settings', 'dashboard', 'policy', 'page', 'profile', 'account', 'management']
        svg_lower = self.svg_content.lower()
        filename_lower = str(self.svg_path).lower() if self.svg_path else ''

        # Check title text (first 500 chars typically contains the centered title)
        title_section = svg_lower[:2000]
        is_page = any(indicator in filename_lower for indicator in page_indicators)

        # Check for page title patterns like "PRIVACY SETTINGS" or "ACCOUNT MANAGEMENT"
        if not is_page:
            for indicator in page_indicators:
                # Look for indicator in title context (near y="28" which is the title position)
                if f'>{indicator}' in title_section or f' {indicator}' in title_section:
                    is_page = True
                    break

        # Additional page indicator: has footer include (modals don't have footers)
        has_footer = 'footer-desktop.svg' in svg_lower or 'footer-mobile.svg' in svg_lower

        # STEP 2: Look for modal-like structures
        modal_indicators = ['modal', 'dialog', 'consent', 'Cookie Preferences', 'Privacy Preferences']
        has_modal_keyword = any(indicator.lower() in svg_lower for indicator in modal_indicators)

        # Strong modal indicator: title contains "MODAL" or "DIALOG"
        is_explicit_modal = 'modal' in title_section or 'dialog' in title_section

        # If it's a page (not an explicit modal), skip the modal overlay check
        # Pages can have modal-related content (like "cookie consent settings") without being modals
        if is_page and not is_explicit_modal:
            return  # This is a page, not a modal - skip overlay check

        if not has_modal_keyword:
            return  # No modal to check

        # Check for DARK overlay: must be a dark color with transparency
        # More flexible patterns to catch various SVG attribute orderings
        dark_overlay_patterns = [
            r'fill=["\']?rgba\s*\(\s*0\s*,\s*0\s*,\s*0',  # rgba(0,0,0,...)
            r'fill=["\']?#000["\']?',  # #000
            r'fill=["\']?#000000["\']?',  # #000000
            r'fill=["\']?black["\']?',  # black
            r'opacity=["\']?0\.[3-6]["\']?[^>]*fill=["\']?#000',  # opacity before fill
        ]

        # Also check for rect with dark fill AND opacity attribute nearby
        dark_rect_pattern = r'<rect[^>]*fill=["\']?#000(?:000)?["\']?[^>]*opacity=["\']?0\.[3-6]'
        dark_rect_alt = r'<rect[^>]*opacity=["\']?0\.[3-6]["\']?[^>]*fill=["\']?#000'

        has_dark_overlay = (
            any(re.search(p, self.svg_content, re.IGNORECASE) for p in dark_overlay_patterns) or
            re.search(dark_rect_pattern, self.svg_content, re.IGNORECASE) or
            re.search(dark_rect_alt, self.svg_content, re.IGNORECASE)
        )

        # Check for light/parchment colors used as "overlay" - this is wrong
        # Parchment colors: #e8d4b8, #dcc8a8, #f5f0e6 - all start with d, e, or f
        light_overlay_pattern = r'fill=["\']?#[d-fD-F][0-9a-fA-F]{5}["\']?[^>]*opacity=["\']?0\.[3-9]'
        has_light_overlay = re.search(light_overlay_pattern, self.svg_content, re.IGNORECASE)

        if has_light_overlay:
            self.issues.append(Issue(
                severity="ERROR",
                code="MODAL-001",
                message="Modal uses light-colored overlay - use dark grey/black (rgba(0,0,0,0.5)) for proper dimming"
            ))
        elif not has_dark_overlay:
            self.issues.append(Issue(
                severity="ERROR",
                code="MODAL-001",
                message="Modal detected but no dimmed background overlay found (use semi-transparent dark rect behind modal)"
            ))

    def _check_callout_positioning(self):
        """CALLOUT-003: Callouts should be positioned after (right/below) elements, not on top.

        Callouts are supporting annotations - they should not obscure or compete
        with the UI elements they're explaining.

        NOTE: Coordinates are relative within transform groups (desktop/mobile).
        We only check callouts against buttons in the SAME viewport group.
        """
        # Find all callout positions in the mockup areas (not annotation panel)
        if 'id="annotations"' in self.svg_content:
            mockup_section = self.mockup_section
        else:
            mockup_section = self.svg_content

        # Extract desktop and mobile sections separately to handle transforms correctly
        desktop_start = mockup_section.find('id="desktop"')
        mobile_start = mockup_section.find('id="mobile"')

        # If no clear sections, skip this check (too complex to analyze)
        if desktop_start == -1 and mobile_start == -1:
            return

        def check_viewport_section(section_content: str, section_offset: int):
            """Check callouts within a single viewport section."""
            callout_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?[^>]*>'

            # Collect actual BUTTONS in this section (not panels/cards)
            # Buttons: small rounded rects (rx=4-8) with typical button dimensions
            # Width 60-200px, height 25-50px (not large panels)
            buttons = []
            for match in re.finditer(r'<rect[^>]*>', section_content):
                rect_str = match.group()
                # Check if this looks like a button (has rx=4-8)
                rx_match = re.search(r'rx=["\']?([4-8])["\']?', rect_str)
                if not rx_match:
                    continue
                # Extract coordinates
                x_match = re.search(r'\bx=["\']?(\d+)', rect_str)
                y_match = re.search(r'\by=["\']?(\d+)', rect_str)
                w_match = re.search(r'width=["\']?(\d+)', rect_str)
                h_match = re.search(r'height=["\']?(\d+)', rect_str)
                if x_match and y_match and w_match and h_match:
                    w = int(w_match.group(1))
                    h = int(h_match.group(1))
                    # Only consider button-sized elements (not panels/cards)
                    if 60 <= w <= 200 and 25 <= h <= 50:
                        buttons.append({
                            'x': int(x_match.group(1)),
                            'y': int(y_match.group(1)),
                            'w': w,
                            'h': h
                        })

            # Check callouts against buttons in this section only
            for match in re.finditer(callout_pattern, section_content):
                callout_str = match.group()
                cx_match = re.search(r'cx=["\']?(\d+)', callout_str)
                cy_match = re.search(r'cy=["\']?(\d+)', callout_str)
                if not cx_match or not cy_match:
                    continue
                cx, cy = int(cx_match.group(1)), int(cy_match.group(1))

                for btn in buttons:
                    if btn['x'] <= cx <= btn['x'] + btn['w'] and btn['y'] <= cy <= btn['y'] + btn['h']:
                        line_num = self._get_line_number(section_offset + match.start())
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="CALLOUT-003",
                            message=f"Callout at ({cx},{cy}) overlaps button at ({btn['x']},{btn['y']}) - place after (right/below) instead",
                            line=line_num
                        ))
                        break

        # Check desktop section if present
        if desktop_start != -1:
            desktop_end = mobile_start if mobile_start > desktop_start else len(mockup_section)
            desktop_section = mockup_section[desktop_start:desktop_end]
            check_viewport_section(desktop_section, desktop_start)

        # Check mobile section if present
        if mobile_start != -1:
            mobile_section = mockup_section[mobile_start:]
            check_viewport_section(mobile_section, mobile_start)

    def _check_annotation_columns(self):
        """ANN-003: Annotation text must stay within column boundaries.

        The annotation panel uses a 4-column grid:
        - Column 1: x=20 to x=470
        - Column 2: x=470 to x=920
        - Column 3: x=920 to x=1370
        - Column 4: x=1370 to x=1820
        """
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        annotation_section = self.svg_content[annotation_start:]

        # Find text elements with x positions
        text_pattern = r'<text[^>]*x=["\']?(\d+)["\']?[^>]*>([^<]*)</text>'

        for match in re.finditer(text_pattern, annotation_section):
            try:
                x = int(match.group(1))
                text_content = match.group(2)[:30]  # First 30 chars

                # Estimate text width (rough: 8px per char for 14px font)
                estimated_width = len(match.group(2)) * 8
                text_end = x + estimated_width

                # Check if text fits within any column
                fits_column = False
                for col_start, col_end in ANNOTATION_COLUMNS:
                    if x >= col_start and text_end <= col_end:
                        fits_column = True
                        break

                # Only warn if text is clearly outside all columns and long enough to matter
                if not fits_column and estimated_width > 100:
                    # Check if it's just starting in a valid column
                    in_valid_start = any(col_start <= x < col_end for col_start, col_end in ANNOTATION_COLUMNS)
                    if in_valid_start and text_end > ANNOTATION_COLUMNS[-1][1]:
                        line_num = self._get_line_number(annotation_start + match.start())
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="ANN-003",
                            message=f"Text overflows column boundary: '{text_content}...' (x={x}, est. end={text_end})",
                            line=line_num
                        ))
            except (ValueError, TypeError):
                continue

    def _check_annotation_containment(self):
        """ANN-004: All annotation content must fit within panel bounds.

        Panel is 1840w × 220h at translate(40, 800).
        Content should not extend beyond x=1840 or y=220 (relative to panel).
        """
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        annotation_section = self.svg_content[annotation_start:]

        # Find the closing </g> of the annotation group (handle nested groups)
        depth = 1  # We start inside the annotation <g>
        pos = 0
        annotation_group = None  # Initialize to handle early break
        # Skip past the opening <g> tag
        first_gt = annotation_section.find('>')
        if first_gt == -1:
            return
        pos = first_gt + 1

        while depth > 0 and pos < len(annotation_section):
            next_open = annotation_section.find('<g', pos)
            next_close = annotation_section.find('</g>', pos)

            if next_close == -1:
                break  # Malformed SVG

            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 2
            else:
                depth -= 1
                if depth == 0:
                    annotation_group = annotation_section[:next_close]
                    break
                pos = next_close + 4
        else:
            # Fallback to first 5000 chars if parsing fails
            annotation_group = annotation_section[:5000]

        # If annotation_group wasn't assigned (malformed SVG), skip containment check
        if annotation_group is None:
            return

        # Check for elements with positions beyond bounds
        x_pattern = r'x=["\']?(\d+)["\']?'
        y_pattern = r'y=["\']?(\d+)["\']?'

        # Find all x values within annotation group only
        for match in re.finditer(x_pattern, annotation_group):
            try:
                x = int(match.group(1))
                if x > ANNOTATION_PANEL_MAX_X:
                    line_num = self._get_line_number(annotation_start + match.start())
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="ANN-004",
                        message=f"Content extends beyond annotation panel (x={x} > {ANNOTATION_PANEL_MAX_X})",
                        line=line_num
                    ))
            except ValueError:
                continue

        # Find all y values within annotation group only
        for match in re.finditer(y_pattern, annotation_group):
            try:
                y = int(match.group(1))
                if y > ANNOTATION_PANEL_MAX_Y:
                    line_num = self._get_line_number(annotation_start + match.start())
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="ANN-004",
                        message=f"Content extends beyond annotation panel (y={y} > {ANNOTATION_PANEL_MAX_Y})",
                        line=line_num
                    ))
            except ValueError:
                continue

    def _check_section_separation(self):
        """ANN-005: UI Elements section must be at bottom of annotation panel.

        The annotation panel layout:
        - Row 1 (y=20): Callout groups ①②③④
        - Row 2 (y=90): More callout groups ⑤⑥⑦⑧
        - Bottom (y≥150): UI Elements or similar summary sections

        If "UI Elements" is at y < 140, it's too close to the callouts.
        """
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        annotation_section = self.svg_content[annotation_start:]

        # Check for "UI Elements" or similar sections positioned too high
        section_indicators = ['UI Elements', 'Summary', 'Notes']

        for indicator in section_indicators:
            if indicator not in annotation_section:
                continue

            # Find the y position of this section
            # Look for pattern: "UI Elements" followed by text element with y attribute
            pattern = rf'{re.escape(indicator)}[^<]*</text>|<text[^>]*>.*?{re.escape(indicator)}'
            match = re.search(pattern, annotation_section)

            if match:
                # Get context around the match to find y value
                start = max(0, match.start() - 100)
                end = min(len(annotation_section), match.end() + 50)
                context = annotation_section[start:end]

                y_match = re.search(r'y=["\']?(\d+)', context)
                if y_match:
                    y = int(y_match.group(1))
                    if y < 140:
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="ANN-005",
                            message=f"'{indicator}' section at y={y} is too close to callouts - move to y>=150 for visual separation"
                        ))

    # ============================================================
    # v6 CHECKS (G-019, G-020, G-021 - 2026-01-12)
    # ============================================================

    def _check_annotation_group_spacing(self):
        """G-020: Annotation groups need 20px vertical gap between each."""
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        annotation_section = self.svg_content[annotation_start:]

        # Find callout circles in annotation panel (they mark group starts)
        circle_pattern = r'<circle[^>]*cy=["\']?(\d+)["\']?[^>]*fill=["\']?#dc2626'
        alt_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?[^>]*cy=["\']?(\d+)'

        y_positions = []
        for pattern in [circle_pattern, alt_pattern]:
            for match in re.finditer(pattern, annotation_section[:3000]):
                try:
                    y = int(match.group(1))
                    if y not in y_positions:
                        y_positions.append(y)
                except ValueError:
                    continue

        y_positions.sort()

        # Check gaps between consecutive groups on same row
        for i in range(1, len(y_positions)):
            gap = y_positions[i] - y_positions[i-1]
            # Groups on same row should have same y; different rows should be 70+ apart
            if 0 < gap < 60:
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-020",
                    message=f"Annotation groups too close: y={y_positions[i-1]} to y={y_positions[i]} (gap={gap}px, need 70px between rows)"
                ))

    def _check_footer_paint_order(self):
        """G-021: Footer <use> must come AFTER modal content in SVG order."""
        # Only relevant if there's a modal
        modal_indicators = ['modal', 'dialog', 'consent', 'opacity="0.5"', 'opacity="0.4"']
        has_modal = any(indicator in self.svg_content.lower() for indicator in modal_indicators)

        if not has_modal:
            return

        # Find positions of footer reference and modal overlay
        footer_match = re.search(r'<use[^>]*footer-desktop\.svg', self.svg_content)
        overlay_match = re.search(r'<rect[^>]*opacity=["\']?0\.[3-6]', self.svg_content)

        if footer_match and overlay_match:
            footer_pos = footer_match.start()
            overlay_pos = overlay_match.start()

            if footer_pos < overlay_pos:
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-021",
                    message="Footer <use> appears BEFORE modal overlay - will be hidden. Move footer after modal content."
                ))

    # ============================================================
    # v7 CHECKS (G-022 to G-029 - 2026-01-12)
    # ============================================================

    def _check_background_gradient(self):
        """G-022: Canvas must have blue gradient background, not solid parchment."""
        has_gradient = 'linearGradient' in self.svg_content and '#c7ddf5' in self.svg_content
        has_gradient_ref = 'fill="url(#bg)"' in self.svg_content or "fill='url(#bg)'" in self.svg_content

        if not has_gradient:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-022",
                message="Missing background gradient. Add linearGradient with #c7ddf5 → #b8d4f0"
            ))
        elif not has_gradient_ref:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-022",
                message="Background gradient defined but not used. Add fill=\"url(#bg)\" to background rect"
            ))

    def _check_title_exists(self):
        """G-024: Must have centered title at y < 40."""
        # Look for text element with y < 40 and text-anchor="middle"
        title_pattern = r'<text[^>]*text-anchor=["\']middle["\'][^>]*y=["\']?(\d+)["\']?'
        alt_pattern = r'<text[^>]*y=["\']?(\d+)["\']?[^>]*text-anchor=["\']middle["\']'

        found_title = False
        for pattern in [title_pattern, alt_pattern]:
            match = re.search(pattern, self.svg_content[:2000])
            if match:
                y = int(match.group(1))
                if y < 40:
                    found_title = True
                    break

        if not found_title:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-024",
                message="Missing centered title block at y=28. Add text-anchor=\"middle\" title."
            ))

    def _check_signature_exists(self):
        """G-025: Must have signature at y > 1040."""
        # Look for text element with y > 1040
        sig_pattern = r'<text[^>]*y=["\']?(10[4-9]\d|1[1-9]\d\d)["\']?'
        match = re.search(sig_pattern, self.svg_content)

        if not match:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-025",
                message="Missing signature block at y=1060. Add 18px bold signature."
            ))

    def _check_callouts_on_mockups(self):
        """G-026: Red numbered callout circles must appear on mockup UI, not just annotation panel."""
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        mockup_section = self.mockup_section

        # Count red callout circles in mockup area
        callout_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?'
        mockup_callouts = len(re.findall(callout_pattern, mockup_section))

        if mockup_callouts < 2:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-026",
                message=f"Only {mockup_callouts} callout circles on mockups. Need numbered callouts (①②③④) ON the UI elements."
            ))

    def _check_mobile_content_position(self):
        """MOBILE-001 / G-034: Mobile content must not overlap header area.

        Mobile mockup header (header-mobile.svg) occupies y=0 to y=78.
        First content element should be at y >= 78.
        """
        # Find mobile group
        mobile_match = re.search(
            r'<g[^>]*id=["\']mobile["\'][^>]*>',
            self.svg_content
        )
        if not mobile_match:
            return  # No mobile mockup

        # Find content after header include
        mobile_start = mobile_match.end()
        # Look for header include
        header_pattern = r'<use[^>]*header-mobile\.svg[^>]*/>'
        header_match = re.search(header_pattern, self.svg_content[mobile_start:])

        if not header_match:
            return  # No header include found

        content_start = mobile_start + header_match.end()

        # Find first content element (rect, text, or nested group with y attribute)
        first_element = re.search(
            r'<(rect|text|g)[^>]*\sy=["\']?(\d+)',
            self.svg_content[content_start:content_start + 2000]
        )

        if first_element:
            element_y = int(first_element.group(2))
            if element_y < MOBILE_CONTENT_MIN_Y:
                line_num = self._get_line_number(content_start + first_element.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="MOBILE-001",
                    message=f"Mobile content y={element_y} overlaps header zone (must be y >= {MOBILE_CONTENT_MIN_Y})",
                    line=line_num,
                    element=first_element.group(0)[:60]
                ))

    # ============================================================
    # v9 CHECKS (G-036, G-037 - 2026-01-12)
    # ============================================================

    def _check_badge_containment(self):
        """G-036: Badge/pill must not overflow container boundaries.

        Badges are small rounded rects (rx=4) used for FR/SC/US labels.
        Desktop mockup ends at x=1320 (40 + 1280), mobile at x=1720 (1360 + 360).
        Annotation panel ends at x=1880 (40 + 1840).
        """
        # Badge pattern: small rounded rect with rx=4
        badge_pattern = r'<rect[^>]*rx=["\']?4["\']?[^>]*>'

        for match in re.finditer(badge_pattern, self.svg_content):
            rect_str = match.group()

            # Skip if this looks like a toggle (toggles have rx >= 10, not 4)
            if 'width="4' in rect_str or 'width="5' in rect_str:
                continue  # Too narrow to be a badge

            # Extract x and width
            x_match = re.search(r'\bx=["\']?(\d+)', rect_str)
            w_match = re.search(r'width=["\']?(\d+)', rect_str)

            if not x_match or not w_match:
                continue

            try:
                x = int(x_match.group(1))
                w = int(w_match.group(1))
                right = x + w

                # Determine which container this badge is in
                if x < 1360:  # Desktop mockup or annotation panel
                    if x < 40:  # Outside canvas
                        continue
                    # Check if in annotation panel (y > 800) vs mockup
                    y_match = re.search(r'\by=["\']?(\d+)', rect_str)
                    if y_match:
                        y = int(y_match.group(1))
                        if y > 800:  # Annotation panel
                            if right > ANNOTATION_PANEL_RIGHT:
                                line_num = self._get_line_number(match.start())
                                self.issues.append(Issue(
                                    severity="ERROR",
                                    code="G-036",
                                    message=f"Badge at x={x} overflows annotation panel (right edge {right} > {ANNOTATION_PANEL_RIGHT})",
                                    line=line_num
                                ))
                        else:  # Desktop mockup
                            if right > DESKTOP_MOCKUP_RIGHT:
                                line_num = self._get_line_number(match.start())
                                self.issues.append(Issue(
                                    severity="ERROR",
                                    code="G-036",
                                    message=f"Badge at x={x} overflows desktop mockup (right edge {right} > {DESKTOP_MOCKUP_RIGHT})",
                                    line=line_num
                                ))
                else:  # Mobile mockup area (x >= 1360)
                    if right > MOBILE_MOCKUP_RIGHT:
                        line_num = self._get_line_number(match.start())
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="G-036",
                            message=f"Badge at x={x} overflows mobile mockup (right edge {right} > {MOBILE_MOCKUP_RIGHT})",
                            line=line_num
                        ))
            except (ValueError, TypeError):
                continue

    def _check_annotation_text_readability(self):
        """G-037: Annotation text must be readable (bold titles, adequate contrast).

        Annotation panel titles (numbered ①②③④) must be bold for visual hierarchy.
        All annotation text should use dark colors (#1f2937, #374151) not light grey.
        """
        if 'id="annotations"' not in self.svg_content:
            return

        annotation_start = self.annotation_start
        annotation_section = self.svg_content[annotation_start:]

        # Find numbered annotation titles (①②③④⑤⑥⑦⑧⑨⑩)
        # These should have font-weight="bold"
        circled_nums = '[①②③④⑤⑥⑦⑧⑨⑩]'
        title_pattern = rf'<text[^>]*>({circled_nums}[^<]*)</text>'

        for match in re.finditer(title_pattern, annotation_section):
            text_content = match.group(1)
            text_element = match.group(0)

            # Check for bold
            if 'font-weight="bold"' not in text_element and 'font-weight:bold' not in text_element:
                line_num = self._get_line_number(annotation_start + match.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-037",
                    message=f"Annotation title not bold: '{text_content[:30]}...' - add font-weight=\"bold\"",
                    line=line_num
                ))

        # Check for light/faded text colors in annotation panel
        # Light colors that are hard to read: #9ca3af, #d1d5db, #e5e7eb
        light_colors = ['#9ca3af', '#d1d5db', '#e5e7eb', '#6b7280']
        text_color_pattern = r'<text[^>]*fill=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]+)</text>'

        for match in re.finditer(text_color_pattern, annotation_section):
            fill = match.group(1).lower()
            text_content = match.group(2)[:20]

            if fill in light_colors:
                line_num = self._get_line_number(annotation_start + match.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-037",
                    message=f"Annotation text uses light color {fill}: '{text_content}...' - use #374151 or darker",
                    line=line_num
                ))

    def _check_footer_nav_corners(self):
        """G-044: Footer and bottom nav containers must have rounded corners (rx).

        Checks for rect elements in footer/nav areas that are missing rx attribute.
        Both desktop footer and mobile bottom nav should have rx="4-8".
        """
        # Find desktop footer rects (within desktop mockup, y near bottom ~640-720 relative to desktop group)
        # Desktop group is at transform="translate(40, 60)" so absolute y would be 700-780
        # Look for rects with large width (footer-like) in the y=640-780 range
        desktop_footer_pattern = r'<rect[^>]*\by=["\']?(6[4-9]\d|7[0-7]\d)["\']?[^>]*width=["\']?(1[0-2]\d\d)["\']?[^>]*'
        for match in re.finditer(desktop_footer_pattern, self.svg_content):
            rect_element = match.group(0)
            # Check if rx attribute is present
            if 'rx=' not in rect_element:
                line_num = self._get_line_number(match.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-044",
                    message="Desktop footer missing rounded corners - add rx=\"4\" or rx=\"8\"",
                    line=line_num
                ))

        # Find mobile bottom nav rects (within mobile mockup area x >= 1360)
        # Mobile nav is at bottom of 720px viewport, so y ~= 664-720
        # Look for nav bar pattern: rect at bottom of mobile with width ~360
        mobile_nav_pattern = r'<rect[^>]*\by=["\']?(66[4-9]|6[7-9]\d|7[0-1]\d)["\']?[^>]*width=["\']?(3[4-6]\d)["\']?[^>]*'
        for match in re.finditer(mobile_nav_pattern, self.svg_content):
            rect_element = match.group(0)
            # Check if rx attribute is present
            if 'rx=' not in rect_element:
                line_num = self._get_line_number(match.start())
                self.issues.append(Issue(
                    severity="ERROR",
                    code="G-044",
                    message="Mobile bottom nav missing rounded corners - add rx=\"4\" or rx=\"8\"",
                    line=line_num
                ))


# ============================================================
# ISSUE LOGGER - Auto-logs to feature-specific .issues.md files
# ============================================================

class IssueLogger:
    """Logs validation issues to feature-specific .issues.md files.

    Issues are logged per-feature first. Only escalate to GENERAL_ISSUES.md
    when the same issue code appears in 2+ different features.
    """

    def __init__(self, wireframes_dir: Path):
        self.wireframes_dir = wireframes_dir
        self.general_issues_path = wireframes_dir / "GENERAL_ISSUES.md"

    def get_issues_file_path(self, svg_path: Path) -> Path:
        """Get the .issues.md file path for an SVG."""
        svg_name = svg_path.stem  # e.g., "01-consent-modal-flow"
        return svg_path.parent / f"{svg_name}.issues.md"

    def log_issues(self, svg_path: Path, issues: List[Issue]) -> None:
        """Log issues to the feature-specific .issues.md file."""
        if not issues:
            return

        issues_file = self.get_issues_file_path(svg_path)
        feature_name = svg_path.parent.name  # e.g., "002-cookie-consent"
        svg_name = svg_path.name
        today = date.today().isoformat()

        # Categorize issues
        categories: Dict[str, List[Issue]] = {}
        for issue in issues:
            # Determine category from issue code prefix
            code = issue.code
            if code.startswith('S-') or code.startswith('G-02'):
                cat = "Structure Issues"
            elif code.startswith('MODAL'):
                cat = "Modal Issues"
            elif code.startswith('C-') or code.startswith('COLL'):
                cat = "Collision Issues"
            elif code.startswith('ANN') or code.startswith('A-'):
                cat = "Annotation Issues"
            elif code.startswith('FONT') or code.startswith('F-'):
                cat = "Font Issues"
            elif code.startswith('HDR'):
                cat = "Header/Footer Issues"
            elif code.startswith('BTN'):
                cat = "Button Issues"
            elif code.startswith('US-'):
                cat = "User Story Issues"
            elif code.startswith('TITLE') or code.startswith('SECTION'):
                cat = "Title/Section Issues"
            elif code.startswith('LAYOUT') or code == 'G-036':
                cat = "Layout Issues"
            elif code.startswith('CLUTTER'):
                cat = "Clutter Issues"
            elif code.startswith('VIS'):
                cat = "Visual Issues"
            elif code.startswith('MOBILE') or code.startswith('MOB'):
                cat = "Mobile Issues"
            elif code == 'G-037':
                cat = "Annotation Issues"
            else:
                cat = "Other Issues"

            if cat not in categories:
                categories[cat] = []
            categories[cat].append(issue)

        # Determine classification (PATCH vs REGENERATE)
        def classify_issue(code: str) -> str:
            """Determine if an issue is PATCH or REGENERATE."""
            # PATCH: localized fixes that don't require full regeneration
            patch_codes = ['C-', 'COLL', 'A-03', 'FONT-001', 'VIS-002', 'VIS-006']
            if any(code.startswith(p) for p in patch_codes):
                return "PATCH"
            return "REGENERATE"

        # Build markdown content
        lines = [
            f"# Issues: {svg_name}",
            "",
            f"**Feature:** {feature_name}",
            f"**SVG:** {svg_name}",
            f"**Last Review:** {today}",
            "**Validator:** v5.0",
            "",
            "---",
            "",
            "## Summary",
            "",
            "| Status | Count |",
            "|--------|-------|",
            f"| Open | {len(issues)} |",
            "",
            "---",
            "",
            f"## Open Issues ({today} Review)",
            "",
        ]

        for category, cat_issues in categories.items():
            lines.append(f"### {category}")
            lines.append("")
            lines.append("| ID | Issue | Code | Classification |")
            lines.append("|----|-------|------|----------------|")

            for i, issue in enumerate(cat_issues, 1):
                prefix = category[0] if category != "Other Issues" else "X"
                issue_id = f"{prefix}-{i:02d}"
                classification = classify_issue(issue.code)
                # Truncate message if too long
                msg = issue.message[:60] + "..." if len(issue.message) > 60 else issue.message
                lines.append(f"| {issue_id} | {msg} | {issue.code} | {classification} |")

            lines.append("")

        lines.extend([
            "---",
            "",
            "## Notes",
            "",
            "- Auto-generated by validator v5.0",
            f"- Run validator to refresh: `python validate-wireframe.py {feature_name}/{svg_name}`",
            "",
        ])

        # Write file
        issues_file.write_text("\n".join(lines))
        print(f"  Issues logged to: {issues_file.relative_to(self.wireframes_dir)}")

    def check_escalation(self) -> Dict[str, List[str]]:
        """Check all .issues.md files for patterns that should escalate.

        Returns dict of issue_code -> list of features where it appears.
        Filters out codes already documented in GENERAL_ISSUES.md.
        """
        pattern_occurrences: Dict[str, Set[str]] = {}

        # Load already-documented codes from GENERAL_ISSUES.md
        documented_codes = self._get_documented_codes()

        # Find all .issues.md files
        for issues_file in self.wireframes_dir.glob("**/*.issues.md"):
            if issues_file.name == "GENERAL_ISSUES.md":
                continue

            feature = issues_file.parent.name
            content = issues_file.read_text()

            # Extract validator codes from the Code column (4th column)
            # Codes look like: FONT-001, G-022, ANN-001, HDR-001, MODAL-001
            # Using \d{3} to match 3-digit codes and avoid matching auto-generated IDs (F-01, S-01)
            codes = re.findall(r'\| ([A-Z]+-\d{3}) \|', content)
            for code in codes:
                if code not in pattern_occurrences:
                    pattern_occurrences[code] = set()
                pattern_occurrences[code].add(feature)

        # Filter to codes appearing in 2+ features AND not already documented
        escalation_candidates = {
            code: list(features)
            for code, features in pattern_occurrences.items()
            if len(features) >= 2 and code not in documented_codes
        }

        return escalation_candidates

    def _get_documented_codes(self) -> Set[str]:
        """Extract validator codes already documented in GENERAL_ISSUES.md.

        Parses the history table for entries like "FONT-001 → G-010" and the
        Validator Trigger sections for codes like "BTN-001 fires when...".
        """
        documented = set()

        if not self.general_issues_path.exists():
            return documented

        content = self.general_issues_path.read_text()

        # Pattern 1: History entries like "FONT-001 → G-010" or "validator: FONT-001"
        escalated = re.findall(r'([A-Z]+-\d{3})\s*[→→]', content)
        documented.update(escalated)

        # Pattern 2: Validator trigger references like "BTN-001 fires" or "(validator: ANN-002)"
        validator_refs = re.findall(r'(?:validator:\s*)?([A-Z]+-\d{3})(?:\s+fires|\))', content)
        documented.update(validator_refs)

        # Pattern 3: Direct G-XXX entries map to their validator codes
        # G-031 -> COLL (callout placement), G-018 -> US (user story), G-024 -> TITLE
        code_mappings = {
            'COLL-001': 'G-031',  # Callout Must Not Block UI
            'US-002': 'G-018',    # User Story anchor
            'TITLE-003': 'G-024', # Title block
        }
        documented.update(code_mappings.keys())

        return documented


# ============================================================
# THEME ANALYSIS - Classify User Stories as Light (UX) or Dark (Backend)
# ============================================================

def classify_story(title: str, content: str) -> tuple:
    """Classify a user story as 'light' (UX) or 'dark' (backend).

    Returns (theme, matched_keywords) tuple.

    Algorithm:
    1. Strong UX indicators in body override everything (has visible UI)
    2. Strong backend keywords in title force dark (if no strong UX)
    3. Title keywords weighted 3x (title is authoritative)
    4. UX wins ties (if there's any UI, show it)
    """
    title_lower = title.lower()
    content_lower = content.lower()

    # Strong UX indicators - if in body, force light (these mean visible UI exists)
    STRONG_UX = ['modal', 'toggle', 'warning', 'indicator', 'strength', 'meter',
                 'feedback', 'i see', 'then i see', 'is warned', 'remember me']
    for kw in STRONG_UX:
        if kw in content_lower:
            return ('light', [kw])

    # Strong backend indicators - if in title AND no strong UX, force dark
    STRONG_BACKEND = ['rls', 'isolation', 'csrf', 'oauth', 'pre-commit', 'secret detection', 'injection', 'sanitiz']
    for kw in STRONG_BACKEND:
        if kw in title_lower:
            return ('dark', [kw])

    # Count matches with title weighting (3x for title)
    ux_title = [kw for kw in UX_KEYWORDS if kw in title_lower]
    ux_body = [kw for kw in UX_KEYWORDS if kw in content_lower]
    backend_title = [kw for kw in BACKEND_KEYWORDS if kw in title_lower]
    backend_body = [kw for kw in BACKEND_KEYWORDS if kw in content_lower]

    ux_score = len(ux_title) * 3 + len(ux_body)
    backend_score = len(backend_title) * 3 + len(backend_body)

    # Collect matched keywords for reporting
    ux_matches = list(set(ux_title + ux_body[:2]))[:3]
    backend_matches = list(set(backend_title + backend_body[:2]))[:3]

    # UX wins ties (if there's any visible UI, show it)
    if ux_score >= backend_score:
        return ('light', ux_matches)
    return ('dark', backend_matches)


def analyze_themes(spec_path: Path) -> dict:
    """Analyze spec.md and recommend themes per user story.

    Reads the spec file, extracts user stories, classifies each as
    light (UX) or dark (backend), and groups them into SVG assignments.
    """
    if not spec_path.exists():
        return {"error": f"Spec file not found: {spec_path}"}

    content = spec_path.read_text()

    # Extract feature name from path
    feature_name = spec_path.parent.name

    # Parse user stories - pattern: ### User Story N - Title (Priority: PX)
    us_pattern = r'### User Story (\d+) - ([^\(]+)\(Priority: (P\d)\)'
    us_matches = list(re.finditer(us_pattern, content))

    if not us_matches:
        return {
            "feature": feature_name,
            "error": "No user stories found in spec",
            "user_stories": [],
            "svg_assignments": []
        }

    user_stories = []
    light_stories = []
    dark_stories = []

    for i, match in enumerate(us_matches):
        us_num = int(match.group(1))
        us_title = match.group(2).strip()
        priority = match.group(3)

        # Get content until next user story or end of section
        start = match.end()
        if i + 1 < len(us_matches):
            end = us_matches[i + 1].start()
        else:
            # Find end of user stories section (next ## or ---)
            end_match = re.search(r'\n## |\n---', content[start:])
            end = start + end_match.start() if end_match else len(content)

        us_content = content[start:end]

        # Classify this user story
        theme, keywords = classify_story(us_title, us_content)

        story_info = {
            "id": f"US-{us_num:03d}",
            "title": us_title,
            "priority": priority,
            "theme": theme,
            "reason": ", ".join(keywords) if keywords else "default"
        }
        user_stories.append(story_info)

        if theme == 'light':
            light_stories.append(story_info)
        else:
            dark_stories.append(story_info)

    # Generate SVG assignments
    svg_assignments = []

    # Group light stories by related functionality
    if light_stories:
        # Simple grouping: all UX stories in one or two SVGs
        if len(light_stories) <= 4:
            svg_assignments.append({
                "file": "01-ux-overview.svg",
                "theme": "light",
                "stories": [s["id"] for s in light_stories]
            })
        else:
            # Split into multiple SVGs
            mid = len(light_stories) // 2
            svg_assignments.append({
                "file": "01-ux-primary.svg",
                "theme": "light",
                "stories": [s["id"] for s in light_stories[:mid]]
            })
            svg_assignments.append({
                "file": "02-ux-secondary.svg",
                "theme": "light",
                "stories": [s["id"] for s in light_stories[mid:]]
            })

    # Group dark stories into backend diagram
    if dark_stories:
        svg_assignments.append({
            "file": f"{len(svg_assignments)+1:02d}-backend-architecture.svg",
            "theme": "dark",
            "stories": [s["id"] for s in dark_stories]
        })

    return {
        "feature": feature_name,
        "user_stories": user_stories,
        "svg_assignments": svg_assignments,
        "summary": {
            "total": len(user_stories),
            "light": len(light_stories),
            "dark": len(dark_stories)
        }
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate-wireframe.py <svg-file-or-dir>")
        print("       python validate-wireframe.py --all")
        print("       python validate-wireframe.py --all --json")
        print("       python validate-wireframe.py --all --summary")
        print("       python validate-wireframe.py --check-escalation")
        print("       python validate-wireframe.py --analyze-themes <spec.md>")
        print("")
        print("Options:")
        print("  --json      Output validation results as JSON (for CI parsing)")
        print("  --summary   Output one-line pass/fail summary (for PR comments)")
        sys.exit(1)

    # Parse output format flags
    output_json = '--json' in sys.argv
    output_summary = '--summary' in sys.argv

    # Remove flags from argv for path processing
    args = [a for a in sys.argv[1:] if a not in ('--json', '--summary')]

    wireframes_dir = Path(__file__).parent
    logger = IssueLogger(wireframes_dir)

    # Ensure we have at least one argument after flag removal
    if not args:
        print("ERROR: No input specified. Use --all or provide an SVG path.")
        sys.exit(1)

    # Handle theme analysis mode
    if args[0] == '--analyze-themes':
        if len(args) < 2:
            print("ERROR: --analyze-themes requires a spec.md path")
            print("Usage: python validate-wireframe.py --analyze-themes features/.../spec.md")
            sys.exit(1)

        spec_path = Path(args[1])
        if not spec_path.is_absolute():
            # Try relative to wireframes dir, then cwd
            if (wireframes_dir / spec_path).exists():
                spec_path = wireframes_dir / spec_path
            elif (wireframes_dir.parent.parent.parent / spec_path).exists():
                # Relative to repo root (wireframes is 3 levels deep)
                spec_path = wireframes_dir.parent.parent.parent / spec_path
            else:
                spec_path = Path.cwd() / spec_path

        result = analyze_themes(spec_path)
        print(json.dumps(result, indent=2))
        sys.exit(0)

    # Handle escalation check mode
    if args[0] == '--check-escalation':
        print(f"\n{'='*60}")
        print("CHECKING FOR ESCALATION CANDIDATES")
        print('='*60)

        candidates = logger.check_escalation()

        if not candidates:
            print("\nNo escalation candidates found.")
            print("Issues must appear in 2+ features to escalate to GENERAL_ISSUES.md")
        else:
            print(f"\n{len(candidates)} issue codes found in 2+ features:")
            print("")
            for code, features in sorted(candidates.items()):
                print(f"  {code}: {', '.join(sorted(features))}")
            print("")
            print("ACTION: Add these to GENERAL_ISSUES.md if not already present.")

        sys.exit(0)

    # Standard validation mode
    if args[0] == '--all':
        svg_files = list(wireframes_dir.glob('**/*.svg'))
        # Exclude includes/ (reusable components) and templates/ (starter templates)
        svg_files = [f for f in svg_files if 'includes' not in str(f) and 'templates' not in str(f)]
    else:
        svg_path = wireframes_dir / args[0]
        if not svg_path.exists():
            print(f"ERROR: File not found: {svg_path}")
            sys.exit(1)
        svg_files = [svg_path]

    total_errors = 0
    passed_files = 0
    failed_files = 0
    all_issues: List[Dict] = []  # For JSON output

    for svg_file in svg_files:
        if not output_json and not output_summary:
            print(f"\n{'='*60}")
            print(f"Validating: {svg_file.relative_to(wireframes_dir)}")
            print('='*60)

        validator = WireframeValidator(svg_file)
        issues = validator.validate()

        errors = [i for i in issues if i.severity == "ERROR"]

        if not issues:
            passed_files += 1
            if not output_json and not output_summary:
                print("PASS - No issues found")
        else:
            failed_files += 1
            if not output_json and not output_summary:
                for issue in issues:
                    line_info = f" (line {issue.line})" if issue.line else ""
                    print(f"  ERROR [{issue.code}]{line_info}: {issue.message}")

                print(f"\n  {len(errors)} errors")

            # Auto-log issues to feature-specific file (unless JSON/summary mode)
            if not output_json and not output_summary:
                logger.log_issues(svg_file, issues)

            # Collect issues for JSON output
            if output_json:
                for issue in issues:
                    all_issues.append({
                        "file": str(svg_file.relative_to(wireframes_dir)),
                        "severity": issue.severity,
                        "code": issue.code,
                        "message": issue.message,
                        "line": issue.line
                    })

        total_errors += len(errors)

    # Output results based on format
    if output_json:
        # JSON output for CI parsing
        result = {
            "passed": passed_files,
            "failed": failed_files,
            "total_files": len(svg_files),
            "total_issues": total_errors,
            "issues": all_issues
        }
        print(json.dumps(result, indent=2))
    elif output_summary:
        # One-line summary for PR comments
        status = "PASS" if total_errors == 0 else "FAIL"
        print(f"Wireframe Validation: {status} | {passed_files}/{len(svg_files)} passed | {total_errors} issues")
    else:
        # Standard verbose output
        print(f"\n{'='*60}")
        print(f"TOTAL: {total_errors} errors across {len(svg_files)} files")

        if total_errors > 0:
            print("STATUS: FAIL")
        else:
            print("STATUS: PASS")

    sys.exit(1 if total_errors > 0 else 0)


if __name__ == '__main__':
    main()
