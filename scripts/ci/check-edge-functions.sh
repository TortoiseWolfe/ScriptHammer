#!/usr/bin/env bash
#
# Type-check every Edge Function under real Deno (#1153).
#
# WHY THIS EXISTS. Nothing had ever checked `supabase/functions/**`, and three independent
# exclusions are why: `vitest.config.ts` excludes the directory, no workflow ran `deno check`,
# and `tsconfig.json` excludes it — correctly, because these are Deno and the app is Node. So
# `pnpm type-check` passing said nothing about them. The first run found 21 errors across
# `create-order`, both webhooks and `send-payment-email` — every one on the money path.
#
# DOCKER-FIRST, like everything else here. `deno` is not installed on the host or in the app
# container and CLAUDE.md forbids installing it. The official image is used exactly the way
# `playwright-in-container.sh` uses Microsoft's — which is also the correction that produced this
# script: "not in the container" was mistaken for "cannot run".
set -uo pipefail

cd "$(dirname "$0")/../.."

DENO_IMAGE="${DENO_IMAGE:-denoland/deno:latest}"

# Prefer a real deno when the environment has one (CI installs it via setup-deno); fall back to
# the image locally. Both run the identical command.
# `--node-modules-dir=none` is load-bearing, not tidiness. Without it Deno finds the APP's
# `node_modules` beside `package.json`, assumes npm specifiers resolve from there, and fails
# three functions with "Could not find a matching package for 'npm:@supabase/realtime-js'" —
# a resolution error about the Node app, not a defect in the Deno function. Edge Functions
# never use that directory; Supabase's runtime resolves from the network.
DENO_ARGS=(check --node-modules-dir=none)

if command -v deno >/dev/null 2>&1; then
  run_check() { deno "${DENO_ARGS[@]}" "$1"; }
  echo "deno: local binary ($(deno --version | head -1))"
else
  run_check() {
    docker run --rm -v "$PWD":/app -w /app "$DENO_IMAGE" deno "${DENO_ARGS[@]}" "$1"
  }
  echo "deno: $DENO_IMAGE (no local binary — Docker-first, as CLAUDE.md requires)"
fi

failed=0
checked=0
for dir in supabase/functions/*/; do
  entry="${dir}index.ts"
  [ -f "$entry" ] || continue          # `_shared` is not a function
  name="$(basename "$dir")"
  checked=$((checked + 1))
  if out="$(run_check "$entry" 2>&1)"; then
    printf '  ok    %s\n' "$name"
  else
    failed=$((failed + 1))
    printf '  FAIL  %s\n' "$name"
    printf '%s\n' "$out" | sed 's/^/        /'
  fi
done

echo
if [ "$checked" -eq 0 ]; then
  # Anti-vacuity. A moved directory would otherwise report a clean sweep of nothing, which is
  # the same silent-green failure this script was written to end.
  echo "::error::no Edge Functions were checked — supabase/functions/*/index.ts matched nothing."
  exit 1
fi

if [ "$failed" -gt 0 ]; then
  echo "::error::$failed of $checked Edge Function(s) fail type checking (#1153)."
  exit 1
fi

echo "OK — $checked Edge Function(s) type-check clean."
