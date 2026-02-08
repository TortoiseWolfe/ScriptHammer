#!/usr/bin/env python3
"""
SVG Autofix - Automatically fix structural issues in wireframe SVGs

Eliminates AI regeneration for deterministic fixes (80% of issues).
Usage: python3 scripts/svg-autofix.py [command] [options]

Commands:
  check <path>             Report fixable issues without modifying
  fix <path>               Fix issues in place
  all                      Check all SVGs in wireframes directory
  diff <path>              Show proposed changes

Options:
  --dry-run                Preview changes without writing
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/svg-autofix.py check 003-auth/01-login.svg
  python3 scripts/svg-autofix.py fix 003-auth/01-login.svg
  python3 scripts/svg-autofix.py all --dry-run
  python3 scripts/svg-autofix.py all --json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
WIREFRAMES_DIR = PROJECT_ROOT / "docs" / "design" / "wireframes"

# Expected values (from wireframe standards)
STANDARDS = {
    "title_x": 960,
    "title_y": 32,
    "panel_color": "#e8d4b8",
    "desktop_x": 40,
    "desktop_y": 60,
    "desktop_width": 1280,
    "desktop_height": 720,
    "mobile_x": 1360,
    "mobile_y": 60,
    "mobile_width": 360,
    "mobile_height": 720,
    "touch_target_min": 44,
    "viewbox": "0 0 1920 1080",
    "signature_bold": True
}

# Auto-fixable issues and their fixes
AUTOFIX_RULES = [
    {
        "id": "title_position",
        "description": "Title text position",
        "pattern": r'(<text[^>]*class="title"[^>]*)(x="[\d.]+")([^>]*>)',
        "check": lambda m: "x=\"960\"" not in m.group(0),
        "fix": lambda m: m.group(1) + f'x="{STANDARDS["title_x"]}"' + m.group(3)
    },
    {
        "id": "panel_color_white",
        "description": "Panel color (white to beige)",
        "pattern": r'(fill=")(#ffffff|#fff|white)(")',
        "check": lambda m: True,
        "fix": lambda m: m.group(1) + STANDARDS["panel_color"] + m.group(3)
    },
    {
        "id": "signature_bold",
        "description": "Signature should be bold",
        "pattern": r'(<text[^>]*class="signature"[^>]*)(?!font-weight)([^>]*>)',
        "check": lambda m: 'font-weight' not in m.group(0),
        "fix": lambda m: m.group(1) + ' font-weight="bold"' + m.group(2)
    },
    {
        "id": "mobile_frame_x",
        "description": "Mobile frame x position",
        "pattern": r'(<rect[^>]*id="mobile-frame"[^>]*)(x="[\d.]+")([^>]*)',
        "check": lambda m: f'x="{STANDARDS["mobile_x"]}"' not in m.group(0),
        "fix": lambda m: m.group(1) + f'x="{STANDARDS["mobile_x"]}"' + m.group(3)
    },
    {
        "id": "desktop_frame_x",
        "description": "Desktop frame x position",
        "pattern": r'(<rect[^>]*id="desktop-frame"[^>]*)(x="[\d.]+")([^>]*)',
        "check": lambda m: f'x="{STANDARDS["desktop_x"]}"' not in m.group(0),
        "fix": lambda m: m.group(1) + f'x="{STANDARDS["desktop_x"]}"' + m.group(3)
    },
    {
        "id": "viewbox_format",
        "description": "ViewBox format",
        "pattern": r'(viewBox=")([^"]+)(")',
        "check": lambda m: m.group(2) != STANDARDS["viewbox"],
        "fix": lambda m: m.group(1) + STANDARDS["viewbox"] + m.group(3)
    },
    {
        "id": "annotation_overlap",
        "description": "Annotation y position overlap",
        "pattern": r'(<text[^>]*class="annotation"[^>]*y=")(\d+)("[^>]*>)',
        "check": lambda m: int(m.group(2)) > 800,  # Annotations should stay above 800
        "fix": lambda m: m.group(1) + "780" + m.group(3)
    }
]


def find_svg_file(path: str) -> Path:
    """Find SVG file by path or name"""
    # Check if it's a full path
    full_path = Path(path)
    if full_path.is_absolute() and full_path.exists():
        return full_path

    # Check relative to wireframes dir
    relative_path = WIREFRAMES_DIR / path
    if relative_path.exists():
        return relative_path

    # Search in wireframes directory
    for svg_file in WIREFRAMES_DIR.rglob("*.svg"):
        if path in str(svg_file):
            return svg_file

    return None


def check_svg(content: str) -> List[Dict]:
    """Check SVG content for fixable issues"""
    issues = []

    for rule in AUTOFIX_RULES:
        matches = list(re.finditer(rule["pattern"], content, re.IGNORECASE | re.DOTALL))

        for match in matches:
            if rule["check"](match):
                issues.append({
                    "rule_id": rule["id"],
                    "description": rule["description"],
                    "location": match.start(),
                    "original": match.group(0)[:80],
                    "fixable": True
                })

    return issues


def fix_svg(content: str, rules: List[str] = None) -> Tuple[str, List[Dict]]:
    """Fix SVG content and return (new_content, fixes_applied)"""
    fixes_applied = []
    new_content = content

    for rule in AUTOFIX_RULES:
        if rules and rule["id"] not in rules:
            continue

        def apply_fix(match):
            if rule["check"](match):
                fixed = rule["fix"](match)
                fixes_applied.append({
                    "rule_id": rule["id"],
                    "description": rule["description"],
                    "original": match.group(0)[:60],
                    "fixed": fixed[:60]
                })
                return fixed
            return match.group(0)

        new_content = re.sub(
            rule["pattern"],
            apply_fix,
            new_content,
            flags=re.IGNORECASE | re.DOTALL
        )

    return new_content, fixes_applied


def get_all_svgs() -> List[Path]:
    """Get all SVG files in wireframes directory"""
    svgs = []

    for feature_dir in WIREFRAMES_DIR.iterdir():
        if not feature_dir.is_dir():
            continue
        if feature_dir.name.startswith(('.', 'includes', 'templates', 'png', 'node_modules')):
            continue

        for svg_file in feature_dir.glob("*.svg"):
            svgs.append(svg_file)

    return sorted(svgs)


# Command handlers

def cmd_check(path: str, args):
    """Check SVG for fixable issues"""
    svg_file = find_svg_file(path)

    if not svg_file:
        print(f"Error: SVG not found: {path}", file=sys.stderr)
        sys.exit(1)

    content = svg_file.read_text()
    issues = check_svg(content)

    if args.json:
        output = {
            "file": str(svg_file.relative_to(PROJECT_ROOT)),
            "issues": issues,
            "fixable_count": len([i for i in issues if i["fixable"]])
        }
        print(json.dumps(output, indent=2))
        return

    print(f"Checking: {svg_file.relative_to(PROJECT_ROOT)}")
    print()

    if not issues:
        print("No fixable issues found.")
        return

    print(f"Found {len(issues)} fixable issues:")
    for issue in issues:
        print(f"  [{issue['rule_id']}] {issue['description']}")
        print(f"      Current: {issue['original'][:50]}...")


def cmd_fix(path: str, args):
    """Fix SVG issues"""
    svg_file = find_svg_file(path)

    if not svg_file:
        print(f"Error: SVG not found: {path}", file=sys.stderr)
        sys.exit(1)

    content = svg_file.read_text()
    new_content, fixes = fix_svg(content)

    if args.json:
        output = {
            "file": str(svg_file.relative_to(PROJECT_ROOT)),
            "fixes_applied": fixes,
            "fix_count": len(fixes),
            "dry_run": args.dry_run
        }
        print(json.dumps(output, indent=2))
        return

    if not fixes:
        print(f"No fixes needed for: {svg_file.name}")
        return

    print(f"Fixing: {svg_file.relative_to(PROJECT_ROOT)}")
    print(f"Applied {len(fixes)} fixes:")
    for fix in fixes:
        print(f"  [{fix['rule_id']}] {fix['description']}")

    if args.dry_run:
        print("\n(dry-run mode - no changes written)")
    else:
        svg_file.write_text(new_content)
        print(f"\nChanges written to {svg_file.name}")


def cmd_all(args):
    """Check all SVGs"""
    svgs = get_all_svgs()

    results = []
    total_issues = 0
    total_fixable = 0

    for svg_file in svgs:
        content = svg_file.read_text()
        issues = check_svg(content)

        if issues:
            result = {
                "file": str(svg_file.relative_to(WIREFRAMES_DIR)),
                "issues": len(issues),
                "fixable": len([i for i in issues if i["fixable"]]),
                "issue_types": list(set(i["rule_id"] for i in issues))
            }
            results.append(result)
            total_issues += len(issues)
            total_fixable += result["fixable"]

    if args.json:
        output = {
            "total_svgs": len(svgs),
            "svgs_with_issues": len(results),
            "total_issues": total_issues,
            "total_fixable": total_fixable,
            "files": results
        }
        print(json.dumps(output, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| SVG AUTOFIX SCAN ({len(svgs)} files){' ' * 50}|"[:80])
    print("+" + "-" * 78 + "+")

    if not results:
        print("| No fixable issues found in any SVG" + " " * 42 + "|")
    else:
        print("| File                                    | Issues | Fixable | Types            |")
        print("+" + "-" * 78 + "+")

        for r in results[:20]:
            file_name = r["file"][:39].ljust(39)
            types = ", ".join(r["issue_types"][:2])[:16].ljust(16)
            print(f"| {file_name} | {r['issues']:6} | {r['fixable']:7} | {types} |")

        if len(results) > 20:
            print(f"| ... and {len(results) - 20} more files{' ' * 55}|"[:80])

    print("+" + "-" * 78 + "+")
    print(f"| TOTAL: {total_issues} issues in {len(results)} files ({total_fixable} fixable){' ' * 30}|"[:80])
    print("+" + "=" * 78 + "+")

    if not args.dry_run and total_fixable > 0:
        print(f"\nRun with --dry-run to preview or without to apply fixes")


def cmd_diff(path: str, args):
    """Show proposed changes"""
    svg_file = find_svg_file(path)

    if not svg_file:
        print(f"Error: SVG not found: {path}", file=sys.stderr)
        sys.exit(1)

    content = svg_file.read_text()
    new_content, fixes = fix_svg(content)

    if args.json:
        output = {
            "file": str(svg_file.relative_to(PROJECT_ROOT)),
            "original_size": len(content),
            "new_size": len(new_content),
            "fixes": fixes
        }
        print(json.dumps(output, indent=2))
        return

    if not fixes:
        print(f"No changes to apply for: {svg_file.name}")
        return

    print(f"Proposed changes for: {svg_file.relative_to(PROJECT_ROOT)}")
    print()

    for fix in fixes:
        print(f"--- [{fix['rule_id']}] {fix['description']} ---")
        print(f"- {fix['original']}")
        print(f"+ {fix['fixed']}")
        print()


def to_summary(args) -> str:
    """Generate one-line summary"""
    svgs = get_all_svgs()
    total_issues = 0
    svgs_with_issues = 0

    for svg_file in svgs:
        content = svg_file.read_text()
        issues = check_svg(content)
        if issues:
            svgs_with_issues += 1
            total_issues += len(issues)

    status = "CLEAN" if total_issues == 0 else "FIXABLE"

    return f"SVG Autofix: {status} | {len(svgs)} SVGs | {svgs_with_issues} with issues | {total_issues} fixable"


def main():
    parser = argparse.ArgumentParser(
        description="SVG Autofix",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="all",
                       help="Command (check, fix, all, diff)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "all":
        cmd_all(args)
    elif args.command == "check":
        if not args.args:
            print("Error: check requires SVG path", file=sys.stderr)
            sys.exit(1)
        cmd_check(args.args[0], args)
    elif args.command == "fix":
        if not args.args:
            print("Error: fix requires SVG path", file=sys.stderr)
            sys.exit(1)
        cmd_fix(args.args[0], args)
    elif args.command == "diff":
        if not args.args:
            print("Error: diff requires SVG path", file=sys.stderr)
            sys.exit(1)
        cmd_diff(args.args[0], args)
    else:
        # Assume it's a path for check
        cmd_check(args.command, args)


if __name__ == "__main__":
    main()
