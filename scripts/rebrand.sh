#!/usr/bin/env bash
# =============================================================================
# ScriptHammer Rebrand Script
# =============================================================================
# Automates rebranding of the ScriptHammer template to a new project identity.
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
#   --keep-cname          Do not update public/CNAME file (keep existing domain)
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
#   1  Invalid arguments
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
#   nothing below it. The token is deliberately brand-neutral: `scripthammer:keep`
#   would itself contain the string being replaced.
#
#   The attribution link in src/config/footer-links.ts is protected this way,
#   which is why --preserve-attribution is now a no-op. Removing the attribution
#   is a one-line edit you are welcome to make. It is MIT.
# =============================================================================

set -euo pipefail

# Script info
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
FILES_MODIFIED=0
FILES_RENAMED=0
START_TIME=$(date +%s)

# Options
DRY_RUN=false
FORCE=false
KEEP_CNAME=false
PRESERVE_SSH=false
PRESERVE_ATTRIBUTION=false

# Original project name to search for
ORIGINAL_NAME="ScriptHammer"
ORIGINAL_NAME_LOWER="scripthammer"
ORIGINAL_OWNER="TortoiseWolfe"

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
    ' "$0"
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

# Count ScriptHammer references to detect if already rebranded
count_references() {
    local count
    count=$(grep -r "$ORIGINAL_NAME" --include="*.ts" --include="*.tsx" --include="*.js" \
        --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" \
        --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=out --exclude-dir=.git \
        "$REPO_ROOT" 2>/dev/null | wc -l || echo "0")
    echo "$count" | tr -d '[:space:]'
}

# Detect previous rebrand
#
# A fresh ScriptHammer clone contains hundreds of "ScriptHammer" references
# across .ts/.tsx/.md/.yml files. A successfully-rebranded fork contains 0–4
# (only the Footer attribution + this script's own constants — and even those
# is protected by `rebrand:keep` markers). The threshold below
# uses < 5 as the "already rebranded" signal — well under any plausible
# fresh-clone count, well above any plausible post-rebrand residual.
detect_previous_rebrand() {
    local ref_count
    ref_count=$(count_references)

    if [ "$ref_count" -eq 0 ] || [ "$ref_count" -lt 5 ]; then
        log_warning "This repository appears to have been rebranded already."
        echo "No \"$ORIGINAL_NAME\" references found (or very few: $ref_count)."
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
    local pattern="$3"

    while IFS= read -r -d '' file; do
        if [ -f "$file" ]; then

            if grep -q "$search" "$file" 2>/dev/null; then
                if [ "$DRY_RUN" = true ]; then
                    # Only claim a change if something UNmarked would actually move.
                    if grep -v 'rebrand:keep' "$file" | grep -q "$search"; then
                        log_verbose "[DRY-RUN] Would update: ${file#$REPO_ROOT/}"
                        ((FILES_MODIFIED++)) || true
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
                    ((FILES_MODIFIED++)) || true
                fi
            fi
        fi
    done < <(find "$REPO_ROOT" -type f \( \
        -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
        -o -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" \
        -o -name "*.sh" -o -name "*.html" -o -name "*.css" \
        \) \
        ! -path "*/node_modules/*" \
        ! -path "*/.next/*" \
        ! -path "*/out/*" \
        ! -path "*/.git/*" \
        ! -name "pnpm-lock.yaml" \
        ! -name "package-lock.json" \
        -print0)
}

# Rename files containing original name
rename_files() {
    local search="$1"
    local replace="$2"

    while IFS= read -r -d '' file; do
        local dir
        local base
        local new_base
        local new_file

        dir=$(dirname "$file")
        base=$(basename "$file")
        new_base=$(echo "$base" | sed "s|$search|$replace|g")

        if [ "$base" != "$new_base" ]; then
            new_file="$dir/$new_base"
            if [ "$DRY_RUN" = true ]; then
                log_verbose "[DRY-RUN] Would rename: ${base} → ${new_base}"
            else
                mv "$file" "$new_file"
                log_verbose "Renamed: ${base} → ${new_base}"
            fi
            ((FILES_RENAMED++)) || true
        fi
    done < <(find "$REPO_ROOT" -type f -name "*${search}*" \
        ! -path "*/node_modules/*" \
        ! -path "*/.next/*" \
        ! -path "*/out/*" \
        ! -path "*/.git/*" \
        -print0)
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
            ((FILES_MODIFIED++)) || true
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
        ((FILES_MODIFIED++)) || true
    fi
}

# Update CNAME file (replace scripthammer domain with new project domain)
update_cname() {
    local cname_file="$REPO_ROOT/public/CNAME"

    if [ -f "$cname_file" ]; then
        # Check if it's a custom domain (not scripthammer.com)
        local domain
        domain=$(cat "$cname_file" 2>/dev/null || echo "")

        if [[ "$domain" == *"scripthammer"* ]] || [ -z "$domain" ]; then
            if [ "$KEEP_CNAME" = true ]; then
                log_info "Keeping CNAME file as-is (--keep-cname flag set)"
            else
                if [ "$DRY_RUN" = true ]; then
                    log_verbose "[DRY-RUN] Would update public/CNAME to ${DISPLAY_NAME}.com"
                else
                    echo "${DISPLAY_NAME}.com" > "$cname_file"
                    log_verbose "Updated public/CNAME: ${domain} → ${DISPLAY_NAME}.com"
                fi
            fi
        else
            log_info "Keeping CNAME file (custom domain: $domain)"
        fi
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
    if grep -q "scripthammer-dark" "$css_file" 2>/dev/null; then
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would rename theme references in globals.css"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$css_file"
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$css_file"
            sed "${SED_INPLACE[@]}" "s|ScriptHammer Dark Theme|${DISPLAY_NAME} Dark Theme|g" "$css_file"
            sed "${SED_INPLACE[@]}" "s|ScriptHammer Light Theme|${DISPLAY_NAME} Light Theme|g" "$css_file"
            log_verbose "Renamed theme blocks: scripthammer-* → ${SANITIZED_NAME}-*"
        fi
        ((FILES_MODIFIED++)) || true
    fi

    # Update ThemeScript.tsx fallback theme names
    local theme_script="$REPO_ROOT/src/components/ThemeScript.tsx"
    if [ -f "$theme_script" ] && grep -q "scripthammer-dark" "$theme_script" 2>/dev/null; then
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update ThemeScript.tsx theme names"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$theme_script"
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$theme_script"
            log_verbose "Updated ThemeScript.tsx theme fallbacks"
        fi
        ((FILES_MODIFIED++)) || true
    fi

    # Update Storybook preview theme names
    local preview_file="$REPO_ROOT/.storybook/preview.tsx"
    if [ -f "$preview_file" ] && grep -q "scripthammer-dark" "$preview_file" 2>/dev/null; then
        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update .storybook/preview.tsx theme names"
        else
            sed "${SED_INPLACE[@]}" "s|scripthammer-dark|${SANITIZED_NAME}-dark|g" "$preview_file"
            sed "${SED_INPLACE[@]}" "s|scripthammer-light|${SANITIZED_NAME}-light|g" "$preview_file"
            log_verbose "Updated Storybook preview theme names"
        fi
        ((FILES_MODIFIED++)) || true
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
    FILES_MODIFIED=$((FILES_MODIFIED + 17))
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
            ((FILES_MODIFIED++)) || true
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
        echo "Usage: $0 <PROJECT_NAME> <OWNER> \"<DESCRIPTION>\" [OPTIONS]"
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

    # Validate sanitized name
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

    # Header
    echo ""
    echo "========================================="
    echo "  ScriptHammer Rebrand Script v${VERSION}"
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

    # Check for previous rebrand
    detect_previous_rebrand || true

    # Perform rebrand operations
    echo "Updating file contents..."
    # Replace case variations
    replace_in_files "$ORIGINAL_NAME" "$DISPLAY_NAME" "*.ts"
    replace_in_files "$ORIGINAL_NAME_LOWER" "$SANITIZED_NAME" "*.ts"
    replace_in_files "$ORIGINAL_OWNER" "$OWNER" "*.ts"

    echo ""
    echo "Renaming files..."
    rename_files "$ORIGINAL_NAME" "$DISPLAY_NAME"
    rename_files "$ORIGINAL_NAME_LOWER" "$SANITIZED_NAME"

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
    echo "Updating CNAME..."
    update_cname

    echo ""
    echo "Updating .env.example..."
    update_env_example

    echo ""
    echo "Updating brand icons..."
    update_brand_icons

    # Summary
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo ""
    echo "========================================="
    echo "  Summary"
    echo "========================================="
    echo "  Files modified: $FILES_MODIFIED"
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
        # measures your project against ScriptHammer's identity and fails on values
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
