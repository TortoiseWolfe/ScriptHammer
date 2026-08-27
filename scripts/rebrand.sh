#!/usr/bin/env bash
# =============================================================================
# ScriptHammer Rebrand Script # rebrand:keep
# =============================================================================
# Automates rebranding of the ScriptHammer template to a new project identity. # rebrand:keep
# Updates 200+ files including code, config, and documentation.
#
# Usage: ./scripts/rebrand.sh <PROJECT_NAME> <OWNER> "<DESCRIPTION>" (--icon <mark> | --no-icon) [OPTIONS]
#
# Arguments:
#   PROJECT_NAME  New project name (auto-sanitized: spaces->hyphens, special chars removed)
#   OWNER         GitHub username or organization
#   DESCRIPTION   Project description (must be quoted if contains spaces)
#
# Options:
#   --force               Skip all confirmation prompts
#   --dry-run             Show what would change without modifying files
#   --keep-cname          Keep public/CNAME. WITHOUT it the file is REMOVED: a fork has
#                         no custom domain yet, and the file merely existing drops the
#                         GitHub Pages basePath, which 404s every asset (#961).
#   --preserve-ssh        Keep SSH format for git remote (if currently SSH)
#   --preserve-attribution No-op; attribution is always kept (rebrand:keep)
#   --icon <mark>         Rebuild every PWA/favicon asset from your mark.
#                         Accepts .svg, .png or .webp (#898 — the SVG-only rule
#                         is what stopped a fork with a PNG logo from using this
#                         at all, so it shipped ours). REQUIRED unless --no-icon.
#   --no-icon             Deliberately keep the template's icons. Say it out
#                         loud; #659 and #898 both shipped past a mere warning.
#   --help                Show this help message
#
# Exit Codes:
#   0  Success
#   1  Validation or rebrand failure
#   2  Re-rebrand declined by user
#   3  Git error (not a repo, git not installed)
#
# Examples (every one needs --icon or --no-icon; the script refuses without):
#   ./scripts/rebrand.sh MyApp myuser "My awesome application" --icon mark.svg
#   ./scripts/rebrand.sh "My Cool App" myuser "Description" --icon mark.png --dry-run
#   ./scripts/rebrand.sh MyApp myuser "Description" --no-icon --force
#   ./scripts/rebrand.sh MyApp myuser "Description" --icon mark.svg --preserve-ssh --dry-run
#
# NOTE: run this INSIDE the container. --icon shells out to generate-icons.js, which
# needs `sharp` from node_modules -- a named Docker volume that does not exist on the
# host, so on the host it fails AFTER replacing public/favicon.svg.
#
# Preserving a string across a rebrand:
#   Put `rebrand:keep` in a comment on the SAME LINE as the string you want to
#   survive. That line is skipped by every replacement pass:
#
#     label: 'ScriptHammer',   // rebrand:keep
#
#   It is LINE-scoped, not file-scoped — a marker at the top of a file protects
#   nothing below it. The token is deliberately brand-neutral: `scripthammer:keep` # rebrand:keep
#   would itself contain the string being replaced.
#
#   The attribution link in src/config/footer-links.ts is protected this way,
#   which is why --preserve-attribution is now a no-op. Removing the attribution
#   is a one-line edit you are welcome to make. It is MIT.
#
# Case and postcondition:
#   Matching is ASCII case-insensitive and replacement preserves the matched
#   style: ScriptHammer/scripthammer/Scripthammer/SCRIPTHAMMER become the # rebrand:keep
#   display/slug/title/uppercase-component projections. Mixed forms are matched
#   too, and identifier-adjacent occurrences stay identifier-safe.
#
#   An applied run finishes by scanning the mapped tracked text and paths. Any
#   old-brand survivor outside a same-line rebrand:keep marker exits non-zero.
#   Uppercase tokens use the separator-free component projection, so env-shaped
#   names such as SCRIPTHAMMER_TEST_DOMAIN stay valid. # rebrand:keep
# =============================================================================

set -euo pipefail

# Execute from an immutable temporary copy. The workflow implementation stays
# template-owned while its four identity fields are updated after verification.
# The copy also prevents Bash from observing an explicitly updated state file
# midway through a successful run.
if [ "${REBRAND_RUNTIME_COPY:-false}" != true ]; then
    REBRAND_SOURCE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
    REBRAND_RUNTIME_PATH=$(mktemp "${TMPDIR:-/tmp}/rebrand-runtime.XXXXXX")
    cp "$REBRAND_SOURCE_PATH" "$REBRAND_RUNTIME_PATH"
    chmod +x "$REBRAND_RUNTIME_PATH"
    export REBRAND_RUNTIME_COPY=true REBRAND_SOURCE_PATH REBRAND_RUNTIME_PATH
    exec bash "$REBRAND_RUNTIME_PATH" "$@"
fi

# Early argument/help failures happen before the tracked-file snapshots install
# their combined cleanup trap, so arm runtime cleanup immediately.
trap 'rm -f -- "$REBRAND_RUNTIME_PATH"' EXIT

# Script info
SCRIPT_DIR="$(cd "$(dirname "$REBRAND_SOURCE_PATH")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CASE_HELPER="$SCRIPT_DIR/rebrand-case.mjs"
VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
# FILES_MODIFIED COUNTS PATHS, NOT INCREMENTS (#956).
#
# It used to be a bare ++ accumulated by two independent sweeps over the same file
# set — the case-helper brand pass and the separate owner pass — so a file matched
# by both counted twice. A real run reported "1002 files modified" against 926
# paths git could see: an 8% overstatement in the one line a forker reads to find
# out what just happened to their repository, and one that `docs/POSITIONING.md`
# then quoted as a measurement.
#
# The union data was always there. consume_case_report() parses a per-path
# UPDATED/RENAMED record for every file and threw it away in favour of a COUNT.
MODIFIED_PATHS=$(mktemp)
trap 'rm -f "$MODIFIED_PATHS"' EXIT

mark_modified() {
    # NORMALISE BEFORE RECORDING. The two sweeps spell the same path differently:
    # rebrand-case.mjs JSON-quotes its payload for the human-readable log, so it
    # reports "docs/FORKING.md" while the sed sweep reports docs/FORKING.md. Left
    # as-is they never dedupe, and the union is no better than the double count it
    # replaced — which is exactly what the first attempt at this measured.
    local path="$1"
    path=${path%\"}
    path=${path#\"}
    printf '%s\n' "$path" >> "$MODIFIED_PATHS"
}

modified_count() {
    sort -u "$MODIFIED_PATHS" 2>/dev/null | grep -c . || echo 0
}

FILES_RENAMED=0
START_TIME=$(date +%s)

# Options
DRY_RUN=false
FORCE=false
KEEP_CNAME=false
PRESERVE_SSH=false
PRESERVE_ATTRIBUTION=false

# Original project name to search for
ORIGINAL_NAME="ScriptHammer" # rebrand:keep
ORIGINAL_NAME_LOWER="scripthammer" # rebrand:keep
ORIGINAL_COMPONENT_NAME="ScriptHammer" # rebrand:keep
ORIGINAL_NAME_UPPER="SCRIPTHAMMER" # rebrand:keep
ORIGINAL_OWNER="TortoiseWolfe"

# One immutable view of the repository is shared by content replacement, path
# planning, and the postcondition. Without it, the first mv makes git's cached
# path stale and a later pass silently stops seeing the renamed file.
TRACKED_SNAPSHOT=""
REWRITABLE_SNAPSHOT=""
DETECTION_SNAPSHOT=""

# =============================================================================
# Helper Functions
# =============================================================================

show_help() {
    # Print the header comment block, stopping at the closing rule.
    #
    # This used to be `sed -n '2,35p'`, a hardcoded range. Adding the
    # rebrand:keep section pushed the header to line 48, and the help output
    # would have been silently truncated mid-sentence. The range does not know
    # the header grew, and nothing would have complained (#541).
    #
    # The first replacement stopped at the first line that was not `#`-prefixed,
    # which traded one silent truncation for another: a single genuinely blank
    # line inside the header cut the output from 47 lines to 8. It only survived
    # because the header happens to use bare `#` for its blank lines.
    #
    # So: skip blank lines rather than stopping on them, and stop on the closing
    # `# ====` rule, which is a real terminator rather than an accident of
    # formatting. tests/rebrand/test-rebrand.sh pins both the line count and the
    # presence of the last section, so either truncation mode fails loudly.
    awk '
      NR == 1              { next }                       # shebang
      /^# =+$/             { seen++; if (seen == 3) exit; next }
      /^#/                 { sub(/^# ?/, ""); print; next }
      /^[[:space:]]*$/     { print ""; next }              # blank line, keep going
                           { exit }                       # real code, stop
    ' "$REBRAND_SOURCE_PATH"
    exit 0
}

log_info() {
    echo -e "${BLUE}INFO${NC}: $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}WARNING${NC}: $1"
}

log_error() {
    echo -e "${RED}ERROR${NC}: $1" >&2
}

log_verbose() {
    echo -e "  ${CYAN}→${NC} $1"
}

# Sanitize project name: spaces->hyphens, remove special chars, lowercase for technical use
sanitize_name() {
    local name="$1"
    # Trim whitespace
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # Replace spaces and underscores with hyphens
    name=$(echo "$name" | sed 's/[[:space:]_]/-/g')
    # Remove special characters (keep alphanumeric and hyphens)
    name=$(echo "$name" | sed 's/[^a-zA-Z0-9-]//g')
    # Convert to lowercase for technical name
    echo "$name" | tr '[:upper:]' '[:lower:]'
}

# Get display name (preserves case from input, just sanitizes special chars)
get_display_name() {
    local name="$1"
    # Trim whitespace
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # Remove special characters except spaces (keep alphanumeric, spaces, hyphens)
    name=$(echo "$name" | sed 's/[^a-zA-Z0-9 -]//g')
    echo "$name"
}

# Derive a PascalCase, identifier-safe component name (#911).
#
# WHY THIS IS NOT get_display_name. `ORIGINAL_NAME` ("ScriptHammer") does two jobs in this # rebrand:keep
# tree: it is a noun in prose, and it is a code identifier — `ScriptHammerLogo`, and the # rebrand:keep
# filename that declares it. Both substitutions used DISPLAY_NAME, which preserves the
# user's spaces, hyphens and casing verbatim. That is right for prose and fatal for code:
#
#   fork "geoLARP"     -> <geoLARPLogo />       JSX reads a lowercase-initial tag as an # rebrand:keep
#                                               INTRINSIC element, so React renders an
#                                               unknown DOM tag instead of the component
#   fork "My Cool App" -> <My Cool AppLogo />   a syntax error — and "My Cool App" is this
#                                               script's own documented example (see --help)
#
# So the fork does not build, and nothing in the harness noticed because its fixture put
# the brand token in a STRING rather than an identifier or a filename.
#
# Words are split on every character an identifier cannot contain, each is capitalised, and
# the separators are dropped. A leading digit is prefixed, since an identifier cannot start
# with one.
get_component_name() {
    local name="$1"
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # Any run of non-alphanumerics is a word boundary, not a character to keep.
    name=$(echo "$name" | sed 's/[^a-zA-Z0-9][^a-zA-Z0-9]*/ /g')
    name=$(echo "$name" | awk '{out=""; for(i=1;i<=NF;i++) out=out toupper(substr($i,1,1)) substr($i,2); print out}')
    case "$name" in
        [0-9]*) name="App$name" ;;
    esac
    echo "$name"
}

# Detect if running on BSD (macOS) or GNU sed
detect_sed() {
    if sed --version 2>/dev/null | grep -q GNU; then
        SED_INPLACE=(-i)
    else
        # BSD sed requires an argument for -i
        SED_INPLACE=(-i '')
    fi
}

# Check if this is a git repository
check_git() {
    if ! command -v git &>/dev/null; then
        log_error "Git is not installed"
        exit 3
    fi

    if ! git rev-parse --git-dir &>/dev/null; then
        log_error "Not a git repository"
        exit 3
    fi

    if ! command -v node &>/dev/null; then
        log_error "Node.js is required for case-preserving rebranding"
        log_error "Run rebrand.sh inside the project container, as documented."
        exit 1
    fi

    if [ ! -f "$CASE_HELPER" ]; then
        log_error "Case-preserving helper not found: $CASE_HELPER"
        exit 1
    fi
}

# Check for uncommitted changes
check_uncommitted_changes() {
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        log_warning "You have uncommitted changes"
        if [ "$FORCE" = false ]; then
            echo "It's recommended to commit or stash changes before rebranding."
            echo "Proceeding anyway..."
        fi
    fi
}

# ============================================================================
# FILE DISCOVERY — ask git what the repository IS (#922)
# ============================================================================
#
# A rebrand rewrites THE REPOSITORY. That set has an exact definition, and it is
# not "whatever `find` trips over": it is `git ls-files`.
#
# WHAT THIS REPLACED, AND WHY. Three separate mechanisms used to decide which
# files to touch -- a `find` with an eleven-suffix allowlist, a second `find` for
# renames, and a `grep -r` with its own `--include`/`--exclude-dir` pair. Each
# carried a hand-maintained exclusion list, all three could disagree, and the
# lists were already leaking: `.pay-verify/` was reached and rewritten.
#
# The exclusion lists are gone rather than extended. git already knows about
# node_modules, .next, out, every cache, and a vendored virtualenv, because they
# are not tracked. A fork that adds its own build directory is covered without
# anyone editing this script.
#
# THIS ALSO SETTLES #910. Widening the suffix allowlist was measured and backed
# out because it pulled in 1,746 files, 1,581 of them in `.speckit-cache/`,
# `.speckit-tools/`, `.pay-verify/` and `.venv/`. Those are all untracked, so the
# question disappears: extensionless files (`.husky/*`, `docker/Dockerfile*`) and
# `.mjs`/`.cjs`/`.py` are reachable now, for free, with no hazard attached.
#
# Emits NUL-separated ABSOLUTE paths. Callers apply their own filters -- the
# content sweep skips binaries and lockfiles, the rename pass does not, because
# renaming a tracked PNG is exactly what it is for.
tracked_files() {
    if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
        # Fail loudly rather than sweep nothing. A silent no-op here would report
        # a successful rebrand having changed not one file (#396).
        log_error "Not a git repository: $REPO_ROOT"
        log_error "rebrand.sh discovers files with 'git ls-files', so it cannot run outside one."
        exit 1
    fi

    git -C "$REPO_ROOT" ls-files -z --cached |
        while IFS= read -r -d '' rel; do
            # Include tracked symlinks as paths, but never follow them during
            # content rewriting. Gitlinks/directories are outside this script's
            # file-renaming contract.
            [ -f "$REPO_ROOT/$rel" ] || [ -L "$REPO_ROOT/$rel" ] || continue
            printf '%s\0' "$REPO_ROOT/$rel"
        done
}

# True when sed may safely rewrite the file in place.
#
# Dropping the suffix allowlist means binaries are reachable for the first time,
# and a sed through a PNG is corruption rather than a rebrand. `grep -I` reports
# no match for binary content, which is the cheapest honest test available here.
# Lockfiles are excluded by name deliberately, not by oversight: their contents
# are generated and integrity-checked, and a brand token inside one is not prose.
is_rewritable() {
    [ ! -L "$1" ] || return 1
    case "${1##*/}" in
        pnpm-lock.yaml|package-lock.json|yarn.lock|bun.lockb) return 1 ;;
    esac
    grep -Iq . "$1" 2>/dev/null
}

cleanup_file_snapshots() {
    [ -z "$TRACKED_SNAPSHOT" ] || rm -f -- "$TRACKED_SNAPSHOT"
    [ -z "$REWRITABLE_SNAPSHOT" ] || rm -f -- "$REWRITABLE_SNAPSHOT"
    [ -z "$DETECTION_SNAPSHOT" ] || rm -f -- "$DETECTION_SNAPSHOT"
    rm -f -- "$REBRAND_RUNTIME_PATH"
}

create_file_snapshots() {
    TRACKED_SNAPSHOT=$(mktemp "${TMPDIR:-/tmp}/rebrand-tracked.XXXXXX")
    REWRITABLE_SNAPSHOT=$(mktemp "${TMPDIR:-/tmp}/rebrand-text.XXXXXX")
    DETECTION_SNAPSHOT=$(mktemp "${TMPDIR:-/tmp}/rebrand-detect.XXXXXX")
    trap cleanup_file_snapshots EXIT

    tracked_files > "$TRACKED_SNAPSHOT"
    while IFS= read -r -d '' file; do
        is_rewritable "$file" || continue
        # The workflow implementation is stable template tooling, not brand
        # content. Its four keep-marked ORIGINAL_* fields are updated explicitly
        # only after verification; rewriting arbitrary shell tokens can corrupt
        # a later run when a project is named e.g. "Local" or "Rebrand".
        if [ "$file" = "$REBRAND_SOURCE_PATH" ]; then
            continue
        fi
        printf '%s\0' "$file" >> "$REWRITABLE_SNAPSHOT"
        # Stable tooling is excluded from already-rebranded detection. The shell
        # implementation stores the source identity, while the helper documents
        # transformation examples; neither is application-brand evidence.
        if [ "$file" != "$REBRAND_SOURCE_PATH" ] && [ "$file" != "$CASE_HELPER" ]; then
            printf '%s\0' "$file" >> "$DETECTION_SNAPSHOT"
        fi
    done < "$TRACKED_SNAPSHOT"
}

case_helper() {
    local command="$1"
    shift
    node "$CASE_HELPER" "$command" "$REPO_ROOT" \
        "$ORIGINAL_NAME" "$ORIGINAL_NAME_LOWER" \
        "$ORIGINAL_COMPONENT_NAME" "$ORIGINAL_NAME_UPPER" \
        "$DISPLAY_NAME" "$SANITIZED_NAME" "$COMPONENT_NAME" "$@"
}

brand_identity_is_unchanged() {
    [ "$DISPLAY_NAME" = "$ORIGINAL_NAME" ] &&
        [ "$SANITIZED_NAME" = "$ORIGINAL_NAME_LOWER" ] &&
        [ "$COMPONENT_NAME" = "$ORIGINAL_COMPONENT_NAME" ] &&
        [ "$(printf '%s' "$COMPONENT_NAME" | tr '[:lower:]' '[:upper:]')" = "$ORIGINAL_NAME_UPPER" ]
}

validate_brand_target() {
    # A target that still contains the recorded source identity makes the final
    # residual contract impossible to satisfy (for example `ScriptHammer Pro` # rebrand:keep
    # or the case-only target `scripthammer`). Fail before the first write. # rebrand:keep
    case_helper validate-target "$OWNER" "$DESCRIPTION" < /dev/null
    case_helper validate-runtime "scripts/rebrand.sh" "scripts/rebrand-case.mjs" < /dev/null

    if [ -n "${BRAND_ICON:-}" ] && [ -f "$BRAND_ICON" ] && \
        [ "$(printf '%s' "${BRAND_ICON##*.}" | tr '[:upper:]' '[:lower:]')" = svg ]; then
        case_helper validate-file "$BRAND_ICON" < /dev/null
    fi
}

assert_index_paths_current() {
    # `git ls-files` is intentionally the repository boundary. After a prior
    # rebrand moves tracked paths, the index still names their missing sources
    # until the user stages or commits the rename. A different-target rerun must
    # not silently omit those files and report a false success.
    local missing
    missing=$(git -C "$REPO_ROOT" ls-files --deleted | sed -n '1,5p')
    if [ -n "$missing" ]; then
        log_error "Tracked paths are missing from the working tree; re-rebrand cannot take a complete snapshot."
        log_error "Stage the prior rename with 'git add -A' (preferably commit it), then retry."
        printf '%s\n' "$missing" | sed 's/^/  missing: /' >&2
        exit 1
    fi
}

# Count ScriptHammer references to detect if already rebranded # rebrand:keep
count_references() {
    # The detector and the postcondition use the same case-insensitive matcher,
    # the same immutable tracked/text snapshot, and the same line-scoped keep
    # rule. A fresh minimal fork with one `Scripthammer` line must not be called # rebrand:keep
    # "already rebranded", and attribution-only keep lines must not prevent the
    # correct zero result.
    case_helper count < "$DETECTION_SNAPSHOT"
}

# Detect previous rebrand
#
# A fresh clone contains hundreds of case variants. A repository with exactly
# zero unmarked matches of its recorded source identity has already moved on.
# There is deliberately no "few enough" heuristic: one missed title/uppercase
# spelling is the bug this detector is meant to expose.
detect_previous_rebrand() {
    local ref_count
    ref_count=$(count_references)

    if [ "$ref_count" -eq 0 ]; then
        log_warning "This repository appears to have been rebranded already."
        echo "No unmarked case-insensitive \"$ORIGINAL_NAME\" references found."
        echo ""

        # Try to detect current project name from package.json
        local current_name
        current_name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPO_ROOT/package.json" 2>/dev/null | \
            sed 's/"name"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || echo "unknown")

        echo "Current project name appears to be: $current_name"
        echo ""

        if [ "$DRY_RUN" = true ]; then
            # A dry run changes nothing, so there is nothing to confirm. Prompting
            # here made --dry-run block on stdin forever in any non-interactive
            # context (CI, the test harness, a pipe), which is why
            # tests/rebrand/test-rebrand.sh hung at its second test (#522).
            log_info "Dry run: proceeding without confirmation"
        elif [ "$FORCE" = false ]; then
            read -p "Do you want to rebrand from \"$current_name\" to \"$DISPLAY_NAME\"? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Rebrand cancelled"
                exit 2
            fi
        else
            log_info "Re-rebrand proceeding (--force flag set)"
        fi

        return 0  # Is a re-rebrand
    fi

    return 1  # Not a re-rebrand
}

# =============================================================================
# File Operations
# =============================================================================

# Replace content in files
replace_in_files() {
    local search="$1"
    local replace="$2"
    # NOTE: there is no third parameter. Callers used to pass "*.ts" and it was
    # assigned to an unused local -- the sweep has always covered every matched
    # file regardless. Removed rather than implemented, because per-call filtering
    # is not what any caller actually wants (#922).

    while IFS= read -r -d '' file; do
        if [ -f "$file" ] && is_rewritable "$file"; then

            if grep -q "$search" "$file" 2>/dev/null; then
                if [ "$DRY_RUN" = true ]; then
                    # Only claim a change if something UNmarked would actually move.
                    if grep -v 'rebrand:keep' "$file" | grep -q "$search"; then
                        log_verbose "[DRY-RUN] Would update: ${file#$REPO_ROOT/}"
                        mark_modified "${file#$REPO_ROOT/}"
                    fi
                else
                    # Lines carrying `rebrand:keep` are skipped; everything else on
                    # every other line still rebrands. Guarding by FILENAME never
                    # worked - the old `*"Footer"*` pattern was case-sensitive and the
                    # attribution lives in lowercase src/config/footer-links.ts, so
                    # the one file the guard existed to protect was the one file it
                    # never matched (#513).
                    sed "${SED_INPLACE[@]}" "/rebrand:keep/!s|$search|$replace|g" "$file"
                    log_verbose "Updated: ${file#$REPO_ROOT/}"
                    mark_modified "${file#$REPO_ROOT/}"
                fi
            fi
        fi
    # Discovery is `git ls-files` (#922), so there is no suffix allowlist and no
    # exclusion list to keep up to date. Binaries and lockfiles are filtered at the
    # top of the loop by is_rewritable, not here.
    done < <(tracked_files)
}

# Consume the helper's escaped, line-oriented report without making path names
# part of shell syntax. Discovery/input remains NUL-separated; JSON quoting is
# used only for the human-readable log.
consume_case_report() {
    local report="$1"
    local counter="$2"
    local kind
    local payload
    local count=0

    while IFS=$'\t' read -r kind payload; do
        case "$kind" in
            UPDATED)
                log_verbose "Updated: $payload"
                [ "$counter" = modified ] && mark_modified "$payload"
                ;;
            WOULD_UPDATE)
                log_verbose "[DRY-RUN] Would update: $payload"
                [ "$counter" = modified ] && mark_modified "$payload"
                ;;
            RENAMED) log_verbose "Renamed: $payload" ;;
            WOULD_RENAME) log_verbose "[DRY-RUN] Would rename: $payload" ;;
            COUNT) count="$payload" ;;
        esac
    done < "$report"

    # Renames are one path each by construction, so the helper's COUNT is exact
    # for them. Modifications are the ones two sweeps can both claim.
    if [ "$counter" != modified ]; then
        FILES_RENAMED=$((FILES_RENAMED + count))
    fi
}

replace_brand_in_files() {
    local mode="content-apply"
    local report
    [ "$DRY_RUN" = false ] || mode="content-dry"
    report=$(mktemp "${TMPDIR:-/tmp}/rebrand-content-report.XXXXXX")

    if ! case_helper "$mode" < "$REWRITABLE_SNAPSHOT" > "$report"; then
        rm -f -- "$report"
        return 1
    fi
    consume_case_report "$report" modified
    rm -f -- "$report"
}

preflight_brand_paths() {
    # This runs before ANY content mutation. `ScriptHammer.md` and # rebrand:keep
    # `Scripthammer.md` can otherwise collapse onto the same target and mv would # rebrand:keep
    # overwrite one of them after hundreds of files had already changed.
    case_helper paths-check < "$TRACKED_SNAPSHOT" > /dev/null
}

rename_brand_paths() {
    local mode="paths-apply"
    local report
    [ "$DRY_RUN" = false ] || mode="paths-dry"
    report=$(mktemp "${TMPDIR:-/tmp}/rebrand-path-report.XXXXXX")

    if ! case_helper "$mode" < "$TRACKED_SNAPSHOT" > "$report"; then
        rm -f -- "$report"
        return 1
    fi
    consume_case_report "$report" renamed
    rm -f -- "$report"
}

update_rebrand_identity_state() {
    [ "$DRY_RUN" = true ] && return 0
    case_helper update-state "$REPO_ROOT/scripts/rebrand.sh"
}

assert_no_old_brand() {
    case_helper verify-paths < "$TRACKED_SNAPSHOT"
    case_helper verify < "$REWRITABLE_SNAPSHOT"
}

assert_no_old_brand_before_path_moves() {
    case_helper verify-current < "$REWRITABLE_SNAPSHOT"
}

# Update docker-compose.yml service name
update_docker_compose() {
    local old_service="$ORIGINAL_NAME_LOWER"
    local new_service="$SANITIZED_NAME"
    local compose_file="$REPO_ROOT/docker-compose.yml"

    if [ -f "$compose_file" ]; then
        if grep -q "^\s*${old_service}:" "$compose_file" 2>/dev/null; then
            if [ "$DRY_RUN" = true ]; then
                log_verbose "[DRY-RUN] Would update service name in docker-compose.yml"
            else
                sed "${SED_INPLACE[@]}" "s|^\(\s*\)${old_service}:|\1${new_service}:|g" "$compose_file"
                sed "${SED_INPLACE[@]}" "s|container_name: ${old_service}|container_name: ${new_service}|g" "$compose_file"
                log_verbose "Updated service name in docker-compose.yml"
            fi
            mark_modified "$compose_file"
        fi
    fi
}

# Update package.json fields
update_package_json() {
    local pkg_file="$REPO_ROOT/package.json"

    if [ -f "$pkg_file" ]; then
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update package.json fields"
        else
            # Update name
            sed "${SED_INPLACE[@]}" "s|\"name\": \"[^\"]*\"|\"name\": \"${SANITIZED_NAME}\"|" "$pkg_file"
            # Update description
            sed "${SED_INPLACE[@]}" "s|\"description\": \"[^\"]*\"|\"description\": \"${DESCRIPTION}\"|" "$pkg_file"
            # Update repository URL
            sed "${SED_INPLACE[@]}" "s|github.com/${ORIGINAL_OWNER}/${ORIGINAL_NAME}|github.com/${OWNER}/${SANITIZED_NAME}|g" "$pkg_file"
            log_verbose "Updated package.json fields"
        fi
        mark_modified "$pkg_file"
    fi
}

# Update CNAME file (replace scripthammer domain with new project domain) # rebrand:keep
update_cname() {
    local cname_file="$REPO_ROOT/public/CNAME"

    [ -f "$cname_file" ] || return 0

    if [ "$KEEP_CNAME" = true ]; then
        log_info "Keeping CNAME file as-is (--keep-cname flag set)"
        return 0
    fi

    # CNAME_IS_INHERITED is decided by classify_cname() BEFORE the content sweep
    # runs, and that ordering is the whole point. The sweep rewrites the file like
    # any other text — `www.<old-brand>.com` becomes `www.<new-brand>.com` — so by the
    # time this function runs the old brand token is already gone and a check
    # against the CURRENT contents can never recognise an inherited domain. The
    # previous version tested the current contents and therefore never fired: the
    # `<slug>.com` it appeared to write was actually the sweep's output, and a fork
    # inherited a domain nobody had chosen.
    if [ "${CNAME_IS_INHERITED:-false}" != true ]; then
        log_info "Keeping CNAME file (custom domain: $(cat "$cname_file" 2>/dev/null))"
        return 0
    fi

    # DELETE IT. Do not invent a domain (#961).
    #
    # A fork has no custom domain until somebody configures one. Absence is the
    # honest default, and it is also the CORRECT one: the file merely existing is
    # how detect-project.js decides a custom domain is configured, so it sets
    # basePath to '' while Pages still serves the site under /<repo>/. Measured on a
    # real fork, that made the deploy fail outright — the canonical gate named 102
    # routes and never mentioned this file.
    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would remove public/CNAME (inherited domain, none owned yet)"
    else
        rm -f "$cname_file"
        log_verbose "Removed public/CNAME; add it back when you own a domain"
    fi
}

# Decide whether public/CNAME is inherited from the template, while its contents
# still say so. Must run BEFORE the content sweep — see update_cname().
classify_cname() {
    local cname_file="$REPO_ROOT/public/CNAME"
    CNAME_IS_INHERITED=false
    [ -f "$cname_file" ] || return 0
    local domain
    domain=$(cat "$cname_file" 2>/dev/null || echo "")
    if [ -z "$domain" ] || printf '%s' "$domain" | grep -qiF "$ORIGINAL_NAME_LOWER"; then
        CNAME_IS_INHERITED=true
    fi
}

# Scaffold custom theme blocks in globals.css
scaffold_themes() {
    local css_file="$REPO_ROOT/src/app/globals.css"

    if [ ! -f "$css_file" ]; then
        log_warning "globals.css not found, skipping theme scaffold"
        return
    fi

    # Replace theme names in @plugin "daisyui" block
    if grep -q "scripthammer-dark" "$css_file" 2>/dev/null; then # rebrand:keep
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would rename theme references in globals.css"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$css_file" # rebrand:keep
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$css_file" # rebrand:keep
            sed "${SED_INPLACE[@]}" "s|ScriptHammer Dark Theme|${DISPLAY_NAME} Dark Theme|g" "$css_file" # rebrand:keep
            sed "${SED_INPLACE[@]}" "s|ScriptHammer Light Theme|${DISPLAY_NAME} Light Theme|g" "$css_file" # rebrand:keep
            log_verbose "Renamed theme blocks: scripthammer-* → ${SANITIZED_NAME}-*" # rebrand:keep
        fi
        mark_modified "$css_file"
    fi

    # Update ThemeScript.tsx fallback theme names
    local theme_script="$REPO_ROOT/src/components/ThemeScript.tsx"
    if [ -f "$theme_script" ] && grep -q "scripthammer-dark" "$theme_script" 2>/dev/null; then # rebrand:keep
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update ThemeScript.tsx theme names"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$theme_script" # rebrand:keep
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$theme_script" # rebrand:keep
            log_verbose "Updated ThemeScript.tsx theme fallbacks"
        fi
        mark_modified "$theme_script"
    fi

    # Update Storybook preview theme names
    local preview_file="$REPO_ROOT/.storybook/preview.tsx"
    if [ -f "$preview_file" ] && grep -q "scripthammer-dark" "$preview_file" 2>/dev/null; then # rebrand:keep
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update .storybook/preview.tsx theme names"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$preview_file" # rebrand:keep
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$preview_file" # rebrand:keep
            log_verbose "Updated Storybook preview theme names"
        fi
        mark_modified "$preview_file"
    fi
}

# Update git remote
update_git_remote() {
    local current_url
    current_url=$(git remote get-url origin 2>/dev/null || echo "")

    if [ -n "$current_url" ]; then
        local new_url
        local is_ssh=false

        # Detect if current URL is SSH format
        if [[ "$current_url" == git@* ]]; then
            is_ssh=true
        fi

        # Preserve SSH format if flag is set and current URL is SSH
        if [ "$PRESERVE_SSH" = true ] && [ "$is_ssh" = true ]; then
            new_url="git@github.com:${OWNER}/${SANITIZED_NAME}.git"
            log_info "Preserving SSH format for git remote (--preserve-ssh)"
        else
            new_url="https://github.com/${OWNER}/${SANITIZED_NAME}.git"
        fi

        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update git remote: $new_url"
        else
            git remote set-url origin "$new_url"
            log_verbose "Updated git remote: $new_url"
        fi
    fi
}

# Update .env.example with new project name
##
# Regenerate every PWA/favicon asset from the fork's own brand mark (#659).
#
# A rebrand is string substitution, and a logo is not a string — so before this
# existed, the icons were simply never touched and every fork installed onto
# phones wearing the upstream monogram. CRUDkit's `CK` reached a live client
# site that way, through two rebrands, because nothing here looked at an image
# and nothing said so.
#
# With --icon, the mark is copied over `public/favicon.svg` (the single source
# `generate-icons.js` reads) and the whole set is rebuilt. Without it, this is a
# no-op on purpose — inventing a logo is not this script's job — and the summary
# prints a warning instead of leaving the gap silent.
##
update_brand_icons() {
    if [ -z "${BRAND_ICON:-}" ]; then
        log_verbose "No --icon given; PWA icons left as-is (warned in summary)"
        return 0
    fi

    if [ ! -f "$BRAND_ICON" ]; then
        log_error "--icon file not found: $BRAND_ICON"
        exit 1
    fi
    # #898: this used to reject anything but SVG, on the reasoning that eight
    # sizes need a vector. That rejection is how #659 recurred: a downstream
    # fork's mark is a PNG, so it could not use --icon at all and shipped our
    # printing mallet on a live custom domain. generate-icons.js handles rasters
    # now -- it trims once and embeds a per-target data: PNG -- so the only job
    # left here is to put the mark where the generator will read it.
    local icon_ext="${BRAND_ICON##*.}"
    case "$(printf '%s' "$icon_ext" | tr '[:upper:]' '[:lower:]')" in
        svg|png|webp) ;;
        *)
            log_error "--icon must be .svg, .png or .webp (got: $BRAND_ICON)"
            exit 1
            ;;
    esac

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would copy $BRAND_ICON to public/favicon.svg and regenerate all icons"
        return 0
    fi

    # An SVG mark becomes public/favicon.svg, which is the generator's default
    # source and keeps the "favicon.svg IS the mark" invariant. A raster cannot
    # be named .svg without lying about its bytes, so it lands beside it as
    # public/brand-mark.<ext> and the generator is pointed at it -- which then
    # emits favicon.svg as an ordinary target, so the invariant still holds when
    # the run finishes.
    local icon_src
    if [ "$(printf '%s' "$icon_ext" | tr '[:upper:]' '[:lower:]')" = "svg" ]; then
        cp "$BRAND_ICON" "$REPO_ROOT/public/favicon.svg"
        icon_src="public/favicon.svg"
    else
        icon_src="public/brand-mark.$(printf '%s' "$icon_ext" | tr '[:upper:]' '[:lower:]')"
        cp "$BRAND_ICON" "$REPO_ROOT/$icon_src"
    fi
    # Run through node directly rather than a package manager: this may run
    # before dependencies are installed, and the only runtime need is sharp,
    # which the script itself reports on if missing.
    if ! (cd "$REPO_ROOT" && node scripts/generate-icons.js --source "$icon_src"); then
        log_error "Icon generation failed. public/favicon.svg was replaced; run 'pnpm run generate:icons' once dependencies are installed."
        exit 1
    fi
    # A LITERAL 17, not a count of anything: generate-icons.js decides how many
    # targets it emits, and this was a guess the summary then reported as a
    # measurement. The icons get their own line in the summary; record only the
    # source we know we touched and let that line speak for the rest.
    mark_modified "$icon_src"
}

update_env_example() {
    local env_file="$REPO_ROOT/.env.example"

    if [ -f "$env_file" ]; then
        if grep -q "$ORIGINAL_NAME_LOWER" "$env_file" 2>/dev/null || grep -q "$ORIGINAL_NAME" "$env_file" 2>/dev/null; then
            if [ "$DRY_RUN" = true ]; then
                log_verbose "[DRY-RUN] Would update .env.example references"
            else
                # Update header comment
                sed "${SED_INPLACE[@]}" "s|$ORIGINAL_NAME Environment Variables|$DISPLAY_NAME Environment Variables|g" "$env_file"
                # Update COMPOSE_PROJECT_NAME default
                sed "${SED_INPLACE[@]}" "s|COMPOSE_PROJECT_NAME=$ORIGINAL_NAME_LOWER|COMPOSE_PROJECT_NAME=$SANITIZED_NAME|g" "$env_file"
                # Update example commands in comments (docker compose -p, exec, etc.)
                sed "${SED_INPLACE[@]}" "s|$ORIGINAL_NAME_LOWER-b|${SANITIZED_NAME}-b|g" "$env_file"
                sed "${SED_INPLACE[@]}" "s|exec $ORIGINAL_NAME_LOWER |exec $SANITIZED_NAME |g" "$env_file"
                sed "${SED_INPLACE[@]}" "s|port $ORIGINAL_NAME_LOWER |port $SANITIZED_NAME |g" "$env_file"
                log_verbose "Updated .env.example references"
            fi
            mark_modified "$env_file"
        fi
    fi
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    # Parse arguments
    POSITIONAL=()
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force|-f)
                FORCE=true
                shift
                ;;
            --keep-cname)
                KEEP_CNAME=true
                shift
                ;;
            --preserve-ssh)
                PRESERVE_SSH=true
                shift
                ;;
            --preserve-attribution)
                PRESERVE_ATTRIBUTION=true
                shift
                ;;
            --no-icon)
                # #898: the deliberate escape hatch. Skipping the mark must be a
                # thing you SAY, not a thing you fail to notice -- the warning
                # this replaces was correct, loud, and scrolled past in a
                # terminal while a fork shipped our logo to a live site.
                NO_ICON=true
                shift
                ;;
            --icon)
                # #659: this script had NO icon handling whatsoever — zero
                # matches for `icon`, `.svg` or `logo` — so every fork kept the
                # upstream brand mark on its home screen. That is how CRUDkit's
                # monogram reached a live client site through two rebrands.
                BRAND_ICON="${2:-}"
                if [ -z "$BRAND_ICON" ]; then
                    log_error "--icon requires a path to a brand mark (.svg, .png or .webp)"
                    exit 1
                fi
                shift 2
                ;;
            -*)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
            *)
                POSITIONAL+=("$1")
                shift
                ;;
        esac
    done

    # Validate arguments
    if [ ${#POSITIONAL[@]} -lt 3 ]; then
        log_error "Missing required arguments"
        echo ""
        echo "Usage: $REBRAND_SOURCE_PATH <PROJECT_NAME> <OWNER> \"<DESCRIPTION>\" [OPTIONS]"
        echo ""
        echo "Use --help for more information"
        exit 1
    fi

    # Set variables
    if [ -z "${BRAND_ICON:-}" ] && [ "${NO_ICON:-false}" != true ]; then
        log_error "Refusing to rebrand without deciding about the app icons."
        echo ""
        echo "  A rebrand is string substitution, and a logo is not a string. If"
        echo "  nothing replaces the mark, every browser tab and every home-screen"
        echo "  install shows ${ORIGINAL_NAME}'s icon. That has now happened twice"
        echo "  on live sites (#659, #898), both times past a warning like this one."
        echo ""
        echo "  Pass your mark:      --icon path/to/your-mark.svg|.png|.webp"
        echo "  Or say so on purpose: --no-icon"
        echo ""
        exit 1
    fi

    PROJECT_NAME="${POSITIONAL[0]}"
    OWNER="${POSITIONAL[1]}"
    DESCRIPTION="${POSITIONAL[2]}"

    # Sanitize names
    SANITIZED_NAME=$(sanitize_name "$PROJECT_NAME")
    DISPLAY_NAME=$(get_display_name "$PROJECT_NAME")
    COMPONENT_NAME=$(get_component_name "$PROJECT_NAME")

    # Validate sanitized name
    if [ -z "$COMPONENT_NAME" ]; then
        log_error "Project name yields no usable component identifier"
        echo "The name must contain at least one letter or digit that can start an identifier"
        exit 1
    fi

    if [ -z "$SANITIZED_NAME" ]; then
        log_error "Project name sanitizes to empty string"
        echo "Please provide a valid project name with at least one alphanumeric character"
        exit 1
    fi

    # Change to repo root
    cd "$REPO_ROOT"

    # Detect sed variant
    detect_sed

    # Pre-flight checks
    check_git
    check_uncommitted_changes
    create_file_snapshots

    local same_brand=false
    if brand_identity_is_unchanged; then
        same_brand=true
    fi

    # Header
    echo ""
    echo "========================================="
    echo "  ScriptHammer Rebrand Script v${VERSION}" # rebrand:keep
    echo "========================================="
    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}DRY-RUN MODE${NC} - No files will be modified"
        echo ""
    fi

    echo "Rebranding: $ORIGINAL_NAME → $DISPLAY_NAME"
    echo "Owner: $OWNER"
    echo "Description: $DESCRIPTION"
    echo ""

    if [ "$SANITIZED_NAME" != "$PROJECT_NAME" ]; then
        echo -e "Sanitizing project name: \"$PROJECT_NAME\" → \"$SANITIZED_NAME\""
        echo ""
    fi

    # Check for previous rebrand. A same-target run is an explicit no-op for the
    # brand sweep; requiring "zero old brand" when old and new are identical is
    # a contradiction, not verification.
    if [ "$same_brand" = true ]; then
        log_info "Brand identity already matches; string and path transforms are a no-op."
    else
        validate_brand_target
        assert_index_paths_current
        detect_previous_rebrand || true
        preflight_brand_paths
    fi

    # Perform rebrand operations
    # Read the CNAME verdict before the sweep rewrites the file out from under it.
    classify_cname

    echo "Updating file contents..."
    if [ "$same_brand" = false ]; then
        # One ASCII-case-insensitive pass handles canonical, lower, title,
        # uppercase, and arbitrary mixed spellings. The replacement callback
        # retains #911's display/slug/component distinction from local context.
        replace_brand_in_files
    fi
    replace_in_files "$ORIGINAL_OWNER" "$OWNER"

    echo ""
    echo "Updating docker-compose.yml..."
    update_docker_compose

    echo ""
    echo "Updating package.json..."
    update_package_json

    echo ""
    echo "Scaffolding custom themes..."
    scaffold_themes

    echo ""
    echo "Updating git remote..."
    update_git_remote

    echo ""
    echo "Updating .env.example..."
    update_env_example

    echo ""
    echo "Updating brand icons..."
    update_brand_icons

    echo ""
    echo "Renaming tracked paths..."
    if [ "$same_brand" = false ]; then
        if [ "$DRY_RUN" = false ]; then
            # Catch every content/specialized-write failure while Git's indexed
            # source paths still exist. A retry can then repair the same tree.
            echo "Verifying content before path moves..."
            assert_no_old_brand_before_path_moves
        fi

        # Transform every path component from the immutable pre-mutation plan.
        # This includes brand-bearing directories and moves binaries without
        # reading their bytes.
        rename_brand_paths
    fi

    if [ "$DRY_RUN" = false ] && [ "$same_brand" = false ]; then
        echo ""
        echo "Verifying rebrand postcondition..."
        assert_no_old_brand

        # Commit identity state only after every write and both independent
        # postconditions succeed. The assignment lines themselves are keep-
        # marked so the content sweep cannot publish a target state early.
        update_rebrand_identity_state
    fi

    # LAST MUTATION, and the position is load-bearing (#961).
    #
    # Removing public/CNAME deletes a TRACKED path, and two separate guards care.
    # rebrand-case.mjs's verifier walks the pre-mutation path snapshot and reports
    # anything absent as "missing after rebrand"; assert_index_paths_current()
    # refuses the NEXT run while `git ls-files --deleted` names it. Doing this
    # before either one turned a correct deletion into a failed rebrand, and then
    # into an unrunnable retry. Both were caught by the harness rather than by
    # reasoning, which is the argument for the harness.
    #
    # After the postconditions there is nothing left to verify and nothing left to
    # repair, so the deletion is safe and the user stages it with everything else.
    echo ""
    echo "Updating CNAME..."
    update_cname

    # Summary
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo ""
    echo "========================================="
    echo "  Summary"
    echo "========================================="
    echo "  Files modified: $(modified_count)"
    echo "  Files renamed:  $FILES_RENAMED"
    echo "  Time elapsed:   ${ELAPSED}s"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}DRY-RUN COMPLETE${NC} - No files were actually modified"
        echo "Run without --dry-run to apply changes"
    else
        echo -e "${GREEN}REBRAND COMPLETE${NC}"
        echo ""
        # #659: the loudest thing this script can say, because it is the one
        # thing a rebrand CANNOT do for you. A logo is not a string substitution,
        # so silence here means the fork ships the upstream mark — which is
        # exactly what happened: CRUDkit's monogram survived two rebrands and
        # installed onto phones from a live client site. Say it or repeat it.
        if [ -n "${BRAND_ICON:-}" ]; then
            echo -e "${GREEN}  Brand mark:${NC} regenerated all PWA icons from ${BRAND_ICON}"
        else
            echo -e "${YELLOW}  ⚠  YOUR APP ICONS ARE STILL ${ORIGINAL_NAME}'S.${NC}"
            echo "     A rebrand cannot draw a logo. Until you replace it, every"
            echo "     home-screen install and browser tab shows the template's mark."
            echo ""
            echo "     Fix it with either:"
            echo "       ./scripts/rebrand.sh … --icon path/to/your-mark.svg"
            echo "       cp your-mark.svg public/favicon.svg && pnpm run generate:icons"
            echo ""
        fi
        # #734: the same class of omission as the icons above. This script cannot
        # know your Supabase project, your SMTP sender or your OAuth client ids —
        # they are registered with third parties, not derived from a project name.
        # `scripts/supabase/auth-config.json` is the DESIRED STATE a daily gate
        # compares your live project against, so leaving it unset means the gate
        # measures your project against ScriptHammer's identity and fails on values # rebrand:keep
        # that were never yours. Say so, rather than let them conclude the gate is
        # broken and stop reading it.
        echo -e "${YELLOW}  ⚠  YOUR AUTH DESIRED-STATE IS STILL ${ORIGINAL_NAME}'S.${NC}"
        echo "     scripts/supabase/auth-config.json is what auth-config-drift.yml"
        echo "     compares your live Supabase project against, daily. Until you set"
        echo "     these, it checks your project against ${ORIGINAL_NAME}'s values"
        echo "     and fails — correctly, but for the wrong reason."
        echo ""
        echo "     Set these as repo VARIABLES (Settings → Secrets and variables →"
        echo "     Actions → Variables). None is a secret; client ids appear in every"
        echo "     authorize URL the browser is redirected to:"
        echo ""
        echo "       AUTH_SITE_URL            https://your-domain"
        echo "       AUTH_URI_ALLOW_LIST      https://your-domain,https://your-domain/**,…"
        echo "       AUTH_SMTP_HOST           your SMTP host"
        echo "       AUTH_SMTP_USER           your SMTP user"
        echo "       AUTH_SMTP_ADMIN_EMAIL    noreply@your-domain"
        echo "       AUTH_SMTP_SENDER_NAME    ${DISPLAY_NAME}"
        echo "       AUTH_GITHUB_CLIENT_ID    from your GitHub OAuth app"
        echo "       AUTH_GOOGLE_CLIENT_ID    from your Google OAuth client"
        echo ""
        echo "     Editing the JSON directly also works, but you then carry a"
        echo "     permanent conflict against every upstream update to that file."
        echo ""
        echo "Next steps:"
        echo "  1. Run 'docker compose up --build' to rebuild with new configuration"
        # NOT 'exec ${SANITIZED_NAME}' — a build in the dev container fights the
        # dev server over .next and corrupts it (#293, #508). The builder service
        # is the same image with its own .next volume.
        echo "  2. Run 'docker compose run --rm builder pnpm run build' to verify build"
        echo "  3. Customize your theme colors in src/app/globals.css (see docs/CUSTOM-THEME.md)"
        echo "  4. Commit changes: git add -A && git commit -m \"Rebrand to ${DISPLAY_NAME}\""
    fi
    echo ""
}

# Run main
main "$@"
