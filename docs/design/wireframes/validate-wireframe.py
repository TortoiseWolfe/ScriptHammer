#!/usr/bin/env python3
"""
SVG Wireframe Validator v5.0

Programmatically checks wireframe SVGs against ScriptHammer standards.
All checks are errors - either it passes or it fails. No ambiguous warnings.

NEW in v5.0: Auto-logs issues to feature-specific .issues.md files.
Issues only escalate to GENERAL_ISSUES.md when seen in 2+ features.

Checks: XML syntax, SVG structure, colors, fonts, headers, modals, callouts,
        annotations, title, signature, background gradient, paint order.

Usage:
    python validate-wireframe.py 002-cookie-consent/01-consent-modal-flow.svg
    python validate-wireframe.py --all  # Validate all SVGs
    python validate-wireframe.py --check-escalation  # Check for patterns to escalate
"""

import sys
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set
from datetime import date
import json

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
        """Check for forbidden colors on PANELS (rect elements only, not text)."""
        for color in FORBIDDEN_PANEL_COLORS:
            # Only match <rect elements with forbidden fill - text can use #ffffff
            pattern = rf'<rect[^>]*fill=["\']?{re.escape(color)}'
            matches = list(re.finditer(pattern, self.svg_content, re.IGNORECASE))
            for match in matches:
                line_num = self.svg_content[:match.start()].count('\n') + 1
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
                    line_num = self.svg_content[:match.start()].count('\n') + 1
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
                severity="ERROR",
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
                        severity="ERROR",
                        code="COLL-001",
                        message=f"Callout circle near footer area - move away from footer",
                        line=line_num
                    ))

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
        annotation_section = self.svg_content[self.svg_content.find('id="annotations"'):]
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
                    # Check centering
                    context = self.svg_content[max(0, match.start()-300):match.start()]
                    if 'text-anchor="middle"' not in context and 'text-anchor:middle' not in context:
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
        annotation_start = self.svg_content.find('id="annotations"')
        mockup_section = self.svg_content[:annotation_start]
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

        Note: #f5f0e6 is valid for tertiary/secondary buttons per design system.
        Only flag truly invisible/panel-matching colors.
        """
        # Colors that make buttons invisible against parchment background
        # Removed #f5f0e6 - valid for tertiary buttons
        faded_colors = ['#e8d4b8', '#dcc8a8']

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
                            line_num = self.svg_content[:match.start()].count('\n') + 1
                            self.issues.append(Issue(
                                severity="ERROR",
                                code="BTN-001",
                                message=f"Button uses faded fill color ({fill}) - use solid fill for prominence",
                                line=line_num
                            ))
                except (ValueError, TypeError):
                    continue

    def _check_signature(self):
        """SIGNATURE-001/002: Signature must be 18px+ and bold."""
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

        annotation_section = self.svg_content[self.svg_content.find('id="annotations"'):]
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
        """
        # Look for modal-like structures: centered panels with "modal", "dialog", or "consent" nearby
        modal_indicators = ['modal', 'dialog', 'consent', 'Cookie Preferences', 'Privacy Preferences']
        has_modal = any(indicator.lower() in self.svg_content.lower() for indicator in modal_indicators)

        if not has_modal:
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
        """
        # Find callout circles (red fill #dc2626) and their positions
        # This is a heuristic check - we look for callouts that appear centered on elements

        # Find all callout positions in the mockup areas (not annotation panel)
        if 'id="annotations"' in self.svg_content:
            mockup_section = self.svg_content[:self.svg_content.find('id="annotations"')]
        else:
            mockup_section = self.svg_content

        # Look for callout circles
        callout_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?[^>]*>'
        callouts = list(re.finditer(callout_pattern, mockup_section))

        # Look for UI elements (buttons, toggles) that might have callouts on them
        # Buttons: rect with rx=4-8, typical button dimensions
        button_pattern = r'<rect[^>]*width=["\']?(\d+)["\']?[^>]*height=["\']?(\d+)["\']?[^>]*rx=["\']?[4-8]["\']?'

        buttons = list(re.finditer(button_pattern, mockup_section))

        # Heuristic: if there are callouts and buttons, and they're close together
        # in the SVG source, warn about potential overlap
        # (Full geometric analysis would require parsing transforms)
        if len(callouts) > 0 and len(buttons) > 0:
            for callout in callouts:
                callout_pos = callout.start()
                # Check if any button is very close in source (within 500 chars)
                for button in buttons:
                    button_pos = button.start()
                    if abs(callout_pos - button_pos) < 300:
                        # They're close in source - might be overlapping
                        line_num = self.svg_content[:callout_pos].count('\n') + 1
                        self.issues.append(Issue(
                            severity="ERROR",
                            code="CALLOUT-003",
                            message="Callout positioned on top of UI element - place after (right/below) instead",
                            line=line_num
                        ))
                        break  # Only warn once per callout

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

        annotation_start = self.svg_content.find('id="annotations"')
        annotation_section = self.svg_content[annotation_start:]

        # Column boundaries (relative to annotation panel)
        columns = [(20, 470), (470, 920), (920, 1370), (1370, 1820)]

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
                for col_start, col_end in columns:
                    if x >= col_start and text_end <= col_end:
                        fits_column = True
                        break

                # Only warn if text is clearly outside all columns and long enough to matter
                if not fits_column and estimated_width > 100:
                    # Check if it's just starting in a valid column
                    in_valid_start = any(col_start <= x < col_end for col_start, col_end in columns)
                    if in_valid_start and text_end > 1820:
                        line_num = self.svg_content[:annotation_start + match.start()].count('\n') + 1
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

        annotation_start = self.svg_content.find('id="annotations"')
        annotation_section = self.svg_content[annotation_start:]

        # Check for elements with positions beyond bounds
        # Look for x > 1800 or y > 200 (leaving some margin)
        x_pattern = r'x=["\']?(\d+)["\']?'
        y_pattern = r'y=["\']?(\d+)["\']?'

        # Find all x values
        for match in re.finditer(x_pattern, annotation_section[:5000]):  # First 5000 chars of annotation
            try:
                x = int(match.group(1))
                if x > 1800:
                    line_num = self.svg_content[:annotation_start + match.start()].count('\n') + 1
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="ANN-004",
                        message=f"Content extends beyond annotation panel (x={x} > 1800)",
                        line=line_num
                    ))
            except ValueError:
                continue

        # Find all y values (within annotation section)
        for match in re.finditer(y_pattern, annotation_section[:5000]):
            try:
                y = int(match.group(1))
                if y > 200:
                    line_num = self.svg_content[:annotation_start + match.start()].count('\n') + 1
                    self.issues.append(Issue(
                        severity="ERROR",
                        code="ANN-004",
                        message=f"Content extends beyond annotation panel (y={y} > 200)",
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

        annotation_start = self.svg_content.find('id="annotations"')
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

        annotation_start = self.svg_content.find('id="annotations"')
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

        annotation_start = self.svg_content.find('id="annotations"')
        mockup_section = self.svg_content[:annotation_start]

        # Count red callout circles in mockup area
        callout_pattern = r'<circle[^>]*fill=["\']?#dc2626["\']?'
        mockup_callouts = len(re.findall(callout_pattern, mockup_section))

        if mockup_callouts < 2:
            self.issues.append(Issue(
                severity="ERROR",
                code="G-026",
                message=f"Only {mockup_callouts} callout circles on mockups. Need numbered callouts (①②③④) ON the UI elements."
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
            elif code.startswith('LAYOUT'):
                cat = "Layout Issues"
            elif code.startswith('CLUTTER'):
                cat = "Clutter Issues"
            else:
                cat = "Other Issues"

            if cat not in categories:
                categories[cat] = []
            categories[cat].append(issue)

        # Determine classification (PATCH vs REGENERATE)
        def classify_issue(code: str) -> str:
            """Determine if an issue is PATCH or REGENERATE."""
            patch_codes = ['C-', 'COLL', 'A-03', 'FONT-001']  # Localized fixes
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
        """
        pattern_occurrences: Dict[str, Set[str]] = {}

        # Find all .issues.md files
        for issues_file in self.wireframes_dir.glob("**/*.issues.md"):
            if issues_file.name == "GENERAL_ISSUES.md":
                continue

            feature = issues_file.parent.name
            content = issues_file.read_text()

            # Extract issue codes from the file
            codes = re.findall(r'\| ([A-Z]+-\d+) \|', content)
            for code in codes:
                if code not in pattern_occurrences:
                    pattern_occurrences[code] = set()
                pattern_occurrences[code].add(feature)

        # Filter to codes appearing in 2+ features
        escalation_candidates = {
            code: list(features)
            for code, features in pattern_occurrences.items()
            if len(features) >= 2
        }

        return escalation_candidates


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate-wireframe.py <svg-file-or-dir>")
        print("       python validate-wireframe.py --all")
        print("       python validate-wireframe.py --check-escalation")
        sys.exit(1)

    wireframes_dir = Path(__file__).parent
    logger = IssueLogger(wireframes_dir)

    # Handle escalation check mode
    if sys.argv[1] == '--check-escalation':
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

    for svg_file in svg_files:
        print(f"\n{'='*60}")
        print(f"Validating: {svg_file.relative_to(wireframes_dir)}")
        print('='*60)

        validator = WireframeValidator(svg_file)
        issues = validator.validate()

        errors = [i for i in issues if i.severity == "ERROR"]

        if not issues:
            print("PASS - No issues found")
        else:
            for issue in issues:
                line_info = f" (line {issue.line})" if issue.line else ""
                print(f"  ERROR [{issue.code}]{line_info}: {issue.message}")

            print(f"\n  {len(errors)} errors")

            # Auto-log issues to feature-specific file
            logger.log_issues(svg_file, issues)

        total_errors += len(errors)

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_errors} errors across {len(svg_files)} files")

    if total_errors > 0:
        print("STATUS: FAIL")
        sys.exit(1)
    else:
        print("STATUS: PASS")
        sys.exit(0)


if __name__ == '__main__':
    main()
