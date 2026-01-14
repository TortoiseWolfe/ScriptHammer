#!/bin/bash
# ScriptHammer tmux session launcher
# Usage: ./tmux-session.sh [--all|--council|--wireframe|--implement|--coord|ROLE...] [--audit]

SESSION="scripthammer"
PROJECT_DIR="$HOME/repos/000_Mega_Plates/ScriptHammer"

# Check for --audit flag and filter it out of arguments
AUDIT_MODE=false
FILTERED_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--audit" ]; then
    AUDIT_MODE=true
  else
    FILTERED_ARGS+=("$arg")
  fi
done
set -- "${FILTERED_ARGS[@]}"

# Color palette - PASTEL for max readability with black text
# All colors are very light for colorblind accessibility
COLOR_COUNCIL="colour229"    # Pale Gold #ffffaf
COLOR_WIREFRAME="colour159"  # Pale Cyan #afffff
COLOR_IMPLEMENT="colour225"  # Pale Pink #ffd7ff
COLOR_SUPPORT="colour254"    # Pale Gray #e4e4e4
COLOR_BASE="colour236"       # Dark gray (status bar bg)

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
  ["WireframeGenerator1"]="You are the Wireframe Generator-1 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["WireframeGenerator2"]="You are the Wireframe Generator-2 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["WireframeGenerator3"]="You are the Wireframe Generator-3 terminal.
/prep wireframe-generator

Skills: /wireframe-prep [feature], /wireframe [feature]"
  ["PreviewHost"]="You are the Preview Host terminal.
/prep preview-host

Skills: /hot-reload-viewer"
  ["WireframeQA"]="You are the Wireframe QA terminal.
/prep wireframe-qa

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
  ["TestEngineer"]="You are the Test Engineer terminal.
/prep test-engineer

Skills: /test, /test-components, /test-a11y, /test-hooks"
  ["Developer"]="You are the Developer terminal.
/prep developer

Skills: /speckit.implement, /speckit.tasks"
  ["Auditor"]="You are the Auditor terminal.
/prep auditor

Skills: /speckit.analyze, /read-spec"
  ["QALead"]="You are the QA Lead terminal.
/prep qa-lead

Skills: Process compliance, acceptance criteria verification, UAT coordination
Reports to: Architect"
  ["TechWriter"]="You are the Technical Writer terminal.
/prep tech-writer

Skills: User documentation, API docs, tutorials, developer guides
Reports to: CTO"
)

# Role groups
COUNCIL=(CTO Architect Security Toolsmith DevOps ProductOwner)
WIREFRAME=(Planner WireframeGenerator1 WireframeGenerator2 WireframeGenerator3 PreviewHost WireframeQA Validator Inspector)
IMPLEMENT=(Developer TestEngineer Auditor)
COORD=(Coordinator CTO)
ALL=(CTO Architect Coordinator Security Toolsmith DevOps ProductOwner Planner WireframeGenerator1 WireframeGenerator2 WireframeGenerator3 PreviewHost WireframeQA Validator Inspector Author TestEngineer Developer Auditor QALead TechWriter)

# Parse arguments
ROLES=()
case "${1:-}" in
  --all)      ROLES=("${ALL[@]}") ;;
  --council)  ROLES=("${COUNCIL[@]}") ;;
  --wireframe) ROLES=("${WIREFRAME[@]}") ;;
  --implement) ROLES=("${IMPLEMENT[@]}") ;;
  --coord)    ROLES=("${COORD[@]}") ;;
  "")
    echo "Usage: $0 [--all|--council|--wireframe|--implement|--coord|ROLE...] [--audit]"
    echo ""
    echo "Groups:"
    echo "  --all        All 21 terminals"
    echo "  --council    CTO, Architect, Security, Toolsmith, DevOps, ProductOwner"
    echo "  --wireframe  Planner, WireframeGenerators, PreviewHost, WireframeQA, Validator, Inspector"
    echo "  --implement  Developer, TestEngineer, Auditor"
    echo "  --coord      Coordinator, CTO"
    echo ""
    echo "Options:"
    echo "  --audit      Broadcast 7-question survey to all terminals after launch"
    echo ""
    echo "Individual roles: CTO, Architect, Coordinator, Security, Toolsmith, DevOps,"
    echo "  ProductOwner, Planner, WireframeGenerator1, WireframeGenerator2, WireframeGenerator3,"
    echo "  PreviewHost, WireframeQA, Validator, Inspector, Author, TestEngineer, Developer,"
    echo "  Auditor, QALead, TechWriter"
    echo ""
    echo "Note: Operator runs OUTSIDE tmux. Use 'claude' then '/prep operator'."
    exit 0
    ;;
  *)          ROLES=("$@") ;;
esac

# Kill existing session
tmux kill-session -t $SESSION 2>/dev/null

# Create session with first role
FIRST="${ROLES[0]}"
tmux new-session -d -s $SESSION -n "$FIRST" -c "$PROJECT_DIR"

# Status bar base styling
tmux set-option -t $SESSION status-style "bg=$COLOR_BASE,fg=white"
tmux set-option -t $SESSION status-left "#[bg=colour27,fg=white,bold] #S #[default]"
tmux set-option -t $SESSION status-left-length 20
tmux set-option -t $SESSION status-right-length 45

# Dynamic status-right via hook (updates on window change)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
tmux set-hook -t $SESSION session-window-changed "run-shell '$SCRIPT_DIR/tmux-role-color.sh'"

# Window list - ALL windows show group color as BACKGROUND (consistent)
# Current window: ">" prefix, Non-current: space prefix
# All use black text on pastel backgrounds for readability
tmux set-option -t $SESSION window-status-current-format "#{?#{||:#{m:CTO,#W},#{||:#{m:Architect,#W},#{||:#{m:Security,#W},#{||:#{m:Toolsmith,#W},#{||:#{m:DevOps,#W},#{m:ProductOwner,#W}}}}}},#[bg=$COLOR_COUNCIL],#{?#{||:#{m:Planner,#W},#{||:#{m:WireframeGenerator*,#W},#{||:#{m:PreviewHost,#W},#{||:#{m:WireframeQA,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}}}},#[bg=$COLOR_WIREFRAME],#{?#{||:#{m:Developer,#W},#{||:#{m:TestEngineer,#W},#{m:Auditor,#W}}},#[bg=$COLOR_IMPLEMENT],#[bg=$COLOR_SUPPORT]}}}#[fg=black,bold]>#W "
tmux set-option -t $SESSION window-status-format "#{?#{||:#{m:CTO,#W},#{||:#{m:Architect,#W},#{||:#{m:Security,#W},#{||:#{m:Toolsmith,#W},#{||:#{m:DevOps,#W},#{m:ProductOwner,#W}}}}}},#[bg=$COLOR_COUNCIL],#{?#{||:#{m:Planner,#W},#{||:#{m:WireframeGenerator*,#W},#{||:#{m:PreviewHost,#W},#{||:#{m:WireframeQA,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}}}},#[bg=$COLOR_WIREFRAME],#{?#{||:#{m:Developer,#W},#{||:#{m:TestEngineer,#W},#{m:Auditor,#W}}},#[bg=$COLOR_IMPLEMENT],#[bg=$COLOR_SUPPORT]}}}#[fg=black] #W "
tmux set-option -t $SESSION window-status-separator " "

# Initialize status-right for first window
"$SCRIPT_DIR/tmux-role-color.sh"

# Create remaining windows
for ROLE in "${ROLES[@]:1}"; do
  tmux new-window -t $SESSION -n "$ROLE" -c "$PROJECT_DIR"
done

# Phase 1: Launch claude in ALL windows first
# --permission-mode acceptEdits: auto-accept file edits without prompting
echo "Starting Claude in ${#ROLES[@]} windows..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM "claude --permission-mode acceptEdits" Enter
  ((WINDOW_NUM++))
done

# Phase 2: Wait for Claude to fully initialize in all windows
INIT_DELAY=2
echo "Waiting ${INIT_DELAY}s for Claude to initialize..."
sleep $INIT_DELAY

# Phase 3: Send primers to all windows
echo "Sending role primers..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  PRIMER="${PRIMERS[$ROLE]}"
  if [ -n "$PRIMER" ]; then
    # Send primer text and Enter to submit
    tmux send-keys -t $SESSION:$WINDOW_NUM "$PRIMER" Enter
    # Small delay then extra Enter to ensure submission
    sleep 0.3
    tmux send-keys -t $SESSION:$WINDOW_NUM "" Enter
  fi
  ((WINDOW_NUM++))
done

# Select first window
tmux select-window -t $SESSION:0
echo "Session '$SESSION' created with ${#ROLES[@]} terminals."

# Run audit if --audit flag was passed
if [ "$AUDIT_MODE" = true ]; then
  echo "Running audit broadcast in 3 seconds..."
  sleep 3
  "$SCRIPT_DIR/tmux-audit.sh"
fi

echo "Attaching... (use Ctrl+b d to detach)"
sleep 1
tmux attach -t $SESSION
