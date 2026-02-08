# ScriptHammer Scripts

Automation scripts for the multi-terminal Claude Code workflow.

## tmux Send-Keys Pattern

**IMPORTANT**: When sending commands to Claude Code via tmux, use separate calls for text and Enter.

### Unreliable (Enter sometimes dropped)

```bash
tmux send-keys -t $SESSION:$WIN "/clear" Enter
```

### Reliable (always works)

```bash
tmux send-keys -t $SESSION:$WIN "/clear"
sleep 0.5
tmux send-keys -t $SESSION:$WIN Enter
```

The delay allows the terminal to fully receive the text before processing Enter. This was discovered when automating the Q1 2026 audit - commands were being typed but not submitted.

## Scripts

| Script                    | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `tmux-session.sh`         | Launch tmux session with 21 Claude terminals    |
| `tmux-context-monitor.sh` | Monitor context usage, clear/re-prime terminals |
| `tmux-dispatch.sh`        | Dispatch tasks to terminals                     |
| `tmux-audit.sh`           | Broadcast audit questions to all terminals      |
| `tmux-role-color.sh`      | Update status bar colors based on current role  |

## Context Monitor

Monitor context window usage and clear terminals that are running low:

```bash
# Check all terminals
./tmux-context-monitor.sh

# Clear and re-prime a specific terminal
./tmux-context-monitor.sh --clear Toolsmith

# Update window names with health indicators
./tmux-context-monitor.sh --update-names

# Reset to clean window names
./tmux-context-monitor.sh --reset-names
```

Thresholds:

- Critical: ≤10% free (red)
- Warning: ≤20% free (yellow)
- OK: >20% free (green)

## Session Launch

```bash
# Launch all 21 terminals
./tmux-session.sh --all

# Launch specific groups
./tmux-session.sh --council     # CTO, Architect, Security, Toolsmith, DevOps, ProductOwner
./tmux-session.sh --wireframe   # Planner, Generators, PreviewHost, WireframeQA, Validator, Inspector
./tmux-session.sh --implement   # Developer, TestEngineer, Auditor

# Launch with audit
./tmux-session.sh --all --audit
```
