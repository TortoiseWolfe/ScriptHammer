#!/bin/bash
# Broadcast audit questions to all terminals in the scripthammer session
# Usage: ./tmux-audit.sh

SESSION="scripthammer"
AUDIT_FILE="docs/interoffice/audits/2026-01-14-organizational-review.md"

# Check if session exists
if ! tmux has-session -t $SESSION 2>/dev/null; then
  echo "Error: tmux session '$SESSION' not found."
  echo "Run './scripts/tmux-session.sh --all' first."
  exit 1
fi

echo "Broadcasting audit to all terminals..."
echo ""

# Loop through all windows
for i in $(tmux list-windows -t $SESSION -F '#I'); do
  # Get window name (role)
  WIN_NAME=$(tmux display-message -t $SESSION:$i -p '#{window_name}')

  # Skip Generator2 and Generator3 - consolidated with Generator1
  case "$WIN_NAME" in
    Generator2|Generator3)
      tmux send-keys -t $SESSION:$i "Your audit response is consolidated with Generator1. No action needed for this survey." Enter
      echo "  [$i] $WIN_NAME - skipped (consolidated)"
      sleep 0.5
      ;;
    *)
      # Send audit prompt
      PROMPT="Please complete the organizational audit. Read $AUDIT_FILE, find your section (### $WIN_NAME), and fill in all 7 questions:

1. Role Understanding - How do you understand your responsibilities?
2. Context Assessment - Is the /prime context adequate?
3. Tooling Adequacy - Are your skills and tools sufficient?
4. Key Dependencies - Which other roles do you depend on?
5. Suggestions - Improvements to tools, processes, or workflows?
6. Missing Roles - Are there gaps in the organizational structure?
7. Suggested Title - Is your current role title accurate?

Edit the file directly using the Edit tool. When done, reply: AUDIT COMPLETE"

      # Send prompt with aggressive Enter presses to force submission
      tmux send-keys -t $SESSION:$i "$PROMPT" Enter
      sleep 1
      tmux send-keys -t $SESSION:$i "" Enter
      sleep 0.5
      tmux send-keys -t $SESSION:$i "" Enter

      echo "  [$i] $WIN_NAME - audit prompt sent (with force submit)"

      # Longer delay between windows to avoid overwhelming
      sleep 2
      ;;
  esac
done

echo ""
echo "Audit broadcast complete!"
echo ""
echo "Monitor progress:"
echo "  tail -f $AUDIT_FILE"
echo ""
echo "Or check status in 2-3 minutes:"
echo "  grep -c '✅' $AUDIT_FILE"
