#!/bin/bash
# ScriptHammer tmux session launcher
# Usage: ./tmux-session.sh [--all|--council|--wireframe|--implement|--coord|ROLE...]

SESSION="scripthammer"
PROJECT_DIR="$HOME/repos/000_Mega_Plates/ScriptHammer"

# Role definitions with primers
declare -A PRIMERS=(
  ["CTO"]="You are the CTO terminal.
/prep cto

Skills: Strategic oversight, technology decisions, cross-cutting concerns
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["Architect"]="You are the Architect terminal.
/prep architect

Skills: /speckit.plan, architectural reviews, dependency management
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["Coordinator"]="You are the Coordinator terminal.
/prep coordinator

Skills: /wireframe-status, /commit, /ship"
  ["Security"]="You are the Security Lead terminal.
/prep security

Skills: Security audits, OWASP compliance, vulnerability scanning
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["Toolsmith"]="You are the Toolsmith terminal.
/prep toolsmith

Skills: Edit skill files in ~/.claude/commands/ and .claude/commands/
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["DevOps"]="You are the DevOps terminal.
/prep devops

Skills: Docker configs, GitHub Actions, deployment pipelines
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["ProductOwner"]="You are the Product Owner terminal.
/prep product-owner

Skills: User story validation, acceptance criteria, UX consistency
Council: /rfc, /rfc-vote, /council, /broadcast"
  ["Planner"]="You are the Planner terminal.
/prep planner

Skills: /wireframe-plan [feature]"
  ["Generator1"]="You are the Generator-1 terminal.
/prep generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["Generator2"]="You are the Generator-2 terminal.
/prep generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["Generator3"]="You are the Generator-3 terminal.
/prep generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["Viewer"]="You are the Viewer terminal.
/prep viewer

Skills: /hot-reload-viewer"
  ["Reviewer"]="You are the Reviewer terminal.
/prep reviewer

Skills: /wireframe-screenshots, /wireframe-review"
  ["Validator"]="You are the Validator terminal.
/prep validator

Skills: python3 docs/design/wireframes/validate-wireframe.py --check-escalation"
  ["Inspector"]="You are the Inspector terminal.
/prep inspector

Skills: /wireframe-inspect, python3 docs/design/wireframes/inspect-wireframes.py"
  ["Author"]="You are the Author terminal.
/prep author

Skills: /session-summary, /changelog"
  ["Tester"]="You are the Tester terminal.
/prep tester

Skills: /test, /test-components, /test-a11y, /test-hooks"
  ["Implementer"]="You are the Implementer terminal.
/prep implementer

Skills: /speckit.implement, /speckit.tasks"
  ["Auditor"]="You are the Auditor terminal.
/prep auditor

Skills: /speckit.analyze, /read-spec"
)

# Role groups
COUNCIL=(CTO Architect Security Toolsmith DevOps ProductOwner)
WIREFRAME=(Planner Generator1 Generator2 Generator3 Viewer Reviewer Validator Inspector)
IMPLEMENT=(Implementer Tester Auditor)
COORD=(Coordinator CTO)
ALL=(CTO Architect Coordinator Security Toolsmith DevOps ProductOwner Planner Generator1 Generator2 Generator3 Viewer Reviewer Validator Inspector Author Tester Implementer Auditor)

# Parse arguments
ROLES=()
case "${1:-}" in
  --all)      ROLES=("${ALL[@]}") ;;
  --council)  ROLES=("${COUNCIL[@]}") ;;
  --wireframe) ROLES=("${WIREFRAME[@]}") ;;
  --implement) ROLES=("${IMPLEMENT[@]}") ;;
  --coord)    ROLES=("${COORD[@]}") ;;
  "")
    echo "Usage: $0 [--all|--council|--wireframe|--implement|--coord|ROLE...]"
    echo ""
    echo "Groups:"
    echo "  --all        All 19 terminals (quarterly audit)"
    echo "  --council    CTO, Architect, Security, Toolsmith, DevOps, ProductOwner"
    echo "  --wireframe  Planner, Generators, Viewer, Reviewer, Validator, Inspector"
    echo "  --implement  Implementer, Tester, Auditor"
    echo "  --coord      Coordinator, CTO"
    echo ""
    echo "Individual roles: CTO, Architect, Coordinator, Security, Toolsmith, DevOps,"
    echo "  ProductOwner, Planner, Generator1, Generator2, Generator3, Viewer,"
    echo "  Reviewer, Validator, Inspector, Author, Tester, Implementer, Auditor"
    exit 0
    ;;
  *)          ROLES=("$@") ;;
esac

# Kill existing session
tmux kill-session -t $SESSION 2>/dev/null

# Create session with first role
FIRST="${ROLES[0]}"
tmux new-session -d -s $SESSION -n "$FIRST" -c "$PROJECT_DIR"

# Create remaining windows
for ROLE in "${ROLES[@]:1}"; do
  tmux new-window -t $SESSION -n "$ROLE" -c "$PROJECT_DIR"
done

# Launch claude and send primer in each window
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  PRIMER="${PRIMERS[$ROLE]}"
  if [ -n "$PRIMER" ]; then
    # Start claude
    tmux send-keys -t $SESSION:$WINDOW_NUM "claude" Enter
    sleep 0.5
    # Send primer (escape special chars, use heredoc approach)
    tmux send-keys -t $SESSION:$WINDOW_NUM "$PRIMER" Enter
  fi
  ((WINDOW_NUM++))
done

# Select first window and attach
tmux select-window -t $SESSION:0
echo "Session '$SESSION' created with ${#ROLES[@]} terminals."
echo "Attaching... (use Ctrl+b d to detach)"
sleep 1
tmux attach -t $SESSION
