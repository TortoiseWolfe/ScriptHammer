#!/bin/bash
# One-command switch to LOCAL Supabase (issue #121).
#
#   pnpm run dev:local   →   this script
#
# Steps:
#   1. Point .env at the local sandbox (backs up cloud → .env.cloud first run).
#   2. Bring up the local Supabase profile (db/kong/auth/rest/realtime).
#   3. Wait for Kong to be healthy (polls — no fixed sleep).
#   4. Restart the app so its dev bundle rebuilds with the local URL baked in.
#   5. Seed test users + connections via the canonical seeder.
#
# Reverse with `pnpm run dev:cloud`.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=================================="
echo "  Switching to LOCAL Supabase"
echo "=================================="

# 1. Swap .env → local (captures real cloud creds into .env.cloud on first run).
node scripts/switch-env.js local

# 2. Bring up the local Supabase stack.
echo ""
echo "📦 Starting local Supabase services..."
docker compose --profile supabase up -d

# 3. Wait for Kong (the API gateway the app + scripts talk to) to be ready.
#    Kong returns HTTP 401 (not 2xx) on /auth/v1/health without an apikey — that
#    still means it's up and routing, so accept ANY HTTP status (000 = not yet
#    listening). Do NOT use `curl -f`, which treats 401 as a failure.
echo ""
echo "⏳ Waiting for Kong to be ready (http://localhost:54321)..."
ATTEMPTS=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:54321/auth/v1/health" 2>/dev/null)" != "000" ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 60 ]; then
    echo "❌ Kong did not respond within ~2 minutes."
    echo "   Check: docker compose --profile supabase ps"
    exit 1
  fi
  sleep 2
done
echo "✓ Kong is responding."

# 4. Restart the app so the dev server rebuilds with the local NEXT_PUBLIC_SUPABASE_URL.
echo ""
echo "🔄 Restarting the app container (rebuilds the bundle with the local URL)..."
docker compose up -d scripthammer

# 5. Seed test users + connections (idempotent).
echo ""
echo "🌱 Seeding local test users + connections..."
bash scripts/setup-e2e-users.sh

echo ""
echo "=================================="
echo "  ✨ LOCAL Supabase ready"
echo "=================================="
echo "  App:    docker compose port scripthammer 3000"
echo "  Studio: http://localhost:54323"
echo "  Back to cloud:  pnpm run dev:cloud"
