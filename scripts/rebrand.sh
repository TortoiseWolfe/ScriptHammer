#!/usr/bin/env bash
# =============================================================================
# ScriptHammer Rebrand Script
# =============================================================================
# Automates rebranding of the ScriptHammer template to a new project identity.
# Updates 200+ files including code, config, and documentation.
#
# Usage: ./scripts/rebrand.sh <PROJECT_NAME> <OWNER> "<DESCRIPTION>" [OPTIONS]
#
# Arguments:
#   PROJECT_NAME  New project name (auto-sanitized: spaces->hyphens, special chars removed)
#   OWNER         GitHub username or organization
#   DESCRIPTION   Project description (must be quoted if contains spaces)
#
# Options:
#   --force       Skip all confirmation prompts
#   --dry-run     Show what would change without modifying files
#   --keep-cname  Do not delete public/CNAME file
#   --help        Show this help message
#
# Exit Codes:
#   0  Success
#   1  Invalid arguments
#   2  Re-rebrand declined by user
#   3  Git error (not a repo, git not installed)
#
# Examples:
#   ./scripts/rebrand.sh MyApp myuser "My awesome application"
#   ./scripts/rebrand.sh "My Cool App" myuser "Description" --dry-run
#   ./scripts/rebrand.sh MyApp myuser "Description" --force
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

# Original project name to search for
ORIGINAL_NAME="ScriptHammer"
ORIGINAL_NAME_LOWER="scripthammer"
ORIGINAL_OWNER="TortoiseWolfe"

# =============================================================================
# Helper Functions
# =============================================================================

show_help() {
    sed -n '2,35p' "$0" | sed 's/^# //' | sed 's/^#//'
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

        if [ "$FORCE" = false ]; then
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
                    log_verbose "[DRY-RUN] Would update: ${file#$REPO_ROOT/}"
                else
                    sed "${SED_INPLACE[@]}" "s|$search|$replace|g" "$file"
                    log_verbose "Updated: ${file#$REPO_ROOT/}"
                fi
                ((FILES_MODIFIED++)) || true
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

# Delete CNAME file
delete_cname() {
    local cname_file="$REPO_ROOT/public/CNAME"

    if [ -f "$cname_file" ]; then
        # Check if it's a custom domain (not scripthammer.com)
        local domain
        domain=$(cat "$cname_file" 2>/dev/null || echo "")

        if [[ "$domain" == *"scripthammer"* ]] || [ -z "$domain" ]; then
            if [ "$KEEP_CNAME" = true ]; then
                log_info "Keeping CNAME file (--keep-cname flag set)"
            else
                if [ "$DRY_RUN" = true ]; then
                    log_verbose "[DRY-RUN] Would delete public/CNAME"
                else
                    rm "$cname_file"
                    log_verbose "Deleted public/CNAME"
                fi
            fi
        else
            log_info "Keeping CNAME file (custom domain: $domain)"
        fi
    fi
}

# Update git remote
update_git_remote() {
    local current_url
    current_url=$(git remote get-url origin 2>/dev/null || echo "")

    if [ -n "$current_url" ]; then
        local new_url="https://github.com/${OWNER}/${SANITIZED_NAME}.git"

        if [ "$DRY_RUN" = true ]; then
            log_verbose "[DRY-RUN] Would update git remote: $new_url"
        else
            git remote set-url origin "$new_url"
            log_verbose "Updated git remote: $new_url"
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

    echo ""
    echo "Updating docker-compose.yml..."
    update_docker_compose

    echo ""
    echo "Updating package.json..."
    update_package_json

    echo ""
    echo "Updating git remote..."
    update_git_remote

    echo ""
    echo "Cleaning up..."
    delete_cname

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
        echo "Next steps:"
        echo "  1. Run 'docker compose up --build' to rebuild with new configuration"
        echo "  2. Run 'docker compose exec ${SANITIZED_NAME} pnpm run build' to verify build"
        echo "  3. Commit changes: git add -A && git commit -m \"Rebrand to ${DISPLAY_NAME}\""
    fi
    echo ""
}

# Run main
main "$@"
