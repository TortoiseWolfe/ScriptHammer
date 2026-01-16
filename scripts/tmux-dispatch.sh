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
PRECOMPUTE_SCRIPT="$PROJECT_DIR/scripts/dispatch-precompute.py"
PRECOMPUTE_CACHE="/tmp/dispatch-precompute-$(date +%Y-%m-%d).json"
USE_PRECOMPUTE=true

# Lookup window by role name (not hardcoded numbers)
# Windows are named after roles - find them dynamically
get_window_by_name() {
  local ROLE="$1"
  tmux list-windows -t $SESSION -F "#{window_index}:#{window_name}" 2>/dev/null | \
    grep ":${ROLE}$" | cut -d: -f1
}

# Check if session exists
check_session() {
  if ! tmux has-session -t $SESSION 2>/dev/null; then
    echo "Error: tmux session '$SESSION' not found."
    echo "Run './scripts/tmux-session.sh --all' first."
    exit 1
  fi
}

# Precompute task assignments (reduces ~500 token prompts to ~50 tokens)
precompute_tasks() {
  local DATE="${1:-$(date +%Y-%m-%d)}"

  if [ "$USE_PRECOMPUTE" != "true" ]; then
    return 1
  fi

  if [ ! -f "$PRECOMPUTE_SCRIPT" ]; then
    echo "  [WARN] Precompute script not found: $PRECOMPUTE_SCRIPT"
    return 1
  fi

  echo "  Pre-computing task assignments for $DATE..."
  python3 "$PRECOMPUTE_SCRIPT" audit "$DATE" --json > "$PRECOMPUTE_CACHE" 2>/dev/null

  if [ $? -ne 0 ] || [ ! -s "$PRECOMPUTE_CACHE" ]; then
    echo "  [WARN] Precompute failed, falling back to verbose prompts"
    rm -f "$PRECOMPUTE_CACHE"
    return 1
  fi

  echo "  [OK] Task assignments cached to $PRECOMPUTE_CACHE"
  return 0
}

# Get tasks for a specific role from precomputed cache
get_precomputed_tasks() {
  local ROLE="$1"
  local ROLE_LOWER=$(echo "$ROLE" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')

  if [ ! -f "$PRECOMPUTE_CACHE" ]; then
    return 1
  fi

  # Extract tasks for this role from the JSON cache
  python3 "$PRECOMPUTE_SCRIPT" for "$ROLE_LOWER" --json 2>/dev/null
}

# Build minimal prompt from precomputed tasks (reduces ~500 to ~50 tokens)
build_minimal_prompt() {
  local ROLE="$1"
  local TASKS_JSON=$(get_precomputed_tasks "$ROLE")

  if [ -z "$TASKS_JSON" ] || [ "$TASKS_JSON" = "[]" ]; then
    echo ""
    return
  fi

  # Count tasks
  local TASK_COUNT=$(echo "$TASKS_JSON" | jq length 2>/dev/null || echo "0")

  if [ "$TASK_COUNT" -eq 0 ]; then
    echo ""
    return
  fi

  # Build minimal prompt - just the task descriptions
  local TASK_LIST=$(echo "$TASKS_JSON" | jq -r '.[].description' 2>/dev/null | head -5)

  echo "You have $TASK_COUNT pending task(s):

$TASK_LIST

Reply DONE when complete."
}

# Dispatch precomputed task to a role (minimal token usage)
dispatch_precomputed() {
  local ROLE="$1"
  local MINIMAL_PROMPT=$(build_minimal_prompt "$ROLE")

  if [ -z "$MINIMAL_PROMPT" ]; then
    echo "  [$ROLE] No tasks assigned"
    return 0
  fi

  dispatch_to "$ROLE" "$MINIMAL_PROMPT"
}

# Dispatch a task to a specific role's terminal (by name, not number)
dispatch_to() {
  local ROLE="$1"
  local TASK="$2"
  local WIN=$(get_window_by_name "$ROLE")

  if [ -z "$WIN" ]; then
    echo "  [ERROR] Window not found for role: $ROLE (is it running?)"
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

  # Council members (per .claude/roles/council.md)
  COUNCIL=(CTO ProductOwner Architect UXDesigner Toolsmith Security DevOps)

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

# --precomputed: Dispatch using precomputed task assignments (minimal tokens)
dispatch_precomputed_all() {
  echo "Dispatching using precomputed task assignments..."
  echo ""

  # Precompute once for all terminals
  if ! precompute_tasks; then
    echo "  [ERROR] Precompute failed. Use --tasks for verbose fallback."
    return 1
  fi

  echo ""

  # All terminal roles that can receive tasks
  TERMINALS=(
    "CTO" "ProductOwner" "Architect" "UXDesigner" "Toolsmith" "Security" "DevOps"
    "Planner" "Generator-1" "Generator-2" "Generator-3"
    "Validator" "Inspector" "WireframeQA"
    "Developer" "TestEngineer" "QALead" "Auditor"
    "Author" "TechWriter" "Coordinator"
  )

  local DISPATCHED=0
  for ROLE in "${TERMINALS[@]}"; do
    dispatch_precomputed "$ROLE" && ((DISPATCHED++))
  done

  echo ""
  echo "Precomputed dispatch complete. Sent to $DISPATCHED terminals."
  echo "Token savings: ~$(( (500 - 50) * DISPATCHED )) tokens vs verbose dispatch"
}

# Main
# Handle --no-precompute flag
for arg in "$@"; do
  if [ "$arg" = "--no-precompute" ]; then
    USE_PRECOMPUTE=false
    echo "[INFO] Precompute disabled, using verbose prompts"
  fi
done

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
  --precomputed)
    check_session
    dispatch_precomputed_all
    ;;
  --all)
    check_session
    # Use precomputed if available, fall back to verbose
    if [ "$USE_PRECOMPUTE" = "true" ] && precompute_tasks; then
      echo ""
      dispatch_precomputed_all
    else
      dispatch_votes
      echo ""
      dispatch_tasks
    fi
    echo ""
    dispatch_queue
    ;;
  --status)
    show_status
    ;;
  *)
    echo "Usage: $0 [--vote|--tasks|--queue|--precomputed|--all|--status] [--no-precompute]"
    echo ""
    echo "Dispatches work to running scripthammer tmux terminals."
    echo ""
    echo "Commands:"
    echo "  --vote        Dispatch RFC votes to council (7 terminals)"
    echo "  --tasks       Dispatch audit action items to assigned owners (verbose)"
    echo "  --queue       Process items from .terminal-status.json"
    echo "  --precomputed Dispatch using pre-computed task assignments (minimal tokens)"
    echo "  --all         Run all dispatchers (prefers precomputed if available)"
    echo "  --status      Show current dispatcher state"
    echo ""
    echo "Flags:"
    echo "  --no-precompute  Disable precomputation, use verbose prompts"
    echo ""
    echo "Examples:"
    echo "  $0 --precomputed          # Efficient dispatch (~50 tokens per terminal)"
    echo "  $0 --tasks                # Verbose dispatch (~500 tokens per terminal)"
    echo "  $0 --all                  # Auto-select best method"
    echo "  $0 --all --no-precompute  # Force verbose dispatch"
    echo ""
    echo "Token Savings:"
    echo "  Precomputed mode reduces dispatch from ~500 to ~50 tokens per terminal."
    echo "  For 26 terminals, that's ~11,700 tokens saved per dispatch cycle."
    echo ""
    echo "Prerequisites:"
    echo "  1. Run ./scripts/tmux-session.sh --all first"
    echo "  2. Wait for terminals to initialize (~5s)"
    echo "  3. Then run this dispatcher"
    ;;
esac
