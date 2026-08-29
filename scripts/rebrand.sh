#!/usr/bin/env bash
# =============================================================================
# ScriptHammer Rebrand Script # rebrand:keep
# =============================================================================
# Automates rebranding of the ScriptHammer template to a new project identity. # rebrand:keep
# Updates ~930 files including code, config, and documentation.
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
#   --icon-small <mark>   A SIMPLER mark for the sizes that cannot carry detail.
#                         Optional. Used for everything at or below 32px — the
#                         favicon.ico 16 and 32 frames, and icon.svg — while the main
#                         mark keeps the rest. 16px is 256 pixels; a mark that is clean
#                         at 32 can be an indistinct smudge there (#906).
#   --keep-blog           Keep the template's blog posts. WITHOUT it every post except
#                         the `hello-world` exemplar is REMOVED: a fork should not
#                         republish the template's writing under its own name (#936).
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
KEEP_BLOG=false

# The one post a fork keeps. It is written to be deleted: it documents the frontmatter
# contract and the `generate:blog` step, and says so in its own text.
BLOG_EXEMPLAR="hello-world.md"
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
# THE DESCRIPTION HAS TO REACH THE SURFACES USERS SEE (#923).
#
# DESCRIPTION used to land in package.json and stop. Nothing a visitor encounters
# reads package.json: og:description, twitter:description, the meta description and
# the PWA manifest all come from projectConfig.projectDescription, whose default is
# a plain English sentence with no brand token in it — so the substitution sweep has
# nothing to match and cannot reach it, no matter how the sweep is widened.
#
# A live fork about geo-located live action role playing therefore advertised "a
# production Next.js and Supabase platform with auth, payments, encrypted
# messaging…" to every social card and search result. package.json had the right
# text the whole time, which is exactly why nobody noticed. (No fork is named
# here on purpose: a brand mentioned in this file is a brand that can never
# re-rebrand, because the tooling-collision guard would see its own prose.)
#
# Written with node rather than sed: a description is free text a forker supplies,
# and `Care & rescue | "now"` would expand `&`, terminate a `|`-delimited sed
# expression, or inject an unescaped quote into a TypeScript string literal.
# A FORK MUST NOT PUBLISH THIS TEMPLATE'S LOCKUP.
#
# The home page hero renders `LayeredScriptHammerLogo` — a gear ring, a printing # rebrand:keep
# mallet, and "SCRIPTHAMMER.COM" twice around the rim. A real fork shipped the whole # rebrand:keep
# thing on its own public front page while every string around it was correctly
# rebranded.
#
# THE SWEEP COULD NEVER HAVE FIXED IT. The rim lettering lives in
# src/components/atomic/SpinningLogo/ringWordmark.ts as outlined glyph paths — mask
# cut-outs generated from a font by a Python/fontTools pipeline. There is no
# "ScriptHammer" string anywhere in it to substitute. Renaming public/*-logo.svg, # rebrand:keep
# which the path-move phase does, changes nothing either: the hero is inline SVG and
# those files are not on its critical path.
#
# So the mark is CHOSEN, not swept. project.config.ts defaults to 'placeholder'
# already, which protects a fork even without this; setting it here as well means the
# guarantee does not depend on the forker never editing that default back.
# THE CARD PEOPLE SEE BEFORE THEY EVER VISIT (#988 follow-up).
#
# public/opengraph-image.png is 1200x630 of this template's lockup, and it is what
# Slack, LinkedIn, iMessage and Twitter render when anyone pastes a fork's link. Every
# fork inherited it. #988 fixed the on-page hero; this is the same borrowed artwork on
# the surface that reaches people who never open the site.
#
# The replacement is DERIVED, NOT DESIGNED: the project's own name and its initials on
# a neutral ground. No tagline, no illustration, no logo — a script cannot know what a
# project looks like, and inventing one is the mistake that put a domain nobody owned
# in CNAME and a description nobody wrote in package.json.
#
# IF IT CANNOT BE GENERATED, THE BORROWED CARD IS DELETED. sharp lives in node_modules,
# and a rebrand may run before anything is installed. An absent card degrades to no
# preview image, which is honest; shipping someone else's brand is not. Same call as
# CNAME: remove rather than inherit, and say so.
# THE COMMITTED MANIFEST MUST DESCRIBE THE FORK'S OWN DEPLOYMENT (#985).
#
# public/manifest.json is tracked on purpose (#392) so its start_url, scope and icon
# paths are reviewable. Those paths depend on the base path, and the base path depends
# on whether public/CNAME exists — which this script has just decided.
#
# A fork inherits `start_url: "/"`, correct for a template served from an apex domain
# and wrong for a fork served from /<repo>/. The result is a PWA whose install scope
# does not match where the app lives, and a first push that fails the repo's own
# generated-manifest test with nothing the forker can do about it.
#
# generate-manifest.js needs only fs and path, so this runs before `pnpm install` ever
# has to have happened. The base path is passed explicitly because detect-project.js
# only derives one under GITHUB_ACTIONS, and this is a local run.
update_manifest() {
    local manifest="$REPO_ROOT/public/manifest.json"
    local generator="$REPO_ROOT/scripts/generate-manifest.js"

    [ -f "$manifest" ] || return 0
    [ -f "$generator" ] || return 0

    # CNAME present means a custom domain at the apex, so no base path.
    local base=""
    [ -f "$REPO_ROOT/public/CNAME" ] || base="/${SANITIZED_NAME}"

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would regenerate public/manifest.json with basePath '${base}'"
        return 0
    fi

    if (cd "$REPO_ROOT" && NEXT_PUBLIC_BASE_PATH="$base" node "$generator" >/dev/null 2>&1); then
        log_success "Regenerated public/manifest.json for basePath '${base:-/}'"
        mark_modified "$manifest"
    else
        log_warning "Could not regenerate public/manifest.json; run 'pnpm run generate:manifest' before your first push"
    fi
}

update_og_image() {
    local card="$REPO_ROOT/public/opengraph-image.png"
    local generator="$REPO_ROOT/scripts/generate-og-image.mjs"

    [ -f "$card" ] || return 0

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would regenerate public/opengraph-image.png for ${DISPLAY_NAME}"
        return 0
    fi

    if [ -f "$generator" ] && (cd "$REPO_ROOT" && node "$generator" "$DISPLAY_NAME" "public/opengraph-image.png" >/dev/null 2>&1); then
        log_success "Regenerated public/opengraph-image.png for ${DISPLAY_NAME}"
        mark_modified "$card"
        return 0
    fi

    rm -f "$card"
    log_warning "Could not render a social card (sharp unavailable?), so the inherited one was REMOVED."
    log_warning "  Run: node scripts/generate-og-image.mjs \"${DISPLAY_NAME}\" — or add your own 1200x630 public/opengraph-image.png"
    mark_modified "$card"
}

update_brand_mark() {
    local conf="$REPO_ROOT/src/config/project.config.ts"

    [ -f "$conf" ] || return 0

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would set brandMark to 'placeholder' in src/config/project.config.ts"
        return 0
    fi

    if ! node - "$conf" <<'NODE'; then
const fs = require('node:fs');
const [file] = process.argv.slice(2);
const source = fs.readFileSync(file, 'utf8');

const pattern = /(brandMark:\s*)'(?:placeholder|lockup)'/;
if (!pattern.test(source)) {
  // Not an error: an older checkout may predate the field entirely.
  process.exit(0);
}
fs.writeFileSync(file, source.replace(pattern, "$1'placeholder'"));
NODE
        log_error "Could not set brandMark in src/config/project.config.ts"
        exit 1
    fi

    log_verbose "Set brandMark to 'placeholder'; the hero renders your initials until you supply a mark"
    mark_modified "$conf"
}

update_project_description() {
    local conf="$REPO_ROOT/src/config/project.config.ts"

    [ -f "$conf" ] || return 0

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would set projectDescription in src/config/project.config.ts"
        mark_modified "$conf"
        return 0
    fi

    if ! node - "$conf" "$DESCRIPTION" <<'NODE'; then
const fs = require('node:fs');
const [file, description] = process.argv.slice(2);
const source = fs.readFileSync(file, 'utf8');

// Match the key and whatever literal follows it, across a line break — prettier
// wraps this one onto its own line, so a single-line pattern misses it entirely.
const pattern = /(projectDescription:\s*)'(?:[^'\\]|\\.)*'/;
if (!pattern.test(source)) {
  process.stderr.write('projectDescription literal not found in project.config.ts\n');
  process.exit(1);
}

// JSON.stringify handles the escaping, then swap to single quotes to match the
// file's own style without hand-rolling an escaper.
const literal = JSON.stringify(description)
  .slice(1, -1)
  .replace(/\\"/g, '"')
  .replace(/'/g, "\\'");

fs.writeFileSync(file, source.replace(pattern, `$1'${literal}'`));
NODE
        log_error "Could not set projectDescription in src/config/project.config.ts"
        exit 1
    fi

    log_verbose "Set projectDescription in src/config/project.config.ts"
    mark_modified "$conf"
}



update_package_json() {
    local pkg_file="$REPO_ROOT/package.json"

    if [ -f "$pkg_file" ]; then
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update package.json fields"
        else
            # JSON VALUES ARE NOT SED REPLACEMENT STRINGS, and DESCRIPTION is free
            # text a forker supplies. `Care & rescue | it's "now"` expands the `&`,
            # TERMINATES the `|`-delimited expression outright, and injects an
            # unescaped quote into JSON. Reproduced on this exact input:
            #
            #   sed: -e expression #1, char 59: unknown option to `s'
            #
            # — the rebrand dies mid-run, after the content sweep has already
            # rewritten the tree. Let JSON.stringify do the escaping instead.
            #
            # The repository URL is handled here too, but note it is DEAD as
            # written (#972): the content sweep has already replaced that token by
            # the time this runs, so the search never matches. Left in place rather
            # than silently dropped, because #972 tracks the decision.
            if ! node - "$pkg_file" "$SANITIZED_NAME" "$DESCRIPTION" \
                "$OWNER" "$ORIGINAL_OWNER" "$ORIGINAL_NAME" <<'NODE'; then
const fs = require('node:fs');
const [file, name, description, owner, originalOwner, originalName] =
  process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

pkg.name = name;
pkg.description = description;

// SET IT, DON'T SEARCH FOR IT (#972).
//
// This searched for `github.com/${originalOwner}/${originalName}` and replaced it.
// That string is gone before this line runs: the general content sweep has already
// rewritten it, so the search could never match and the branch was dead. Worse than
// dead — the sweep substitutes the DISPLAY name, so a fork with a repository field
// ended up pointing at `github.com/owner/My Project` while its git remote said
// `my-project`, and nothing here corrected it.
//
// Rewriting whatever owner/repo pair is currently there is correct regardless of what
// the sweep did or did not do to it. Absent field stays absent: package.json has no
// `repository` today, and inventing one is not this script's job.
// The separator is CAPTURED, not assumed: `git@github.com:owner/repo.git` is an SSH
// URL and rewriting its colon to a slash quietly breaks it.
const canonical = (u) =>
  u.replace(
    /github\.com([/:])[^/]+\/[^/#?]+?(\.git)?(?=$|[/#?])/,
    (_, sep, git) => `github.com${sep}${owner}/${name}${git || ''}`
  );
if (typeof pkg.repository === 'string') {
  pkg.repository = canonical(pkg.repository);
} else if (pkg.repository && typeof pkg.repository.url === 'string') {
  pkg.repository.url = canonical(pkg.repository.url);
}

fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
NODE
                log_error "Could not update package.json"
                exit 1
            fi
            log_verbose "Updated package.json fields"
        fi
        mark_modified "$pkg_file"
    fi
}

# A FORK MUST NOT REPUBLISH THE TEMPLATE'S BLOG (#936).
#
# rebrand.sh had no concept of the blog. It swept brand strings across every file,
# public/blog/*.md included, so the template's posts had the brand swapped and silently
# became the fork's writing — public, indexed, in its sitemap and its RSS feed. Measured
# on a real fork: 15 of its 16 posts existed upstream, and its own introduction slug
# served a post titled "<Template> - Opinionated Next.js PWA Template". The tell is that
# a deliberate bad-SEO TEST FIXTURE shipped as a real post: nothing in the pipeline
# distinguished a demo from content a fork should publish.
#
# TWO SIDES HAVE TO GO, and deleting only the markdown would be worse than doing
# nothing. src/app/blog/[slug]/page.tsx renders out of the committed index, never from
# the markdown, and generate:blog is deliberately not part of prebuild (#938) — so a
# fork that deleted the posts alone would keep serving every one of them from
# blog-data.json, with the files gone and no way to edit them.
#
# The index is filtered here rather than regenerated because generate:blog needs
# gray-matter from node_modules, and a forker may well run this before installing
# anything. Filtering copies each retained entry verbatim, so every field-mirroring test
# (rss-feed.test.js) still holds.
clear_template_blog() {
    local blog_dir="$REPO_ROOT/public/blog"
    local index="$REPO_ROOT/src/lib/blog/blog-data.json"

    if [ "$KEEP_BLOG" = true ]; then
        log_info "Keeping the template's blog posts (--keep-blog flag set)"
        return 0
    fi

    [ -d "$blog_dir" ] || return 0

    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would remove the template's blog posts, keeping ${BLOG_EXEMPLAR}"
        return 0
    fi

    local removed
    removed=$(node - "$blog_dir" "$index" "$REPO_ROOT/public/blog-images" \
        "$BLOG_EXEMPLAR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [blogDir, indexPath, imagesDir, exemplar] = process.argv.slice(2);

// Mirrors scripts/generate-blog-data.js: `.md` only, and its ALL-CAPS exclusion —
// CLAUDE.md in public/blog is author guidance, not a post, and must survive.
const isPost = (f) => f.endsWith('.md') && !/^[A-Z]+\.md$/.test(f);

const slugOf = (file) => {
  const src = fs.readFileSync(path.join(blogDir, file), 'utf8');
  const fm = src.startsWith('---') ? src.slice(3, src.indexOf('\n---', 3)) : '';
  const m = fm.match(/^slug:\s*['"]?([^'"\n]+?)['"]?\s*$/m);
  return m ? m[1].trim() : file.replace(/\.md$/, '');
};

const files = fs.readdirSync(blogDir).filter(isPost);
const doomed = files.filter((f) => f !== exemplar);
const keptSlugs = new Set(files.filter((f) => f === exemplar).map(slugOf));

for (const file of doomed) {
  // Read the slug BEFORE unlinking; it names the image directory, which is not
  // always the filename because frontmatter may override the slug.
  const slug = slugOf(file);
  fs.rmSync(path.join(blogDir, file));
  const assets = path.join(imagesDir, slug);
  if (fs.existsSync(assets)) fs.rmSync(assets, { recursive: true });
}

if (fs.existsSync(indexPath)) {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.posts = (index.posts || []).filter((p) => keptSlugs.has(p.slug));
  index.count = index.posts.length;
  // Recomputed, not preserved: leaving the template's tag and category lists behind
  // would populate the fork's blog filters with facets nothing is filed under.
  const collect = (key) => [
    ...new Set(index.posts.flatMap((p) => p.frontMatter?.[key] || [])),
  ];
  if ('tags' in index) index.tags = collect('tags');
  if ('categories' in index) index.categories = collect('categories');
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

process.stdout.write(String(doomed.length));
NODE
    ) || {
        log_error "Could not clear the template's blog posts"
        exit 1
    }

    if [ "${removed:-0}" -gt 0 ]; then
        log_success "Removed ${removed} template blog post(s); kept ${BLOG_EXEMPLAR}"
        mark_modified "$index"
    else
        log_verbose "No template blog posts to remove"
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

# A URL POINTING AT THE UPSTREAM REPOSITORY IS A CITATION, NOT BRANDING (#926).
#
# Inherited documentation links to the template as evidence — a bug report used as
# a worked example, a file on main. The substitution has no notion of that, so it
# rewrites `github.com/TortoiseWolfe/ScriptHammer/issues/51` into a link to the # rebrand:keep
# fork's own empty tracker. Measured on a real fork: 42 issue and PR URLs, every
# one a 404.
#
# The owner pass makes it broader than the brand pass alone. Another repository the
# same author owns carries no brand token, so its NAME survives while its OWNER is
# rewritten — breaking links to every repo upstream owns, not just this one.
#
# Both halves are hidden behind a sentinel before any pass runs and restored after,
# which is why one mechanism covers a case-preserving projection engine and a plain
# sed in the same breath. The sentinel carries no brand or owner text, so nothing
# matches it.
#
# The two substitutions are ordered: owner+name first, bare owner second, so the
# specific case is claimed before the general one.
UPSTREAM_OWNER_SENTINEL="@@REBRAND_UPSTREAM_OWNER@@"
UPSTREAM_NAME_SENTINEL="@@REBRAND_UPSTREAM_NAME@@"
SELF_REPO_SENTINEL="@@REBRAND_SELF_REPO@@"

# THE SWEEP MUST NOT MINT A HOSTNAME (#983).
#
# `<brand>.com` is a brand token in a tracked file, so the content sweep rewrites it
# like any other — turning this template's domain into `<fork-slug>.com`, a perfectly
# well-formed domain that nobody registered. #961 already learned this one file over,
# in public/CNAME, where the gate approved `geo-larp.com` for exactly the same reason:
# validity was the wrong question, ownership is the question.
#
# Measured on a real rebrand of this repository: 78 tracked files, 139 occurrences, and
# SEVEN of them are read by a machine rather than a human —
#
#   scripts/supabase/auth-config.json   site_url, uri_allow_list and the mail sender
#                                       PUSHED to Supabase, so every verification and
#                                       reset link points at a domain that does not
#                                       resolve. Signup is broken, silently.
#   supabase/functions/send-payment-email  the From: of every payment receipt, on a
#                                       domain with no SPF or DKIM — so it is rejected
#                                       or filed as spam.
#   src/components/molecular/DisqusComments.tsx  the fallback thread URL, shipped to
#                                       the browser; comments key off the dead host.
#   scripts/seed-test-users.ts          seeds the welcome-message admin there.
#   playwright.smoke.config.ts          the default baseURL of the post-deploy smoke.
#   .github/workflows/deploy.yml        the SITE_URL fallback.
#   public/robots.txt                   advertises a sitemap nobody can fetch.
#
# Same mechanism as the citations above: park it behind a sentinel that carries no
# brand text, then hand back an HONEST value once the sweep has run.
BRAND_DOMAIN_SENTINEL="@@REBRAND_BRAND_DOMAIN@@"

# RFC 2606 reserves example.com precisely so it can never be registered. An email
# domain cannot be derived from a project name — there is no honest guess — so this is
# a placeholder the forker must replace, and one that reads as a placeholder. The same
# call as CNAME: say you do not know, rather than invent something plausible.
PLACEHOLDER_DOMAIN="example.com"

# WHICH URLS ARE CITATIONS, AND WHICH ARE THE FORK'S OWN IDENTITY.
#
# Not every `github.com/OWNER/ScriptHammer` points at the template. package.json's # rebrand:keep
# repository field, the clone URL in the README, CONTRIBUTING's "open a
# Discussion" link — those name THIS project and must become the fork's. Protecting
# them all was the obvious first move and it is wrong: it leaves a fork's
# package.json declaring the upstream repository as its own.
#
# The distinction is whether the link names a SPECIFIC upstream artifact. An issue
# or PR by number, a file at a ref — those are evidence, and #926 states the intent
# plainly: "an inherited doc that cites an upstream issue should keep citing the
# upstream issue." A bare repository URL, a `.git` clone URL, or an unnumbered
# /issues or /discussions is a project LOCATION, and a fork wants its own.
# ONE PATTERN PER ENTRY, NOT AN ALTERNATION. replace_in_files builds
# `s|$search|$replace|g`, so `|` is the sed DELIMITER — a `\|` alternation here
# silently terminates the expression and the pattern matches nothing. That cost a
# debugging round: the citations simply stayed unprotected with no error.
UPSTREAM_ARTIFACT_PATHS=(
    'issues/[0-9]'
    'pull/[0-9]'
    'blob/'
    'tree/'
    'commit/'
    'releases/tag/'
)

protect_upstream_citations() {
    # ORDER IS THE WHOLE MECHANISM, because sed cannot express "this owner but not
    # that repository". Four steps, narrowest first.

    # 1. This repository cited by ARTIFACT — evidence a fork cannot reproduce.
    local artifact
    for artifact in "${UPSTREAM_ARTIFACT_PATHS[@]}"; do
        # Captured, not re-spelled: `issues/[0-9]` in the REPLACEMENT would write
        # that string literally and eat the issue number.
        replace_in_files \
            "github\.com/$ORIGINAL_OWNER/$ORIGINAL_NAME/\($artifact\)" \
            "github.com/$UPSTREAM_OWNER_SENTINEL/$UPSTREAM_NAME_SENTINEL/\1"
    done

    # 2. Every remaining reference to THIS repository is the project's own identity
    #    — package.json's repository field, the clone URL, the discussions link —
    #    and must rebrand. Park it behind a different marker so step 3 cannot claim
    #    it, then hand it back in step 4.
    replace_in_files \
        "github\.com/$ORIGINAL_OWNER/$ORIGINAL_NAME" \
        "github.com/$SELF_REPO_SENTINEL"

    # 3. Anything still under the upstream owner is a DIFFERENT repository they own.
    #    Never the fork by any reading, and its name carries no brand token — so
    #    only the owner pass breaks it, silently, for every repo upstream owns.
    replace_in_files \
        "github\.com/$ORIGINAL_OWNER/" \
        "github.com/$UPSTREAM_OWNER_SENTINEL/"

    # 4. Give the self-references back, as plain text, so every pass rebrands them.
    replace_in_files \
        "github\.com/$SELF_REPO_SENTINEL" \
        "github.com/$ORIGINAL_OWNER/$ORIGINAL_NAME"
}

# Park the template's own hostname so no pass can rewrite it. Must run BEFORE the
# content sweep, for the same reason classify_cname does: afterwards the text that
# identifies it is already gone.
#
# Two passes because the case-preserving engine projects case: the hostname appears
# lowercase (201×) and in the canonical spelling (5×), and a plain sed sees them as
# different strings. Both land on the same sentinel — the distinction that survives is
# the SYNTACTIC one made in resolve_brand_domain, not the capitalisation.
protect_brand_domain() {
    # public/CNAME is EXEMPT, and deliberately so. update_cname() is that file's only
    # writer: it deletes an inherited domain, keeps a custom one, and honours
    # --keep-cname, and every one of those decisions is tested. A second writer
    # reaching into it is the coupling that produced #961 in the first place. Snapshot
    # it across the window so the sweep sees exactly what it sees today.
    local cname_file="$REPO_ROOT/public/CNAME"
    local cname_before=""
    [ -f "$cname_file" ] && cname_before=$(cat "$cname_file")

    replace_in_files "$ORIGINAL_NAME\.com" "$BRAND_DOMAIN_SENTINEL"
    replace_in_files "$ORIGINAL_NAME_LOWER\.com" "$BRAND_DOMAIN_SENTINEL"

    if [ -n "$cname_before" ] && [ "$DRY_RUN" = false ]; then
        printf '%s\n' "$cname_before" > "$cname_file"
    fi
}

# Hand the parked hostname back as something true.
#
# THE ANSWER DEPENDS ON SYNTAX, and there are only two answers:
#
#   a URL     → the fork's GitHub Pages origin. Real, reachable, and derived rather
#               than guessed: it is exactly what scripts/site-url.js resolves to with
#               no NEXT_PUBLIC_DEPLOY_URL set, which is the state every fresh fork is
#               in. So the committed artifacts agree with what a build produces
#               instead of drifting from it (#504).
#   an email  → example.com. See PLACEHOLDER_DOMAIN.
#
# Deliberately NOT derived from public/CNAME even when one survives --keep-cname:
# site-url.js refuses to do that on purpose, because this repository's CNAME names the
# `www` host while its canonical origin is the apex, and a generated URL at the wrong
# host is the same SEO failure in a new place. A fork with a domain sets
# NEXT_PUBLIC_DEPLOY_URL, and the next build rewrites the generated artifacts anyway.
#
# Ordered longest-match first, because sed is not a parser: `https://www.` has to be
# claimed before `https://`, and both before the bare form.
resolve_brand_domain() {
    local pages_origin="https://$(printf '%s' "$OWNER" | tr '[:upper:]' '[:lower:]').github.io/${SANITIZED_NAME}"

    replace_in_files "https://www\.$BRAND_DOMAIN_SENTINEL" "$pages_origin"
    replace_in_files "http://www\.$BRAND_DOMAIN_SENTINEL" "$pages_origin"
    replace_in_files "https://$BRAND_DOMAIN_SENTINEL" "$pages_origin"
    replace_in_files "http://$BRAND_DOMAIN_SENTINEL" "$pages_origin"
    replace_in_files "www\.$BRAND_DOMAIN_SENTINEL" "$PLACEHOLDER_DOMAIN"
    replace_in_files "$BRAND_DOMAIN_SENTINEL" "$PLACEHOLDER_DOMAIN"
}

# `https://<brand>.com` and `https://www.<brand>.com` are different strings that both
# resolve to one origin, so the allow list comes out of resolve_brand_domain carrying
# the same entry twice. Harmless to Supabase and confusing to a human, and this file is
# tracked to BE read — it is the desired state auth-config-drift.yml compares a live
# project against.
#
# Order-preserving, first-occurrence-wins: the list's shape (origin, origin/**, then
# the localhost pair) is what makes it reviewable, so it must survive deduplication.
dedupe_auth_allow_list() {
    local conf="$REPO_ROOT/scripts/supabase/auth-config.json"

    [ -f "$conf" ] || return 0
    if [ "$DRY_RUN" = true ]; then
        log_verbose "[DRY-RUN] Would de-duplicate auth-config.json uri_allow_list"
        return 0
    fi

    if node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const raw = fs.readFileSync(file, "utf8");
        // RAW TEXT, not parse-and-reserialize. JSON.stringify would drop the blank
        // line that separates the OAuth block from the rest, so a de-duplication
        // would arrive as a whole-file reformat in the first diff a fork sees.
        const line = /("uri_allow_list":\s*")([^"]*)(")/;
        const found = line.exec(raw);
        if (!found) process.exit(0);
        const value = found[2];
        const envelope = /^(\$\{[A-Z_]+:-)(.*)(\})$/.exec(value);
        const [prefix, body, suffix] = envelope
            ? [envelope[1], envelope[2], envelope[3]]
            : ["", value, ""];
        const entries = body.split(",").map((s) => s.trim()).filter(Boolean);
        const deduped = [...new Set(entries)];
        if (deduped.length === entries.length) process.exit(0);
        fs.writeFileSync(
            file,
            raw.replace(line, found[1] + prefix + deduped.join(",") + suffix + found[3])
        );
    ' "$conf" 2>/dev/null; then
        mark_modified "$conf"
    else
        log_warning "Could not de-duplicate scripts/supabase/auth-config.json uri_allow_list; check it by hand"
    fi
}

restore_upstream_citations() {
    replace_in_files \
        "github\.com/$UPSTREAM_OWNER_SENTINEL/$UPSTREAM_NAME_SENTINEL/" \
        "github.com/$ORIGINAL_OWNER/$ORIGINAL_NAME/"
    replace_in_files \
        "github\.com/$UPSTREAM_OWNER_SENTINEL/" \
        "github.com/$ORIGINAL_OWNER/"
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
    # The simplified mark for small sizes, if the fork supplied one (#906). Copied
    # into public/ by the generator so `pnpm check:icons` can find it afterwards
    # without being told again.
    local icon_args=(--source "$icon_src")
    if [ -n "${BRAND_ICON_SMALL:-}" ]; then
        if [ ! -f "$BRAND_ICON_SMALL" ]; then
            log_error "--icon-small file not found: $BRAND_ICON_SMALL"
            exit 1
        fi
        local small_ext
        small_ext="$(printf '%s' "${BRAND_ICON_SMALL##*.}" | tr '[:upper:]' '[:lower:]')"
        case "$small_ext" in
            svg|png|webp) ;;
            *)
                log_error "--icon-small must be .svg, .png or .webp (got: $BRAND_ICON_SMALL)"
                exit 1
                ;;
        esac
        cp "$BRAND_ICON_SMALL" "$REPO_ROOT/public/favicon-small.$small_ext"
        icon_args+=(--source-small "public/favicon-small.$small_ext")
        mark_modified "$REPO_ROOT/public/favicon-small.$small_ext"
    fi
    if ! (cd "$REPO_ROOT" && node scripts/generate-icons.js "${icon_args[@]}"); then
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
            --keep-blog)
                KEEP_BLOG=true
                shift
                ;;
            --icon-small)
                BRAND_ICON_SMALL="$2"
                shift 2
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

    # --keep-cname ON AN INHERITED DOMAIN IS INCOHERENT, AND IT USED TO SUCCEED (#995).
    #
    # The flag exists for a fork migrating in a domain it already owns. Pointed at the
    # template's own CNAME it kept a domain nobody owned: update_cname() returns at its
    # KEEP_CNAME branch BEFORE consulting CNAME_IS_INHERITED, so the verdict computed
    # two lines above was thrown away, and what survived was whatever the content sweep
    # had rewritten the file to — `www.<fork-slug>.com`.
    #
    # That is worse than an ordinary wrong string, because public/CNAME's EXISTENCE is
    # what drops the Pages base path (detect-project.js:123). The result is a fork
    # serving from /<repo>/ with every asset URL rooted at /, so all of them 404 — the
    # exact failure #961 was filed for, reached through the one door it left open.
    #
    # Refused in PREFLIGHT, before any mutation, so a rejected run leaves the tree
    # untouched rather than half-rebranded. The verdict already exists at this point;
    # the bug was never that it was unknowable, only that nobody asked.
    if [ "$KEEP_CNAME" = true ] && [ "${CNAME_IS_INHERITED:-false}" = true ]; then
        log_error "--keep-cname was passed, but public/CNAME still holds the template's domain."
        echo ""
        echo "     public/CNAME: $(cat "$REPO_ROOT/public/CNAME" 2>/dev/null)"
        echo ""
        echo "     That domain belongs to ${ORIGINAL_NAME}, not to you, and keeping it does not"
        echo "     give you a site: the file's mere EXISTENCE drops the GitHub Pages base path,"
        echo "     so a fork served from /<repo>/ 404s every asset (#961)."
        echo ""
        echo "     --keep-cname is for a domain you ALREADY OWN. Either:"
        echo "       • drop the flag — the file is removed, and you add it back when you own one"
        echo "       • or put your own domain in public/CNAME first, then pass --keep-cname"
        echo ""
        exit 1
    fi

    # Hide upstream citations from every pass (#926).
    protect_upstream_citations

    # Same, for the template's own hostname (#983). A domain is not a brand token to
    # be projected — it is something somebody registered.
    protect_brand_domain

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
    echo "Updating project description..."
    update_project_description
    update_brand_mark

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

    # AFTER the residual verifier, deliberately (#926). A protected citation is
    # brand text the rebrand chose to keep, so showing it to a gate whose question
    # is "did anything get missed?" can only produce a false positive. They are
    # invisible to it by construction — the substitution never saw them either —
    # and test_upstream_citations_survive is what actually covers them.
    restore_upstream_citations

    # Same position, same argument (#983): the sentinel carries no brand text, so the
    # residual verifier could not have seen these either way — and the honest values
    # this writes contain the FORK's owner and repository, which is precisely what a
    # gate asking "did anything get missed?" would flag if it ran afterwards.
    resolve_brand_domain
    dedupe_auth_allow_list

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

    # Same position, same reason (#936). Clearing the blog deletes tracked paths — the
    # posts and their image directories — so it has to sit after both postconditions
    # for exactly the argument made above about CNAME. It also has to sit after the
    # content sweep for a second reason: the retained exemplar and the index entry that
    # describes it are brand text, and they must be rewritten before they are kept.
    echo ""
    echo "Clearing the template's blog..."
    clear_template_blog

    # LAST MUTATIONS, and the position is load-bearing for the same reason as CNAME
    # and the blog (#961): this DELETES a tracked path when it cannot render a
    # replacement, and the pre-move verifier walks the pre-mutation snapshot and
    # reports anything absent as "missing before path rename". Doing it early turned a
    # correct deletion into a failed rebrand — caught by the harness, exactly as the
    # CNAME comment above warned and I did anyway.
    echo ""
    echo "Updating the social card..."
    update_og_image

    # AFTER update_cname, and that order is the point: the manifest's paths depend on
    # whether a CNAME exists, and this script has just removed it.
    echo ""
    echo "Regenerating the web manifest..."
    update_manifest

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
