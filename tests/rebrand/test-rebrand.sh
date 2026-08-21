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

# #898: every invocation below that is not ABOUT the brand mark passes
# --no-icon explicitly. rebrand.sh now refuses to run without an icon decision,
# because two live sites shipped this template's logo past a warning. These
# tests are asserting sanitization, attribution and auth-config drift, so they
# state the choice rather than inherit a default -- which is the whole point of
# the flag.

# Test counters
TESTS_RUN=0
GROUPS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test utilities
# TESTS_RUN counts ASSERTIONS, the same unit as TESTS_PASSED and TESTS_FAILED
# (#549). It used to be incremented once per test GROUP by run_test, so the
# summary printed things like "Total: 5 / Passed: 11" — passed exceeding total,
# and no way to reconcile the two numbers. A summary you cannot read is a
# summary you cannot use to catch the next #522, which is the bug where this
# harness exited 1 having run nothing at all.
log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${YELLOW}Expected${NC}: $2"
    echo -e "  ${YELLOW}Got${NC}: $3"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

run_test() {
    local test_name="$1"
    GROUPS_RUN=$((GROUPS_RUN + 1))
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
    mkdir -p src/config
    cat > src/config/footer-links.ts <<'FOOTER'
export const FOOTER_LINKS = [
  { href: 'https://crudgames.com', label: 'CRUDgames.com' },
  {
    href: 'https://github.com/TortoiseWolfe/ScriptHammer', // rebrand:keep
    label: 'ScriptHammer', // rebrand:keep
  },
] as const;
FOOTER

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
# --help must print the WHOLE header, and no code (#541)
#
# show_help has now truncated silently twice. First as `sed -n '2,35p'`, a
# hardcoded range that stopped knowing where the header ended the moment the
# header grew. Then as an awk that stopped at the first non-`#` line, which cut
# the output from 47 lines to 8 the instant a genuinely blank line appeared
# inside the header.
#
# Both failures printed a plausible-looking help text and exited 0. Nothing
# caught either, because --help had no test at all. This is that test: it pins a
# floor on the line count, requires the LAST section to be present, and requires
# that no code leaks past the closing rule.
# ============================================================================
test_help_output_is_complete() {
    run_test "test_help_output_is_complete"
    setup_temp_dir

    local help_out line_count
    help_out=$("$TEMP_DIR/scripts/rebrand.sh" --help 2>&1)
    line_count=$(printf '%s\n' "$help_out" | wc -l)

    # Floor, not an exact match, so adding to the header does not fail the test.
    # 30 is comfortably below the current 44 and far above either truncation.
    if [ "$line_count" -ge 30 ]; then
        log_pass "--help prints the full header ($line_count lines)"
    else
        log_fail "--help output truncated" "at least 30 lines" "$line_count lines"
    fi

    # The last section of the header. If the printer stops early for any reason,
    # this is what goes missing first.
    if printf '%s\n' "$help_out" | grep -q 'rebrand:keep'; then
        log_pass "--help reaches the last header section"
    else
        log_fail "--help missing last section" "rebrand:keep documented" "absent"
    fi

    # And it must stop at the header. Leaking the script body would mean the
    # terminator is not being honoured.
    if printf '%s\n' "$help_out" | grep -qE 'set -euo pipefail|SCRIPT_DIR='; then
        log_fail "--help leaked script body" "header only" "shell code present"
    else
        log_pass "--help stops at the header, no code leaked"
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
    output=$("$TEMP_DIR/scripts/rebrand.sh" "My App!" "testuser" "Test desc" --dry-run --no-icon 2>&1 || true)

    if echo "$output" | grep -q "my-app"; then
        log_pass "\"My App!\" sanitizes to \"my-app\""
    else
        log_fail "Name sanitization" "my-app in output" "$output"
    fi

    # Test with underscores
    output=$("$TEMP_DIR/scripts/rebrand.sh" "my_cool_app" "testuser" "Test desc" --dry-run --no-icon 2>&1 || true)

    if echo "$output" | grep -q "my-cool-app"; then
        log_pass "\"my_cool_app\" sanitizes to \"my-cool-app\""
    else
        log_fail "Underscore sanitization" "my-cool-app in output" "$output"
    fi

    # Test with leading/trailing spaces
    output=$("$TEMP_DIR/scripts/rebrand.sh" "  Spaces  " "testuser" "Test desc" --dry-run --no-icon 2>&1 || true)

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
    "$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --force --no-icon 2>/dev/null || true

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
test_attribution_preserved() {
    run_test "test_attribution_preserved"
    setup_temp_dir

    # A real rebrand, not a dry run - the point is what survives on disk.
    "$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force --no-icon >/dev/null 2>&1 || true

    local footer="$TEMP_DIR/src/config/footer-links.ts"

    if grep -q "TortoiseWolfe/ScriptHammer" "$footer"; then
        log_pass "Attribution URL survives a rebrand"
    else
        log_fail "Attribution URL" "TortoiseWolfe/ScriptHammer intact" "$(cat "$footer")"
    fi

    if grep -q "label: 'ScriptHammer'" "$footer"; then
        log_pass "Attribution label survives a rebrand"
    else
        log_fail "Attribution label" "label: 'ScriptHammer' intact" "$(cat "$footer")"
    fi

    # The guard must be surgical: everything NOT marked still rebrands.
    if grep -q "MyApp" "$TEMP_DIR/src/components/Logo.tsx"; then
        log_pass "Unmarked lines still rebrand"
    else
        log_fail "Unmarked rebrand" "MyApp in Logo.tsx" "$(cat "$TEMP_DIR/src/components/Logo.tsx")"
    fi

    cd "$REPO_ROOT"
}

##
# #659 / #898: a rebrand that silently keeps the upstream icons is how CRUDkit's
# `CK` monogram installed onto phones from a live client site, through two
# rebrands. It then happened a SECOND time -- raisedpaws.com served this repo's
# printing mallet as its favicon and home-screen icon -- past the warning that
# was added to prevent exactly that.
#
# So the contract changed. A warning is not a gate: skipping the mark must now
# be something a forker SAYS (--no-icon), not something they fail to notice.
#
# The second failure also had a cause in this script: --icon rejected anything
# but SVG, and that fork's mark is a PNG, so they could not use the flag at all.
# The rejection funnelled them into the path it was warning about. Rasters are
# accepted now, so this asserts the extension gate lets one through.
##
test_brand_icons() {
    run_test "test_brand_icons"
    setup_temp_dir

    local out status

    # 1. Neither --icon nor --no-icon: REFUSE. This is the half that used to be
    #    a warning, and the half that shipped our logo twice.
    set +e
    out=$("$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force 2>&1)
    status=$?
    set -e
    if [ "$status" -ne 0 ] && echo "$out" | grep -q "Refusing to rebrand without deciding about the app icons"; then
        log_pass "Refuses to rebrand when no icon decision was made"
    else
        log_fail "Missing icon decision" "a non-zero exit refusing to continue (got status $status)" "$out"
    fi

    # 2. --no-icon: the deliberate escape hatch proceeds, and still says the
    #    icons are ours. An escape hatch that goes quiet is the old bug back.
    out=$("$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force --no-icon 2>&1 || true)
    if echo "$out" | grep -q "YOUR APP ICONS ARE STILL"; then
        log_pass "--no-icon proceeds and still warns the icons are unchanged"
    else
        log_fail "--no-icon" "the rebrand to continue and warn about the icons" "$out"
    fi

    setup_temp_dir

    # 3. An unsupported mark is still rejected, by extension.
    out=$("$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force --icon "$TEMP_DIR/README.md" 2>&1 || true)
    if echo "$out" | grep -q -- "--icon must be .svg, .png or .webp"; then
        log_pass "Rejects an unsupported mark format"
    else
        log_fail "Unsupported --icon" "an error naming the accepted formats" "$out"
    fi

    # 4. #898: a PNG mark must get PAST the format gate. Generation itself needs
    #    sharp and is covered by scripts/__tests__/generate-icons-source-kinds.test.js;
    #    what is asserted here is that this script no longer turns a raster away.
    printf 'not really a png' > "$TEMP_DIR/mark.png"
    out=$("$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force --icon "$TEMP_DIR/mark.png" 2>&1 || true)
    if echo "$out" | grep -q -- "--icon must be"; then
        log_fail "PNG --icon rejected" "a raster mark to be accepted by the format gate" "$out"
    else
        log_pass "Accepts a raster mark (#898)"
    fi

    cd "$REPO_ROOT"
}

##
# #734: the same shape as the icons above, one layer down. `auth-config.json` is
# the DESIRED STATE `auth-config-drift.yml` compares a live Supabase project
# against, daily. A fork that never sets its own values gets its project measured
# against ScriptHammer's identity, and the gate fails on values that were never
# theirs — whereupon the rational response is to stop believing the gate.
#
# The script cannot know a fork's OAuth client ids or SMTP sender; they are
# registered with third parties, not derived from a project name. So the contract
# is the same: SAY SO. This asserts the warning names the file, names the
# mechanism, and lists the variables — a warning too vague to act on is a warning
# that gets ignored.
##
test_auth_config_desired_state() {
    run_test "test_auth_config_desired_state"
    setup_temp_dir

    local out
    out=$("$TEMP_DIR/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --force --no-icon 2>&1 || true)

    if echo "$out" | grep -q "YOUR AUTH DESIRED-STATE IS STILL"; then
        log_pass "Warns that the auth desired-state is unchanged"
    else
        log_fail "Missing auth-config warning" "a warning that auth-config.json is unchanged" "$out"
    fi

    if echo "$out" | grep -q "scripts/supabase/auth-config.json"; then
        log_pass "Names the file to change"
    else
        log_fail "Auth-config warning names no file" "the path scripts/supabase/auth-config.json" "$out"
    fi

    # The variables are the actionable half. Assert a representative spread rather
    # than one name, so dropping the list cannot pass on a surviving heading.
    local missing=""
    for v in AUTH_SITE_URL AUTH_SMTP_ADMIN_EMAIL AUTH_GITHUB_CLIENT_ID AUTH_GOOGLE_CLIENT_ID; do
        echo "$out" | grep -q "$v" || missing="$missing $v"
    done
    if [ -z "$missing" ]; then
        log_pass "Lists the override variables"
    else
        log_fail "Auth-config warning omits variables" "every AUTH_* name" "missing:$missing"
    fi

    cd "$REPO_ROOT"
}

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
    output=$("$REREBRAND_TEMP/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --no-icon 2>&1 || true)

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
    test_help_output_is_complete
    test_name_sanitization
    test_dry_run_no_changes
    test_rerebrand_detection
    test_attribution_preserved
    test_brand_icons
    test_auth_config_desired_state

    echo ""
    echo "========================================"
    echo "Test Summary"
    echo "========================================"
    echo -e "Assertions: $TESTS_RUN  (across $GROUPS_RUN test groups)"
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
        test_help_output_is_complete)
            test_help_output_is_complete
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
        test_attribution_preserved)
            test_attribution_preserved
            ;;
        # `test_brand_icons` had no case of its own: it sat inside the branch above,
        # before its `;;`, so selecting test_attribution_preserved silently ran two
        # groups and test_brand_icons could not be run alone at all. Fixed while
        # adding the case below (#734).
        test_brand_icons)
            test_brand_icons
            ;;
        test_auth_config_desired_state)
            test_auth_config_desired_state
            ;;
        *)
            echo "Unknown test: $1"
            exit 1
            ;;
    esac
else
    run_all_tests
fi
