#!/bin/bash
# One-command switch back to CLOUD Supabase (issue #121).
#
#   pnpm run dev:cloud   →   this script
#
# Restores your real cloud .env from .env.cloud, restarts the app so its bundle
# rebuilds with the cloud URL, and stops the local Supabase stack.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=================================="
echo "  Switching to CLOUD Supabase"
echo "=================================="

# 1. Restore the real cloud .env (aborts if .env.cloud is missing).
node scripts/switch-env.js cloud

# 2. Stop the local Supabase services FIRST. Use `stop` + `rm` scoped to the
#    profile rather than `down` — `down` tears down the whole compose project
#    (including the network the app uses), which would disrupt the app container.
echo ""
echo "🛑 Stopping the local Supabase stack..."
docker compose --profile supabase stop
docker compose --profile supabase rm -f

# 3. Recreate the app LAST so its dev bundle rebuilds with the cloud URL on an
#    intact network.
echo ""
echo "🔄 Restarting the app container (rebuilds the bundle with the cloud URL)..."
docker compose up -d scripthammer

echo ""
echo "=================================="
echo "  ✨ Back on CLOUD Supabase"
echo "=================================="
