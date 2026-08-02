#!/bin/sh
# basePath-aware health probe for the Next.js dev server (issue #230).
#
# Compose's `test:` cannot interpolate CONTAINER env at exec time, so this
# script reads NEXT_PUBLIC_BASE_PATH from the healthcheck exec environment
# (populated from env_file at container creation). With a basePath set, the
# bare root "/" 500s by design — only the basePath route is meaningful.
# With NEXT_PUBLIC_BASE_PATH unset (forks), this degrades to the root probe.
#
# Usage: healthcheck.sh [--code] [ROUTE]
#
# Exit 0 = HTTP 2xx/3xx at the basePath + ROUTE. Exit 1 = anything else.
# --code: also print the raw status ("000" = timeout/refused) so the
# entrypoint's self-heal supervisor can distinguish corruption (5xx) from
# a server that is merely still compiling (000).
#
# ROUTE defaults to "/", so `healthcheck.sh` and `healthcheck.sh --code` behave
# exactly as before — compose's `test: ['CMD', '/usr/local/bin/healthcheck.sh']`
# is unchanged, and CONTAINER health deliberately stays "is `/` serving". That
# is a different question from "is `.next` corrupt", and one slow route must
# never flip the container unhealthy.
#
# The ROUTE argument exists because `.next` corruption is PARTIAL (#298).
# Measured during a real incident on 2026-08-02:
#
#   /          200
#   /docs/     200
#   /contact/  500     <- Cannot find module './6048.js'
#
# Routes already compiled and cached keep serving; only routes needing a chunk
# that was rewritten under the running server break. A single fixed probe URL —
# any single URL — is therefore a lottery. The supervisor rotates through
# several using this argument.
CODE_MODE=0
if [ "$1" = "--code" ]; then
  CODE_MODE=1
  shift
fi
ROUTE="${1:-/}"

URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}${ROUTE}"
# Internal --max-time stays below Docker's healthcheck timeout (10s) so the
# script self-reports "000" instead of being SIGKILLed (a killed probe logs
# no output).
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time "${SH_HEALTHCHECK_MAX_TIME:-8}" "$URL" 2>/dev/null) || CODE=000

[ "$CODE_MODE" = "1" ] && echo "$CODE"

case "$CODE" in
  2??|3??) exit 0 ;;
  *)       exit 1 ;;
esac
