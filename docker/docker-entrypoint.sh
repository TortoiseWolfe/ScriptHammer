#!/bin/sh
set -e

# Docker entrypoint for ScriptHammer
# Runs as node user (set by USER in Dockerfile)
# No root operations needed at runtime

echo "Initializing ScriptHammer container..."

# Ensure dependencies match package.json (fast when already current)
echo "Checking dependencies..."
pnpm install --frozen-lockfile
echo "Dependencies are up-to-date"

# Clean .next directory to prevent stale cache issues
echo "Cleaning .next directory..."
if [ -d "/app/.next" ]; then
  # Named volume may be owned by root — clean contents, not the mount point
  rm -rf /app/.next/* /app/.next/.* 2>/dev/null || true
fi

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

echo "Container initialized successfully"

# Execute the main command directly (already running as node)
exec "$@"
