#!/usr/bin/env python3
"""
SVG Wireframe Inspector v1.0

Cross-SVG consistency checker for ScriptHammer wireframes.
Runs AFTER validate-wireframe.py passes to check patterns across all SVGs.

Checks for:
- Title position consistency (x=960, y=28)
- Signature position consistency (y=1060, bold)
- Header/footer include consistency
- Desktop/mobile mockup positioning
- Annotation panel positioning
- Navigation active states

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
    'signature': {'y': 1060, 'bold': True},
    'desktop_mockup': {'x': 40, 'y': 60, 'width': 1280, 'height': 720},
    'mobile_mockup': {'x': 1360, 'y': 60, 'width': 360, 'height': 720},
    'annotation_panel': {'x': 40, 'y': 800, 'width': 1840, 'height': 220},
    'desktop_header': 'includes/header-desktop.svg#desktop-header',
    'desktop_footer': 'includes/footer-desktop.svg#site-footer',
    'mobile_header': 'includes/header-mobile.svg#mobile-header-group',
    'mobile_footer': 'includes/footer-mobile.svg#mobile-bottom-nav',
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

    # Extract title (y < 40, text-anchor="middle")
    title_match = re.search(
        r'<text[^>]*text-anchor=["\']middle["\'][^>]*y=["\']?(\d+)["\']?[^>]*>([^<]+)</text>',
        content[:3000]
    )
    if not title_match:
        title_match = re.search(
            r'<text[^>]*y=["\']?(\d+)["\']?[^>]*text-anchor=["\']middle["\'][^>]*>([^<]+)</text>',
            content[:3000]
        )

    if title_match:
        y = int(title_match.group(1))
        if y < 50:
            # Find x position
            x_match = re.search(r'x=["\']?(\d+)', title_match.group(0))
            x = int(x_match.group(1)) if x_match else None
            structure.title = StructuralElement(
                element_type='title',
                x=x,
                y=y,
                text_anchor='middle'
            )

    # Extract signature (y > 1040)
    sig_pattern = r'<text[^>]*y=["\']?(10[4-9]\d|1[1-9]\d\d)["\']?[^>]*'
    sig_match = re.search(sig_pattern, content)
    if sig_match:
        sig_element = sig_match.group()
        y_match = re.search(r'y=["\']?(\d+)', sig_element)
        x_match = re.search(r'x=["\']?(\d+)', sig_element)
        bold = 'font-weight="bold"' in sig_element or 'font-weight:bold' in sig_element
        structure.signature = StructuralElement(
            element_type='signature',
            x=int(x_match.group(1)) if x_match else None,
            y=int(y_match.group(1)) if y_match else None,
            bold=bold
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

        # Check signature position and bold
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

    # Collect SVG files
    if sys.argv[1] == '--all' or sys.argv[1] == '--report':
        svg_files = list(wireframes_dir.glob('**/*.svg'))
        svg_files = [f for f in svg_files if 'includes' not in str(f)]
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
