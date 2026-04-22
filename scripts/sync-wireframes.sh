#!/usr/bin/env bash
# Sync wireframe assets from the features/ tree into public/wireframes/ so
# the Next.js static export can serve them under `/wireframes`.
#
# Layout:
#   features/<category>/<NNN-feature>/wireframes/*.svg     ← canonical source
#                                    /includes/*.svg        (optional per-feature)
#
# Emitted:
#   public/wireframes/viewer.html                           (from extension)
#   public/wireframes/viewer-config.json                    (from extension)
#   public/wireframes/wireframes-manifest.json              (generated)
#   public/wireframes/<category>-<feature>/<svg>            (flattened)
#   public/wireframes/<category>-<feature>/includes/*.svg   (per-feature chrome)
#
# The category + feature are flattened into a single slug when copied so
# viewer URLs stay predictable (`/wireframes/foundation-003-user-authentication/…`).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR/features"
DEST="$ROOT_DIR/public/wireframes"
EXT_DIR="$ROOT_DIR/.specify/extensions/wireframe"

# Clean destination
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy viewer shell from the extension (it's the single source of truth)
if [ -f "$EXT_DIR/viewer/viewer.html" ]; then
    cp "$EXT_DIR/viewer/viewer.html" "$DEST/viewer.html"
else
    echo "sync-wireframes: viewer.html not found at $EXT_DIR/viewer/ — extension may not be installed."
    echo "  Run \`./specify extension add wireframe\` then re-run this script."
    exit 1
fi

if [ -f "$EXT_DIR/viewer/viewer-config.json" ]; then
    cp "$EXT_DIR/viewer/viewer-config.json" "$DEST/viewer-config.json"
fi

# Walk features/<cat>/<feat>/wireframes/ → public/wireframes/<cat>-<feat>/
svg_count=0
while IFS= read -r -d '' wf_dir; do
    feat_dir="$(dirname "$wf_dir")"
    feat_name="$(basename "$feat_dir")"
    cat_dir="$(dirname "$feat_dir")"
    cat_name="$(basename "$cat_dir")"
    slug="${cat_name}-${feat_name}"

    mkdir -p "$DEST/$slug"
    # Copy every SVG in this feature's wireframes/ (skip includes/ subdir here — handled next)
    find "$wf_dir" -maxdepth 1 -name '*.svg' -exec cp {} "$DEST/$slug/" \;
    # Copy per-feature includes/ if present
    if [ -d "$wf_dir/includes" ]; then
        mkdir -p "$DEST/$slug/includes"
        cp "$wf_dir"/includes/*.svg "$DEST/$slug/includes/" 2>/dev/null || true
    fi
    svg_count=$((svg_count + $(find "$wf_dir" -maxdepth 1 -name '*.svg' | wc -l)))
done < <(find "$SRC" -type d -name 'wireframes' -print0)

# Generate manifest (reads the features tree we just mirrored).
# `--path-prefix ""` yields relative paths so the viewer fetches siblings
# of its own URL — works whether deployed at `/` or under a basePath.
if [ -f "$EXT_DIR/scripts/generate-manifest.py" ]; then
    python3 "$EXT_DIR/scripts/generate-manifest.py" \
        --root "$SRC" \
        --output "$DEST/wireframes-manifest.json" \
        --path-prefix ""
else
    echo "sync-wireframes: generate-manifest.py not found; skipping manifest generation."
    echo "  Viewer will fall back to empty nav."
fi

echo "Synced $svg_count wireframes from $SRC → $DEST"
