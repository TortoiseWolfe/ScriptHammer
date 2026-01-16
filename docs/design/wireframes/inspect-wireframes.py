#!/usr/bin/env python3
"""
SVG Wireframe Inspector v1.5

Cross-SVG consistency checker for ScriptHammer wireframes.
Runs AFTER validate-wireframe.py passes to check patterns across all SVGs.

NEW in v1.5: G-047 key_concepts_position - expects y=940 (inside annotation panel, below user stories).
             CONFIRMED by Architect (2026-01-16): y=730 was outside panel boundary.
NEW in v1.4: Fixed G-044 to recognize <use> include files (footer/nav have proper corners via <path>).
             Fixed G-044 to check mobile active state overlays for rx attribute.
             Added G-047 "Additional Requirements" label detection (should be "Key Concepts").
NEW in v1.3: Added G-047 (Key Concepts row) check.
NEW in v1.2: Added mobile active state checks (icon + corner tabs).
NEW in v1.1: Added G-044 (footer/nav rounded corners) check.

Checks for:
- Title position consistency (x=960, y=28)
- Signature position consistency (y=1060, bold)
- Signature alignment consistency (x=40, left-aligned)
- Signature format consistency (NNN:NN | Feature Name | ScriptHammer)
- Header/footer include consistency
- Desktop/mobile mockup positioning
- Annotation panel positioning
- Navigation active states
- Footer/nav rounded corners (G-044) - includes and active overlays
- Mobile active state icon presence (G-045)
- Mobile corner tab shape (G-046)
- Key Concepts row presence at y=940 (G-047) - inside annotation panel, below user stories
- Wrong label detection: "Additional Requirements" should be "Key Concepts"

Usage:
    python inspect-wireframes.py --all           # Inspect all SVGs
    python inspect-wireframes.py --report        # JSON report only
    python inspect-wireframes.py 002-cookie-consent/01-consent-modal.svg
"""

import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Set

# ============================================================
# EXPECTED PATTERNS (from wireframe standards)
# ============================================================

EXPECTED = {
    'title': {'x': 960, 'y': 28, 'anchor': 'middle'},
    'signature': {
        'x': 40,
        'y': 1060,
        'bold': True,
        'anchor': None,  # x=40 = left-aligned, no text-anchor
        'format': r'^[0-9]{3}:[0-9]{2} \| .+ \| ScriptHammer$',  # NNN:NN | Feature Name | ScriptHammer
    },
    'desktop_mockup': {'x': 40, 'y': 60, 'width': 1280, 'height': 720},
    'mobile_mockup': {'x': 1360, 'y': 60, 'width': 360, 'height': 720},
    'annotation_panel': {'x': 40, 'y': 800, 'width': 1840, 'height': 220},
    'desktop_header': 'includes/header-desktop.svg#desktop-header',
    'desktop_footer': 'includes/footer-desktop.svg#site-footer',
    'mobile_header': 'includes/header-mobile.svg#mobile-header-group',
    'mobile_footer': 'includes/footer-mobile.svg#mobile-bottom-nav',
    'key_concepts': {
        'y': 940,  # Per G-047: Key Concepts row at y=940 (inside annotation panel at y=800, offset +140)
        'tolerance': 50,  # ±50px for y position (allows variation in layout)
        'gap_to_signature': 120,  # Expected gap: 1060 - 940 = 120px (room for signature below)
    },
}

# Tolerance for position checks (pixels)
POSITION_TOLERANCE = 5


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class StructuralElement:
    """Extracted structural element from an SVG."""
    element_type: str
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    text_anchor: Optional[str] = None
    bold: bool = False
    href: Optional[str] = None
    text: Optional[str] = None  # Text content (for signature format validation)


@dataclass
class SVGStructure:
    """Structural analysis of a single SVG."""
    path: Path
    feature: str
    svg_name: str
    title: Optional[StructuralElement] = None
    signature: Optional[StructuralElement] = None
    desktop_header: Optional[StructuralElement] = None
    desktop_footer: Optional[StructuralElement] = None
    mobile_header: Optional[StructuralElement] = None
    mobile_footer: Optional[StructuralElement] = None
    desktop_mockup: Optional[StructuralElement] = None
    mobile_mockup: Optional[StructuralElement] = None
    annotation_panel: Optional[StructuralElement] = None
    nav_active_page: Optional[str] = None
    # G-044: Footer/nav corners - now checks includes OR inline elements
    desktop_footer_uses_include: bool = False  # Uses <use href="includes/footer-desktop.svg">
    desktop_footer_has_rx: bool = False  # Has inline <rect> with rx attribute
    mobile_nav_uses_include: bool = False  # Uses <use href="includes/footer-mobile.svg">
    mobile_nav_has_rx: bool = False  # Has inline <rect> with rx attribute
    mobile_active_overlay_has_rx: bool = True  # Active state overlay rect has rx (middle tabs)
    mobile_active_has_icon: bool = False  # G-045: active state includes icon path
    mobile_active_corner_uses_path: bool = True  # G-046: corner tabs use <path> not <rect>
    mobile_active_detected: bool = False  # Whether we found a mobile active state overlay
    has_key_concepts: bool = False  # G-047: Key Concepts row exists
    has_wrong_label: bool = False  # G-047: Uses "Additional Requirements" instead of "Key Concepts"
    key_concepts_y: Optional[float] = None  # G-047: Y position of Key Concepts row
    issues: List[str] = field(default_factory=list)


@dataclass
class PatternViolation:
    """A deviation from the expected pattern."""
    svg_path: Path
    check: str
    expected: str
    actual: str
    severity: str = "PATTERN_VIOLATION"


# ============================================================
# STRUCTURAL EXTRACTION
# ============================================================

def extract_structure(svg_path: Path) -> SVGStructure:
    """Extract structural elements from an SVG file."""
    content = svg_path.read_text()
    feature = svg_path.parent.name
    svg_name = svg_path.name

    structure = SVGStructure(
        path=svg_path,
        feature=feature,
        svg_name=svg_name
    )

    # Extract title (y < 50, text-anchor="middle")
    # Find ALL centered text elements and filter to those with y < 50
    # This handles multiline elements and varying attribute order
    text_elements = re.findall(
        r'<text([^>]*)>([\s\S]*?)</text>',
        content[:5000]
    )

    for attrs, text_content in text_elements:
        # Check for text-anchor="middle"
        if 'text-anchor="middle"' not in attrs and "text-anchor='middle'" not in attrs:
            continue

        # Extract y position
        y_match = re.search(r'y=["\']?(\d+)', attrs)
        if not y_match:
            continue
        y = int(y_match.group(1))

        # Only consider elements with y < 50 (title area)
        if y >= 50:
            continue

        # Extract x position
        x_match = re.search(r'x=["\']?(\d+)', attrs)
        x = int(x_match.group(1)) if x_match else None

        structure.title = StructuralElement(
            element_type='title',
            x=x,
            y=y,
            text_anchor='middle'
        )
        break  # Found the title, stop searching

    # Extract signature (y > 1040) - capture both element attributes and text content
    sig_pattern = r'<text([^>]*y=["\']?(10[4-9]\d|1[1-9]\d\d)["\']?[^>]*)>([\s\S]*?)</text>'
    sig_match = re.search(sig_pattern, content)
    if sig_match:
        sig_attrs = sig_match.group(1)
        sig_text = sig_match.group(3).strip()
        # Clean up text content (remove extra whitespace, newlines)
        sig_text = ' '.join(sig_text.split())

        y_match = re.search(r'y=["\']?(\d+)', sig_attrs)
        x_match = re.search(r'x=["\']?(\d+)', sig_attrs)
        bold = 'font-weight="bold"' in sig_attrs or 'font-weight:bold' in sig_attrs or 'font-weight="700"' in sig_attrs
        # Check for text-anchor (centered signatures use text-anchor="middle")
        anchor_match = re.search(r'text-anchor=["\']([^"\']+)["\']', sig_attrs)
        text_anchor = anchor_match.group(1) if anchor_match else None
        structure.signature = StructuralElement(
            element_type='signature',
            x=int(x_match.group(1)) if x_match else None,
            y=int(y_match.group(1)) if y_match else None,
            text_anchor=text_anchor,
            bold=bold,
            text=sig_text
        )

    # Extract header/footer includes
    header_patterns = [
        ('desktop_header', r'href=["\']includes/header-desktop\.svg#([^"\']+)["\']'),
        ('desktop_footer', r'href=["\']includes/footer-desktop\.svg#([^"\']+)["\']'),
        ('mobile_header', r'href=["\']includes/header-mobile\.svg#([^"\']+)["\']'),
        ('mobile_footer', r'href=["\']includes/footer-mobile\.svg#([^"\']+)["\']'),
    ]

    for name, pattern in header_patterns:
        match = re.search(pattern, content)
        if match:
            setattr(structure, name, StructuralElement(
                element_type=name,
                href=f"includes/{name.replace('_', '-')}.svg#{match.group(1)}"
            ))

    # Extract mockup positions from transform groups
    desktop_match = re.search(
        r'<g[^>]*id=["\']desktop["\'][^>]*transform=["\']translate\(\s*(\d+)\s*,\s*(\d+)\s*\)',
        content
    )
    if desktop_match:
        structure.desktop_mockup = StructuralElement(
            element_type='desktop_mockup',
            x=int(desktop_match.group(1)),
            y=int(desktop_match.group(2))
        )

    mobile_match = re.search(
        r'<g[^>]*id=["\']mobile["\'][^>]*transform=["\']translate\(\s*(\d+)\s*,\s*(\d+)\s*\)',
        content
    )
    if mobile_match:
        structure.mobile_mockup = StructuralElement(
            element_type='mobile_mockup',
            x=int(mobile_match.group(1)),
            y=int(mobile_match.group(2))
        )

    # Extract annotation panel position
    ann_match = re.search(
        r'<g[^>]*id=["\']annotations["\'][^>]*transform=["\']translate\(\s*(\d+)\s*,\s*(\d+)\s*\)',
        content
    )
    if ann_match:
        structure.annotation_panel = StructuralElement(
            element_type='annotation_panel',
            x=int(ann_match.group(1)),
            y=int(ann_match.group(2))
        )

    # Detect nav active page from content
    nav_indicators = {
        'Home': ['landing', 'home', 'index'],
        'Features': ['features', 'feature'],
        'Docs': ['docs', 'documentation', 'guide'],
        'Account': ['account', 'profile', 'settings', 'auth', 'login', 'register'],
    }

    svg_lower = svg_name.lower()
    for page, keywords in nav_indicators.items():
        if any(kw in svg_lower for kw in keywords):
            structure.nav_active_page = page
            break

    # G-044: Check for rounded corners on footer/nav
    # Include files (footer-desktop.svg, footer-mobile.svg) already have proper corners via <path>
    # So if using includes, the check passes. Only check inline rects if no include used.

    # Check for desktop footer include
    if re.search(r'<use[^>]*href=["\']includes/footer-desktop\.svg', content):
        structure.desktop_footer_uses_include = True

    # Check for mobile nav include
    if re.search(r'<use[^>]*href=["\']includes/footer-mobile\.svg', content):
        structure.mobile_nav_uses_include = True

    # Fallback: check inline rects only if not using includes
    if not structure.desktop_footer_uses_include:
        # Desktop footer: rect with large width (1000+) in footer area (y ~640-780)
        desktop_footer_pattern = r'<rect[^>]*\by=["\']?(6[4-9]\d|7[0-7]\d)["\']?[^>]*width=["\']?(1[0-2]\d\d)["\']?[^>]*'
        for match in re.finditer(desktop_footer_pattern, content):
            if 'rx=' in match.group(0):
                structure.desktop_footer_has_rx = True
                break

    if not structure.mobile_nav_uses_include:
        # Mobile nav: rect with width ~360 at bottom (y ~664-720)
        mobile_nav_pattern = r'<rect[^>]*\by=["\']?(66[4-9]|6[7-9]\d|7[0-1]\d)["\']?[^>]*width=["\']?(3[4-6]\d)["\']?[^>]*'
        for match in re.finditer(mobile_nav_pattern, content):
            if 'rx=' in match.group(0):
                structure.mobile_nav_has_rx = True
                break

    # G-044: Check mobile active state overlays for rx attribute
    # Look for active state rects in mobile nav area (y=664) with purple fill (#8b5cf6)
    # Direct rect pattern: <rect x="X" y="664" width="90" height="56" fill="#8b5cf6">
    # where X is 0, 90, 180, or 270 for the four tabs
    direct_active_pattern = r'<rect[^>]*x=["\']?(\d+)["\']?[^>]*y=["\']?664["\']?[^>]*fill=["\']#8b5cf6["\']?'
    for match in re.finditer(direct_active_pattern, content):
        rect_element = match.group(0)
        x_pos = int(match.group(1))

        # Found a direct active overlay - mark as detected
        structure.mobile_active_detected = True

        # Check for rx attribute on middle tabs (x=90 or x=180)
        # Corner tabs (x=0 or x=270) should use <path>, not <rect>
        if x_pos in [90, 180]:
            if 'rx=' not in rect_element:
                structure.mobile_active_overlay_has_rx = False
        elif x_pos in [0, 270]:
            # Corner tab using direct rect - this is a G-046 violation (should use path)
            structure.mobile_active_corner_uses_path = False

    # G-045 & G-046: Check mobile active state overlay
    # Look for active state overlays in mobile section (translate near y=664 for bottom nav)
    # Pattern: <g transform="translate(X, 664)"> where X is 0, 90, 180, or 270
    mobile_active_pattern = r'<g[^>]*transform=["\']translate\(\s*(\d+)\s*,\s*664\s*\)["\'][^>]*>([\s\S]*?)</g>'
    mobile_active_matches = list(re.finditer(mobile_active_pattern, content))

    for match in mobile_active_matches:
        x_pos = int(match.group(1))
        overlay_content = match.group(2)

        # Check if this looks like an active state (has fill="#8b5cf6" purple)
        if 'fill="#8b5cf6"' not in overlay_content:
            continue

        structure.mobile_active_detected = True

        # G-045: Check for icon path in overlay (white-filled path)
        # Icon paths have fill="#fff" or fill="#ffffff" or fill="white"
        icon_pattern = r'<path[^>]*fill=["\']#fff(?:fff)?["\']'
        if re.search(icon_pattern, overlay_content):
            structure.mobile_active_has_icon = True

        # G-046: Check corner tabs (x=0 for Home, x=270 for Account)
        # Corner tabs should use <path> element, not <rect>
        is_corner_tab = x_pos in [0, 270]
        if is_corner_tab:
            # Check if using rect instead of path for the background
            uses_rect = '<rect' in overlay_content and 'width="90"' in overlay_content
            uses_path = '<path' in overlay_content and ('M 0 0 L 90' in overlay_content or 'M0 0L90' in overlay_content)

            if uses_rect and not uses_path:
                structure.mobile_active_corner_uses_path = False

    # G-047: Check for Key Concepts row
    # Per G-047: Key Concepts should be at y=940 (inside annotation panel at y=800, +140 offset)
    # Formats: <g transform="translate(40, 940)">...Key Concepts... OR <text y="940">Key Concepts:...

    # Simple presence check - look for "Key Concepts" text anywhere
    if re.search(r'[Kk]ey\s*[Cc]oncepts\s*:', content):
        structure.has_key_concepts = True

        # Find the immediate parent group transform for Key Concepts
        # Pattern: <g transform="translate(X, Y)">...Key Concepts (within ~500 chars)
        # The Y value IS the absolute position (not nested inside annotation panel)
        kc_parent_pattern = r'<g[^>]*transform=["\']translate\(\s*\d+\s*,\s*(\d+)\s*\)["\'][^>]*>\s*(?:<[^>]+>\s*){0,5}[^<]*[Kk]ey\s*[Cc]oncepts'
        kc_parent_match = re.search(kc_parent_pattern, content)
        if kc_parent_match:
            # The transform y IS the absolute position
            structure.key_concepts_y = int(kc_parent_match.group(1))

        # Also check for direct y attribute on text element (less common)
        if not structure.key_concepts_y:
            direct_pattern = r'<text[^>]*y=["\']?(\d+)["\']?[^>]*>[^<]*[Kk]ey\s*[Cc]oncepts'
            direct_match = re.search(direct_pattern, content)
            if direct_match:
                structure.key_concepts_y = int(direct_match.group(1))

    # G-047: Check for wrong label - "Additional Requirements" should be "Key Concepts"
    if re.search(r'[Aa]dditional\s*[Rr]equirements\s*:', content):
        structure.has_wrong_label = True
        # If they have "Additional Requirements" but not "Key Concepts", still mark as missing Key Concepts
        if not structure.has_key_concepts:
            # The wrong label exists, so there IS a bottom row, just with wrong text
            # We'll report both issues: wrong label AND missing Key Concepts
            pass

    return structure


# ============================================================
# PATTERN CHECKING
# ============================================================

def check_patterns(structures: List[SVGStructure]) -> List[PatternViolation]:
    """Check all SVGs against expected patterns."""
    violations = []

    for structure in structures:
        # Check title position
        if structure.title:
            if structure.title.y and abs(structure.title.y - EXPECTED['title']['y']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='title_y_position',
                    expected=f"y={EXPECTED['title']['y']}",
                    actual=f"y={structure.title.y}"
                ))
            if structure.title.x and abs(structure.title.x - EXPECTED['title']['x']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='title_x_position',
                    expected=f"x={EXPECTED['title']['x']}",
                    actual=f"x={structure.title.x}"
                ))
        else:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='title_missing',
                expected='centered title at y=28',
                actual='no title found'
            ))

        # Check signature position, alignment, and bold
        if structure.signature:
            if structure.signature.y and abs(structure.signature.y - EXPECTED['signature']['y']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='signature_y_position',
                    expected=f"y={EXPECTED['signature']['y']}",
                    actual=f"y={structure.signature.y}"
                ))
            if not structure.signature.bold:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='signature_not_bold',
                    expected='font-weight="bold"',
                    actual='not bold'
                ))
            # Check signature alignment - should be left-aligned (x=40, no text-anchor)
            # Centered signatures have x=960 and text-anchor="middle"
            is_centered = (
                structure.signature.text_anchor == 'middle' or
                (structure.signature.x and structure.signature.x > 100)  # x > 100 indicates not left-aligned
            )
            if is_centered:
                actual_desc = f"x={structure.signature.x}"
                if structure.signature.text_anchor:
                    actual_desc += f", text-anchor=\"{structure.signature.text_anchor}\""
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='signature_alignment',
                    expected='x="40" (left-aligned)',
                    actual=actual_desc
                ))
            # Check signature format - must be "NNN:NN | Feature Name | ScriptHammer"
            if structure.signature.text:
                format_pattern = EXPECTED['signature']['format']
                if not re.match(format_pattern, structure.signature.text):
                    # Truncate long signatures for display
                    actual_text = structure.signature.text
                    if len(actual_text) > 50:
                        actual_text = actual_text[:47] + "..."
                    violations.append(PatternViolation(
                        svg_path=structure.path,
                        check='signature_format',
                        expected='NNN:NN | Feature Name | ScriptHammer',
                        actual=f'"{actual_text}"'
                    ))
        else:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='signature_missing',
                expected='signature at y=1060',
                actual='no signature found'
            ))

        # Check header/footer includes
        if not structure.desktop_header:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='desktop_header_missing',
                expected=EXPECTED['desktop_header'],
                actual='not found'
            ))

        if not structure.desktop_footer:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='desktop_footer_missing',
                expected=EXPECTED['desktop_footer'],
                actual='not found'
            ))

        if not structure.mobile_header:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='mobile_header_missing',
                expected=EXPECTED['mobile_header'],
                actual='not found'
            ))

        if not structure.mobile_footer:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='mobile_footer_missing',
                expected=EXPECTED['mobile_footer'],
                actual='not found'
            ))

        # Check mockup positions
        if structure.desktop_mockup:
            exp = EXPECTED['desktop_mockup']
            if structure.desktop_mockup.x and abs(structure.desktop_mockup.x - exp['x']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='desktop_mockup_x',
                    expected=f"x={exp['x']}",
                    actual=f"x={structure.desktop_mockup.x}"
                ))
            if structure.desktop_mockup.y and abs(structure.desktop_mockup.y - exp['y']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='desktop_mockup_y',
                    expected=f"y={exp['y']}",
                    actual=f"y={structure.desktop_mockup.y}"
                ))

        if structure.mobile_mockup:
            exp = EXPECTED['mobile_mockup']
            if structure.mobile_mockup.x and abs(structure.mobile_mockup.x - exp['x']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='mobile_mockup_x',
                    expected=f"x={exp['x']}",
                    actual=f"x={structure.mobile_mockup.x}"
                ))
            if structure.mobile_mockup.y and abs(structure.mobile_mockup.y - exp['y']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='mobile_mockup_y',
                    expected=f"y={exp['y']}",
                    actual=f"y={structure.mobile_mockup.y}"
                ))

        # Check annotation panel position
        if structure.annotation_panel:
            exp = EXPECTED['annotation_panel']
            if structure.annotation_panel.x and abs(structure.annotation_panel.x - exp['x']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='annotation_panel_x',
                    expected=f"x={exp['x']}",
                    actual=f"x={structure.annotation_panel.x}"
                ))
            if structure.annotation_panel.y and abs(structure.annotation_panel.y - exp['y']) > POSITION_TOLERANCE:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='annotation_panel_y',
                    expected=f"y={exp['y']}",
                    actual=f"y={structure.annotation_panel.y}"
                ))

        # G-044: Check footer/nav rounded corners
        # Desktop footer: uses include (which has proper <path> corners) OR inline rect with rx
        if not structure.desktop_footer_uses_include and not structure.desktop_footer_has_rx:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='footer_nav_corners',
                expected='desktop footer via include OR inline rect with rx="4-8"',
                actual='desktop footer missing rounded corners'
            ))

        # Mobile nav: uses include (which has proper <path> corners) OR inline rect with rx
        if not structure.mobile_nav_uses_include and not structure.mobile_nav_has_rx:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='footer_nav_corners',
                expected='mobile nav via include OR inline rect with rx="4-8"',
                actual='mobile nav missing rounded corners'
            ))

        # Mobile active state overlay (middle tabs) should have rx for consistency
        if structure.mobile_active_detected and not structure.mobile_active_overlay_has_rx:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='mobile_active_overlay_corners',
                expected='mobile active state rect (middle tabs) has rx="8"',
                actual='mobile active state rect missing rx attribute'
            ))

        # G-045: Check mobile active state has icon
        # Only check if we detected a mobile active state overlay
        if structure.mobile_active_detected and not structure.mobile_active_has_icon:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='mobile_active_icon_missing',
                expected='mobile active state includes white icon path',
                actual='active state has text only, no icon'
            ))

        # G-046: Check corner tabs use path not rect
        # Only check if we detected a mobile active state overlay
        if structure.mobile_active_detected and not structure.mobile_active_corner_uses_path:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='mobile_active_corner_shape',
                expected='corner tabs (Home/Account) use <path> with rounded corner',
                actual='corner tab uses <rect> (missing rounded corner)'
            ))

        # G-047: Check for Key Concepts row
        exp_kc = EXPECTED['key_concepts']
        if not structure.has_key_concepts:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='key_concepts_missing',
                expected=f'Key Concepts row at y≈{exp_kc["y"]}',
                actual='Key Concepts row not found'
            ))
        elif structure.key_concepts_y:
            # Check y position is within tolerance
            if abs(structure.key_concepts_y - exp_kc['y']) > exp_kc['tolerance']:
                violations.append(PatternViolation(
                    svg_path=structure.path,
                    check='key_concepts_position',
                    expected=f'y={exp_kc["y"]} (±{exp_kc["tolerance"]}px)',
                    actual=f'y={structure.key_concepts_y}'
                ))

        # G-047: Check for wrong label (Additional Requirements instead of Key Concepts)
        if structure.has_wrong_label:
            violations.append(PatternViolation(
                svg_path=structure.path,
                check='key_concepts_wrong_label',
                expected='Label: "Key Concepts:"',
                actual='Label: "Additional Requirements:" (wrong - use "Key Concepts:")'
            ))

    return violations


def find_oddballs(structures: List[SVGStructure]) -> List[PatternViolation]:
    """Find SVGs that deviate from the majority pattern (oddballs)."""
    violations = []

    # Collect actual values for each check
    title_y_values = []
    title_x_values = []
    signature_y_values = []
    desktop_x_values = []
    mobile_x_values = []
    annotation_y_values = []

    for s in structures:
        if s.title and s.title.y:
            title_y_values.append((s.path, s.title.y))
        if s.title and s.title.x:
            title_x_values.append((s.path, s.title.x))
        if s.signature and s.signature.y:
            signature_y_values.append((s.path, s.signature.y))
        if s.desktop_mockup and s.desktop_mockup.x:
            desktop_x_values.append((s.path, s.desktop_mockup.x))
        if s.mobile_mockup and s.mobile_mockup.x:
            mobile_x_values.append((s.path, s.mobile_mockup.x))
        if s.annotation_panel and s.annotation_panel.y:
            annotation_y_values.append((s.path, s.annotation_panel.y))

    def find_outliers(values: List, check_name: str, tolerance: int = 10):
        """Find values that differ significantly from the majority."""
        if len(values) < 3:
            return []

        # Find most common value (mode)
        value_counts = {}
        for path, val in values:
            rounded = round(val / tolerance) * tolerance
            value_counts[rounded] = value_counts.get(rounded, 0) + 1

        if not value_counts:
            return []

        mode = max(value_counts, key=value_counts.get)
        mode_count = value_counts[mode]

        # Only flag if there's a clear majority (> 50%)
        if mode_count < len(values) / 2:
            return []

        outliers = []
        for path, val in values:
            rounded = round(val / tolerance) * tolerance
            if rounded != mode:
                outliers.append(PatternViolation(
                    svg_path=path,
                    check=f'{check_name}_oddball',
                    expected=f'majority pattern: {mode}',
                    actual=f'this SVG: {val}'
                ))
        return outliers

    violations.extend(find_outliers(title_y_values, 'title_y'))
    violations.extend(find_outliers(title_x_values, 'title_x'))
    violations.extend(find_outliers(signature_y_values, 'signature_y'))
    violations.extend(find_outliers(desktop_x_values, 'desktop_x'))
    violations.extend(find_outliers(mobile_x_values, 'mobile_x'))
    violations.extend(find_outliers(annotation_y_values, 'annotation_y'))

    return violations


# ============================================================
# ISSUE LOGGING
# ============================================================

def log_violations(violations: List[PatternViolation], wireframes_dir: Path):
    """Log violations to per-SVG .issues.md files."""
    # Group violations by SVG
    by_svg: Dict[Path, List[PatternViolation]] = {}
    for v in violations:
        if v.svg_path not in by_svg:
            by_svg[v.svg_path] = []
        by_svg[v.svg_path].append(v)

    for svg_path, svg_violations in by_svg.items():
        issues_file = svg_path.parent / f"{svg_path.stem}.issues.md"
        feature = svg_path.parent.name
        svg_name = svg_path.name
        today = date.today().isoformat()

        # Check if file exists and has existing content
        existing_content = ""
        if issues_file.exists():
            existing_content = issues_file.read_text()

        # Build new section for inspector issues
        lines = [
            "",
            f"## Inspector Issues ({today})",
            "",
            "| Check | Expected | Actual | Classification |",
            "|-------|----------|--------|----------------|",
        ]

        for v in svg_violations:
            lines.append(f"| {v.check} | {v.expected} | {v.actual} | {v.severity} |")

        lines.append("")

        # Append to existing file or create new
        if existing_content and "## Inspector Issues" in existing_content:
            # Replace existing inspector section
            pattern = r'## Inspector Issues \([^)]+\).*?(?=\n## |\Z)'
            new_content = re.sub(pattern, "\n".join(lines[1:]), existing_content, flags=re.DOTALL)
        elif existing_content:
            # Append to existing file
            new_content = existing_content.rstrip() + "\n" + "\n".join(lines)
        else:
            # Create new file
            header = [
                f"# Issues: {svg_name}",
                "",
                f"**Feature:** {feature}",
                f"**SVG:** {svg_name}",
                f"**Last Review:** {today}",
                "",
                "---",
            ]
            new_content = "\n".join(header + lines)

        issues_file.write_text(new_content)
        print(f"  Issues logged to: {issues_file.relative_to(wireframes_dir)}")


# ============================================================
# MAIN
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python inspect-wireframes.py --all")
        print("       python inspect-wireframes.py --report")
        print("       python inspect-wireframes.py <svg-path>")
        sys.exit(1)

    wireframes_dir = Path(__file__).parent

    # Collect SVG files (exclude includes/ and templates/)
    if sys.argv[1] == '--all' or sys.argv[1] == '--report':
        svg_files = list(wireframes_dir.glob('**/*.svg'))
        svg_files = [f for f in svg_files if 'includes' not in str(f) and 'templates' not in str(f)]
    else:
        svg_path = wireframes_dir / sys.argv[1]
        if not svg_path.exists():
            print(f"ERROR: File not found: {svg_path}")
            sys.exit(1)
        svg_files = [svg_path]

    if not svg_files:
        print("No SVG files found to inspect.")
        sys.exit(0)

    print(f"\n{'='*60}")
    print(f"INSPECTING {len(svg_files)} SVG FILES")
    print('='*60)

    # Extract structure from all SVGs
    structures = []
    for svg_file in svg_files:
        try:
            structure = extract_structure(svg_file)
            structures.append(structure)
        except Exception as e:
            print(f"  ERROR parsing {svg_file.name}: {e}")

    # Run pattern checks
    violations = check_patterns(structures)

    # Find oddballs (deviations from majority)
    oddball_violations = find_oddballs(structures)
    violations.extend(oddball_violations)

    # Report mode - JSON output
    if sys.argv[1] == '--report':
        report = {
            'total_svgs': len(structures),
            'total_violations': len(violations),
            'violations_by_svg': {},
            'violations_by_check': {},
        }

        for v in violations:
            svg_key = str(v.svg_path.relative_to(wireframes_dir))
            if svg_key not in report['violations_by_svg']:
                report['violations_by_svg'][svg_key] = []
            report['violations_by_svg'][svg_key].append({
                'check': v.check,
                'expected': v.expected,
                'actual': v.actual
            })

            if v.check not in report['violations_by_check']:
                report['violations_by_check'][v.check] = []
            report['violations_by_check'][v.check].append(svg_key)

        print(json.dumps(report, indent=2))
        sys.exit(0)

    # Print violations
    if violations:
        print(f"\n{len(violations)} pattern violations found:\n")

        # Group by SVG
        by_svg: Dict[Path, List[PatternViolation]] = {}
        for v in violations:
            if v.svg_path not in by_svg:
                by_svg[v.svg_path] = []
            by_svg[v.svg_path].append(v)

        for svg_path, svg_violations in by_svg.items():
            rel_path = svg_path.relative_to(wireframes_dir)
            print(f"  {rel_path}:")
            for v in svg_violations:
                print(f"    [{v.check}] expected {v.expected}, got {v.actual}")
            print()

        # Log to issues files
        log_violations(violations, wireframes_dir)

        print(f"\n{'='*60}")
        print(f"STATUS: {len(violations)} PATTERN VIOLATIONS")
        sys.exit(1)
    else:
        print("\nAll SVGs follow consistent patterns.")
        print(f"\n{'='*60}")
        print("STATUS: PASS")
        sys.exit(0)


if __name__ == '__main__':
    main()
