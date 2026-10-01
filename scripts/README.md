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
| `tmux-crew.py`            | Morning plan: open, refresh or close terminals  |
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

Windows are found by name, including the `🔴👔 CTO [10%]` form that
`--update-names` leaves behind, not by a fixed position. A role with no window is
reported as missing rather than guessed at.

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

## Morning crew

`tmux-crew.py` reads the queue, the open tmux windows and each window's context, then
tells you which roles to open, refresh or close. **It only prints a plan** until you ask
it to act. Python 3, standard library only.

```bash
python3 scripts/tmux-crew.py                 # print the plan, change nothing
python3 scripts/tmux-crew.py --apply         # carry the plan out
python3 scripts/tmux-crew.py --max-open 3    # open at most 3 windows this run (default 6)
python3 scripts/tmux-crew.py --json          # the plan as JSON
```

The plan is a table (role, model, pending, context, state, action, reason) and a
summary such as `open 3, refresh 1, close 2, report 4`.

| Action  | When                                                                  |
| ------- | --------------------------------------------------------------------- |
| OPEN    | The role has pending work and no window. At most `--max-open` per run |
| REFRESH | The window is at ≤10% free and its role is idle                       |
| CLOSE   | The role has nothing pending and is idle                              |
| REPORT  | Left alone: blocked or stale, busy at ≤10%, unknown context, odd name |

REPORT is never acted on, and the Operator (which runs outside tmux) is never touched.
Roles over the `--max-open` cap show as `waiting: cap`, in assembly-line order. CLOSE
wins over REFRESH: a window with nothing to do is closed rather than cleared.

`--apply` opens roles in assembly-line order (a 3 s stagger between windows), then
refreshes, then closes. OPEN launches `claude --model <M> --dangerously-skip-permissions`,
accepts the consent dialog, waits for the prompt and only then sends the primer, and it
never types a primer into a shell that has no prompt. REFRESH runs
`tmux-context-monitor.sh --clear ROLE`. CLOSE sends `/exit`, then `kill-window` if the
window is still there after 15 s. The exit code is 1 if any action failed.

Models and primers are read from `tmux-session.sh`, which is never run. Queue and
idle/blocked/stale come from `queue-status.py` and `terminal-health.py`, so the plan reads
`docs/design/wireframes/.terminal-status.json`. **If that file is missing, nothing can be
called idle, so REFRESH and CLOSE are held back** and the plan says so. `--status-file PATH`
points it elsewhere.

Tests: `python3 -m unittest discover -s scripts/tests`
