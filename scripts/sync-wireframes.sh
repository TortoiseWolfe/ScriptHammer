#!/usr/bin/env bash
# Sync wireframe assets from docs/design/wireframes/ to public/wireframes/
# for Next.js static export. The canonical source remains in docs/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR/docs/design/wireframes"
DEST="$ROOT_DIR/public/wireframes"

# Clean destination
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy SVG feature directories (NNN-*)
for dir in "$SRC"/[0-9]*; do
  [ -d "$dir" ] || continue
  dirname="$(basename "$dir")"
  mkdir -p "$DEST/$dirname"
  # Copy only SVG files
  find "$dir" -maxdepth 1 -name '*.svg' -exec cp {} "$DEST/$dirname/" \;
done

# Copy shared includes
if [ -d "$SRC/includes" ]; then
  mkdir -p "$DEST/includes"
  cp "$SRC"/includes/*.svg "$DEST/includes/"
fi

# Copy templates
if [ -d "$SRC/templates" ]; then
  mkdir -p "$DEST/templates"
  cp "$SRC"/templates/*.svg "$DEST/templates/" 2>/dev/null || true
fi

# Copy viewer (renamed to avoid conflict with Next.js route index.html)
cp "$SRC/index.html" "$DEST/viewer.html"
cp "$SRC/wireframe-status.json" "$DEST/" 2>/dev/null || true

echo "Synced wireframes to public/wireframes/"
