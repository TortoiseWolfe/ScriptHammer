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

        # v3 checks (from plan analysis)
        self._check_title_format()
        self._check_section_labels()
        self._check_clutter()
        self._check_callout_coverage()
        self._check_button_fills()
        self._check_signature()
        self._check_annotation_spacing()

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
                message=f"Only {callout_count} annotation groups found (minimum 4 recommended)"
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
                            severity="WARNING",
                            code="TITLE-003",
                            message="Title should be centered (text-anchor='middle')"
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
                severity="WARNING",
                code="SECTION-001",
                message="Missing DESKTOP section label (e.g., 'DESKTOP (16:9)' at y=52)"
            ))
        if not has_mobile_label:
            self.issues.append(Issue(
                severity="WARNING",
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

        General warning for any button-sized rect using faded panel colors.
        Feature-specific rules (e.g., GDPR Accept/Reject equality) come from spec.md.
        """
        # Faded colors that make buttons look "transparent" or muted
        faded_colors = ['#f5f0e6', '#e8d4b8', '#dcc8a8']

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
                                severity="WARNING",
                                code="BTN-001",
                                message=f"Button uses faded fill color ({fill}) - consider solid fill for prominence",
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
                        severity="WARNING",
                        code="SIGNATURE-001",
                        message=f"Signature font too small ({font_size}px) - use 18px"
                    ))
            # Check for bold
            if 'font-weight="bold"' not in sig_element and 'font-weight:bold' not in sig_element:
                self.issues.append(Issue(
                    severity="WARNING",
                    code="SIGNATURE-002",
                    message="Signature should be bold"
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
