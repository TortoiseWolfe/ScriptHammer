#!/bin/sh
set -e

# Docker entrypoint for ScriptHammer
# Runs as node user (set by USER in Dockerfile)
# No root operations needed at runtime

echo "Initializing ScriptHammer container..."

# Is the command we were handed the long-running dev server? The dispatch at the
# bottom of this file asks the same question; both must agree.
is_dev_server() {
  [ "$1" = "pnpm" ] && [ "$2" = "run" ] && [ "$3" = "dev" ]
}

clean_next() {
  DIR="/app/${NEXT_DIST_DIR:-.next}"
  if [ -d "$DIR" ]; then
    # Named volume may be owned by root — clean contents, not the mount point
    rm -rf "$DIR"/* "$DIR"/.* 2>/dev/null || true
  fi
}

# Ensure dependencies match package.json (fast when already current)
echo "Checking dependencies..."
pnpm install --frozen-lockfile
echo "Dependencies are up-to-date"

# Clean .next ONLY when we are the dev server (#293).
#
# This used to run unconditionally, on every container start — including
# `docker compose run --rm scripthammer pnpm build`, which mounts the SAME .next
# named volume as the ALREADY-RUNNING dev container. So a one-off build wiped the
# live dev server's manifests and chunks out from under it, and every route
# 500'd with ChunkLoadError / "Cannot read properties of undefined (reading
# 'call')" / ENOENT routes-manifest.json — on pages the build never touched.
# Four times in one session, each "fixed" by a restart that never addressed why.
#
# The dispatch at the bottom already treats one-shot commands differently
# ("keep plain exec semantics"); it just did not gate the clean. A one-shot
# command must leave .next exactly as it found it.
if is_dev_server "$@"; then
  echo "Cleaning .next directory..."
  clean_next

  # Ensure .next exists and is writable (handles fresh named volumes)
  if [ ! -w "/app/.next" ]; then
    echo "  .next volume not writable by node user — this is expected on first run"
    echo "  Hint: run 'docker compose down -v' and 'docker compose up' to reset volumes"
  fi

  mkdir -p /app/.next 2>/dev/null || true
  echo "Fresh .next directory configured"

  if [ -f ".next/BUILD_ID" ]; then
      echo "Found existing build cache"
  else
      echo "No build cache found (will be created on first run)"
  fi
else
  # A build/test/one-off. A dev server may be live on this same volume.
  echo "One-shot command — leaving ${NEXT_DIST_DIR:-.next}/ untouched (#293)"
  echo "  Build into a separate dir with NEXT_DIST_DIR=.next-build to keep dev fully isolated."
fi

echo "Container initialized successfully"

# ── .next corruption self-heal (issue #230) ──────────────────────────────
# Bulk file changes under the running dev server (bakes, branch switches)
# racing the HMR compiler on the WSL2 bind mount corrupt .next: every route
# 500s ("Cannot read properties of undefined (reading '/_app')", ENOENT
# vendor-chunks). The fix has always been "restart the container" — which
# also re-rolled the ephemeral host port. This supervisor recycles .next and
# relaunches the dev tree IN-PLACE instead: container and port unchanged.
#
# Detection is status-code-only via healthcheck.sh --code: only sustained
# HTTP 5xx counts as corruption. Timeouts/"000" mean the server is still
# compiling — slow is NEVER corruption.
#
# The probe ROTATES over several routes, because corruption is PARTIAL (#298).
# Measured on 2026-08-02, mid-incident: `/` 200, `/docs/` 200, `/contact/` 500.
# Routes already compiled keep serving; only routes needing a rewritten chunk
# break. This supervisor probed `/` alone for its whole life, so it sat silent
# through that — while still serving the exact 5xx signature it exists to catch.
# A second FIXED url would not have helped either: `/docs/` was one of the
# healthy ones. Rotation is the answer, not a longer fixed list.
#
# Rotation forces a matching change to the counter. The old logic counted
# CONSECUTIVE 5xx from one route; under rotation a single corrupt route among
# six 5xxes once, the next route returns 200, and the count resets — it could
# never reach the limit. So a 5xx now triggers confirmation ON THE SAME ROUTE:
# a dead chunk keeps 500ing, a transient blip does not. "Sustained, not
# transient" is preserved; "sustained" just stopped meaning "always the same
# single url".
supervise_dev() {
  set +e # probe/kill failures are expected control flow here
  PROBE_INTERVAL="${SH_HEAL_PROBE_INTERVAL:-15}" # seconds between probes
  FAIL_LIMIT="${SH_HEAL_FAIL_LIMIT:-4}"          # 5xx on ONE route before heal
  GRACE="${SH_HEAL_GRACE:-120}"                  # post-launch compile grace
  CONFIRM_INTERVAL="${SH_HEAL_CONFIRM_INTERVAL:-3}" # seconds between re-probes

  # Distinct chunk graphs, not an exhaustive route list — it does not need to
  # be complete, it needs to not be ONE. Overridable so a fork with different
  # routes can point it somewhere real.
  HEAL_ROUTES="${SH_HEAL_ROUTES:-/ /docs/ /blog/ /contact/ /themes/ /sign-in/}"
  ROUTES_LEFT=""

  # ── Loop guard ──────────────────────────────────────────────────────────
  # Recycling `.next` fixes CORRUPTION. It cannot fix a route that 5xxes for a
  # reason that survives a rebuild — a genuine error at module scope in the
  # page's own source, say. Without a guard that route heals, still 5xxes,
  # heals again: a permanent restart loop that is strictly worse than the bug
  # this supervisor exists for.
  #
  # The risk is not new — a persistently broken `/` could always do this — but
  # rotation widens the exposure from one route to six, so it has to be handled
  # rather than inherited. If the SAME route triggers a second heal in a row,
  # recycling demonstrably is not the answer for it: stop healing on it, say so
  # loudly, and keep watching the others. Declared OUTSIDE the relaunch loop
  # below so it survives a dev-server restart — that is the whole point.
  #
  # A quarantine lasts until the CONTAINER restarts, deliberately. Once a route
  # is skipped nothing probes it, so nothing can observe it recovering; clearing
  # the quarantine automatically would mean re-probing skipped routes, i.e.
  # re-opening the loop this closes. Losing one route from the rotation is a far
  # smaller cost than a restart loop, and the log line above names the route so
  # the fix is obvious.
  LAST_HEAL_ROUTE=""
  SKIP_ROUTES=""

  # Next route in the rotation, refilling when the list runs out and skipping
  # any route already proven unfixable by a recycle.
  next_route() {
    _tries=0
    while [ "$_tries" -lt 32 ]; do
      _tries=$((_tries + 1))
      [ -z "$ROUTES_LEFT" ] && ROUTES_LEFT="$HEAL_ROUTES"
      ROUTE="${ROUTES_LEFT%% *}"
      case "$ROUTES_LEFT" in
        *' '*) ROUTES_LEFT="${ROUTES_LEFT#* }" ;;
        *) ROUTES_LEFT="" ;;
      esac
      case " $SKIP_ROUTES " in
        *" $ROUTE "*) continue ;; # quarantined — a recycle did not fix it
        *) return 0 ;;
      esac
    done
    # Every route quarantined. Nothing left to watch; ROUTE is whatever fell
    # out last, and the caller's confirm step will simply not fire a heal.
    ROUTE=""
    return 1
  }

  # 0 = sustained 5xx on THIS route (corruption). 1 = anything else, including
  # "000" (still compiling) — slow is never corruption, unchanged from before.
  confirm_corrupt() {
    _route="$1"
    _n=0
    while :; do
      _code=$(/usr/local/bin/healthcheck.sh --code "$_route")
      case "$_code" in
        5??) _n=$((_n + 1)) ;;
        *) return 1 ;;
      esac
      [ "$_n" -ge "$FAIL_LIMIT" ] && return 0
      # sleep as a child + wait, so the TERM trap still fires promptly.
      sleep "$CONFIRM_INTERVAL" &
      wait $! 2>/dev/null
    done
  }

  while :; do
    # Own session/process-group so ONE negative-PID signal reaches the whole
    # dev tree (pnpm → script sh → next dev → next-server). Backgrounded
    # setsid from a non-job-control shell execs in place: $! is the leader.
    setsid "$@" &
    DEV_PID=$!
    # NOTE: dash's kill builtin rejects `kill -TERM -- -PID` ("Illegal
    # number") — the POSIX `-s SIG` form is required for group kills.
    trap 'kill -s TERM -- "-$DEV_PID" 2>/dev/null; wait "$DEV_PID" 2>/dev/null; exit 0' TERM INT

    # Kick the first compile so probes pass sooner after (re)launch.
    (
      sleep 10
      curl -s -o /dev/null --max-time 180 \
        "http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}/"
    ) &

    START=$(date +%s)
    ROUTES_LEFT=""
    while kill -0 "$DEV_PID" 2>/dev/null; do
      # sleep as a child + wait: TERM/INT traps fire immediately, so
      # `docker compose stop` stays within its 10s grace.
      sleep "$PROBE_INTERVAL" &
      wait $! 2>/dev/null
      [ $(($(date +%s) - START)) -lt "$GRACE" ] && continue
      next_route || continue # every route quarantined — nothing to probe
      # One request per interval, same cost as before — just not always the
      # same url. A 5xx is only a CANDIDATE until confirmed on that route.
      if confirm_corrupt "$ROUTE"; then
        if [ "$ROUTE" = "$LAST_HEAL_ROUTE" ]; then
          # Already recycled for this exact route and it came back 5xx anyway.
          # Recycling is not the fix here; looping on it would be.
          SKIP_ROUTES="$SKIP_ROUTES $ROUTE"
          LAST_HEAL_ROUTE=""
          echo "[self-heal] ${ROUTE} still 5xx after a recycle — NOT corruption. Quarantining it and continuing to watch the rest. Look at that route's source."
          continue
        fi
        LAST_HEAL_ROUTE="$ROUTE"
        echo "[self-heal] ${FAIL_LIMIT} consecutive 5xx on ${ROUTE} — recycling .next, relaunching next dev (container/port unchanged)"
        kill -s TERM -- "-$DEV_PID" 2>/dev/null
        n=0
        while kill -0 "$DEV_PID" 2>/dev/null && [ "$n" -lt 10 ]; do
          n=$((n + 1))
          sleep 1
        done
        kill -s KILL -- "-$DEV_PID" 2>/dev/null
        sleep 1
        if kill -0 "$DEV_PID" 2>/dev/null; then
          echo "[self-heal] WARNING: dev tree (pgid $DEV_PID) survived SIGKILL — waiting on it anyway"
        fi
        break
      fi
    done
    wait "$DEV_PID" 2>/dev/null
    clean_next
    echo "[self-heal] relaunching dev server..."
  done
}

# Supervise only the long-running dev server; one-shot commands
# (docker compose run --rm scripthammer <cmd>) keep plain exec semantics.
if [ "$1" = "pnpm" ] && [ "$2" = "run" ] && [ "$3" = "dev" ]; then
  supervise_dev "$@"
else
  # Execute the main command directly (already running as node)
  exec "$@"
fi
