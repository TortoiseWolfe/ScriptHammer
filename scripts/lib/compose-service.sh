#!/usr/bin/env bash
# Resolve the Compose service that runs the app.
#
# WHY THIS IS NOT A LITERAL. `scripts/rebrand.sh` renames the app service to the
# fork's slug, so anything that hardcodes the template's own name breaks on the
# first push from every fork with `no such service` — an error naming a service
# the forker has never heard of, on a repository they just created (#957).
#
# #910/#921 fixed the Git hooks this way and deliberately left the scripts alone,
# which is how `validate-ci.sh` — the gate the hooks actually invoke — kept the
# literal and undid the fix one call later. Four copies of the same awk was the
# other tempting answer; this is the one that cannot drift.
#
# Read the FIRST service in docker-compose.yml: the app is written first, and a
# rebrand renames it in place rather than reordering.
compose_service() {
    awk '
      /^services:/ { in_services = 1; next }
      in_services && /^[^[:space:]#]/ { exit }
      in_services && /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ {
        sub(/:[[:space:]]*$/, ""); gsub(/[[:space:]]/, ""); print; exit
      }
    ' "${1:-docker-compose.yml}" 2>/dev/null
}
