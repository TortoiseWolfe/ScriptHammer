#!/bin/sh
# basePath-aware health probe for the Next.js dev server (issue #230).
#
# Compose's `test:` cannot interpolate CONTAINER env at exec time, so this
# script reads NEXT_PUBLIC_BASE_PATH from the healthcheck exec environment
# (populated from env_file at container creation). With a basePath set, the
# bare root "/" 500s by design — only the basePath route is meaningful.
# With NEXT_PUBLIC_BASE_PATH unset (forks), this degrades to the root probe.
#
# Exit 0 = HTTP 2xx/3xx at the basePath root. Exit 1 = anything else.
# --code: also print the raw status ("000" = timeout/refused) so the
# entrypoint's self-heal supervisor can distinguish corruption (5xx) from
# a server that is merely still compiling (000).

URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}/"
# Internal --max-time stays below Docker's healthcheck timeout (10s) so the
# script self-reports "000" instead of being SIGKILLed (a killed probe logs
# no output).
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time "${SH_HEALTHCHECK_MAX_TIME:-8}" "$URL" 2>/dev/null) || CODE=000

[ "$1" = "--code" ] && echo "$CODE"

case "$CODE" in
  2??|3??) exit 0 ;;
  *)       exit 1 ;;
esac
