# Automation Patterns and Pitfalls

Lessons learned from automating multi-terminal workflows with tmux and Claude Code.

## CRITICAL: Git Remote Rules

**NEVER change the git remote URL.** It MUST remain SSH:

```
origin  git@github.com:TortoiseWolfe/ScriptHammer.git
```

**NEVER run `git push`** - Only the Operator has SSH access.

If a terminal accidentally changes to HTTPS, fix immediately:

```bash
git remote set-url origin git@github.com:TortoiseWolfe/ScriptHammer.git
```

## Known Edge Cases

### 1. Boundary Position Bug

**Problem**: Terminals at list boundaries may not receive commands reliably.

| Position            | Risk   | Cause                               |
| ------------------- | ------ | ----------------------------------- |
| After skipped items | High   | Shorter delay before prompt arrives |
| Last in list        | High   | Script exits before confirmation    |
| First in list       | Medium | May not be fully initialized        |

**Solution**: Add explicit delays and verification:

```bash
# BAD: Script exits immediately after last item
for i in $(tmux list-windows -t $SESSION -F '#I'); do
  tmux send-keys -t $SESSION:$i "$PROMPT" Enter
done
# Script exits here - last window may not process

# GOOD: Add trailing delay and verification
for i in $(tmux list-windows -t $SESSION -F '#I'); do
  tmux send-keys -t $SESSION:$i "$PROMPT" Enter
  sleep 2
done
sleep 5  # Final buffer before script exits
```

### 2. Skip Logic Boundary

**Problem**: Items immediately after skipped items receive commands too quickly.

```bash
# BAD: Only 0.5s after skip, then immediately send to next
case "$WIN_NAME" in
  SkippedRole)
    echo "Skipped"
    sleep 0.5
    ;;
  *)
    tmux send-keys ... # Next window gets this too fast
    ;;
esac

# GOOD: Normalize delay after skips
case "$WIN_NAME" in
  SkippedRole)
    echo "Skipped"
    sleep 0.5
    ;;
  *)
    sleep 1  # Buffer after any skip
    tmux send-keys ...
    sleep 2
    ;;
esac
```

### 3. Permission Prompt Blocking

**Problem**: Claude Code waits for user approval on tool calls, blocking automation.

**Solution**: Launch with `--dangerously-skip-permissions`:

```bash
# Terminals will auto-accept ALL operations (edits, bash, commits)
tmux send-keys -t $SESSION:$i "claude --dangerously-skip-permissions" Enter
```

**CRITICAL**: Multi-terminal automation REQUIRES `--dangerously-skip-permissions`.
Using `--permission-mode acceptEdits` only auto-accepts file edits, NOT bash commands or commits.
This causes terminals to block waiting for manual approval, defeating autonomous operation.

**Available modes**:

- `default` - Prompts for all tool calls
- `acceptEdits` - Auto-accepts file edits ONLY (prompts for bash) - NOT ENOUGH FOR AUTOMATION
- `bypassPermissions` - Alias for dangerously-skip-permissions
- `--dangerously-skip-permissions` - Full bypass, REQUIRED for multi-terminal workflows

### 4. File Contention

**Problem**: Multiple terminals editing the same file simultaneously causes conflicts.

**Symptoms**:

- "Error editing file" messages
- Terminals saving to temp files instead
- Partial or lost updates

**Solutions**:

1. **Stagger timing**: Add delays between terminals writing to shared files
2. **Use append mode**: Each terminal appends to a unique section
3. **Use temp files**: Each terminal writes to its own file, merge later
4. **Lock files**: Implement file locking (complex)

```bash
# Stagger approach - 3s between each terminal
WINDOW_NUM=0
for ROLE in "${ROLES[@]}"; do
  tmux send-keys -t $SESSION:$WINDOW_NUM "$PROMPT" Enter
  sleep 3  # Give time for file write to complete
  ((WINDOW_NUM++))
done
```

### 5. Initialization Race

**Problem**: Sending commands before Claude is fully initialized.

**Solution**: Wait for initialization, verify ready state:

```bash
# Launch Claude
tmux send-keys -t $SESSION:$i "claude --permission-mode acceptEdits" Enter

# Wait for initialization (adjust based on system speed)
sleep 3

# Verify Claude is ready (look for prompt)
READY=$(tmux capture-pane -t $SESSION:$i -p | grep -c "╭─")
if [ "$READY" -eq 0 ]; then
  sleep 2  # Extra wait if not ready
fi

# Now send commands
tmux send-keys -t $SESSION:$i "$PRIMER" Enter
```

## Verification Patterns

### Check All Windows Completed

```bash
# Count checkmarks in shared file
EXPECTED=17
ACTUAL=$(grep -c '✅' "$AUDIT_FILE")

if [ "$ACTUAL" -lt "$EXPECTED" ]; then
  echo "Only $ACTUAL/$EXPECTED complete"
  # Identify which ones are missing
  grep -B1 'Awaiting input' "$AUDIT_FILE"
fi
```

### Capture Window State

```bash
# Check what a terminal is doing
tmux capture-pane -t scripthammer:18 -p | tail -20

# Check if stuck on permission prompt
tmux capture-pane -t scripthammer:$i -p | grep -q "Do you want to proceed"
```

### Retry Failed Windows

```bash
# Re-send to windows that didn't complete
for i in $(tmux list-windows -t $SESSION -F '#I'); do
  WIN_NAME=$(tmux display-message -t $SESSION:$i -p '#{window_name}')

  # Check if this role completed
  if ! grep -q "#### $WIN_NAME ✅" "$AUDIT_FILE"; then
    echo "Retrying $WIN_NAME (window $i)"
    tmux send-keys -t $SESSION:$i "$PROMPT" Enter
    sleep 3
  fi
done
```

## Testing Automation Scripts

1. **Test on subset first**: Use `--coord` (2 terminals) before `--all` (19)
2. **Watch in real-time**: Keep tmux attached while script runs
3. **Log everything**: Add `echo` statements with timestamps
4. **Capture failures**: Save window state when errors occur

```bash
# Debug mode with logging
DEBUG=true
LOG_FILE="/tmp/automation-$(date +%Y%m%d-%H%M%S).log"

log() {
  if [ "$DEBUG" = true ]; then
    echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"
  fi
}

log "Starting automation for ${#ROLES[@]} terminals"
```

## Task Dispatcher

The `tmux-dispatch.sh` script dispatches work to running terminals without manual intervention.

### Usage

```bash
# Prerequisite: terminals must be running
./scripts/tmux-session.sh --all
sleep 5  # Wait for initialization

# Dispatch work
./scripts/tmux-dispatch.sh --vote    # RFC votes to council
./scripts/tmux-dispatch.sh --tasks   # Audit action items to owners
./scripts/tmux-dispatch.sh --queue   # Process .terminal-status.json queue
./scripts/tmux-dispatch.sh --all     # Everything
./scripts/tmux-dispatch.sh --status  # Show current state
```

### Dispatch Modes

| Mode       | Targets                     | Purpose                 |
| ---------- | --------------------------- | ----------------------- |
| `--vote`   | Council (6)                 | Expedite RFC voting     |
| `--tasks`  | Toolsmith, DevOps, Security | Audit action items      |
| `--queue`  | Various                     | Process wireframe queue |
| `--status` | N/A                         | Show dispatcher state   |

### Adding New Dispatch Types

1. Create a new function: `dispatch_[type]()`
2. Add to case statement in main
3. Document in help text

```bash
dispatch_custom() {
  echo "Dispatching custom tasks..."

  dispatch_to "RoleName" "Your task prompt here.
Include context and expected completion signal.
Reply: TASK COMPLETE when done."
}

# Add to case statement
case "${1:-}" in
  --custom) dispatch_custom ;;
  # ...
esac
```

### Completion Tracking

Terminals should signal completion with standard phrases:

- `TASK COMPLETE` - General task finished
- `SKILL COMPLETE [name]` - Skill created
- `QUEUE ITEM COMPLETE` - Queue item processed
- `VOTES CAST` - RFC votes submitted

Future: Parse terminal output to auto-update `.terminal-status.json`

## Future Considerations

- [x] Add `--status` to show current dispatch state
- [ ] Add `--dry-run` flag to preview commands without executing
- [ ] Implement proper file locking for shared resources
- [ ] Create verification script to check all terminals completed
- [ ] Add timeout handling for stuck terminals
- [ ] Consider message queue instead of direct file writes
- [ ] Add `--watch` mode for continuous dispatch loop
- [ ] Parse completion signals to auto-update status file
