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
supervise_dev() {
  set +e # probe/kill failures are expected control flow here
  PROBE_INTERVAL="${SH_HEAL_PROBE_INTERVAL:-15}" # seconds between probes
  FAIL_LIMIT="${SH_HEAL_FAIL_LIMIT:-4}"          # consecutive 5xx before heal
  GRACE="${SH_HEAL_GRACE:-120}"                  # post-launch compile grace

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
    FAILS=0
    while kill -0 "$DEV_PID" 2>/dev/null; do
      # sleep as a child + wait: TERM/INT traps fire immediately, so
      # `docker compose stop` stays within its 10s grace.
      sleep "$PROBE_INTERVAL" &
      wait $! 2>/dev/null
      [ $(($(date +%s) - START)) -lt "$GRACE" ] && continue
      CODE=$(/usr/local/bin/healthcheck.sh --code)
      case "$CODE" in
        5??) FAILS=$((FAILS + 1)) ;; # corruption signature: real HTTP 5xx only
        *) FAILS=0 ;;                # 2xx/3xx healthy; 000 = still compiling
      esac
      if [ "$FAILS" -ge "$FAIL_LIMIT" ]; then
        echo "[self-heal] ${FAILS} consecutive 5xx — recycling .next, relaunching next dev (container/port unchanged)"
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
