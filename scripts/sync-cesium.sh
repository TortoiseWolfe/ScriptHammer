#!/usr/bin/env bash
# Sync CesiumJS's static runtime assets from node_modules into public/cesium/
# so the Next.js static export serves them alongside the app.
#
# WHY THIS EXISTS
# Cesium loads four asset trees at RUNTIME by URL, not through the bundler:
#   Workers/     web workers (terrain/geometry decode) — nothing renders without them
#   Assets/      IAU2006_XYS earth-orientation, approximateTerrainHeights.json
#                (required by clampToGround), skybox + textures
#   ThirdParty/  draco/basis decoders for glTF + 3D Tiles
#   Widgets/     widget CSS + images
# It finds them via `window.CESIUM_BASE_URL`, which the app sets to
# getAssetUrl('/cesium/') — see src/twin/cesium/. Only getAssetUrl() is correct
# across all four basePath regimes ('' on the CNAME'd production deploy, ''
# under DISABLE_BASE_PATH, '/ScriptHammer' for the basepath E2E job and local
# .env). Never hardcode the prefix.
#
# The npm package ships these prebuilt under Build/Cesium/, so no postinstall is
# needed — cesium's own `prepare` script is repo tooling (gulp/husky/playwright)
# and pnpm is right to block it. We deliberately do NOT copy Build/Cesium/
# Cesium.js or index.js (~10MB): webpack bundles the library itself from the
# package's `module` entry. Only the runtime-fetched trees belong in public/.
#
# public/cesium/ is GITIGNORED and generated: ~8MB of vendored binaries that can
# drift from the lockfile is exactly the debt the constitution forbids —
# node_modules/cesium is the single source of truth. Same call as
# public/wireframes/.
#
# Wired into BOTH `dev` and `prebuild` in package.json, because `pnpm dev` does
# not run `prebuild` — that is precisely why sync-wireframes.sh is listed twice.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR/node_modules/cesium/Build/Cesium"
DEST="$ROOT_DIR/public/cesium"
TREES=(Workers Assets ThirdParty Widgets)

if [ ! -d "$SRC" ]; then
    echo "sync-cesium: $SRC not found."
    echo "  Run \`docker compose exec scripthammer pnpm install\` first."
    exit 1
fi

VERSION="$(node -p "require('$ROOT_DIR/node_modules/cesium/package.json').version")"
STAMP="$DEST/.cesium-version"

# Re-copying ~8MB on every `pnpm dev` is pure waste; the version stamp makes it
# a no-op once synced. A version bump (or a hand-deleted tree) forces a rebuild.
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$VERSION" ]; then
    for tree in "${TREES[@]}"; do
        if [ ! -d "$DEST/$tree" ]; then
            rm -f "$STAMP" # incomplete sync — fall through and redo it
            break
        fi
    done
    if [ -f "$STAMP" ]; then
        echo "Cesium $VERSION assets already synced → $DEST"
        exit 0
    fi
fi

rm -rf "$DEST"
mkdir -p "$DEST"

for tree in "${TREES[@]}"; do
    if [ ! -d "$SRC/$tree" ]; then
        echo "sync-cesium: expected $SRC/$tree — cesium package layout changed."
        echo "  Cesium runtime-fetches this tree; shipping without it renders a black globe."
        exit 1
    fi
    cp -R "$SRC/$tree" "$DEST/$tree"
done

echo "$VERSION" >"$STAMP"
echo "Synced Cesium $VERSION assets (${TREES[*]}) → $DEST"
