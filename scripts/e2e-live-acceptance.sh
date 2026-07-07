#!/usr/bin/env bash
# Live-acceptance E2E runner — drives the payment specs against the REAL
# provider sandboxes (Stripe test mode / PayPal sandbox) using the creds in
# your gitignored .env. CI never runs these legs (its env carries no provider
# keys, so the specs auto-skip); this script is how they actually get run.
#
# Run from the HOST (it orchestrates docker compose):
#   pnpm run test:e2e:live                       # default: payment suite, chromium
#   ./scripts/e2e-live-acceptance.sh tests/e2e/payment/08-subscription-lifecycle.spec.ts --project=chromium-gen
#
# What it encodes (each step failed with a misleading symptom before it was
# understood — see docs/project/TESTING.md "Live-acceptance E2E"):
#   1. ROOT-PATH build: CI has no .env, so its build has no basePath. A
#      basePath build under plain `serve` 404s every chunk → blank page.
#   2. Serve on :3001: the edge fns' CORS allowlists ONLY the configured
#      site URL + localhost:3000/3001 — any other port → "Failed to fetch".
#   3. NEXT_PUBLIC_BASE_PATH= on the TEST RUN too: playwright's dotenv loads
#      the /ScriptHammer value from .env and the authed fixture helpers
#      prepend it to gotos → app-styled 404s on a root-path build.
set -euo pipefail
cd "$(dirname "$0")/.."

# Host guard: inside the container there is no docker CLI — without this the
# script dies at the first compose call with a confusing error.
if ! command -v docker >/dev/null 2>&1; then
  echo "error: run this from the HOST (it orchestrates docker compose);" >&2
  echo "       inside the container use plain 'pnpm exec playwright test'." >&2
  exit 1
fi

ARGS=("$@")
if [ ${#ARGS[@]} -eq 0 ]; then
  ARGS=(tests/e2e/payment --project=chromium-gen)
fi

# Only auto-restore the manifest if WE dirtied it — never discard an edit the
# operator had pending before this run.
MANIFEST_CLEAN_AT_START=0
git diff --quiet -- public/manifest.json 2>/dev/null && MANIFEST_CLEAN_AT_START=1

# Matches both the npx and pnpm-exec forms of the serve process (whose
# cmdline is node .../serve/build/main.js out -l 3001 — no literal "serve out").
kill_serve() {
  docker compose exec -T scripthammer pkill -f "serve.*-l 3001" >/dev/null 2>&1 || true
}

cleanup() {
  kill_serve
  # Root-path builds flip start_url/scope in the generated manifest.
  if [ "$MANIFEST_CLEAN_AT_START" -eq 1 ]; then
    git checkout -- public/manifest.json 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "== 1/3 clean root-path build (CI-matching)"
# NEXT_DIST_DIR isolates this build from the dev server, which owns .next.
# It must live INSIDE the .next-acceptance NAMED VOLUME (docker-compose.yml):
# on the WSL2 bind mount, freshly-written chunks are intermittently invisible
# to Next's page-collection workers ("Cannot find module for page") — and it
# must be a SUBDIRECTORY of the volume, not the mount point itself, because
# export-mode builds rmdir the distDir root at the end (EBUSY on a mount).
docker compose exec -T scripthammer sh -c 'rm -rf .next-acceptance/build'
docker compose exec -T -e NEXT_PUBLIC_BASE_PATH= -e NEXT_DIST_DIR=.next-acceptance/build \
  scripthammer pnpm run build

echo "== 2/3 static serve on :3001"
# Clear any orphan from a previous crashed run FIRST — otherwise the health
# check below can green-light a stale server still holding the old build.
kill_serve
# pnpm exec (local devDependency), NOT npx: on a freshly created container the
# npm cache is empty and npx's download can outlast any reasonable wait.
# Serve the distDir itself: with a custom NEXT_DIST_DIR, Next 15.5's export
# REPLACES the distDir contents with the finished static site and never
# creates out/ (empirical — out/ only appears with the default .next).
docker compose exec -T -d scripthammer pnpm exec serve .next-acceptance/build -l 3001
for i in $(seq 1 30); do
  if docker compose exec -T scripthammer sh -c 'curl -sf -o /dev/null http://localhost:3001/'; then
    break
  fi
  [ "$i" -eq 30 ] && { echo "serve never came up on :3001" >&2; exit 1; }
  sleep 1
done

echo "== 3/3 playwright: ${ARGS[*]}"
# --reporter=list comes FIRST so an operator-supplied --reporter in ARGS wins
# (playwright takes the last occurrence of a single-value option).
docker compose exec -T \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e SKIP_WEBSERVER=1 \
  -e BASE_URL=http://localhost:3001 \
  -e NEXT_PUBLIC_BASE_PATH= \
  scripthammer pnpm exec playwright test --reporter=list "${ARGS[@]}"

echo "== done — read the per-test PASS/SKIP lines above; a live test that"
echo "   SKIPPED means a cred is missing from .env, not that it passed."
