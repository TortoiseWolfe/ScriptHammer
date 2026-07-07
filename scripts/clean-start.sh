#!/bin/bash

# Clean Start Script - Ensures fresh build without cache issues
# Usage: ./scripts/clean-start.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"

# Stop any running containers
docker compose down 2>/dev/null || true

# Remove .next directory if it exists
if [ -d ".next" ]; then
  echo "Removing .next directory..."
  rm -rf .next 2>/dev/null || {
    echo "Could not remove .next normally, trying with Docker..."
    docker run --rm -v "$(pwd):/app" alpine rm -rf /app/.next
  }
fi

# Remove node_modules/.cache if it exists
if [ -d "node_modules/.cache" ]; then
  echo "Removing node_modules cache..."
  rm -rf node_modules/.cache 2>/dev/null || true
fi

echo -e "${GREEN}✅ Clean complete${NC}"
echo ""
echo -e "${YELLOW}🚀 Starting fresh development environment...${NC}"

# Start containers
docker compose up -d

# Wait for container to be ready
echo "Waiting for container to initialize..."
sleep 5

# Check if dev server is running
for i in {1..30}; do
  if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Development server is ready at http://localhost:3000${NC}"
    break
  fi
  echo -n "."
  sleep 2
done

echo ""
echo -e "${GREEN}🎉 Clean start complete!${NC}"
echo ""
echo "Available commands:"
echo "  docker compose logs -f          # View logs"
echo "  docker compose exec scripthammer sh  # Enter container shell"
echo "  docker compose down             # Stop containers"