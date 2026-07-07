#!/bin/bash

# E2E Test Runner Script
# Usage: ./scripts/run-e2e-tests.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MODE="headless"
BROWSER="all"
SPECIFIC_TEST=""
DOCKER=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      MODE="headed"
      shift
      ;;
    --ui)
      MODE="ui"
      shift
      ;;
    --debug)
      MODE="debug"
      shift
      ;;
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    --test)
      SPECIFIC_TEST="$2"
      shift 2
      ;;
    --docker)
      DOCKER=true
      shift
      ;;
    --help)
      echo "E2E Test Runner"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --headed       Run tests in headed mode (see browser)"
      echo "  --ui           Run tests in UI mode"
      echo "  --debug        Run tests in debug mode"
      echo "  --browser NAME Run tests in specific browser (chromium|firefox|webkit)"
      echo "  --test FILE    Run specific test file"
      echo "  --docker       Run tests in Docker container"
      echo "  --help         Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🎭 Starting E2E Tests${NC}"
echo "Mode: $MODE"
echo "Browser: $BROWSER"
if [ -n "$SPECIFIC_TEST" ]; then
  echo "Test: $SPECIFIC_TEST"
fi
echo ""

# Check if running in Docker
if [ "$DOCKER" = true ]; then
  echo -e "${YELLOW}Running tests in Docker...${NC}"

  # Start services
  docker compose -f docker/docker-compose.e2e.yml up -d scripthammer

  # Wait for health check
  echo "Waiting for application to be ready..."
  sleep 10

  # Run tests
  if [ "$MODE" = "ui" ]; then
    docker compose -f docker/docker-compose.e2e.yml --profile ui up e2e-ui
  else
    docker compose -f docker/docker-compose.e2e.yml run --rm e2e-tests
  fi

  # Clean up
  docker compose -f docker/docker-compose.e2e.yml down
else
  # Run locally
  echo -e "${YELLOW}Running tests locally...${NC}"

  # Check if app is running
  if ! curl -s http://localhost:3000/scripthammer > /dev/null; then
    echo -e "${YELLOW}Starting development server...${NC}"
    pnpm run dev &
    DEV_PID=$!
    sleep 5
  fi

  # Build test command
  TEST_CMD="pnpm test:e2e"

  if [ "$MODE" = "headed" ]; then
    TEST_CMD="$TEST_CMD --headed"
  elif [ "$MODE" = "ui" ]; then
    TEST_CMD="pnpm test:e2e:ui"
  elif [ "$MODE" = "debug" ]; then
    TEST_CMD="pnpm test:e2e:debug"
  fi

  if [ "$BROWSER" != "all" ]; then
    TEST_CMD="$TEST_CMD --project=$BROWSER"
  fi

  if [ -n "$SPECIFIC_TEST" ]; then
    TEST_CMD="$TEST_CMD $SPECIFIC_TEST"
  fi

  # Run tests
  echo "Running: $TEST_CMD"
  $TEST_CMD

  # Clean up dev server if we started it
  if [ -n "$DEV_PID" ]; then
    kill $DEV_PID 2>/dev/null || true
  fi
fi

echo -e "${GREEN}✅ E2E Tests Complete${NC}"