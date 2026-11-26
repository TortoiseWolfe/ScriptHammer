#!/usr/bin/env bash
# Copy the house band's files over this checkout, just before the build.
#
# The band's music, art and pages are all rights reserved and live in the private repository
# TortoiseWolfe/band-wagon, so the public template carries none of them. scripthammer.com's deploy
# pulls them in here with a read-only deploy key. Anyone else's build has no key, so this prints a
# notice and does nothing: the site builds with no band, which is the intended result.
#
# Usage: BAND_DEPLOY_KEY="<private key text>" bash scripts/ci/band-overlay.sh
# Optional: BAND_REPO (default TortoiseWolfe/band-wagon), BAND_REF (default main).
set -euo pipefail

if [ -z "${BAND_DEPLOY_KEY:-}" ]; then
  echo "::notice::No BAND_DEPLOY_KEY. Building without the house band, as a template does."
  exit 0
fi

repo="${BAND_REPO:-TortoiseWolfe/band-wagon}"
ref="${BAND_REF:-main}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

key="$work/key"
umask 077
printf '%s\n' "$BAND_DEPLOY_KEY" >"$key"

GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git clone --quiet --depth 1 --branch "$ref" "git@github.com:${repo}.git" "$work/band"

if [ ! -d "$work/band/overlay" ]; then
  echo "::error::$repo has no overlay/ folder"
  exit 1
fi

cp -a "$work/band/overlay/." .

# The blog index (src/lib/blog/blog-data.json) is tracked and built from public/blog, and this
# public repository carries no band post, so the index has no entry for it. Rebuild the index when
# the overlay brought a post in, or the band's blog page is never generated and answers 404.
# The generator is deterministic (stable ids), so the other posts come out as committed.
if [ -d "$work/band/overlay/public/blog" ]; then
  node scripts/generate-blog-data.js
fi
echo "::notice::House band files copied in from $repo@$(git -C "$work/band" rev-parse --short HEAD)"
