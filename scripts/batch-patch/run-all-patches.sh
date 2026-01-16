#!/bin/bash
# Run all batch PATCH fixes for SVG wireframes
#
# Usage:
#   ./run-all-patches.sh           # Run all fixes
#   ./run-all-patches.sh --dry-run # Preview changes without writing
#   ./run-all-patches.sh --fix X   # Run only fix X (signature, g044, g047)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=""
FIX_ONLY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --fix)
            FIX_ONLY="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--fix signature|g044|g047]"
            exit 1
            ;;
    esac
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           SVG Wireframe Batch PATCH Runner                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [[ -n "$DRY_RUN" ]]; then
    echo "🔍 DRY RUN MODE - No files will be modified"
    echo ""
fi

run_fix() {
    local name=$1
    local script=$2

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    python3 "$script" $DRY_RUN || true
}

# Run fixes based on selection
if [[ -z "$FIX_ONLY" ]] || [[ "$FIX_ONLY" == "signature" ]]; then
    run_fix "SIGNATURE-003: Left-align signatures" "fix-signature-003.py"
fi

if [[ -z "$FIX_ONLY" ]] || [[ "$FIX_ONLY" == "g044" ]]; then
    run_fix "G-044: Footer/Nav rounded corners" "fix-g044-footer-corners.py"
fi

if [[ -z "$FIX_ONLY" ]] || [[ "$FIX_ONLY" == "g047" ]]; then
    run_fix "G-047: Key Concepts row" "fix-g047-key-concepts.py"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Batch patching complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -z "$DRY_RUN" ]]; then
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff docs/design/wireframes/"
    echo "  2. Run validator:  cd docs/design/wireframes && python validate-wireframe.py --all"
    echo "  3. Commit if OK:   git add -A && git commit -m 'fix(wireframes): batch PATCH for SIGNATURE-003, G-044, G-047'"
fi
