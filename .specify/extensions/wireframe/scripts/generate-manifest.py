#!/usr/bin/env python3
"""
Generate wireframes-manifest.json for the viewer.

Scans a feature tree for `wireframes/*.svg` and emits a JSON manifest the
viewer can fetch. Supports both flat layouts (SpecKit default) and the
ScriptHammer two-level layout (`features/<category>/<feature>/wireframes/`).
Also reads any *.issues.md files to surface review status in the manifest.

Usage:
  # Flat SpecKit layout (specs/<feature>/wireframes/…)
  python3 scripts/generate-manifest.py

  # ScriptHammer nested layout (features/<cat>/<feature>/wireframes/…)
  python3 scripts/generate-manifest.py \\
      --root features \\
      --output public/wireframes/wireframes-manifest.json \\
      --path-prefix /wireframes

Writes to .specify/extensions/wireframe/viewer/wireframes-manifest.json by default.
"""
import argparse
import json
import re
import sys
from pathlib import Path


def extract_title(svg_path: Path) -> str:
    """Read the first <title>-like text from the SVG, fall back to filename."""
    try:
        content = svg_path.read_text(errors="ignore")
        # Look for the centered title text element (v5 convention: y="28")
        m = re.search(r'<text[^>]*y=["\']28["\'][^>]*>([^<]+)</text>', content)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    # Fall back to filename: "01-sign-in.svg" → "Sign In"
    stem = svg_path.stem
    parts = stem.split("-", 1)
    title = parts[1] if len(parts) > 1 and parts[0].isdigit() else stem
    return title.replace("-", " ").title()


def detect_status(svg_path: Path) -> str:
    """Derive review status from sibling .issues.md file."""
    issues = svg_path.with_suffix(".issues.md")
    if not issues.exists():
        return "draft"
    try:
        content = issues.read_text()
    except Exception:
        return "draft"
    m = re.search(r'^\*\*Status:\*\*\s*(\w+)', content, re.MULTILINE)
    if not m:
        return "draft"
    status = m.group(1).upper()
    return {"PASS": "approved", "PATCH": "review", "REGENERATE": "review", "REGEN": "review"}.get(status, "draft")


def detect_theme(svg_path: Path) -> str:
    """Guess theme by peeking at the background fill."""
    try:
        content = svg_path.read_text(errors="ignore")[:1000]
    except Exception:
        return "unknown"
    if "bg-dark" in content or "#0f172a" in content or "#1a1a2e" in content:
        return "dark"
    if "#c7ddf5" in content or "#e8d4b8" in content:
        return "light"
    return "unknown"


def feature_label(feature_dir: str) -> str:
    """Turn '001-user-login' into '001 - User Login'."""
    m = re.match(r'^(\d+)-(.+)$', feature_dir)
    if not m:
        return feature_dir
    num, slug = m.groups()
    return f"{num} - {slug.replace('-', ' ').title()}"


def find_feature_dirs(root: Path) -> list[Path]:
    """Discover every dir under `root` that contains a `wireframes/` child.

    Works for both flat layouts (`specs/NNN-name/wireframes/`) and nested
    layouts (`features/cat/NNN-name/wireframes/`). Returns feature dirs in
    sorted order; duplicates (same basename in multiple categories) are
    disambiguated by their relative path.
    """
    if not root.exists():
        return []
    features: list[Path] = []
    # Recursive: the wireframes/ dir is always the immediate parent of the
    # SVGs, and its parent is the "feature dir" we want.
    for wf_dir in sorted(root.glob("**/wireframes")):
        if not wf_dir.is_dir():
            continue
        feature = wf_dir.parent
        if feature in features:
            continue
        features.append(feature)
    return features


def build_manifest(root: Path, path_prefix: str) -> dict:
    """Build the manifest by walking `root` and emitting path_prefix-prefixed paths.

    `path_prefix` is prepended to each wireframe's URL in the flat list,
    so e.g. `--path-prefix /wireframes` yields `/wireframes/<feature>/<svg>`.
    """
    features: list[dict] = []

    for feature_dir in find_feature_dirs(root):
        wireframes_dir = feature_dir / "wireframes"
        svgs = sorted(wireframes_dir.glob("*.svg"))
        if not svgs:
            continue

        # Category prefix disambiguates same-named features across cats.
        # Relative from `root`: e.g. "foundation/001-wcag-aa-compliance"
        try:
            rel = feature_dir.relative_to(root)
        except ValueError:
            rel = Path(feature_dir.name)

        feature_id = str(rel).replace("/", "-")  # e.g. "foundation-001-wcag-aa-compliance"
        category = rel.parent.name if rel.parent != Path(".") else ""

        feature_entries = []
        for svg in svgs:
            feature_entries.append({
                "path": svg.name,  # Just the basename; viewer joins with feature_id
                "title": extract_title(svg),
                "status": detect_status(svg),
                "theme": detect_theme(svg),
                "svg_file": svg.name,
            })
        features.append({
            "id": feature_id,
            "label": feature_label(feature_dir.name),
            "category": category,
            "source_path": str(rel),  # original path under root (category/feature)
            "wireframes": feature_entries,
        })

    # Flat list is what the viewer iterates for nav + prev/next.
    # Each entry's `path` is what the viewer fetches. An empty `path_prefix`
    # produces relative paths (sibling of viewer.html); a non-empty prefix
    # produces absolute URL paths rooted at the prefix.
    prefix = path_prefix.rstrip("/")

    def _build_path(feature_id: str, svg_name: str) -> str:
        tail = f"{feature_id}/{svg_name}"
        return f"{prefix}/{tail}" if prefix else tail

    flat = [
        {
            "path": _build_path(f["id"], wf["path"]),
            "title": wf["title"],
            "feature": f["id"],
            "feature_label": f["label"],
            "category": f.get("category", ""),
            "status": wf["status"],
            "theme": wf["theme"],
        }
        for f in features
        for wf in f["wireframes"]
    ]

    return {
        "schema_version": "1.0",
        "features": features,
        "wireframes": flat,
        "total": len(flat),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", "--specs-dir",
        default="specs",
        dest="root",
        help="Root dir to walk for feature/<name>/wireframes/ (default: specs)",
    )
    parser.add_argument(
        "--output",
        default=".specify/extensions/wireframe/viewer/wireframes-manifest.json",
        help="Path to write the manifest JSON",
    )
    parser.add_argument(
        "--path-prefix",
        default="/specs",
        help="URL prefix for each wireframe's path (default: /specs)",
    )
    args = parser.parse_args()

    root = Path(args.root)
    manifest = build_manifest(root, args.path_prefix)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"Wrote manifest: {output}")
    print(f"  Features: {len(manifest['features'])}")
    print(f"  Wireframes: {manifest['total']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
