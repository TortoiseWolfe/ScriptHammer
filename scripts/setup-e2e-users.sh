#!/bin/bash
# Setup E2E Test Users
# Creates test users and connections in Supabase for E2E testing
#
# Usage: ./scripts/setup-e2e-users.sh
#
# Prerequisites:
# - Docker compose running: docker compose up -d
# - Environment variables set in .env:
#   - NEXT_PUBLIC_SUPABASE_URL
#   - SUPABASE_SERVICE_ROLE_KEY
#   - TEST_USER_*_EMAIL/PASSWORD vars

set -e

echo "=================================="
echo "  Setting up E2E Test Users"
echo "=================================="
echo ""

# Check if docker compose is running
if ! docker compose ps scripthammer | grep -q "Up"; then
    echo "❌ Error: Docker container 'scripthammer' is not running"
    echo "   Run: docker compose up -d"
    exit 1
fi

# Step 1: Create test users
echo "📋 Step 1: Creating test users..."
docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts
echo ""

# Step 2: Create connections between users
echo "📋 Step 2: Creating connections between users..."
docker compose exec scripthammer pnpm exec tsx scripts/seed-connections.ts
echo ""

echo "=================================="
echo "  ✨ E2E Test Users Ready!"
echo "=================================="
echo ""
echo "Users created with connections (passwords from .env):"
echo "  - Primary: \$TEST_USER_PRIMARY_EMAIL"
echo "  - Secondary: \$TEST_USER_SECONDARY_EMAIL"
echo "  - Tertiary: \$TEST_USER_TERTIARY_EMAIL"
echo ""
echo "Run E2E tests:"
echo "  docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/"
echo ""
