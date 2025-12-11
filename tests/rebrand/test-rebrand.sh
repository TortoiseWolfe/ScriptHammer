#!/usr/bin/env bash
# Test harness for scripts/rebrand.sh
#
# SAFETY: All tests run in isolated temporary directories.
#         The actual ScriptHammer repo is NEVER modified.
#
# Usage: ./tests/rebrand/test-rebrand.sh [test_name]
# Run all tests: ./tests/rebrand/test-rebrand.sh
# Run specific: ./tests/rebrand/test-rebrand.sh test_argument_validation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REBRAND_SCRIPT="$REPO_ROOT/scripts/rebrand.sh"

# SAFETY CHECK: Never run rebrand on the actual repo
SAFETY_FILE="$REPO_ROOT/.git/config"
if [ -f "$SAFETY_FILE" ] && grep -q "ScriptHammer" "$SAFETY_FILE" 2>/dev/null; then
    ACTUAL_REPO=true
else
    ACTUAL_REPO=false
fi

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test utilities
log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${YELLOW}Expected${NC}: $2"
    echo -e "  ${YELLOW}Got${NC}: $3"
    ((TESTS_FAILED++))
}

run_test() {
    local test_name="$1"
    ((TESTS_RUN++))
    echo -e "\n${YELLOW}Running${NC}: $test_name"
}

# Create temporary test directory with mock ScriptHammer structure
setup_temp_dir() {
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    # Create mock ScriptHammer repo structure in temp dir
    cd "$TEMP_DIR"
    git init -q
    git remote add origin "https://github.com/TortoiseWolfe/ScriptHammer.git"

    # Create essential files with ScriptHammer references
    mkdir -p src/components
    echo '{"name": "scripthammer", "description": "ScriptHammer template"}' > package.json
    echo "# ScriptHammer" > README.md
    echo "scripthammer.com" > CNAME
    echo "export const projectName = 'ScriptHammer';" > src/components/Logo.tsx

    # Copy the rebrand script to temp dir
    cp "$REBRAND_SCRIPT" "$TEMP_DIR/scripts/" 2>/dev/null || {
        mkdir -p scripts
        cp "$REBRAND_SCRIPT" "$TEMP_DIR/scripts/"
    }

    cd "$TEMP_DIR"
}

# Safety wrapper - ensures we're in temp dir before running rebrand
safe_rebrand() {
    local current_dir
    current_dir=$(pwd)

    # CRITICAL: Verify we're NOT in the actual repo
    if [ "$current_dir" = "$REPO_ROOT" ] || [[ "$current_dir" == "$REPO_ROOT"* && ! "$current_dir" == /tmp* ]]; then
        echo -e "${RED}SAFETY ERROR${NC}: Attempted to run rebrand in actual repo!"
        echo "Current dir: $current_dir"
        echo "Repo root: $REPO_ROOT"
        exit 99
    fi

    # Run rebrand script
    "$TEMP_DIR/scripts/rebrand.sh" "$@"
}

# ============================================================================
# T005b: Test argument validation (missing args should fail with exit 1)
# ============================================================================
test_argument_validation() {
    run_test "test_argument_validation"
    setup_temp_dir

    # Test: No arguments should fail with exit 1
    if "$TEMP_DIR/scripts/rebrand.sh" 2>/dev/null; then
        log_fail "No arguments" "exit code 1" "exit code 0"
    else
        local exit_code=$?
        if [ "$exit_code" -eq 1 ]; then
            log_pass "No arguments returns exit code 1"
        else
            log_fail "No arguments" "exit code 1" "exit code $exit_code"
        fi
    fi

    # Test: One argument should fail with exit 1
    if "$TEMP_DIR/scripts/rebrand.sh" "MyApp" 2>/dev/null; then
        log_fail "One argument" "exit code 1" "exit code 0"
    else
        local exit_code=$?
        if [ "$exit_code" -eq 1 ]; then
            log_pass "One argument returns exit code 1"
        else
            log_fail "One argument" "exit code 1" "exit code $exit_code"
        fi
    fi

    # Test: Two arguments should fail with exit 1
    if "$TEMP_DIR/scripts/rebrand.sh" "MyApp" "myuser" 2>/dev/null; then
        log_fail "Two arguments" "exit code 1" "exit code 0"
    else
        local exit_code=$?
        if [ "$exit_code" -eq 1 ]; then
            log_pass "Two arguments returns exit code 1"
        else
            log_fail "Two arguments" "exit code 1" "exit code $exit_code"
        fi
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# T005c: Test name sanitization ("My App!" -> "my-app")
# ============================================================================
test_name_sanitization() {
    run_test "test_name_sanitization"
    setup_temp_dir

    # Test sanitization by checking --dry-run output (runs in temp dir)
    local output
    output=$("$TEMP_DIR/scripts/rebrand.sh" "My App!" "testuser" "Test desc" --dry-run 2>&1 || true)

    if echo "$output" | grep -q "my-app"; then
        log_pass "\"My App!\" sanitizes to \"my-app\""
    else
        log_fail "Name sanitization" "my-app in output" "$output"
    fi

    # Test with underscores
    output=$("$TEMP_DIR/scripts/rebrand.sh" "my_cool_app" "testuser" "Test desc" --dry-run 2>&1 || true)

    if echo "$output" | grep -q "my-cool-app"; then
        log_pass "\"my_cool_app\" sanitizes to \"my-cool-app\""
    else
        log_fail "Underscore sanitization" "my-cool-app in output" "$output"
    fi

    # Test with leading/trailing spaces
    output=$("$TEMP_DIR/scripts/rebrand.sh" "  Spaces  " "testuser" "Test desc" --dry-run 2>&1 || true)

    if echo "$output" | grep -q "spaces"; then
        log_pass "\"  Spaces  \" sanitizes to \"spaces\""
    else
        log_fail "Space trimming" "spaces in output" "$output"
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# T005d: Test dry-run produces no file changes
# ============================================================================
test_dry_run_no_changes() {
    run_test "test_dry_run_no_changes"
    setup_temp_dir

    # Get hash of package.json before dry-run
    local original_hash
    original_hash=$(md5sum "$TEMP_DIR/package.json" | cut -d' ' -f1)

    # Run with --dry-run --force (in temp dir)
    "$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --force 2>/dev/null || true

    # Check file unchanged
    local new_hash
    new_hash=$(md5sum "$TEMP_DIR/package.json" | cut -d' ' -f1)

    if [ "$original_hash" = "$new_hash" ]; then
        log_pass "Dry-run did not modify files"
    else
        log_fail "Dry-run file modification" "file unchanged" "file was modified"
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# T005e: Test re-rebrand detection prompts user
# ============================================================================
test_rerebrand_detection() {
    run_test "test_rerebrand_detection"

    # Create a DIFFERENT temp dir for this test (without ScriptHammer refs)
    local REREBRAND_TEMP
    REREBRAND_TEMP=$(mktemp -d)
    trap "rm -rf $REREBRAND_TEMP" RETURN

    # Create a repo WITHOUT "ScriptHammer" references (simulating already rebranded)
    cd "$REREBRAND_TEMP"
    git init -q
    git remote add origin "https://github.com/testuser/other-project.git"

    # Create files WITHOUT ScriptHammer (already rebranded scenario)
    mkdir -p scripts src/components
    echo '{"name": "otherproject", "description": "Other project"}' > package.json
    echo "# OtherProject" > README.md
    echo "export const projectName = 'OtherProject';" > src/components/Logo.tsx

    # Copy rebrand script
    cp "$REBRAND_SCRIPT" "$REREBRAND_TEMP/scripts/"

    # Run without --force, test for WARNING message in output
    local output
    output=$("$REREBRAND_TEMP/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run 2>&1 || true)

    if echo "$output" | grep -qi "already.*rebranded\|no.*scripthammer.*found\|WARNING"; then
        log_pass "Re-rebrand scenario detected and warned"
    else
        log_fail "Re-rebrand detection" "warning about already rebranded" "${output:0:200}"
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# Test runner
# ============================================================================
run_all_tests() {
    echo "========================================"
    echo "Rebrand Script Test Suite"
    echo "========================================"

    # Check if rebrand script exists
    if [ ! -f "$REBRAND_SCRIPT" ]; then
        echo -e "${RED}ERROR${NC}: Rebrand script not found at $REBRAND_SCRIPT"
        echo "Tests will FAIL until script is implemented"
        exit 1
    fi

    # Check if script is executable
    if [ ! -x "$REBRAND_SCRIPT" ]; then
        echo -e "${YELLOW}WARNING${NC}: Making rebrand script executable"
        chmod +x "$REBRAND_SCRIPT"
    fi

    test_argument_validation
    test_name_sanitization
    test_dry_run_no_changes
    test_rerebrand_detection

    echo ""
    echo "========================================"
    echo "Test Summary"
    echo "========================================"
    echo -e "Total:  $TESTS_RUN"
    echo -e "${GREEN}Passed${NC}: $TESTS_PASSED"
    echo -e "${RED}Failed${NC}: $TESTS_FAILED"

    if [ "$TESTS_FAILED" -gt 0 ]; then
        exit 1
    fi
}

# Run specific test or all tests
if [ $# -eq 1 ]; then
    case "$1" in
        test_argument_validation)
            test_argument_validation
            ;;
        test_name_sanitization)
            test_name_sanitization
            ;;
        test_dry_run_no_changes)
            test_dry_run_no_changes
            ;;
        test_rerebrand_detection)
            test_rerebrand_detection
            ;;
        *)
            echo "Unknown test: $1"
            exit 1
            ;;
    esac
else
    run_all_tests
fi
