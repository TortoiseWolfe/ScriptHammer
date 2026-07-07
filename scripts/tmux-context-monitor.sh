#!/bin/bash
# Context window monitor for scripthammer multi-terminal workflow
# Usage: ./tmux-context-monitor.sh [--clear ROLE]
#
# Scans all 21 tmux windows and reports context usage from Claude Code's
# prompt line ("X% free"). Identifies terminals that need /clear + re-priming.

SESSION="scripthammer"
PROJECT_DIR="$HOME/repos/000_Mega_Plates/ScriptHammer"
WARNING_THRESHOLD=20   # Yellow: 20% or less free
CRITICAL_THRESHOLD=10  # Red: 10% or less free

# Role to window mapping (must match tmux-session.sh)
declare -A WINDOWS=(
  ["CTO"]=0 ["Architect"]=1 ["Coordinator"]=2 ["Security"]=3
  ["Toolsmith"]=4 ["DevOps"]=5 ["ProductOwner"]=6 ["Planner"]=7
  ["WireframeGenerator1"]=8 ["WireframeGenerator2"]=9 ["WireframeGenerator3"]=10
  ["PreviewHost"]=11 ["WireframeQA"]=12 ["Validator"]=13 ["Inspector"]=14
  ["Author"]=15 ["TestEngineer"]=16 ["Developer"]=17 ["Auditor"]=18
  ["QALead"]=19 ["TechWriter"]=20
)

# Minimal primers for context recovery (different from tmux-session.sh verbose primers)
# These are designed to preserve recovered context by requesting minimal response
declare -A PRIMERS=(
  ["CTO"]="You are the CTO terminal.
/prime cto
Respond only: Ready."
  ["Architect"]="You are the Architect terminal.
/prime architect
Respond only: Ready."
  ["Coordinator"]="You are the Coordinator terminal.
/prime coordinator
Respond only: Ready."
  ["Security"]="You are the Security Lead terminal.
/prime security
Respond only: Ready."
  ["Toolsmith"]="You are the Toolsmith terminal.
/prime toolsmith
Respond only: Ready."
  ["DevOps"]="You are the DevOps terminal.
/prime devops
Respond only: Ready."
  ["ProductOwner"]="You are the Product Owner terminal.
/prime product-owner
Respond only: Ready."
  ["Planner"]="You are the Planner terminal.
/prime planner
Respond only: Ready."
  ["WireframeGenerator1"]="You are the Wireframe Generator-1 terminal.
/prime wireframe-generator
Respond only: Ready."
  ["WireframeGenerator2"]="You are the Wireframe Generator-2 terminal.
/prime wireframe-generator
Respond only: Ready."
  ["WireframeGenerator3"]="You are the Wireframe Generator-3 terminal.
/prime wireframe-generator
Respond only: Ready."
  ["PreviewHost"]="You are the Preview Host terminal.
/prime preview-host
Respond only: Ready."
  ["WireframeQA"]="You are the Wireframe QA terminal.
/prime wireframe-qa
Respond only: Ready."
  ["Validator"]="You are the Validator terminal.
/prime validator
Respond only: Ready."
  ["Inspector"]="You are the Inspector terminal.
/prime inspector
Respond only: Ready."
  ["Author"]="You are the Author terminal.
/prime author
Respond only: Ready."
  ["TestEngineer"]="You are the Test Engineer terminal.
/prime test-engineer
Respond only: Ready."
  ["Developer"]="You are the Developer terminal.
/prime developer
Respond only: Ready."
  ["Auditor"]="You are the Auditor terminal.
/prime auditor
Respond only: Ready."
  ["QALead"]="You are the QA Lead terminal.
/prime qa-lead
Respond only: Ready."
  ["TechWriter"]="You are the Technical Writer terminal.
/prime tech-writer
Respond only: Ready."
)

# ANSI colors
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if session exists
check_session() {
  if ! tmux has-session -t $SESSION 2>/dev/null; then
    echo "Error: tmux session '$SESSION' not found."
    echo "Run './scripts/tmux-session.sh --all' first."
    exit 1
  fi
}

# Extract context percentage from a window
check_context() {
  local ROLE="$1"
  local WIN="${WINDOWS[$ROLE]}"

  # Capture last 100 lines of pane (prompt may be anywhere)
  PANE=$(tmux capture-pane -t $SESSION:$WIN -p -S -100 2>/dev/null)

  # Extract "X% free" pattern - look for the most recent occurrence
  # Pattern matches: "13% free" or "67% free" etc.
  if echo "$PANE" | grep -oE '[0-9]+% free' | tail -1 | grep -oE '[0-9]+' > /dev/null 2>&1; then
    echo "$PANE" | grep -oE '[0-9]+% free' | tail -1 | grep -oE '[0-9]+'
  else
    echo "-1"  # Could not detect
  fi
}

# Clear and re-prime a terminal
clear_terminal() {
  local ROLE="$1"
  local WIN="${WINDOWS[$ROLE]}"
  local PRIMER="${PRIMERS[$ROLE]}"

  if [ -z "$WIN" ]; then
    echo "Error: Unknown role '$ROLE'"
    echo "Valid roles: ${!WINDOWS[*]}"
    exit 1
  fi

  if [ -z "$PRIMER" ]; then
    echo "Error: No primer defined for '$ROLE'"
    exit 1
  fi

  echo "Clearing $ROLE (window $WIN)..."

  # Send /clear with explicit separate Enter
  tmux send-keys -t $SESSION:$WIN "/clear"
  sleep 0.5
  tmux send-keys -t $SESSION:$WIN Enter
  sleep 3

  # Clear tmux scrollback so old "X% free" values are gone
  tmux clear-history -t $SESSION:$WIN

  # Wait for context to clear (poll up to 30 seconds)
  echo "Waiting for context to clear..."
  local PCT=-1
  for i in {1..6}; do
    sleep 5
    PCT=$(check_context "$ROLE")
    if [ "$PCT" -ge 80 ] 2>/dev/null; then
      echo "Context cleared: ${PCT}% free"
      break
    fi
    if [ "$PCT" -eq -1 ]; then
      echo "  Waiting for prompt..."
    else
      echo "  Waiting... (${PCT}% free)"
    fi
  done

  # Send primer with explicit separate Enter
  echo "Re-priming $ROLE..."
  tmux send-keys -t $SESSION:$WIN "$PRIMER"
  sleep 0.5
  tmux send-keys -t $SESSION:$WIN Enter
  sleep 1
  tmux send-keys -t $SESSION:$WIN Enter

  echo "Done. $ROLE has been cleared and re-primed."
}

# Show status of all terminals
show_status() {
  echo ""
  echo -e "${CYAN}Context Window Status${NC} - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=============================================="
  echo ""

  CRITICAL_COUNT=0
  WARNING_COUNT=0
  OK_COUNT=0
  UNKNOWN_COUNT=0

  # Collect all results first
  declare -A RESULTS
  for ROLE in "${!WINDOWS[@]}"; do
    PCT=$(check_context "$ROLE")
    RESULTS[$ROLE]=$PCT
  done

  # Sort and display by percentage (lowest first)
  for ROLE in $(for r in "${!RESULTS[@]}"; do echo "$r ${RESULTS[$r]}"; done | sort -k2 -n | cut -d' ' -f1); do
    WIN="${WINDOWS[$ROLE]}"
    PCT="${RESULTS[$ROLE]}"

    if [ "$PCT" -eq -1 ]; then
      STATUS="[--]"
      COLOR=""
      ((UNKNOWN_COUNT++))
      PCT_DISPLAY="--"
    elif [ "$PCT" -le "$CRITICAL_THRESHOLD" ]; then
      STATUS="[!!]"
      COLOR="$RED"
      ((CRITICAL_COUNT++))
      PCT_DISPLAY="$PCT"
    elif [ "$PCT" -le "$WARNING_THRESHOLD" ]; then
      STATUS="[! ]"
      COLOR="$YELLOW"
      ((WARNING_COUNT++))
      PCT_DISPLAY="$PCT"
    else
      STATUS="[ok]"
      COLOR="$GREEN"
      ((OK_COUNT++))
      PCT_DISPLAY="$PCT"
    fi

    printf "%s %2d %-22s ${COLOR}%3s%% free${NC}\n" "$STATUS" "$WIN" "$ROLE" "$PCT_DISPLAY"
  done

  echo ""
  echo "----------------------------------------------"
  printf "Critical (≤%d%%): ${RED}%d${NC}\n" "$CRITICAL_THRESHOLD" "$CRITICAL_COUNT"
  printf "Warning  (≤%d%%): ${YELLOW}%d${NC}\n" "$WARNING_THRESHOLD" "$WARNING_COUNT"
  printf "OK       (>%d%%): ${GREEN}%d${NC}\n" "$WARNING_THRESHOLD" "$OK_COUNT"
  if [ "$UNKNOWN_COUNT" -gt 0 ]; then
    printf "Unknown:         %d\n" "$UNKNOWN_COUNT"
  fi

  if [ "$CRITICAL_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${RED}Action needed:${NC} Run './scripts/tmux-context-monitor.sh --clear ROLE'"
  fi
  echo ""
}

# Get role emoji based on terminal group
get_role_emoji() {
  local ROLE="$1"
  case "$ROLE" in
    CTO|Architect|Security|Toolsmith|DevOps|ProductOwner)
      echo "👔" ;;  # Council
    Planner|WireframeGenerator*|PreviewHost|WireframeQA|Validator|Inspector)
      echo "🎨" ;;  # Wireframe
    Developer|TestEngineer|Auditor)
      echo "💻" ;;  # Implement
    *)
      echo "📋" ;;  # Support (Coordinator, Author, QALead, TechWriter)
  esac
}

# Update window names to show context percentage
update_window_names() {
  echo "Updating window names with context indicators..."

  for ROLE in "${!WINDOWS[@]}"; do
    WIN="${WINDOWS[$ROLE]}"
    PCT=$(check_context "$ROLE")

    if [ "$PCT" -eq -1 ]; then
      # Can't detect - skip this window
      continue
    fi

    # Health emoji based on threshold
    if [ "$PCT" -le "$CRITICAL_THRESHOLD" ]; then
      HEALTH="🔴"
    elif [ "$PCT" -le "$WARNING_THRESHOLD" ]; then
      HEALTH="🟡"
    else
      HEALTH="🟢"
    fi

    # Role emoji based on group
    ROLE_EMOJI=$(get_role_emoji "$ROLE")

    # Rename window: "🔴👔 CTO [10%]" or "🟢🎨 Planner [72%]"
    NEW_NAME="${HEALTH}${ROLE_EMOJI} ${ROLE} [${PCT}%]"
    tmux rename-window -t $SESSION:$WIN "$NEW_NAME"
  done

  echo "Done. Press Ctrl+b w to see updated window list."
}

# Reset window names to original role names
reset_window_names() {
  echo "Resetting window names to defaults..."

  for ROLE in "${!WINDOWS[@]}"; do
    WIN="${WINDOWS[$ROLE]}"
    tmux rename-window -t $SESSION:$WIN "$ROLE"
  done

  echo "Done. Window names reset."
}

# Main
case "${1:-}" in
  --clear)
    if [ -z "$2" ]; then
      echo "Usage: $0 --clear ROLE"
      echo ""
      echo "Valid roles: ${!WINDOWS[*]}"
      exit 1
    fi
    check_session
    clear_terminal "$2"
    ;;
  --update-names)
    check_session
    update_window_names
    ;;
  --reset-names)
    check_session
    reset_window_names
    ;;
  --help|-h)
    echo "Usage: $0 [--clear ROLE | --update-names | --reset-names]"
    echo ""
    echo "Monitor context window usage across all scripthammer terminals."
    echo ""
    echo "Commands:"
    echo "  (none)          Show context status for all 21 terminals"
    echo "  --clear ROLE    Clear and re-prime a specific terminal"
    echo "  --update-names  Rename windows to show context % (e.g., '!!CTO [10%]')"
    echo "  --reset-names   Reset window names to clean role names"
    echo ""
    echo "Thresholds:"
    echo "  Critical: ≤${CRITICAL_THRESHOLD}% free (red, '!!' prefix)"
    echo "  Warning:  ≤${WARNING_THRESHOLD}% free (yellow, '! ' prefix)"
    echo "  OK:       >${WARNING_THRESHOLD}% free (green, no prefix)"
    echo ""
    echo "Valid roles:"
    for ROLE in "${!WINDOWS[@]}"; do
      printf "  %-22s (window %d)\n" "$ROLE" "${WINDOWS[$ROLE]}"
    done | sort -t'(' -k2 -n
    ;;
  *)
    check_session
    show_status
    ;;
esac
