#!/bin/bash
# Convert a PRP into a feature branch with Specify system integration
# Usage: ./scripts/prp-to-feature.sh <prp-name> <branch-number>
# Example: ./scripts/prp-to-feature.sh prp-methodology 001

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -ne 2 ]; then
    echo -e "${RED}Error: Invalid number of arguments${NC}"
    echo "Usage: $0 <prp-name> <branch-number>"
    echo "Example: $0 prp-methodology 001"
    exit 1
fi

PRP_NAME=$1
BRANCH_NUMBER=$2
BRANCH_NAME="${BRANCH_NUMBER}-${PRP_NAME}"
PRP_FILE="docs/prp-docs/${PRP_NAME}-prp.md"

# Verify we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on main branch (currently on $CURRENT_BRANCH)${NC}"
    echo "Do you want to continue? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Check if PRP file exists
if [ ! -f "$PRP_FILE" ]; then
    echo -e "${RED}Error: PRP file not found: $PRP_FILE${NC}"
    echo "Available PRPs:"
    ls docs/prp-docs/*-prp.md 2>/dev/null | xargs -n1 basename | sed 's/-prp.md//'
    exit 1
fi

# Check if branch already exists
if git show-ref --quiet refs/heads/"$BRANCH_NAME"; then
    echo -e "${YELLOW}Warning: Branch $BRANCH_NAME already exists${NC}"
    echo "Do you want to checkout the existing branch? (y/n)"
    read -r response
    if [ "$response" = "y" ]; then
        git checkout "$BRANCH_NAME"
        echo -e "${GREEN}Switched to existing branch $BRANCH_NAME${NC}"
        exit 0
    else
        echo "Aborted."
        exit 1
    fi
fi

echo -e "${GREEN}Creating feature branch from PRP...${NC}"

# Create and checkout branch
git checkout -b "$BRANCH_NAME"
echo -e "${GREEN}✓ Created branch: $BRANCH_NAME${NC}"

# Setup feature directory
mkdir -p "docs/specs/$BRANCH_NAME"
cp "$PRP_FILE" "docs/specs/$BRANCH_NAME/spec.md"
echo -e "${GREEN}✓ Copied PRP to docs/specs/$BRANCH_NAME/spec.md${NC}"

# Update PRP status in tracking dashboard
if [ -f "docs/prp-docs/PRP-STATUS.md" ]; then
    # Update status from Inbox to In Progress
    sed -i "s/| ${PRP_NAME} | P[0-2] | 📥 Inbox |/| ${PRP_NAME} | P[0-2] | 🔄 In Progress |/" docs/prp-docs/PRP-STATUS.md
    # Add start date
    TODAY=$(date +%Y-%m-%d)
    sed -i "s/| \`${BRANCH_NAME}\` | - | - |/| \`${BRANCH_NAME}\` | $TODAY | - |/" docs/prp-docs/PRP-STATUS.md
    echo -e "${GREEN}✓ Updated PRP status to In Progress${NC}"
fi

echo ""
echo -e "${GREEN}Feature branch setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run ${YELLOW}./plan${NC} to generate implementation plan"
echo "2. Review the generated plan in docs/specs/$BRANCH_NAME/plan.md"
echo "3. Run ${YELLOW}./tasks${NC} to generate task list"
echo "4. Begin implementation following TDD principles"
echo ""
echo "Current branch: ${GREEN}$BRANCH_NAME${NC}"
echo "Spec location: docs/specs/$BRANCH_NAME/spec.md"