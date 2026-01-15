#!/bin/bash
# Task dispatcher for scripthammer terminals
# Usage: ./tmux-dispatch.sh [--vote|--tasks|--queue|--all]
#
# Dispatches work to running tmux terminals without manual intervention.
# See AUTOMATION.md for patterns and edge case documentation.

SESSION="scripthammer"
STATUS_FILE="docs/design/wireframes/.terminal-status.json"
AUDIT_FILE="docs/interoffice/audits/2026-01-14-organizational-review.md"
PROJECT_DIR="$HOME/repos/000_Mega_Plates/ScriptHammer"

# Role to window number mapping (matches tmux-session.sh ALL array order)
# Note: Operator runs OUTSIDE tmux and is not in this mapping
declare -A WINDOWS=(
  ["CTO"]=0 ["Architect"]=1 ["Coordinator"]=2 ["Security"]=3
  ["Toolsmith"]=4 ["DevOps"]=5 ["ProductOwner"]=6 ["UXDesigner"]=7
  ["Planner"]=8 ["WireframeGenerator1"]=9 ["WireframeGenerator2"]=10 ["WireframeGenerator3"]=11
  ["PreviewHost"]=12 ["WireframeQA"]=13 ["Validator"]=14 ["Inspector"]=15
  ["Author"]=16 ["TestEngineer"]=17 ["Developer"]=18 ["Auditor"]=19
  ["QALead"]=20 ["TechWriter"]=21 ["DockerCaptain"]=22
  ["UIDesigner"]=23 ["BusinessAnalyst"]=24 ["ReleaseManager"]=25
)

# Check if session exists
check_session() {
  if ! tmux has-session -t $SESSION 2>/dev/null; then
    echo "Error: tmux session '$SESSION' not found."
    echo "Run './scripts/tmux-session.sh --all' first."
    exit 1
  fi
}

# Dispatch a task to a specific role's terminal
dispatch_to() {
  local ROLE="$1"
  local TASK="$2"
  local WIN="${WINDOWS[$ROLE]}"

  if [ -z "$WIN" ]; then
    echo "  [ERROR] Unknown role: $ROLE"
    return 1
  fi

  echo "  [$WIN] $ROLE: Dispatching..."
  tmux send-keys -t $SESSION:$WIN "$TASK" Enter
  sleep 2
  # Extra Enter to ensure submission
  tmux send-keys -t $SESSION:$WIN "" Enter
  sleep 0.5
}

# --vote: Expedite RFC voting (council only)
dispatch_votes() {
  echo "Dispatching RFC votes to council..."
  echo ""

  # Find pending RFCs
  RFC_DIR="$PROJECT_DIR/docs/interoffice/rfcs"
  if [ ! -d "$RFC_DIR" ]; then
    echo "  No RFC directory found at $RFC_DIR"
    return 1
  fi

  # List RFC files that are still pending (voting or proposed status, not decided/rejected)
  RFC_FILES=""
  for f in "$RFC_DIR"/RFC-*.md; do
    [ -f "$f" ] || continue
    STATUS=$(grep -m1 "^\*\*Status\*\*:" "$f" | sed 's/.*: //')
    if [ "$STATUS" = "voting" ] || [ "$STATUS" = "proposed" ] || [ "$STATUS" = "review" ]; then
      RFC_FILES="$RFC_FILES $f"
    fi
  done

  if [ -z "$RFC_FILES" ]; then
    echo "  No pending RFCs found (all decided or rejected)."
    return 0
  fi

  echo "  Pending RFCs:"
  for f in $RFC_FILES; do
    echo "    - $(basename "$f")"
  done
  echo ""

  COUNCIL=(CTO Architect Security Toolsmith DevOps ProductOwner UXDesigner)

  for ROLE in "${COUNCIL[@]}"; do
    PROMPT="Review and vote on pending RFCs:

$(for f in $RFC_FILES; do echo "- $f"; done)

Read each RFC carefully. Use /rfc-vote [number] [approve|reject|abstain] for each.
Consider the Q1 2026 audit findings when voting.

Reply: VOTES CAST when done."

    dispatch_to "$ROLE" "$PROMPT"
  done

  echo ""
  echo "Vote dispatch complete. Monitor with:"
  echo "  grep -h 'Vote:' $RFC_DIR/*.md"
}

# --tasks: Dispatch action items from audit
dispatch_tasks() {
  echo "Dispatching action items from audit..."
  echo ""

  # Toolsmith quick wins (no RFC needed)
  dispatch_to "Toolsmith" "You have skill development tasks from the Q1 audit.

Read $AUDIT_FILE and find the Action Items table.

Build the skills assigned to Toolsmith (no RFC required):
1. /status - Project health dashboard showing terminal states, queue depth, recent completions
2. /queue - Task queue management (add/remove/list items in .terminal-status.json)
3. /review-queue - Show items pending review with age
4. /wireframe-fix [svg] - Auto-load feature context and issues for targeted fixes
5. /viewer-status - Health check for wireframe viewer

Start with /status since it's most requested by multiple roles.
Create each skill in .claude/commands/, test it, commit with descriptive message.

IMPORTANT: Write your progress/findings to docs/interoffice/audits/$(date +%Y-%m-%d)-toolsmith-skills.md

Reply: SKILL COMPLETE [name] after each one."

  # DevOps CI/CD work
  dispatch_to "DevOps" "You have infrastructure tasks from the Q1 audit.

Read $AUDIT_FILE and find items assigned to DevOps.

Priority items:
1. Add pre-commit hooks for linting/type-checking
2. Set up GitHub Actions for PR validation
3. Configure Docker health checks

Start with pre-commit hooks (most impact on code quality).

IMPORTANT: Write your progress/findings to docs/interoffice/audits/$(date +%Y-%m-%d)-devops-infrastructure.md

Reply: TASK COMPLETE [item] after each."

  # Security scanning
  dispatch_to "Security" "You have security tasks from the Q1 audit.

Read $AUDIT_FILE and find items assigned to Security.

Priority items:
1. Create /security-audit skill with OWASP checklist
2. Create /secrets-scan skill for detecting exposed credentials
3. Review auth flows in feature specs

Start with /security-audit skill.

IMPORTANT: Write your progress/findings to docs/interoffice/audits/$(date +%Y-%m-%d)-security-review.md

Reply: TASK COMPLETE [item] after each."

  echo ""
  echo "Task dispatch complete. Monitor progress in terminal windows."
}

# --queue: Process items from .terminal-status.json
dispatch_queue() {
  echo "Processing queue from $STATUS_FILE..."
  echo ""

  if [ ! -f "$PROJECT_DIR/$STATUS_FILE" ]; then
    echo "  Status file not found: $STATUS_FILE"
    return 1
  fi

  # Check for jq
  if ! command -v jq &> /dev/null; then
    echo "  Error: jq is required for queue processing."
    echo "  Install with: sudo apt install jq"
    return 1
  fi

  # Parse and dispatch queue items
  QUEUE_COUNT=$(jq '.queue | length' "$PROJECT_DIR/$STATUS_FILE")

  if [ "$QUEUE_COUNT" -eq 0 ]; then
    echo "  Queue is empty."
    return 0
  fi

  echo "  Found $QUEUE_COUNT queue items:"

  jq -r '.queue[] | "    - \(.assignedTo): \(.action) \(.feature)"' "$PROJECT_DIR/$STATUS_FILE"
  echo ""

  jq -r '.queue[] | "\(.assignedTo)|\(.action)|\(.feature)|\(.reason)"' "$PROJECT_DIR/$STATUS_FILE" | \
  while IFS='|' read -r ROLE ACTION FEATURE REASON; do
    # Normalize role name (lowercase to match window names)
    ROLE_NORMALIZED=$(echo "$ROLE" | sed 's/.*/\u&/')

    PROMPT="Queue item assigned to you:

Feature: $FEATURE
Action: $ACTION
Reason: $REASON

Process this item according to your role's workflow.
When complete, reply: QUEUE ITEM COMPLETE"

    dispatch_to "$ROLE_NORMALIZED" "$PROMPT"
  done

  echo ""
  echo "Queue dispatch complete."
}

# --status: Show current state
show_status() {
  echo "Dispatcher Status"
  echo "================="
  echo ""

  check_session

  echo "Session: $SESSION"
  echo "Windows: $(tmux list-windows -t $SESSION | wc -l)"
  echo ""

  if [ -f "$PROJECT_DIR/$STATUS_FILE" ]; then
    echo "Queue depth: $(jq '.queue | length' "$PROJECT_DIR/$STATUS_FILE" 2>/dev/null || echo "N/A")"
    echo "Completed today: $(jq '.completedToday | length' "$PROJECT_DIR/$STATUS_FILE" 2>/dev/null || echo "N/A")"
  else
    echo "Status file: Not found"
  fi

  echo ""
  echo "RFC status:"
  if [ -d "$PROJECT_DIR/docs/interoffice/rfcs" ]; then
    for f in "$PROJECT_DIR"/docs/interoffice/rfcs/RFC-*.md; do
      if [ -f "$f" ]; then
        STATUS=$(grep -m1 "^\*\*Status\*\*:" "$f" | sed 's/.*: //')
        echo "  $(basename "$f"): $STATUS"
      fi
    done
  else
    echo "  No RFCs found"
  fi
}

# Main
case "${1:-}" in
  --vote)
    check_session
    dispatch_votes
    ;;
  --tasks)
    check_session
    dispatch_tasks
    ;;
  --queue)
    check_session
    dispatch_queue
    ;;
  --all)
    check_session
    dispatch_votes
    echo ""
    dispatch_tasks
    echo ""
    dispatch_queue
    ;;
  --status)
    show_status
    ;;
  *)
    echo "Usage: $0 [--vote|--tasks|--queue|--all|--status]"
    echo ""
    echo "Dispatches work to running scripthammer tmux terminals."
    echo ""
    echo "Commands:"
    echo "  --vote    Dispatch RFC votes to council (7 terminals)"
    echo "  --tasks   Dispatch audit action items to assigned owners"
    echo "  --queue   Process items from .terminal-status.json"
    echo "  --all     Run all dispatchers in sequence"
    echo "  --status  Show current dispatcher state"
    echo ""
    echo "Examples:"
    echo "  $0 --vote          # Get council to vote on pending RFCs"
    echo "  $0 --tasks         # Send audit action items to Toolsmith, DevOps, Security"
    echo "  $0 --queue         # Process wireframe review queue"
    echo "  $0 --all           # Do everything"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run ./scripts/tmux-session.sh --all first"
    echo "  2. Wait for terminals to initialize (~5s)"
    echo "  3. Then run this dispatcher"
    ;;
esac
