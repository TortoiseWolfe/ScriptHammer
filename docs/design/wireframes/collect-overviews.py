#!/usr/bin/env python3
"""Collect overview PNGs to central /pngs folder."""

import shutil
from pathlib import Path


def collect_overviews():
    wireframes_dir = Path(__file__).parent
    project_root = wireframes_dir.parent.parent.parent
    png_source = wireframes_dir / "png"
    png_target = project_root / "pngs"

    # Create target directory
    png_target.mkdir(exist_ok=True)

    # Find all overview.png files
    count = 0
    for overview in sorted(png_source.rglob("overview.png")):
        # Extract: png/000-feature/01-screen/overview.png
        parts = overview.relative_to(png_source).parts
        feature = parts[0]   # 000-landing-page
        screen = parts[1]    # 01-landing-page

        # Create flat name: 000-landing-page_01-landing-page_overview.png
        target_name = f"{feature}_{screen}_overview.png"
        target_path = png_target / target_name

        shutil.copy2(overview, target_path)
        print(f"Copied: {target_name}")
        count += 1

    print(f"\nDone! {count} files collected to: {png_target}")


if __name__ == "__main__":
    collect_overviews()
