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
REBRAND_CASE_HELPER="$REPO_ROOT/scripts/rebrand-case.mjs"
UPSTREAM_DISPLAY='Script''Hammer'

# SAFETY CHECK: Never run rebrand on the actual repo
SAFETY_FILE="$REPO_ROOT/.git/config"
if [ -f "$SAFETY_FILE" ] && grep -q "$UPSTREAM_DISPLAY" "$SAFETY_FILE" 2>/dev/null; then
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
    # public/CNAME, not ./CNAME — rebrand.sh reads "$REPO_ROOT/public/CNAME". The root-level
    # copy that used to be here meant the CNAME branch never executed in any test.
    echo "scripthammer.com" > CNAME
    mkdir -p public
    echo "scripthammer.com" > public/CNAME
    echo "export const projectName = 'ScriptHammer';" > src/components/Logo.tsx
    printf 'lockfileBrand: ScriptHammer\n' > pnpm-lock.yaml

    # THE DESCRIPTION EVERY USER-VISIBLE SURFACE ACTUALLY READS (#923).
    #
    # DESCRIPTION reached package.json and stopped there. og:description,
    # twitter:description, the meta description and the PWA manifest all read
    # projectConfig.projectDescription, whose default carries NO brand token — so
    # the sweep cannot match it and a fork's social cards keep describing the
    # template. A live fork about live action role playing advertised "a
    # production Next.js and Supabase platform…" that way. No fork is named here:
    # a brand written into this tree becomes a brand that cannot be re-rebranded.
    mkdir -p src/config
    cat > src/config/project.config.ts <<'PROJCONF'
const defaultConfig = {
  projectName: 'ScriptHammer',
  projectOwner: 'TortoiseWolfe',
  projectDescription:
    'A production Next.js and Supabase platform with auth, payments, encrypted messaging, and an accessible offline-capable PWA',
  basePath: '',
};
PROJCONF

    # URLS THAT CITE THE TEMPLATE RATHER THAN NAMING THE FORK (#926).
    #
    # A fork inherits documentation linking to the upstream repository as evidence
    # — a bug report used as a worked example, a file on main. The substitution
    # rewrites those into links to the fork's own empty tracker, so `.../issues/51`
    # becomes a 404 in a repository that has no issue 51.
    #
    # Four shapes, because they break through different passes: the brand pass
    # rewrites the NAME half, and the owner pass rewrites the OWNER half even for
    # repositories whose names carry no brand token at all.
    mkdir -p docs
    cat > docs/CITATIONS.md <<'CITEDOC'
# Citations

A worked example of a good bug report:
https://github.com/TortoiseWolfe/ScriptHammer/issues/51

A file on the template's main branch:
https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/FORKING.md

Another repository the same author owns — its name carries no brand token, but
the owner pass rewrites it anyway:
https://github.com/TortoiseWolfe/RescueDogs/issues/15

The same host lowercased, which the case-sensitive owner pass walks past:
https://github.com/tortoisewolfe/CRUDkit
CITEDOC

    # THE BRAND TOKEN IN A FILENAME AND IN AN IDENTIFIER (#911).
    #
    # Every other fixture file carries it only inside a STRING, which is why the rename
    # pass had nothing to match and no test ever produced an identifier. A fork whose name
    # starts lowercase or contains a space rebranded this into `<geoLARPLogo />` or
    # `<My Cool AppLogo />` — an intrinsic tag and a syntax error respectively — and the
    # suite stayed green.
    cat > src/components/ScriptHammerLogo.tsx <<'LOGO'
export interface ScriptHammerLogoProps {
  size?: number;
}

export function ScriptHammerLogo({ size = 32 }: ScriptHammerLogoProps) {
  return <svg width={size} height={size} aria-label="ScriptHammer" />;
}

export const SimpleScriptHammer = () => <ScriptHammerLogo size={16} />;
LOGO
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

    # A GITIGNORED DIRECTORY CARRYING THE BRAND TOKEN (#922).
    #
    # The sweep used to discover files with `find`, which has no idea what git
    # tracks, and its hand-maintained exclusion list was already leaking --
    # `.pay-verify/` was reached and rewritten in the real repo. Discovery is now
    # `git ls-files`, so this file must come through untouched. Without a fixture
    # like this the change looks identical either way.
    echo "node_modules/" > .gitignore
    echo ".pay-verify/" >> .gitignore
    mkdir -p .pay-verify node_modules/some-dep
    echo "ScriptHammer must survive here" > .pay-verify/artifact.json
    echo "ScriptHammer must survive here too" > node_modules/some-dep/index.js

    # AN EXTENSIONLESS TRACKED FILE (#910, unblocked by #922).
    #
    # `.husky/*` and `docker/Dockerfile*` carry no suffix, so the old allowlist
    # could never reach them. Widening it was measured and backed out because it
    # dragged in caches and a vendored virtualenv. Asking git instead makes these
    # reachable for free, which is the gain that motivates the change.
    mkdir -p .husky
    printf '#!/bin/sh\n# ScriptHammer pre-commit hook\n' > .husky/pre-commit
    chmod +x .husky/pre-commit

    # EVERY REAL CASE STYLE PLUS A FUTURE MIXED STYLE (#933). These are code-shaped,
    # not just prose: a replacement can remove the old word and still make an invalid
    # identifier for a project name with spaces.
    cat > src/config/case-variants.ts <<'VARIANTS'
export const canonical = 'ScriptHammer';
export const lower = 'scripthammer';
export const title = 'Scripthammer';
export const upper = 'SCRIPTHAMMER';
export const futureMixed = 'ScriptHAMMER';
export const scripthammerCaches = true;
export const __scripthammer_syncQueue = true;
export const SCRIPTHAMMER_TEST_DOMAIN = '@scripthammer.test';
export function cleanupStaleScripthammerUsers() {}
export const keep = 'SCRIPTHAMMER + ScriptHAMMER'; // rebrand:keep
VARIANTS
    cat > src/config/owner-map.ts <<'OWNER_MAP'
export const authors = {
  ['TortoiseWolfe']: true,
};
OWNER_MAP

    # The reported live failure: the slug/file moved but every reader-facing field
    # kept the title-case spelling. The image directory is equally load-bearing —
    # rewriting this URL without moving the directory produces a broken intro post.
    mkdir -p public/blog public/blog-images/scripthammer-intro
    cat > public/blog/scripthammer-intro.md <<'INTRO'
---
title: Scripthammer - Opinionated Template
ogTitle: SCRIPTHAMMER
featuredImageAlt: ScriptHAMMER introduction
---
# Scripthammer: Introduction
![Dashboard](/blog-images/scripthammer-intro/plain.png)
INTRO
    printf 'binary-before\0Scripthammer\0binary-after' > public/blog-images/scripthammer-intro/plain.png

    # Non-lower path styles prove the path pass is case-insensitive too.
    mkdir -p docs
    printf '# Scripthammer badge\n' > src/components/ScripthammerBadge.tsx
    printf '# SCRIPTHAMMER notes\n' > docs/SCRIPTHAMMER-NOTES.md

    # Copy both halves of the rebrand implementation. The shell script owns the
    # workflow; the Node helper owns portable, callback-based casing and atomic
    # path planning (BSD sed cannot express either safely).
    mkdir -p scripts
    cp "$REBRAND_SCRIPT" "$REBRAND_CASE_HELPER" "$TEMP_DIR/scripts/"

    # STAGE EVERYTHING. Discovery is `git ls-files`, so an unstaged fixture is an
    # EMPTY fixture -- every assertion below would pass vacuously against a sweep
    # that touched nothing. This mirrors reality: a fork is a clone, so its files
    # are tracked. `git add` is enough; the index is what ls-files reads.
    git add -A >/dev/null 2>&1

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

# Choose a deterministic target that remains different even when this harness
# is executed from a fork whose current identity is already GeoLarp. The test
# source itself is rebranded with the repository, so fixed GeoLarp arguments
# otherwise turn the integration cases into same-target no-ops downstream.
set_case_test_identity() {
    CASE_SOURCE_DISPLAY=$(sed -n 's/^ORIGINAL_NAME="\([^"]*\)".*/\1/p' "$TEMP_DIR/scripts/rebrand.sh")
    CASE_SOURCE_SLUG=$(sed -n 's/^ORIGINAL_NAME_LOWER="\([^"]*\)".*/\1/p' "$TEMP_DIR/scripts/rebrand.sh")
    CASE_SOURCE_COMPONENT=$(sed -n 's/^ORIGINAL_COMPONENT_NAME="\([^"]*\)".*/\1/p' "$TEMP_DIR/scripts/rebrand.sh")
    CASE_SOURCE_UPPER=$(sed -n 's/^ORIGINAL_NAME_UPPER="\([^"]*\)".*/\1/p' "$TEMP_DIR/scripts/rebrand.sh")
    CASE_SOURCE_TITLE=$(printf '%s' "$CASE_SOURCE_COMPONENT" | tr '[:upper:]' '[:lower:]' | \
        awk '{ print toupper(substr($0, 1, 1)) substr($0, 2) }')

    if [ "$CASE_SOURCE_DISPLAY" = "GeoLarp" ]; then # rebrand:keep
        CASE_TARGET_DISPLAY="CaseProbe" # rebrand:keep
    else
        CASE_TARGET_DISPLAY="GeoLarp" # rebrand:keep
    fi
    CASE_TARGET_SLUG=$(printf '%s' "$CASE_TARGET_DISPLAY" | tr '[:upper:]' '[:lower:]')
    CASE_TARGET_COMPONENT="$CASE_TARGET_DISPLAY"
    CASE_TARGET_UPPER=$(printf '%s' "$CASE_TARGET_COMPONENT" | tr '[:lower:]' '[:upper:]')
    CASE_TARGET_TITLE=$(printf '%s' "$CASE_TARGET_COMPONENT" | tr '[:upper:]' '[:lower:]' | \
        awk '{ print toupper(substr($0, 1, 1)) substr($0, 2) }')
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
test_component_identifiers_are_valid() {
    run_test "test_component_identifiers_are_valid"
    setup_temp_dir

    # "geo LARP" is hostile in BOTH ways at once: a lowercase initial AND a space. The
    # first makes JSX resolve the tag as an intrinsic DOM element; the second is a plain
    # syntax error. A single fixture name covers both failure modes.
    "$TEMP_DIR/scripts/rebrand.sh" "geo LARP" "testuser" "Test desc" --force --no-icon >/dev/null 2>&1 || true

    # 1. The FILE must be renamed to something identifier-safe. Under the old code this
    #    never ran at all, because no fixture filename carried the token.
    if [ -f "$TEMP_DIR/src/components/GeoLARPLogo.tsx" ]; then
        log_pass "Component file renamed to PascalCase (GeoLARPLogo.tsx)"
    else
        log_fail "Component filename" "src/components/GeoLARPLogo.tsx" \
            "$(ls "$TEMP_DIR/src/components/" 2>/dev/null | tr '\n' ' ')"
    fi

    local logo
    logo=$(find "$TEMP_DIR/src/components" -name "*Logo.tsx" ! -name "Logo.tsx" | head -1)

    if [ -z "$logo" ]; then
        log_fail "Component file present" "a *Logo.tsx survived the rebrand" "none found"
        cd "$REPO_ROOT"
        return
    fi

    # 2. Every JSX tag must be a valid component reference. This is the assertion that
    #    fails on `<geoLARPLogo />` (lowercase initial) and on `<geo LARPLogo />` (space).
    local bad_tags
    bad_tags=$(grep -oE '<[A-Za-z][^ />]*' "$logo" | sed 's/^<//' \
               | grep -vE '^[A-Z][A-Za-z0-9]*$' | grep -vE '^(svg)$' || true)
    if [ -z "$bad_tags" ]; then
        log_pass "JSX tags are valid component identifiers"
    else
        log_fail "JSX tag validity" "every tag ^[A-Z][A-Za-z0-9]*$" "$bad_tags"
    fi

    # 3. Declared identifiers must be valid too — an export with a space in it is a syntax
    #    error the JSX check above would not see.
    # Take EVERYTHING between the keyword and the first delimiter, not the first word.
    # Splitting on whitespace was itself the bug: `export function geo LARPLogo(` yields
    # "geo", a perfectly valid identifier, so this assertion passed against the broken
    # script it was written to catch. The whole span must be one identifier.
    local bad_ids
    bad_ids=$(sed -nE 's/^export (function|const|interface) ([^(:={<]*).*/\2/p' "$logo" \
              | sed 's/[[:space:]]*$//' | grep -vE '^[A-Za-z_][A-Za-z0-9_]*$' || true)
    if [ -z "$bad_ids" ]; then
        log_pass "Exported identifiers are syntactically valid"
    else
        log_fail "Identifier validity" "every export a valid identifier" "$bad_ids"
    fi

    # 4. And prose must still read as the user typed it. The fix must not achieve safety by
    #    flattening the display name everywhere — "geo LARP" is what belongs in the README.
    if grep -q "geo LARP" "$TEMP_DIR/README.md"; then
        log_pass "Prose keeps the display name, spaces and all"
    else
        log_fail "Display name in prose" "geo LARP in README.md" "$(cat "$TEMP_DIR/README.md")"
    fi

    # 5. THE CNAME MUST BE GONE (#961), not merely well-formed.
    #
    #    This used to assert the file was a syntactically valid hostname, and it passed
    #    for years while describing nothing real: the value it validated was written by
    #    the CONTENT SWEEP, not by update_cname, whose own branch could never fire because
    #    the sweep had already removed the old brand token it tested for. So the gate
    #    approved `geo-larp.com` — a perfectly valid hostname that the forker does not own,
    #    and whose mere presence drops the Pages basePath and 404s every asset.
    #
    #    Absence is the assertion now. Validity was the wrong question.
    if [ -f "$TEMP_DIR/public/CNAME" ]; then
        log_fail "CNAME removed" "public/CNAME absent after a rebrand" \
            "still present: $(cat "$TEMP_DIR/public/CNAME")"
    else
        log_pass "CNAME removed — a fork owns no domain until it says so"
    fi

    # 6. …and --keep-cname must still keep it. Without this, "removed" could be
    #    satisfied by a script that deletes unconditionally, which would break the
    #    one fork that really is migrating a domain in.
    setup_temp_dir
    "$TEMP_DIR/scripts/rebrand.sh" "geo LARP" "testuser" "Test desc" --force --no-icon \
        --keep-cname >/dev/null 2>&1 || true
    if [ -f "$TEMP_DIR/public/CNAME" ]; then
        log_pass "--keep-cname still keeps it ($(cat "$TEMP_DIR/public/CNAME"))"
    else
        log_fail "--keep-cname honoured" "public/CNAME retained under --keep-cname" "removed anyway"
    fi

    cd "$REPO_ROOT"
}

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

    # Commit the application fixture before copying the implementation. This
    # gives the detector a real tracked set without letting its own source text
    # satisfy (or contaminate) the brand count.
    git add package.json README.md src/components/Logo.tsx >/dev/null 2>&1
    git -c user.name=Test -c user.email=test@example.com commit -qm fixture
    cp "$REBRAND_SCRIPT" "$REBRAND_CASE_HELPER" "$REREBRAND_TEMP/scripts/"

    local output status detector='This repository appears to have been rebranded already'
    set +e
    output=$("$REREBRAND_TEMP/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && printf '%s\n' "$output" | grep -Fq "$detector"; then
        log_pass "Exact-zero detector recognizes an already-rebranded tree"
    else
        log_fail "Re-rebrand detection" "exit 0 and exact detector warning" \
            "status=$status output=${output:0:300}"
    fi

    # One alternate-case survivor is enough to prove this is not an already-
    # rebranded tree. This pins removal of the former '< 5' heuristic.
    printf "export const oldBrand = 'Scripthammer';\n" > src/components/legacy.ts
    git add src/components/legacy.ts >/dev/null 2>&1
    set +e
    output=$("$REREBRAND_TEMP/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && ! printf '%s\n' "$output" | grep -Fq "$detector"; then
        log_pass "One unmarked title-case survivor prevents rebrand detection"
    else
        log_fail "Alternate-case detector" "no already-rebranded warning" \
            "status=$status output=${output:0:300}"
    fi

    # The same occurrence is intentionally invisible only when its own line is
    # explicitly protected.
    printf "export const oldBrand = 'Scripthammer'; // rebrand:keep\n" > src/components/legacy.ts
    set +e
    output=$("$REREBRAND_TEMP/scripts/rebrand.sh" "MyApp" "testuser" "Test desc" --dry-run --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && printf '%s\n' "$output" | grep -Fq "$detector"; then
        log_pass "Keep-only source references count as zero"
    else
        log_fail "Keep-only detector" "exit 0 and exact detector warning" \
            "status=$status output=${output:0:300}"
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# Test runner
# ============================================================================
# ============================================================================
# #922: discovery is `git ls-files`, not `find`
# ============================================================================
test_discovery_is_git_tracked() {
    run_test "test_discovery_is_git_tracked"

    setup_temp_dir
    safe_rebrand "GeoLARP" "tortoisewolfe" "A geo game" --force --no-icon > /tmp/rb-922.log 2>&1 || true

    # 1. GITIGNORED CONTENT MUST SURVIVE. The old `find` had no notion of what git
    # tracks, and its hand-maintained exclusion list was already leaking --
    # `.pay-verify/` was reached and rewritten in the real repo. A vendored
    # virtualenv was the worst case: a blind sed through it is corruption.
    if grep -q "ScriptHammer" .pay-verify/artifact.json 2>/dev/null; then
        log_pass "Gitignored file untouched (.pay-verify)"
    else
        log_fail "Gitignored file was rewritten" "ScriptHammer intact in .pay-verify/artifact.json" "$(cat .pay-verify/artifact.json 2>/dev/null)"
    fi

    if grep -q "ScriptHammer" node_modules/some-dep/index.js 2>/dev/null; then
        log_pass "Gitignored file untouched (node_modules)"
    else
        log_fail "node_modules was rewritten" "ScriptHammer intact in node_modules/some-dep/index.js" "$(cat node_modules/some-dep/index.js 2>/dev/null)"
    fi

    # 2. AN EXTENSIONLESS TRACKED FILE MUST BE REWRITTEN. The gain that motivates
    # the change, and the other half of #910: `.husky/*` and `docker/Dockerfile*`
    # carry no suffix, so the old allowlist could never reach them. Widening it was
    # backed out because it dragged in 1,746 files, 1,581 of them caches.
    if grep -q "GeoLARP" .husky/pre-commit 2>/dev/null; then
        log_pass "Extensionless tracked file rebranded (.husky/pre-commit)"
    else
        log_fail "Extensionless file was not reached" "GeoLARP in .husky/pre-commit" "$(cat .husky/pre-commit 2>/dev/null)"
    fi

    # Generated lockfiles are tracked but deliberately not content-rewritten;
    # changing one without regenerating it can invalidate integrity metadata.
    if grep -q "ScriptHammer" pnpm-lock.yaml 2>/dev/null; then
        log_pass "Tracked lockfile content is left byte-stable"
    else
        log_fail "Lockfile exclusion" "ScriptHammer intact in pnpm-lock.yaml" \
            "$(cat pnpm-lock.yaml 2>/dev/null)"
    fi

    # 3. A FLOOR, so a discovery change that silently matches NOTHING fails loudly.
    # Every assertion above is satisfiable by a sweep that touched no file at all --
    # the gitignored ones stay intact for the wrong reason. Without this the whole
    # group goes vacuous the moment discovery breaks. That is the #396 shape.
    local modified
    modified=$(grep -oE 'Files modified: *[0-9]+' /tmp/rb-922.log | grep -oE '[0-9]+' | head -1)
    modified=${modified:-0}
    if [ "$modified" -ge 3 ]; then
        log_pass "Sweep still modified a plausible number of files ($modified)"
    else
        log_fail "Sweep modified almost nothing" "at least 3 files modified" "reported $modified -- discovery is probably finding nothing"
    fi

    cd "$REPO_ROOT"
}

# ============================================================================
# #933: arbitrary casing, identifier projections, full paths, and postcondition
# ============================================================================
test_case_preserving_rebrand() {
    run_test "test_case_preserving_rebrand"
    setup_temp_dir
    set_case_test_identity

    local binary_before output status residuals old_paths key_before key_after keep_before
    binary_before=$(git hash-object public/blog-images/scripthammer-intro/plain.png)
    keep_before=$(tail -1 src/config/case-variants.ts)

    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "test-user" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
        log_pass "Case-preserving rebrand exits zero"
    else
        log_fail "Case-preserving rebrand status" "exit 0" "exit $status: $output"
        cd "$REPO_ROOT"
        return
    fi

    local variants="$TEMP_DIR/src/config/case-variants.ts"
    local expected
    for expected in \
        "export const canonical = '$CASE_TARGET_DISPLAY';" \
        "export const lower = '$CASE_TARGET_SLUG';" \
        "export const title = '$CASE_TARGET_TITLE';" \
        "export const upper = '$CASE_TARGET_UPPER';" \
        "export const futureMixed = '$CASE_TARGET_DISPLAY';" \
        "export const ${CASE_TARGET_SLUG}Caches = true;" \
        "export const __${CASE_TARGET_SLUG}_syncQueue = true;" \
        "export const ${CASE_TARGET_UPPER}_TEST_DOMAIN = '@${CASE_TARGET_SLUG}.test';" \
        "export function cleanupStale${CASE_TARGET_TITLE}Users() {}"; do
        if grep -Fqx "$expected" "$variants"; then
            log_pass "Exact case projection: $expected"
        else
            log_fail "Case projection" "$expected" "$(cat "$variants")"
        fi
    done

    if [ "$(tail -1 "$variants")" = "$keep_before" ]; then
        log_pass "All keep-line case variants remain byte-exact"
    else
        log_fail "Keep-line surgery" "original mixed/upper line" "$(tail -1 "$variants")"
    fi

    if grep -Fqx "  ['test-user']: true," src/config/owner-map.ts; then
        log_pass "Hyphenated GitHub owner remains a valid quoted object key"
    else
        log_fail "Owner identifier safety" "quoted test-user key" \
            "$(cat src/config/owner-map.ts)"
    fi

    local intro="$TEMP_DIR/public/blog/${CASE_TARGET_SLUG}-intro.md"
    if [ -f "$intro" ] && grep -Fq "title: $CASE_TARGET_TITLE - Opinionated Template" "$intro" && \
        grep -Fq "ogTitle: $CASE_TARGET_UPPER" "$intro" && grep -Fq "# $CASE_TARGET_TITLE: Introduction" "$intro"; then
        log_pass "Renamed intro has no missed reader-facing casing"
    else
        log_fail "Intro rebrand" "renamed intro with Geolarp/GEOLARP content" "$(cat "$intro" 2>/dev/null)"
    fi

    local binary_after="$TEMP_DIR/public/blog-images/${CASE_TARGET_SLUG}-intro/plain.png"
    if [ -f "$binary_after" ] && [ "$(git hash-object "$binary_after")" = "$binary_before" ]; then
        log_pass "Brand directory renamed without changing binary bytes"
    else
        log_fail "Binary/path transform" "geolarp-intro path with identical hash" "missing or changed"
    fi

    if [ -f "$TEMP_DIR/src/components/${CASE_TARGET_TITLE}Badge.tsx" ] && \
        [ -f "$TEMP_DIR/docs/${CASE_TARGET_UPPER}-NOTES.md" ]; then
        log_pass "Title and uppercase tracked paths use their exact projections"
    else
        log_fail "Case-preserving paths" "GeolarpBadge.tsx and GEOLARP-NOTES.md" \
            "$(find "$TEMP_DIR" -maxdepth 3 -type f | sort | tr '\n' ' ')"
    fi

    # TWO KINDS OF LEGITIMATE SURVIVOR NOW, not one (#926).
    #
    # `rebrand:keep` marks a line the author chose to protect. A URL under the
    # upstream owner is the second kind: an inherited doc citing the template as
    # evidence — an issue by number, a file at a ref — which a fork cannot
    # reproduce because its own tracker has no issue 51. Those are retained on
    # purpose, so a gate whose question is "did anything get MISSED?" must not
    # count them.
    #
    # Scoped to `github.com/<upstream-owner>/` rather than the brand token, because
    # the owner pass breaks links to every repository upstream owns — including
    # ones whose names carry no brand token at all.
    local CASE_SOURCE_OWNER="TortoiseWolfe" # rebrand:keep
    residuals=""
    old_paths=""
    local source
    for source in "$CASE_SOURCE_DISPLAY" "$CASE_SOURCE_SLUG" "$CASE_SOURCE_COMPONENT" "$CASE_SOURCE_UPPER"; do
        residuals+=$(find . \
            \( -path './.git' -o -path './node_modules' -o -path './.pay-verify' \) -prune -o \
            -type f ! -name pnpm-lock.yaml ! -name package-lock.json \
            ! -name yarn.lock ! -name bun.lockb -print0 | \
            xargs -0 grep -IinF "$source" 2>/dev/null | \
            grep -v 'rebrand:keep' | \
            grep -v "github.com/$CASE_SOURCE_OWNER/" || true)
        old_paths+=$(find . \
            \( -path './.git' -o -path './node_modules' -o -path './.pay-verify' \) -prune -o \
            -print | grep -iF "$source" || true)
    done
    if [ -z "$residuals" ] && [ -z "$old_paths" ] && \
        printf '%s\n' "$output" | grep -q 'Verified: no old-brand text or tracked paths remain'; then
        log_pass "Tree and script postcondition agree: zero unmarked old-brand survivors"
    else
        log_fail "Residual postcondition" "no unmarked content/path survivors" \
            "content=[$residuals] paths=[$old_paths] output=[$output]"
    fi

    # Same-target idempotence: the intended target is not misreported as the old
    # brand merely because rebrand.sh persisted it as the current identity.
    key_before=$(git hash-object "$variants")
    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "test-user" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e
    key_after=$(git hash-object "$variants")
    if [ "$status" -eq 0 ] && [ "$key_before" = "$key_after" ] && \
        printf '%s\n' "$output" | grep -q 'Brand identity already matches'; then
        log_pass "Same-target rerun is a clean no-op"
    else
        log_fail "Same-target rerun" "exit 0, unchanged bytes, explicit no-op" \
            "status=$status before=$key_before after=$key_after output=$output"
    fi

    # A different-target rerun before index refresh would silently omit every
    # renamed path. It must stop with an actionable error rather than claiming
    # success over an incomplete snapshot.
    set +e
    output=$(safe_rebrand "Second App" "seconduser" "Second desc" --force --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 1 ] && printf '%s\n' "$output" | grep -q "Stage the prior rename with 'git add -A'"; then
        log_pass "Different-target rerun rejects stale index paths"
    else
        log_fail "Stale-index re-rebrand" "exit 1 with git add -A instruction" "status=$status output=$output"
    fi

    # Commit-equivalent index refresh, then prove a later re-rebrand can finish.
    git add -A >/dev/null 2>&1
    set +e
    output=$(safe_rebrand "Second App" "seconduser" "Second desc" --force --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && grep -Fqx '# Second App' "$TEMP_DIR/README.md" && \
        [ -f "$TEMP_DIR/src/components/SecondAppLogo.tsx" ] && \
        grep -Fq 'SECONDAPP_TEST_DOMAIN' "$TEMP_DIR/src/config/case-variants.ts" && \
        [ -f "$TEMP_DIR/public/blog-images/second-app-intro/plain.png" ]; then
        log_pass "Re-rebrand succeeds after renamed paths are staged"
    else
        log_fail "Re-rebrand projections" "Second App across prose/code/path" "status=$status output=$output"
    fi

    cd "$REPO_ROOT"
}

##
# The #952 guard could not fail on the input that caused the bug (#958).
#
# test_case_preserving_rebrand asserts the case projections with
# CASE_TARGET_DISPLAY set to "CaseProbe" or "GeoLarp" — both SINGLE-TOKEN, where
# targetSlug and asciiLower(targetComponent) are the same string. The branch it is
# meant to protect, rebrand-case.mjs's `identifierAdjacent ? … : …`, therefore
# produces identical output either way: delete the branch and that suite stays
# green.
#
# It only diverges for a multi-token name. `__scripthammer_syncQueue` becomes
# `__widgetworks_syncQueue` if the branch fires and `__widget-works_syncQueue` if
# it does not — and the latter is not an identifier at all. Prettier then reads
# the hyphen as subtraction and rewrites it into a different valid expression, so
# the token stops existing as a contiguous string and only the type-checker
# notices. That is what happened in a real tree.
#
# CASE_TARGET_DISPLAY is shared by six test functions, so this adds a second case
# rather than changing it. And it asserts identifier VALIDITY rather than equality
# against a computed string: equality still passes when both sides are wrong in
# the same way, and this is a file whose whole job is to be syntactically valid.
##
test_case_preserving_multiword() {
    run_test "test_case_preserving_multiword"
    setup_temp_dir

    local target="Widget Works"
    local slug="widget-works"
    local component="widgetworks"

    "$TEMP_DIR/scripts/rebrand.sh" "$target" "testuser" "Test desc" --force --no-icon \
        >/dev/null 2>&1 || true

    local variants="$TEMP_DIR/src/config/case-variants.ts"
    if [ ! -f "$variants" ]; then
        log_fail "Case variants present" "src/config/case-variants.ts after rebrand" "missing"
        cd "$REPO_ROOT"
        return
    fi

    # 1. Every declared name must be a syntactically valid identifier. This is the
    #    assertion the single-token suite cannot make, because it never produces an
    #    invalid one.
    local bad
    bad=$(sed -nE "s/^export (const|function) ([^ =(]*).*/\2/p" "$variants" \
          | grep -vE '^[A-Za-z_$][A-Za-z0-9_$]*$' || true)
    if [ -z "$bad" ]; then
        log_pass "Multi-token rebrand leaves every declared name a valid identifier"
    else
        log_fail "Identifier validity (multi-token)" "every export a valid identifier" "$bad"
    fi

    # 2. And specifically: a slug glued to an identifier takes the separator-free
    #    component projection, not the hyphenated slug. This is the branch itself.
    if grep -Fqx "export const __${component}_syncQueue = true;" "$variants"; then
        log_pass "Identifier-adjacent slug uses the component projection (__${component}_syncQueue)"
    else
        log_fail "Identifier-adjacent projection" \
            "export const __${component}_syncQueue = true;" "$(cat "$variants")"
    fi

    # 3. While a STANDALONE slug still takes the hyphenated form — otherwise the fix
    #    could be "never hyphenate", which would corrupt prose and hostnames.
    if grep -Fqx "export const lower = '${slug}';" "$variants"; then
        log_pass "Standalone slug stays hyphenated (${slug})"
    else
        log_fail "Standalone slug" "export const lower = '${slug}';" "$(cat "$variants")"
    fi

    cd "$REPO_ROOT"
}

##
# The summary must report what it did, not more (#956).
#
# FILES_MODIFIED was a bare ++ accumulated by two independent sweeps over the same
# file set, so a file matched by both counted twice: a real run said "1002 files
# modified" against 926 paths git could see. That number does not stay in the
# terminal — docs/POSITIONING.md quoted it as a measurement — and it is the first
# thing a forker reads about what just happened to their repository.
#
# Asserting against git rather than a magic number, because a hardcoded expectation
# here would need updating every time the fixture grows and would be "corrected"
# to whatever the script happened to print.
##
test_summary_counts_paths_not_increments() {
    run_test "test_summary_counts_paths_not_increments"

    # A DIFFERENTIAL, because a bound is not falsifiable here.
    #
    # The defect is that two sweeps — the case-helper brand pass and the separate
    # owner pass — each incremented the same counter, so a file carrying BOTH
    # tokens counted twice. A real run reported 1002 against 926 paths.
    #
    # My first attempt asserted `reported <= what git sees`, and it passed against
    # the unfixed script: this fixture has too few dual-token files for the
    # over-count to exceed the total. A guard that cannot fail is worth nothing, so
    # this measures the thing itself instead — add ONE file carrying both tokens
    # and the reported count must grow by exactly ONE.
    local baseline delta
    baseline=$(_summary_count_for "")
    delta=$(_summary_count_for "dual")

    if [ -z "$baseline" ] || [ -z "$delta" ]; then
        log_fail "Summary count readable" "a 'Files modified:' line from both runs" \
            "baseline='$baseline' with-dual='$delta'"
        cd "$REPO_ROOT"
        return
    fi

    local growth=$((delta - baseline))
    if [ "$growth" -eq 1 ]; then
        log_pass "One dual-token file adds one to the count ($baseline -> $delta)"
    else
        log_fail "Dual-token double count" "count to grow by 1" \
            "grew by $growth ($baseline -> $delta) — the file was counted once per sweep"
    fi

    # A floor, so a rewrite that reports 0 for both still fails rather than
    # satisfying the delta with two zeroes.
    if [ "$baseline" -ge 5 ]; then
        log_pass "Baseline count is non-vacuous ($baseline)"
    else
        log_fail "Summary non-vacuous" "at least 5 paths in the fixture" "$baseline"
    fi

    cd "$REPO_ROOT"
}

# Rebrand a fresh fixture and echo the summary's "Files modified" number.
# With "dual", first add one file carrying BOTH the brand and the owner token —
# the only shape that distinguishes a path count from an increment count.
_summary_count_for() {
    setup_temp_dir
    if [ "$1" = "dual" ]; then
        mkdir -p "$TEMP_DIR/docs"
        printf 'See https://github.com/TortoiseWolfe/ScriptHammer for ScriptHammer docs.\n' \
            > "$TEMP_DIR/docs/DUAL.md"
        (cd "$TEMP_DIR" && git add -A >/dev/null 2>&1 && \
            git -c user.email=t@t.t -c user.name=t commit -qm dual >/dev/null 2>&1) || true
    fi
    "$TEMP_DIR/scripts/rebrand.sh" "geo LARP" "testuser" "Test desc" --force --no-icon 2>&1 \
        | sed -n 's/^ *Files modified: *\([0-9]*\) *$/\1/p' | tail -1
}

##
# A URL pointing at the template is a CITATION, not branding (#926).
#
# The substitution has no notion that `github.com/OWNER/ScriptHammer/...` points
# BACK at the template rather than being an instance of the fork's own name, so
# every fork silently converts inherited documentation links into links to its own
# empty tracker. Measured on a real fork: 42 issue and PR URLs retargeted, every
# one a 404.
#
# The owner pass makes it worse than the brand pass alone. `RescueDogs` carries no
# brand token, so the name survives — and the owner is rewritten anyway, which
# breaks links to EVERY repository the template's author owns. And because that
# pass is case-sensitive, the same link survives or breaks depending on how it was
# capitalised, which is the kind of asymmetry nobody discovers on purpose.
##
test_upstream_citations_survive() {
    run_test "test_upstream_citations_survive"
    setup_temp_dir

    "$TEMP_DIR/scripts/rebrand.sh" "geo LARP" "testuser" "Test desc" --force --no-icon \
        >/dev/null 2>&1 || true

    local doc="$TEMP_DIR/docs/CITATIONS.md"
    if [ ! -f "$doc" ]; then
        log_fail "Citation fixture present" "docs/CITATIONS.md after rebrand" "missing"
        cd "$REPO_ROOT"
        return
    fi

    local expected
    for expected in \
        "https://github.com/TortoiseWolfe/ScriptHammer/issues/51" \
        "https://github.com/TortoiseWolfe/ScriptHammer/blob/main/docs/FORKING.md" \
        "https://github.com/TortoiseWolfe/RescueDogs/issues/15" \
        "https://github.com/tortoisewolfe/CRUDkit"; do
        if grep -Fq "$expected" "$doc"; then
            log_pass "Citation survives: ${expected#https://github.com/}"
        else
            log_fail "Citation rewritten" "$expected" "$(grep -oE 'https://github\.com/[^ ]*' "$doc" | tr '\n' ' ')"
        fi
    done

    # THE POSITIVE CONTROL. The exemption must be about URLs pointing at the
    # template, not about switching the substitution off — prose naming the fork
    # still has to rebrand, or "citations survive" is satisfied by doing nothing.
    if grep -q "geo LARP" "$TEMP_DIR/README.md"; then
        log_pass "Prose still rebrands (the exemption is scoped to citations)"
    else
        log_fail "Prose rebrands" "geo LARP in README.md" "$(cat "$TEMP_DIR/README.md")"
    fi

    cd "$REPO_ROOT"
}

##
# The description a forker passes must reach the surfaces users see (#923).
#
# It reached package.json and stopped. Everything user-visible — og:description,
# twitter:description, the meta description, the PWA manifest — reads
# projectConfig.projectDescription, whose default contains no brand token, so the
# substitution sweep has nothing to match and cannot reach it.
#
# Asserted on the CONFIG rather than on package.json, because package.json was
# always right and that is exactly why nobody noticed.
##
test_description_reaches_the_site() {
    run_test "test_description_reaches_the_site"
    setup_temp_dir

    local desc="a widget for widgeting"
    "$TEMP_DIR/scripts/rebrand.sh" "geo LARP" "testuser" "$desc" --force --no-icon \
        >/dev/null 2>&1 || true

    local conf="$TEMP_DIR/src/config/project.config.ts"
    if [ ! -f "$conf" ]; then
        log_fail "Config present" "src/config/project.config.ts after rebrand" "missing"
        cd "$REPO_ROOT"
        return
    fi

    if grep -Fq "$desc" "$conf"; then
        log_pass "projectDescription carries the description the forker passed"
    else
        log_fail "Description reaches the config" "$desc in projectDescription" \
            "$(grep -A2 'projectDescription' "$conf")"
    fi

    # And the template's own copy must be GONE — leaving both would let a stale
    # default win depending on which one a reader edits.
    if grep -q "production Next.js and Supabase platform" "$conf"; then
        log_fail "Template description removed" "no trace of the template's own text" \
            "$(grep -A2 'projectDescription' "$conf")"
    else
        log_pass "The template's own description no longer survives in the config"
    fi

    # package.json was always right; assert it still is, so the fix does not move
    # the problem rather than solving it.
    if grep -Fq "\"description\": \"$desc\"" "$TEMP_DIR/package.json"; then
        log_pass "package.json description unchanged by the fix"
    else
        log_fail "package.json description" "\"description\": \"$desc\"" \
            "$(cat "$TEMP_DIR/package.json")"
    fi

    cd "$REPO_ROOT"
}
##
# A description is free text, and it reaches two files with incompatible
# escaping rules (#923, #972).
#
# `update_package_json` built `s|"description": "…"|"description": "$DESCRIPTION"|`
# — `|` as the delimiter, DESCRIPTION interpolated raw. A description containing
# a pipe TERMINATED the expression and the rebrand died mid-run, after the
# content sweep had already rewritten the whole tree:
#
#   sed: -e expression #1, char 59: unknown option to `s'
#
# Reproduced against the shipped script, not a fixture. The same string breaks
# the other three ways too: `&` expands to the whole match in a sed replacement,
# `"` breaks JSON, and `'` closes the TypeScript literal in project.config.ts.
# One input covers all four. Assert the value ROUND-TRIPS rather than that the
# run exits zero, because a silently mangled description also exits zero.
##
test_hostile_description_is_escaped() {
    run_test "test_hostile_description_is_escaped"
    setup_temp_dir

    local desc status conf
    desc='Care & rescue | it'"'"'s "now" — 100%'

    set +e
    "$TEMP_DIR/scripts/rebrand.sh" "Widget Works" "testuser" "$desc" --force --no-icon \
        >/dev/null 2>&1
    status=$?
    set -e

    if [ "$status" -eq 0 ]; then
        log_pass "Rebrand survives a description containing & | ' and \""
    else
        log_fail "Hostile description" "exit 0" "exit $status (sed delimiter collision?)"
        cd "$REPO_ROOT"
        return
    fi

    if node -e 'const fs=require("node:fs");
const pkg=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(pkg.description===process.argv[2]?0:1);' \
        "$TEMP_DIR/package.json" "$desc" 2>/dev/null; then
        log_pass "package.json stays valid JSON and round-trips the description"
    else
        log_fail "package.json escaping" "valid JSON holding the exact description" \
            "$(grep -m1 description "$TEMP_DIR/package.json" || true)"
    fi

    conf="$TEMP_DIR/src/config/project.config.ts"
    if node -e 'const fs=require("node:fs");
const src=fs.readFileSync(process.argv[1],"utf8");
new Function(src.replace(/\bconst\b/g,"var"));
const m=src.match(/projectDescription:\s*\x27((?:[^\x27\\]|\\.)*)\x27/);
if(!m)process.exit(1);
process.exit(m[1].replace(/\\\x27/g,"\x27")===process.argv[2]?0:1);' \
        "$conf" "$desc" 2>/dev/null; then
        log_pass "project.config.ts still parses and round-trips the description"
    else
        log_fail "config escaping" "parseable literal holding the exact description" \
            "$(grep -A2 projectDescription "$conf" 2>/dev/null || echo missing)"
    fi

    cd "$REPO_ROOT"
}


test_path_collision_is_atomic() {
    run_test "test_path_collision_is_atomic"
    setup_temp_dir
    set_case_test_identity

    # The uppercase fixture already exists. Its lowercase peer maps to the same
    # case-folded destination; a portable rebrand must reject that before content
    # writes or mv can overwrite either source.
    local lower_peer="docs/${CASE_SOURCE_SLUG}-NOTES.md"
    printf '# lowercase sentinel\n' > "$lower_peer"
    git add "$lower_peer" >/dev/null 2>&1

    local output status
    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "testuser" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e

    if [ "$status" -eq 1 ] && printf '%s\n' "$output" | grep -q 'rebrand path collision'; then
        log_pass "Path collision fails before mutation"
    else
        log_fail "Path collision status" "exit 1 with collision diagnostic" "status=$status output=$output"
    fi
    if grep -Fqx "# $CASE_SOURCE_DISPLAY" README.md && \
        grep -Fqx "# $CASE_SOURCE_UPPER notes" "docs/${CASE_SOURCE_UPPER}-NOTES.md" && \
        grep -Fqx '# lowercase sentinel' "$lower_peer"; then
        log_pass "Collision leaves both sources and repository content intact"
    else
        log_fail "Collision atomicity" "all preflight sources byte-intact" "one or more files changed"
    fi

    cd "$REPO_ROOT"
}

test_existing_target_directory_is_atomic() {
    run_test "test_existing_target_directory_is_atomic"
    setup_temp_dir
    set_case_test_identity

    local target_dir="public/blog-images/${CASE_TARGET_SLUG}-intro"
    mkdir -p "$target_dir"
    printf 'target sentinel\n' > "$target_dir/sentinel.txt"

    local output status
    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "testuser" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e

    if [ "$status" -eq 1 ] && printf '%s\n' "$output" | grep -q 'rebrand target directory already exists'; then
        log_pass "Existing target directory fails before mutation"
    else
        log_fail "Target directory status" "exit 1 with target-directory diagnostic" "status=$status output=$output"
    fi
    if grep -Fqx "# $CASE_SOURCE_DISPLAY" README.md && \
        grep -Fqx 'target sentinel' "$target_dir/sentinel.txt" && \
        [ -f "public/blog-images/${CASE_SOURCE_SLUG}-intro/plain.png" ]; then
        log_pass "Existing target directory leaves source and target byte-intact"
    else
        log_fail "Target directory atomicity" "source and target byte-intact" "one or more files changed"
    fi

    cd "$REPO_ROOT"
}

test_residual_gate_is_fatal() {
    run_test "test_residual_gate_is_fatal"
    setup_temp_dir
    set_case_test_identity

    printf '%s FORCE_SURVIVOR\n' "$CASE_SOURCE_TITLE" > src/config/residual.ts
    git add src/config/residual.ts >/dev/null 2>&1

    # Break the shared substitution/path regex itself. The independent verifier
    # uses a separate ASCII-folded fixed-string implementation, so it must still
    # catch the survivor and make the whole run non-zero.
    node - "$TEMP_DIR/scripts/rebrand-case.mjs" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const anchor = "`(?:${identity.sources.map(asciiCasePattern).join('|')})`,";
const source = fs.readFileSync(file, 'utf8');
if (!source.includes(anchor)) throw new Error('replacement mutation anchor missing');
fs.writeFileSync(file, source.replace(anchor, "'(?!)',"));
NODE

    local output status
    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "testuser" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e

    if [ "$status" -eq 1 ] && printf '%s\n' "$output" | grep -q 'Old brand remains outside rebrand:keep' && \
        printf '%s\n' "$output" | grep -q 'residual.ts:1'; then
        log_pass "Independent residual scan turns a missed variant into a failure"
    else
        log_fail "Residual gate" "exit 1 with path:line survivor" "status=$status output=$output"
    fi
    if printf '%s\n' "$output" | grep -q 'REBRAND COMPLETE'; then
        log_fail "Residual success suppression" "no success banner after failed postcondition" "$output"
    else
        log_pass "Failed postcondition never prints REBRAND COMPLETE"
    fi

    if grep -Fqx "ORIGINAL_NAME=\"$CASE_SOURCE_DISPLAY\" # rebrand:keep" scripts/rebrand.sh; then
        log_pass "Failed postcondition does not publish target identity state"
    else
        log_fail "Identity commit ordering" "source identity retained after failure" \
            "$(grep '^ORIGINAL_' scripts/rebrand.sh)"
    fi

    # Restore the deliberately broken helper and retry the same command. Because
    # the first failure happened before path moves and before identity commit,
    # this is a real recovery rather than a same-target false success.
    cp "$REBRAND_CASE_HELPER" scripts/rebrand-case.mjs
    set +e
    output=$(safe_rebrand "$CASE_TARGET_DISPLAY" "testuser" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && ! grep -qiF "$CASE_SOURCE_TITLE" src/config/residual.ts && \
        printf '%s\n' "$output" | grep -q 'REBRAND COMPLETE'; then
        log_pass "Same-command retry repairs a failed residual run"
    else
        log_fail "Residual retry" "exit 0 with survivor repaired" "status=$status output=$output"
    fi

    cd "$REPO_ROOT"
}

test_source_containing_target_is_atomic() {
    run_test "test_source_containing_target_is_atomic"
    setup_temp_dir
    set_case_test_identity

    local target before after output status
    target=$(printf '%s' "$CASE_SOURCE_DISPLAY" | tr '[:upper:]' '[:lower:]')
    if [ "$target" = "$CASE_SOURCE_DISPLAY" ]; then
        target=$(printf '%s' "$CASE_SOURCE_DISPLAY" | tr '[:lower:]' '[:upper:]')
    fi
    before=$(git hash-object README.md)

    set +e
    output=$(safe_rebrand "$target" "testuser" "Test desc" --force --no-icon 2>&1)
    status=$?
    set -e
    after=$(git hash-object README.md)

    if [ "$status" -eq 1 ] && \
        printf '%s\n' "$output" | grep -Eq 'target identity still contains|automated re-rebrand is unsafe'; then
        log_pass "Case-equivalent target is rejected before writes"
    else
        log_fail "Source-containing target" "exit 1 with identity diagnostic" "status=$status output=$output"
    fi
    if [ "$before" = "$after" ] && grep -Fqx "# $CASE_SOURCE_DISPLAY" README.md; then
        log_pass "Rejected identity leaves repository bytes unchanged"
    else
        log_fail "Target preflight atomicity" "README byte-intact" "before=$before after=$after"
    fi

    cd "$REPO_ROOT"
}

test_forked_harness_smoke() {
    run_test "test_forked_harness_smoke"
    setup_temp_dir

    local output status
    set +e
    output=$(safe_rebrand "HarnessProbe42" "testuser" "Fork harness probe" --force --no-icon 2>&1) # rebrand:keep
    status=$?
    set -e

    if [ "$status" -eq 0 ] && printf '%s\n' "$output" | grep -q 'REBRAND COMPLETE'; then
        log_pass "Forked harness can exercise a distinct safe target"
    elif [ "$status" -eq 1 ] && \
        printf '%s\n' "$output" | grep -q 'automated re-rebrand is unsafe'; then
        log_pass "Forked harness confirms an intentionally unsupported source identity"
    else
        log_fail "Forked harness smoke" "clean success or explicit unsafe-identity refusal" \
            "status=$status output=$output"
    fi

    cd "$REPO_ROOT"
}

test_harness_survives_rebrand() {
    run_test "test_harness_survives_rebrand"
    setup_temp_dir

    mkdir -p tests/rebrand
    cp "$REPO_ROOT/tests/rebrand/test-rebrand.sh" tests/rebrand/test-rebrand.sh
    chmod +x tests/rebrand/test-rebrand.sh
    git add -A >/dev/null 2>&1

    local output status
    set +e
    output=$(safe_rebrand "GeoLarp" "testuser" "Fork harness probe" --force --no-icon 2>&1) # rebrand:keep
    status=$?
    set -e
    if [ "$status" -ne 0 ]; then
        log_fail "Harness fork setup" "initial rebrand exits 0" "status=$status output=$output"
        cd "$REPO_ROOT"
        return
    fi

    git add -A >/dev/null 2>&1
    set +e
    output=$(bash tests/rebrand/test-rebrand.sh 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ] && printf '%s\n' "$output" | grep -q 'Forked harness'; then
        log_pass "Rebranded shell harness remains executable and green"
    else
        log_fail "Harness fork stability" "exit 0 through fork smoke mode" \
            "status=$status output=$output"
    fi

    cd "$REPO_ROOT"
}

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

    local recorded_source
    recorded_source=$(sed -n 's/^ORIGINAL_NAME="\([^"]*\)".*/\1/p' "$REBRAND_SCRIPT")
    if [ "$recorded_source" != "$UPSTREAM_DISPLAY" ]; then
        # The exhaustive fixtures deliberately model the upstream source. Once
        # this harness has itself been rebranded, use one state-relative smoke
        # instead of replaying transformed fixed expectations as red fork CI.
        test_forked_harness_smoke

        echo ""
        echo "========================================"
        echo "Test Summary"
        echo "========================================"
        echo -e "Assertions: $TESTS_RUN  (across $GROUPS_RUN test groups)"
        echo -e "${GREEN}Passed${NC}: $TESTS_PASSED"
        echo -e "${RED}Failed${NC}: $TESTS_FAILED"
        [ "$TESTS_FAILED" -eq 0 ] || exit 1
        return
    fi

    test_argument_validation
    test_help_output_is_complete
    test_name_sanitization
    test_dry_run_no_changes
    test_discovery_is_git_tracked
    test_case_preserving_rebrand
    test_case_preserving_multiword
    test_summary_counts_paths_not_increments
    test_upstream_citations_survive
    test_description_reaches_the_site
    test_hostile_description_is_escaped
    test_path_collision_is_atomic
    test_existing_target_directory_is_atomic
    test_residual_gate_is_fatal
    test_source_containing_target_is_atomic
    test_rerebrand_detection
    test_attribution_preserved
    test_brand_icons
    test_component_identifiers_are_valid
    test_auth_config_desired_state
    test_harness_survives_rebrand

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
        test_component_identifiers_are_valid)
            test_component_identifiers_are_valid
            ;;
        test_auth_config_desired_state)
            test_auth_config_desired_state
            ;;
        test_discovery_is_git_tracked)
            test_discovery_is_git_tracked
            ;;
        test_case_preserving_rebrand)
            test_case_preserving_rebrand
            ;;
        test_case_preserving_multiword)
            test_case_preserving_multiword
            ;;
        test_summary_counts_paths_not_increments)
            test_summary_counts_paths_not_increments
            ;;
        test_upstream_citations_survive)
            test_upstream_citations_survive
            ;;
        test_description_reaches_the_site)
            test_description_reaches_the_site
            ;;
        test_hostile_description_is_escaped)
            test_hostile_description_is_escaped
            ;;
        test_path_collision_is_atomic)
            test_path_collision_is_atomic
            ;;
        test_existing_target_directory_is_atomic)
            test_existing_target_directory_is_atomic
            ;;
        test_residual_gate_is_fatal)
            test_residual_gate_is_fatal
            ;;
        test_source_containing_target_is_atomic)
            test_source_containing_target_is_atomic
            ;;
        test_harness_survives_rebrand)
            test_harness_survives_rebrand
            ;;
        *)
            echo "Unknown test: $1"
            exit 1
            ;;
    esac
    if [ "$TESTS_FAILED" -gt 0 ]; then
        exit 1
    fi
else
    run_all_tests
fi
