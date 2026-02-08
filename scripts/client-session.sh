#!/bin/bash
# Client tmux session launcher
# Usage: ./client-session.sh --client <code> [--all|--design|--wireframe|ROLE...]
#
# Example:
#   ./client-session.sh --client stw --all       # Launch all StW terminals
#   ./client-session.sh --client stw --wireframe # Launch wireframe pipeline only

# Derive project dir from script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse --client flag first
CLIENT=""
FILTERED_ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --client)
      CLIENT="$2"
      shift 2
      ;;
    *)
      FILTERED_ARGS+=("$1")
      shift
      ;;
  esac
done
set -- "${FILTERED_ARGS[@]}"

# Validate client
if [ -z "$CLIENT" ]; then
  echo "Error: --client <code> is required"
  echo ""
  echo "Usage: $0 --client <code> [--all|--design|--wireframe|ROLE...]"
  echo ""
  echo "Clients:"
  echo "  stw    SpokeToWork"
  echo ""
  echo "Groups:"
  echo "  --all        All client terminals"
  echo "  --design     UIDesigner, UXDesigner"
  echo "  --wireframe  Planner, Generators, Validator, Inspector"
  echo ""
  echo "Example:"
  echo "  $0 --client stw --all"
  exit 1
fi

SESSION="$CLIENT"

# Color palette - match ScriptHammer but slightly different for distinction
COLOR_DESIGN="colour183"     # Pale Lavender #d7afff
COLOR_WIREFRAME="colour159"  # Pale Cyan #afffff
COLOR_SUPPORT="colour254"    # Pale Gray #e4e4e4
COLOR_BASE="colour239"       # Darker gray (distinguishes from scripthammer)

# Role definitions - just the /prime command
declare -A PRIMERS=(
  ["Planner"]="/prime planner"
  ["Generator1"]="/prime wireframe-generator"
  ["Generator2"]="/prime wireframe-generator"
  ["Generator3"]="/prime wireframe-generator"
  ["Validator"]="/prime validator"
  ["Inspector"]="/prime inspector"
  ["UIDesigner"]="/prime ui-designer"
  ["UXDesigner"]="/prime ux-designer"
  ["Coordinator"]="/prime coordinator"
)

# Role groups (smaller set for client work)
DESIGN=(UIDesigner UXDesigner)
WIREFRAME=(Planner Generator1 Generator2 Generator3 Validator Inspector)
ALL=(UIDesigner UXDesigner Planner Generator1 Generator2 Generator3 Validator Inspector Coordinator)

# Parse arguments
ROLES=()
case "${1:-}" in
  --all)       ROLES=("${ALL[@]}") ;;
  --design)    ROLES=("${DESIGN[@]}") ;;
  --wireframe) ROLES=("${WIREFRAME[@]}") ;;
  "")
    echo "Usage: $0 --client <code> [--all|--design|--wireframe|ROLE...]"
    echo ""
    echo "Client: $CLIENT"
    echo ""
    echo "Groups:"
    echo "  --all        All ${#ALL[@]} terminals"
    echo "  --design     UIDesigner, UXDesigner"
    echo "  --wireframe  Planner, Generators, Validator, Inspector"
    echo ""
    echo "Individual roles: ${ALL[*]}"
    exit 0
    ;;
  *)           ROLES=("$@") ;;
esac

# Get client-specific working directory
case "$CLIENT" in
  stw)
    # SpokeToWork repos are siblings to ScriptHammer
    CLIENT_DIR="$(dirname "$PROJECT_DIR")/SpokeToWork-MVP"
    if [ ! -d "$CLIENT_DIR" ]; then
      echo "Warning: $CLIENT_DIR not found, using ScriptHammer dir"
      CLIENT_DIR="$PROJECT_DIR"
    fi
    ;;
  *)
    CLIENT_DIR="$PROJECT_DIR"
    ;;
esac

# Kill existing session
tmux kill-session -t $SESSION 2>/dev/null

# Create session with first role
FIRST="${ROLES[0]}"
tmux new-session -d -s $SESSION -n "$FIRST" -c "$CLIENT_DIR"

# Status bar styling (slightly different from scripthammer for visual distinction)
tmux set-option -t $SESSION status-style "bg=$COLOR_BASE,fg=white"
tmux set-option -t $SESSION status-left "#[bg=colour166,fg=white,bold] $SESSION #[default]"
tmux set-option -t $SESSION status-left-length 15
tmux set-option -t $SESSION status-right "#[fg=colour166]Client: ${CLIENT^^}#[default]"
tmux set-option -t $SESSION status-right-length 30

# Window list styling
tmux set-option -t $SESSION window-status-current-format "#{?#{||:#{m:UIDesigner,#W},#{m:UXDesigner,#W}},#[bg=$COLOR_DESIGN],#{?#{||:#{m:Planner,#W},#{||:#{m:Generator*,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}},#[bg=$COLOR_WIREFRAME],#[bg=$COLOR_SUPPORT]}}#[fg=black,bold]>#W "
tmux set-option -t $SESSION window-status-format "#{?#{||:#{m:UIDesigner,#W},#{m:UXDesigner,#W}},#[bg=$COLOR_DESIGN],#{?#{||:#{m:Planner,#W},#{||:#{m:Generator*,#W},#{||:#{m:Validator,#W},#{m:Inspector,#W}}}},#[bg=$COLOR_WIREFRAME],#[bg=$COLOR_SUPPORT]}}#[fg=black] #W "
tmux set-option -t $SESSION window-status-separator " "

# Create remaining windows
for ROLE in "${ROLES[@]:1}"; do
  tmux new-window -t $SESSION -n "$ROLE" -c "$CLIENT_DIR"
done

# Phase 1: Launch claude in ALL windows first
echo "Starting Claude in ${#ROLES[@]} windows for $SESSION..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM "claude --dangerously-skip-permissions" Enter
  ((WINDOW_NUM++))
done

# Phase 2: Wait for Claude to initialize
INIT_DELAY=3
echo "Waiting ${INIT_DELAY}s for Claude to initialize..."
sleep $INIT_DELAY

# Phase 2.5: Auto-accept bypass permissions consent
echo "Accepting bypass permissions consent..."
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM Down Enter
  sleep 0.15
  ((WINDOW_NUM++))
done

sleep 2

# Phase 3: Send /prime commands
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
echo "Client: ${CLIENT^^}"
echo "Working dir: $CLIENT_DIR"
echo ""
echo "Attaching... (use Ctrl+b d to detach)"
sleep 1
tmux attach -t $SESSION
