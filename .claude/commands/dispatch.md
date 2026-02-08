# Push-Based Dispatch via tmux

Send commands directly to terminals using tmux send-keys. This skill EXECUTES tmux commands - it does not just update queue files.

**Access**: Planner, Coordinator, Council members

## Usage

```
/dispatch [terminal] [command]
/dispatch [group] [command]
```

**Examples**:

```
/dispatch generator-1 /queue-check
/dispatch gen2 "/wireframe-fix 003-user-authentication 01-registration.svg"
/dispatch all-generators /queue-check
/dispatch qc /queue-check
```

## CRITICAL: This Skill EXECUTES Commands

When you run /dispatch, you MUST:

1. Run the actual `tmux send-keys` bash command
2. NOT just describe what would happen
3. NOT ask for permission - execute immediately

## Terminal Map (from .claude/config/terminal-map.json)

| Name             | Aliases | Window |
| ---------------- | ------- | ------ |
| cto              | -       | 0      |
| product-owner    | -       | 1      |
| business-analyst | -       | 2      |
| architect        | -       | 3      |
| ux-designer      | -       | 4      |
| ui-designer      | -       | 5      |
| planner          | -       | 6      |
| generator-1      | gen1    | 7      |
| generator-2      | gen2    | 8      |
| generator-3      | gen3    | 9      |
| preview-host     | preview | 10     |
| wireframe-qa     | qa      | 11     |
| validator        | -       | 12     |
| inspector        | -       | 13     |
| developer        | -       | 14     |
| toolsmith        | -       | 15     |
| security         | -       | 16     |
| test-engineer    | -       | 17     |
| qa-lead          | -       | 18     |
| auditor          | -       | 19     |
| author           | -       | 20     |
| tech-writer      | -       | 21     |
| devops           | -       | 22     |
| docker-captain   | -       | 23     |
| release-manager  | -       | 24     |
| coordinator      | -       | 25     |

## Groups

| Group          | Terminals                                                               | Windows                    |
| -------------- | ----------------------------------------------------------------------- | -------------------------- |
| all-generators | generator-1, generator-2, generator-3                                   | 7, 8, 9                    |
| qc             | preview-host, wireframe-qa, validator, inspector                        | 10, 11, 12, 13             |
| council        | cto, architect, security, toolsmith, devops, product-owner, ux-designer | 0, 3, 16, 15, 22, 1, 4     |
| wireframe      | planner + generators + qc                                               | 6, 7, 8, 9, 10, 11, 12, 13 |

## Instructions - EXECUTE THESE STEPS

### Step 1: Parse Arguments

Extract `[target]` and `[command]` from the arguments.

### Step 2: Resolve Target to Window Numbers

**Single terminal**: Look up window number from table above (check aliases first)
**Group**: Get all window numbers for that group

### Step 3: EXECUTE tmux send-keys

**For single terminal** - RUN THIS COMMAND:

```bash
tmux send-keys -t scripthammer:[WINDOW] '[COMMAND]' Enter
```

**For group (e.g., all-generators)** - RUN THESE COMMANDS:

```bash
tmux send-keys -t scripthammer:7 '[COMMAND]' Enter && sleep 0.3
tmux send-keys -t scripthammer:8 '[COMMAND]' Enter && sleep 0.3
tmux send-keys -t scripthammer:9 '[COMMAND]' Enter
```

**IMPORTANT**:

- Use the Bash tool to execute these commands
- Replace [WINDOW] with actual window number
- Replace [COMMAND] with the command to dispatch
- Single-quote the command to prevent shell expansion
- Add 0.3s delay between multiple dispatches

### Step 4: Confirm Dispatch

Output confirmation:

```
Dispatched to [target]:
  > [command]

Sent via tmux to window(s): [list]
```

## Quick Reference - Copy-Paste Commands

### Dispatch /queue-check to all generators:

```bash
tmux send-keys -t scripthammer:7 '/queue-check' Enter && sleep 0.3 && tmux send-keys -t scripthammer:8 '/queue-check' Enter && sleep 0.3 && tmux send-keys -t scripthammer:9 '/queue-check' Enter
```

### Dispatch to single generator:

```bash
tmux send-keys -t scripthammer:7 '/queue-check' Enter
```

### Dispatch wireframe-fix to generator-1:

```bash
tmux send-keys -t scripthammer:7 '/wireframe-fix [feature] [svg]' Enter
```

## Error Handling

Before dispatching, verify tmux session exists:

```bash
tmux has-session -t scripthammer 2>/dev/null && echo "Session exists" || echo "ERROR: No scripthammer session"
```

## DO NOT

- Just describe what you would do - EXECUTE the tmux commands
- Ask for permission - dispatch is authorized for Planner/Coordinator/Council
- Skip the actual bash execution

## RFC Reference

Implements RFC-008: Push-Based Dispatch System (CTO fast-tracked 2026-01-16)
