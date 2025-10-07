#!/bin/sh
set -e

# Docker entrypoint for ScriptHammer
# Handles .next directory permissions to prevent Docker/host conflicts

echo "🚀 Initializing ScriptHammer container..."

# Always ensure dependencies are up-to-date with package.json FIRST (as root)
# This is fast when dependencies are already installed but catches any new ones
echo "📦 Checking dependencies..."
pnpm install --frozen-lockfile
echo "✅ Dependencies are up-to-date"

# .next directory is mounted as tmpfs - ensure proper permissions AFTER pnpm install
echo "🔧 Setting up tmpfs .next directory..."
mkdir -p /app/.next
chown -R node:node /app/.next
chmod -R 755 /app/.next
echo "✅ tmpfs .next directory configured!"

# Also ensure node_modules has correct ownership
chown -R node:node /app/node_modules 2>/dev/null || true

# Check for common issues that might need fixing
if [ -f ".next/BUILD_ID" ]; then
    echo "✅ Found existing build cache"
else
    echo "🔨 No build cache found (will be created on first run)"
fi

echo "✨ Container initialized successfully"

# Switch to node user and execute the main command
# Using su to switch to node user
exec su -s /bin/sh node -c "exec $@"