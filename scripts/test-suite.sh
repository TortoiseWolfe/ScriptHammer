#!/bin/bash

# Test Suite Runner for ScriptHammer
# Runs all tests with clear feedback and actionable results

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
declare -a FAILED_TEST_NAMES

# Function to print section headers
print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print test results
print_result() {
    local test_name=$1
    local status=$2
    local details=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ ${test_name}${NC}"
        [ -n "$details" ] && echo -e "   ${details}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif [ "$status" = "fail" ]; then
        echo -e "${RED}❌ ${test_name}${NC}"
        [ -n "$details" ] && echo -e "${RED}   ${details}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name")
    elif [ "$status" = "skip" ]; then
        echo -e "${YELLOW}⏭️  ${test_name}${NC}"
        [ -n "$details" ] && echo -e "${YELLOW}   ${details}${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    fi
}

# Function to check if we're in Docker
in_docker() {
    if [ -f /.dockerenv ]; then
        return 0
    else
        return 1
    fi
}

# Start time tracking
START_TIME=$(date +%s)

# Main header
echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║                  ScriptHammer Comprehensive Test Suite               ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Running all tests to ensure code quality and functionality...${NC}"

# Determine if we're in Docker or need to use docker compose exec
if in_docker; then
    CMD_PREFIX=""
else
    CMD_PREFIX="docker compose exec scripthammer"
fi

# 1. TypeScript Type Checking
print_header "1. TypeScript Type Checking"
echo "Checking for type errors..."
if $CMD_PREFIX pnpm run type-check > /tmp/type-check-output.txt 2>&1; then
    print_result "TypeScript Type Check" "pass" "No type errors found"
else
    ERROR_COUNT=$(grep -c "error TS" /tmp/type-check-output.txt 2>/dev/null || echo "0")
    print_result "TypeScript Type Check" "fail" "$ERROR_COUNT type errors found"
    echo -e "${RED}First few errors:${NC}"
    head -n 10 /tmp/type-check-output.txt | sed 's/^/  /'
fi

# 2. ESLint
print_header "2. ESLint Code Quality"
echo "Checking code style and quality..."
if $CMD_PREFIX pnpm run lint > /tmp/lint-output.txt 2>&1; then
    print_result "ESLint" "pass" "No linting issues"
else
    ERROR_COUNT=$(grep -E "error|warning" /tmp/lint-output.txt | wc -l)
    print_result "ESLint" "fail" "$ERROR_COUNT issues found"
    echo -e "${RED}First few issues:${NC}"
    grep -E "error|warning" /tmp/lint-output.txt | head -n 5 | sed 's/^/  /'
fi

# 3. Prettier Formatting
print_header "3. Code Formatting"
echo "Checking code formatting..."
if $CMD_PREFIX pnpm run format:check > /tmp/format-output.txt 2>&1; then
    print_result "Prettier Formatting" "pass" "All files properly formatted"
else
    UNFORMATTED=$(grep -c "Code style issues found" /tmp/format-output.txt 2>/dev/null || echo "some")
    print_result "Prettier Formatting" "fail" "$UNFORMATTED files need formatting"
    echo -e "${YELLOW}Run 'pnpm run format' to fix${NC}"
fi

# 4. Unit Tests
print_header "4. Unit Tests"
echo "Running unit tests..."
if $CMD_PREFIX pnpm test -- --reporter=verbose --run > /tmp/test-output.txt 2>&1; then
    TEST_STATS=$(grep -E "Test Files|Tests" /tmp/test-output.txt | tail -2)
    print_result "Unit Tests" "pass" "$TEST_STATS"
else
    print_result "Unit Tests" "fail" "Some tests failed"
    echo -e "${RED}Failed tests:${NC}"
    grep -E "FAIL|✗" /tmp/test-output.txt | head -n 10 | sed 's/^/  /'
fi

# 5. Test Coverage
print_header "5. Test Coverage"
echo "Analyzing test coverage..."
if $CMD_PREFIX pnpm run test:coverage > /tmp/coverage-output.txt 2>&1; then
    COVERAGE=$(grep -E "All files" /tmp/coverage-output.txt | awk '{print $10}')
    if [ -n "$COVERAGE" ]; then
        COVERAGE_NUM=${COVERAGE%\%}
        if (( $(echo "$COVERAGE_NUM >= 60" | bc -l) )); then
            print_result "Test Coverage" "pass" "Coverage: $COVERAGE (Target: 60%)"
        else
            print_result "Test Coverage" "fail" "Coverage: $COVERAGE (Below target of 60%)"
        fi
    else
        print_result "Test Coverage" "skip" "Could not determine coverage"
    fi
else
    print_result "Test Coverage" "fail" "Coverage analysis failed"
fi

# 6. Component Structure Validation
print_header "6. Component Structure"
echo "Validating component file structure..."
if $CMD_PREFIX pnpm run validate:structure > /tmp/structure-output.txt 2>&1; then
    print_result "Component Structure" "pass" "All components follow required structure"
else
    print_result "Component Structure" "fail" "Some components have invalid structure"
    echo -e "${RED}Issues found:${NC}"
    grep -E "ERROR|Missing" /tmp/structure-output.txt | head -n 5 | sed 's/^/  /'
fi

# 7. Build Test
print_header "7. Production Build"
echo "Testing production build..."
if $CMD_PREFIX pnpm run build > /tmp/build-output.txt 2>&1; then
    print_result "Production Build" "pass" "Build completed successfully"
else
    print_result "Production Build" "fail" "Build failed"
    echo -e "${RED}Build errors:${NC}"
    grep -E "Error:|error|failed" /tmp/build-output.txt | head -n 5 | sed 's/^/  /'
fi

# 8. Accessibility Tests (only if server is running)
print_header "8. Accessibility Tests"

# Production build corrupts .next permissions - restart container to fix
if ! in_docker; then
    echo "Restarting container to restore dev server after build..."
    docker compose restart scripthammer > /dev/null 2>&1

    # Wait for dev server to be ready
    echo "Waiting for dev server to recover..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:3000 | grep -q "html" 2>/dev/null; then
            echo "Dev server ready."
            break
        fi
        sleep 2
    done
fi

echo "Checking if dev server is available..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Dev server detected, running accessibility tests..."
    if $CMD_PREFIX pnpm run test:a11y > /tmp/a11y-output.txt 2>&1; then
        print_result "Accessibility (Pa11y)" "pass" "All pages meet WCAG standards"
    else
        ERRORS=$(grep -c "Error:" /tmp/a11y-output.txt 2>/dev/null || echo "Some")
        print_result "Accessibility (Pa11y)" "fail" "$ERRORS accessibility issues found"
    fi
else
    print_result "Accessibility (Pa11y)" "skip" "Dev server not running - start with 'pnpm run dev'"
fi

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

# Final Summary
print_header "Test Suite Summary"
echo ""
echo -e "${BOLD}Results:${NC}"
echo -e "  ${GREEN}✅ Passed:${NC}  $PASSED_TESTS"
echo -e "  ${RED}❌ Failed:${NC}  $FAILED_TESTS"
echo -e "  ${YELLOW}⏭️  Skipped:${NC} $SKIPPED_TESTS"
echo -e "  ${CYAN}📊 Total:${NC}   $TOTAL_TESTS"
echo ""
echo -e "${BOLD}Time:${NC} ${MINUTES}m ${SECONDS}s"

# List failed tests if any
if [ $FAILED_TESTS -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}Failed Tests:${NC}"
    for test in "${FAILED_TEST_NAMES[@]}"; do
        echo -e "  ${RED}• $test${NC}"
    done
    echo ""
    echo -e "${YELLOW}💡 Run individual test commands to see detailed errors${NC}"
fi

# Overall status
echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✨ All tests passed! Code is ready for commit.${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}⚠️  Some tests failed. Please fix the issues before committing.${NC}"
    exit 1
fi