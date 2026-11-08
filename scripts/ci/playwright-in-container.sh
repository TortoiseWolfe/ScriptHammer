#!/usr/bin/env bash
# Run Playwright from the image that already ships the browsers (#829).
#
# WHY THIS EXISTS AS ONE SCRIPT. The same `docker run` prelude is needed at ten call
# sites across four workflows. Ten copies is ten chances for one of them to drift —
# and the drift that actually happened was subtle: an `--env-file` filter whose `=`
# bound to every branch of an alternation, forwarding two variables instead of eight
# and failing 25 of 26 jobs with a DNS error 300 lines downstream (#830).
#
# WHAT IT REPLACES. `pnpm exec playwright install --with-deps` on a bare runner, which
# cost a median 11.6 min per shard (~158 runner-minutes per run) and depended on
# Microsoft's CDN and the Ubuntu apt mirror being up, 24 times per run. It was not:
# #819 failed 5 shards on 2026-08-18 and 17 of 25 on 2026-08-19, always in the install
# step, never a test failure.
#
# Usage:  scripts/ci/playwright-in-container.sh test --project=x --shard=1/6
#         scripts/ci/playwright-in-container.sh test --config playwright.smoke.config.ts
set -euo pipefail

# MUST track @playwright/test in package.json. Playwright refuses to drive browsers
# built for a different release, and the mismatch error points nowhere near the cause
# (docker/Dockerfile.e2e:6-9 records the same warning).
IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.65.0-noble}"

ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

# TWO GROUPS, and the split is the whole point. `^(A|B|PREFIX_)=` binds the `=` to
# EVERY branch, so each prefix must BE the entire variable name — which forwarded only
# CI and BASE_URL and dropped every Supabase credential (#830).
#
# The exact-name group is NOT a grab bag: it is every variable the test process reads
# that no prefix family covers. Auditing it by hand found seven more on the second
# lane — MAILPIT_URL among them, without which the signup-mailer suite cannot see a
# delivered message at all. `playwright-env-forwarding.test.js` derives the list from
# `process.env.X` in the test sources and fails when the two drift, because finding
# this by hand once is not a system.
env | grep -E -e '^(CI|SKIP_WEBSERVER|BASE_URL|WORKERS|AUTH_SETUP_JOB|NODE_ENV|BASE_PATH|APP_BASE_PATH|E2E_PATH_PREFIX|E2E_LOCAL_TURNSTILE_TESTS|MAILPIT_URL|LIVE_PROVIDER_TESTS|STRIPE_SECRET_KEY|TEST_EMAIL_DOMAIN|ZERO_ASSERTION_GATE_MODE|ZERO_ASSERTION_OUTPUT)=' -e '^(PLAYWRIGHT_|NEXT_PUBLIC_|SUPABASE_|TEST_USER_|RESEND_)' > "$ENV_FILE" || true

# Fail on a missing credential rather than letting dotenv silently substitute the
# workspace `.env`, whose hostnames are container-side. The silent fallback, not the
# typo, is what made #830 cost a full 26-job run to diagnose.
missing=""
for key in ${PLAYWRIGHT_REQUIRED_ENV:-}; do
  grep -q "^${key}=" "$ENV_FILE" || missing="$missing $key"
done
if [ -n "$missing" ]; then
  echo "::error::not forwarding to the test container:$missing — the suite would fall back to .env and fail inside globalSetup with a DNS error"
  exit 1
fi

# --network=host: the app is on localhost and Supabase's Kong is published on
#   127.0.0.1 — and that URL is compiled into the static bundle at BUILD time. A
#   bridge network makes `localhost` the container's own loopback.
# --user: without it the reports land root-owned and the upload steps fail.
# ./node_modules/.bin/playwright: pnpm is not in the image, and corepack would
#   download it per shard, reintroducing the fetch this removes.
# Xvfb: headless Firefox in this image has no WebGL, which made browser tests
#   skip themselves. Headed Firefox on a virtual display gets software
#   WebGL, so start one and export DISPLAY (playwright.config.ts reads it). Not
#   xvfb-run: it hangs in this image. Chromium and WebKit ignore the display.
#   The screen is 4096x2304 on purpose: an X pointer starts at the screen
#   centre, and on a 1280x1024 screen that is inside the Firefox window, so the
#   page's submit button sat in :hover and the AAA contrast test measured its
#   darker hover colour (6.54:1) instead of the resting one. At this size the
#   centre (2048,1152) is outside every test viewport.
exec docker run --rm --network=host \
  --user "$(id -u):$(id -g)" \
  --env-file "$ENV_FILE" \
  -e HOME=/tmp \
  -v "$PWD":/work -w /work \
  "$IMAGE" \
  bash -c '
    Xvfb :99 -screen 0 4096x2304x24 -nolisten tcp >/dev/null 2>&1 &
    for _ in $(seq 50); do
      [ -S /tmp/.X11-unix/X99 ] && break
      sleep 0.1
    done
    if [ ! -S /tmp/.X11-unix/X99 ]; then
      echo "::error::Xvfb did not start" >&2
      exit 1
    fi
    export DISPLAY=:99
    exec ./node_modules/.bin/playwright "$@"
  ' playwright-with-display "$@"
