#!/usr/bin/env python3
"""
Wireframe Prep Loader - File discovery for /wireframe-prep skill

Discovers required files and outputs paths for Claude to read.
Reduces token usage by offloading file discovery to Python.

Usage: python3 wireframe-prep-loader.py [command] [args]

Commands:
  files                         List mandatory files to read
  files <feature>               List files for specific feature
  spec <feature>                Find and output spec.md path
  issues                        List all *.issues.md files
  issues <feature>              List issues.md for specific feature
  escalation                    Run escalation check
  summary                       Show prep summary (file counts)
  prime [feature]               Output full priming block
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Dict

SCRIPT_DIR = Path(__file__).parent
WIREFRAMES_DIR = SCRIPT_DIR
FEATURES_DIR = SCRIPT_DIR.parent.parent.parent / "features"
HOME = Path.home()

# Mandatory files for all prep
MANDATORY_FILES = [
    WIREFRAMES_DIR / "validate-wireframe.py",
    WIREFRAMES_DIR / "GENERAL_ISSUES.md",
    HOME / ".claude" / "commands" / "wireframe.md",
]


def find_feature_dir(feature_num: str) -> Optional[Path]:
    """Find feature directory by number prefix"""
    # Search in features/ subdirectories
    for category_dir in FEATURES_DIR.iterdir():
        if not category_dir.is_dir():
            continue
        for feature_dir in category_dir.iterdir():
            if feature_dir.is_dir() and feature_dir.name.startswith(f"{feature_num}-"):
                return feature_dir
    return None


def find_spec_file(feature_num: str) -> Optional[Path]:
    """Find spec.md for a feature"""
    feature_dir = find_feature_dir(feature_num)
    if feature_dir:
        spec_file = feature_dir / "spec.md"
        if spec_file.exists():
            return spec_file
    return None


def find_wireframe_dir(feature_num: str) -> Optional[Path]:
    """Find wireframe directory for a feature"""
    for d in WIREFRAMES_DIR.iterdir():
        if d.is_dir() and d.name.startswith(f"{feature_num}-"):
            return d
    return None


def list_issues_files(feature_num: Optional[str] = None) -> List[Path]:
    """List all *.issues.md files, optionally filtered by feature"""
    issues = []

    if feature_num:
        wireframe_dir = find_wireframe_dir(feature_num)
        if wireframe_dir:
            issues.extend(wireframe_dir.glob("*.issues.md"))
    else:
        for d in WIREFRAMES_DIR.iterdir():
            if d.is_dir() and d.name[0].isdigit():
                issues.extend(d.glob("*.issues.md"))

    return sorted(issues)


def list_mandatory_files() -> None:
    """List mandatory files to read"""
    print("Mandatory files:")
    for f in MANDATORY_FILES:
        exists = "✓" if f.exists() else "✗"
        print(f"  {exists} {f}")


def list_feature_files(feature_num: str) -> None:
    """List all files needed for a specific feature"""
    print(f"Files for feature {feature_num}:")
    print()

    # Mandatory files
    print("Mandatory:")
    for f in MANDATORY_FILES:
        exists = "✓" if f.exists() else "✗"
        print(f"  {exists} {f}")

    print()

    # Spec file
    spec = find_spec_file(feature_num)
    print("Spec:")
    if spec:
        print(f"  ✓ {spec}")
    else:
        print(f"  ✗ No spec.md found for {feature_num}")

    print()

    # Issues files
    issues = list_issues_files(feature_num)
    print(f"Issues ({len(issues)}):")
    if issues:
        for f in issues:
            print(f"  {f.name}")
    else:
        print("  (none)")

    print()

    # Wireframe dir
    wireframe_dir = find_wireframe_dir(feature_num)
    if wireframe_dir:
        svgs = list(wireframe_dir.glob("*.svg"))
        print(f"Existing SVGs ({len(svgs)}):")
        for svg in sorted(svgs):
            print(f"  {svg.name}")
    else:
        print("Wireframe dir: (not created yet)")


def output_spec_path(feature_num: str) -> None:
    """Find and output spec.md path"""
    spec = find_spec_file(feature_num)
    if spec:
        print(spec)
    else:
        print(f"Error: No spec.md found for feature {feature_num}", file=sys.stderr)
        # Try to help find it
        feature_dir = find_feature_dir(feature_num)
        if feature_dir:
            print(f"Feature dir exists: {feature_dir}", file=sys.stderr)
            print("Contents:", file=sys.stderr)
            for f in feature_dir.iterdir():
                print(f"  {f.name}", file=sys.stderr)
        else:
            print(f"No feature directory found matching {feature_num}-*", file=sys.stderr)
        sys.exit(1)


def output_issues(feature_num: Optional[str] = None) -> None:
    """List issues.md files"""
    issues = list_issues_files(feature_num)

    if not issues:
        if feature_num:
            print(f"No issues files for feature {feature_num}")
        else:
            print("No issues files found")
        return

    for f in issues:
        print(f)


def run_escalation_check() -> None:
    """Run the escalation check"""
    validator = WIREFRAMES_DIR / "validate-wireframe.py"
    if not validator.exists():
        print("Error: validate-wireframe.py not found", file=sys.stderr)
        sys.exit(1)

    result = subprocess.run(
        ["python3", str(validator), "--check-escalation"],
        capture_output=True,
        text=True,
        cwd=WIREFRAMES_DIR
    )

    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)


def show_summary() -> None:
    """Show prep summary with file counts"""
    # Count mandatory files
    mandatory_exists = sum(1 for f in MANDATORY_FILES if f.exists())

    # Count all issues files
    all_issues = list_issues_files()

    # Count wireframe dirs
    wireframe_dirs = [d for d in WIREFRAMES_DIR.iterdir()
                      if d.is_dir() and d.name[0].isdigit()]

    # Count total SVGs
    total_svgs = sum(len(list(d.glob("*.svg"))) for d in wireframe_dirs)

    print("Wireframe Prep Summary")
    print("=" * 40)
    print(f"Mandatory files: {mandatory_exists}/{len(MANDATORY_FILES)}")
    print(f"Wireframe dirs:  {len(wireframe_dirs)}")
    print(f"Total SVGs:      {total_svgs}")
    print(f"Issues files:    {len(all_issues)}")


def output_priming_block(feature_num: Optional[str] = None) -> None:
    """Output the full priming block"""

    # Determine mode
    if feature_num:
        mode = f"{feature_num}"
        spec = find_spec_file(feature_num)
        feature_dir = find_feature_dir(feature_num)
        feature_name = feature_dir.name if feature_dir else f"{feature_num}-unknown"
    else:
        mode = "patch mode"
        feature_name = "patch mode"

    # Get counts
    issues = list_issues_files(feature_num)
    wireframe_dir = find_wireframe_dir(feature_num) if feature_num else None
    svg_count = len(list(wireframe_dir.glob("*.svg"))) if wireframe_dir else 0

    # Output priming block
    print("═" * 63)
    print("WIREFRAME GENERATION PRIMED")
    print("═" * 63)
    print()
    print("NON-NEGOTIABLE:")
    print("- Validator MUST show STATUS: PASS before done")
    print("- If errors → FIX THEM. No excuses.")
    print("- NEVER say \"false positives\" or \"validator limitations\"")
    print()
    print("CRITICAL RULES (validator-enforced):")
    print("- Canvas: blue gradient #c7ddf5 → #b8d4f0")
    print("- Title: centered at y=28, text-anchor=\"middle\"")
    print("- Signature: y=1060, 18px bold")
    print("- Numbered callouts ①②③④ ON mockup UI elements")
    print("- Use <use href=\"includes/...\"/> for headers/footers")
    print("- Minimum font: 14px everywhere")
    print("- Modal overlay: dark (#000 with opacity)")
    print("- Footer <use> AFTER modal content")
    print()
    print("ISSUE WORKFLOW:")
    print("1. Validator auto-logs issues to feature/*.issues.md")
    print("2. Issues escalate to GENERAL_ISSUES.md when seen in 2+ features")
    print("3. Run --check-escalation periodically to find candidates")
    print()
    print("WORKFLOW: PRE-FLIGHT → Generate → Validate → PASS or fix")
    print()
    print(f"Feature: {feature_name}")
    if feature_num:
        print(f"Existing SVGs: {svg_count}")
        print(f"Issues files: {len(issues)}")
    print("Ready for /wireframe command.")
    print("═" * 63)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    if command == "files":
        if args:
            list_feature_files(args[0])
        else:
            list_mandatory_files()

    elif command == "spec":
        if not args:
            print("Usage: spec <feature>", file=sys.stderr)
            sys.exit(1)
        output_spec_path(args[0])

    elif command == "issues":
        output_issues(args[0] if args else None)

    elif command == "escalation":
        run_escalation_check()

    elif command == "summary":
        show_summary()

    elif command == "prime":
        output_priming_block(args[0] if args else None)

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
