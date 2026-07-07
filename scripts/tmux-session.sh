#!/bin/bash
# ScriptHammer tmux session launcher
# Usage: ./tmux-session.sh [--all|--council|--wireframe|--implement|--coord|ROLE...] [--audit]

SESSION="scripthammer"
# Derive project dir from script location (scripts/ is one level down from root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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
COLOR_DESIGN="colour183"     # Pale Lavender #d7afff
COLOR_SUPPORT="colour254"    # Pale Gray #e4e4e4
COLOR_BASE="colour236"       # Dark gray (status bar bg)

# Role definitions - just the /prime command (loads all context needed)
declare -A PRIMERS=(
  ["CTO"]="/prime cto"
  ["Architect"]="/prime architect"
  ["Coordinator"]="/prime coordinator"
  ["Security"]="/prime security"
  ["Toolsmith"]="/prime toolsmith"
  ["DevOps"]="/prime devops"
  ["ProductOwner"]="/prime product-owner"
  ["Planner"]="/prime planner"
  ["WireframeGenerator1"]="/prime wireframe-generator"
  ["WireframeGenerator2"]="/prime wireframe-generator"
  ["WireframeGenerator3"]="/prime wireframe-generator"
  ["PreviewHost"]="/prime preview-host"
  ["WireframeQA"]="/prime wireframe-qa"
  ["Validator"]="/prime validator"
  ["Inspector"]="/prime inspector"
  ["Author"]="/prime author"
  ["TestEngineer"]="/prime test-engineer"
  ["Developer"]="/prime developer"
  ["Auditor"]="/prime auditor"
  ["QALead"]="/prime qa-lead"
  ["TechWriter"]="/prime tech-writer"
  ["DockerCaptain"]="/prime docker-captain"
  ["UXDesigner"]="/prime ux-designer"
  ["UIDesigner"]="/prime ui-designer"
  ["BusinessAnalyst"]="/prime business-analyst"
  ["ReleaseManager"]="/prime release-manager"
)

# Role groups
# ASSEMBLY LINE ORDER: Strategy → Requirements → Design → Wireframes → Code → Test → Docs → Release
COUNCIL=(CTO ProductOwner Architect UXDesigner Toolsmith Security DevOps)
WIREFRAME=(Planner WireframeGenerator1 WireframeGenerator2 WireframeGenerator3 PreviewHost WireframeQA Validator Inspector)
IMPLEMENT=(Developer Toolsmith Security TestEngineer QALead Auditor)
DESIGN=(UXDesigner UIDesigner)
SUPPORT=(Author TechWriter Coordinator)
COORD=(Coordinator CTO)
RELEASE=(DevOps DockerCaptain ReleaseManager)
QC=(PreviewHost WireframeQA Validator Inspector Auditor)
# ALL follows assembly line: Strategy(0-2) → Design(3-5) → Wireframes(6-13) → Code(14-16) → Test(17-19) → Docs(20-21) → Release(22-25)
ALL=(CTO ProductOwner BusinessAnalyst Architect UXDesigner UIDesigner Planner WireframeGenerator1 WireframeGenerator2 WireframeGenerator3 PreviewHost WireframeQA Validator Inspector Developer Toolsmith Security TestEngineer QALead Auditor Author TechWriter DevOps DockerCaptain ReleaseManager Coordinator)

# Parse arguments
ROLES=()
case "${1:-}" in
  --all)      ROLES=("${ALL[@]}") ;;
  --council)  ROLES=("${COUNCIL[@]}") ;;
  --wireframe) ROLES=("${WIREFRAME[@]}") ;;
  --implement) ROLES=("${IMPLEMENT[@]}") ;;
  --design)   ROLES=("${DESIGN[@]}") ;;
  --support)  ROLES=("${SUPPORT[@]}") ;;
  --coord)    ROLES=("${COORD[@]}") ;;
  --qc)       ROLES=("${QC[@]}") ;;
  "")
    echo "Usage: $0 [--all|--council|--wireframe|--implement|--design|--support|--coord|--qc|ROLE...] [--audit]"
    echo ""
    echo "Groups:"
    echo "  --all        All 26 terminals"
    echo "  --council    CTO, Architect, Security, Toolsmith, DevOps, ProductOwner, UXDesigner"
    echo "  --wireframe  Planner, WireframeGenerators, PreviewHost, WireframeQA, Validator, Inspector"
    echo "  --implement  Developer, TestEngineer, Auditor, ReleaseManager"
    echo "  --design     UIDesigner"
    echo "  --support    Coordinator, Author, QALead, TechWriter, BusinessAnalyst"
    echo "  --coord      Coordinator, CTO"
    echo "  --qc         PreviewHost, WireframeQA, Validator, Inspector, Auditor"
    echo ""
    echo "Options:"
    echo "  --audit      Broadcast 7-question survey to all terminals after launch"
    echo ""
    echo "Individual roles: CTO, Architect, Coordinator, Security, Toolsmith, DevOps,"
    echo "  ProductOwner, UXDesigner, Planner, WireframeGenerator1, WireframeGenerator2,"
    echo "  WireframeGenerator3, PreviewHost, WireframeQA, Validator, Inspector, Author,"
    echo "  TestEngineer, Developer, Auditor, QALead, TechWriter, DockerCaptain, UIDesigner,"
    echo "  BusinessAnalyst, ReleaseManager"
    echo ""
    echo "Note: Operator runs OUTSIDE tmux. Use 'claude' then '/prime operator'."
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
tmux set-hook -t $SESSION session-window-changed "run-shell '$SCRIPT_DIR/tmux-role-color.sh'"

# Window list - ALL windows show group color as BACKGROUND (consistent)
# Current window: ">" prefix, Non-current: space prefix
# All use black text on pastel backgrounds for readability
tmux set-option -t $SESSION window-status-current-format "#{?#{||:#{m:CTO,#W},#{||:#{m:Architect,#W},#{||:#{m:Security,#W},#{||:#{m:Toolsmith,#W},#{||:#{m:DevOps,#W},#{||:#{m:ProductOwner,#W},#{m:UXDesigner,#W}}}}}}},#[bg=$COLOR_COUNCIL],#{?#{||:#{m:Planner,#W},#{||:#{m:WireframeGenerator*,#W},#{||:#{m:PreviewHost,#W},#{||:#{m:WireframeQA,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}}}},#[bg=$COLOR_WIREFRAME],#{?#{||:#{m:Developer,#W},#{||:#{m:TestEngineer,#W},#{||:#{m:Auditor,#W},#{m:ReleaseManager,#W}}}},#[bg=$COLOR_IMPLEMENT],#{?#{m:UIDesigner,#W},#[bg=$COLOR_DESIGN],#[bg=$COLOR_SUPPORT]}}}}#[fg=black,bold]>#W "
tmux set-option -t $SESSION window-status-format "#{?#{||:#{m:CTO,#W},#{||:#{m:Architect,#W},#{||:#{m:Security,#W},#{||:#{m:Toolsmith,#W},#{||:#{m:DevOps,#W},#{||:#{m:ProductOwner,#W},#{m:UXDesigner,#W}}}}}}},#[bg=$COLOR_COUNCIL],#{?#{||:#{m:Planner,#W},#{||:#{m:WireframeGenerator*,#W},#{||:#{m:PreviewHost,#W},#{||:#{m:WireframeQA,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}}}},#[bg=$COLOR_WIREFRAME],#{?#{||:#{m:Developer,#W},#{||:#{m:TestEngineer,#W},#{||:#{m:Auditor,#W},#{m:ReleaseManager,#W}}}},#[bg=$COLOR_IMPLEMENT],#{?#{m:UIDesigner,#W},#[bg=$COLOR_DESIGN],#[bg=$COLOR_SUPPORT]}}}}#[fg=black] #W "
tmux set-option -t $SESSION window-status-separator " "

# Initialize status-right for first window
"$SCRIPT_DIR/tmux-role-color.sh"

# Create remaining windows
for ROLE in "${ROLES[@]:1}"; do
  tmux new-window -t $SESSION -n "$ROLE" -c "$PROJECT_DIR"
done

# Phase 1: Launch claude in ALL windows first
# --dangerously-skip-permissions: bypass ALL permission checks for autonomous operation
# CRITICAL: Multi-terminal automation requires full permission bypass
# Without this, every edit/commit/bash blocks waiting for manual approval
echo "Starting Claude in ${#ROLES[@]} windows..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM "claude --dangerously-skip-permissions" Enter
  ((WINDOW_NUM++))
done

# Phase 2: Wait for Claude to fully initialize in all windows
INIT_DELAY=3
echo "Waiting ${INIT_DELAY}s for Claude to initialize..."
sleep $INIT_DELAY

# Phase 2.5: Auto-accept bypass permissions consent dialog
# The --dangerously-skip-permissions flag shows a one-time consent dialog
# Dialog has "No, exit" selected by default - we send Down+Enter to select "Yes"
echo "Accepting bypass permissions consent..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM Down Enter
  sleep 0.15
  ((WINDOW_NUM++))
done

# Wait for consent to process
sleep 2

# Phase 3: Send /prime commands to all windows
echo "Sending role primers..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  PRIMER="${PRIMERS[$ROLE]}"
  if [ -n "$PRIMER" ]; then
    tmux send-keys -t $SESSION:$WINDOW_NUM "$PRIMER" Enter
    sleep 0.2
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
