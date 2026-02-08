# RFC-008: Push-Based Dispatch System

**Status**: fast-tracked
**Author**: CTO
**Created**: 2026-01-16
**Target Decision**: 2026-01-17

## Stakeholders (Consensus Required)

| Stakeholder   | Vote        | Date       |
| ------------- | ----------- | ---------- |
| CTO           | **approve** | 2026-01-16 |
| Architect     | pending     | -          |
| Security Lead | pending     | -          |
| Toolsmith     | pending     | -          |
| DevOps        | pending     | -          |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

Replace the current pull-based dispatch model (update JSON, hope terminals poll) with a push-based system that sends commands directly to idle terminals via tmux. This eliminates the gap where dispatched work sits unprocessed because generators don't know to check.

## Motivation

On 2026-01-16, QC identified 45 wireframe issues requiring PATCH/REGEN. The Planner correctly dispatched all items to `.terminal-status.json` with proper `assignedTo` fields. However, all three Generator terminals sat idle at their prompts while the queue backed up.

**Root cause**: The current workflow is pull-based:

1. Planner updates `.terminal-status.json` with assignments
2. Generators must run `/queue-check` to see their work
3. Nothing notifies generators that work is waiting

**Impact**: Hours of delay. QC crew did their job; Generators never picked up. Manual intervention (Operator sending tmux commands) was required to unblock.

## Proposal

### 1. New `/dispatch` Skill

Create a `/dispatch` skill for Planner/Coordinator that:

```bash
/dispatch [terminal] [command]
```

**Examples**:

```bash
/dispatch generator-1 /queue-check
/dispatch generator-2 "/wireframe-fix 003-user-authentication 01-registration-sign-in.svg"
/dispatch all-generators /queue-check
```

### 2. Implementation

The skill will:

1. Map terminal names to tmux window IDs (from `scripts/tmux-session.sh` or a config)
2. Use `tmux send-keys -t scripthammer:N 'command' Enter` to push commands
3. Optionally wait and capture response via `tmux capture-pane`
4. Log dispatch to `.terminal-status.json` completedToday

### 3. Terminal Mapping Config

Add to `.claude/config/terminal-map.json`:

```json
{
  "generator-1": "scripthammer:7",
  "generator-2": "scripthammer:8",
  "generator-3": "scripthammer:9",
  "planner": "scripthammer:6",
  "validator": "scripthammer:13"
}
```

### 4. Auto-Dispatch on Queue Update

When Planner adds items to queue:

1. Update `.terminal-status.json` (current behavior)
2. Auto-dispatch `/queue-check` to assigned terminals (new behavior)

### 5. Idle Detection (Optional Enhancement)

Before dispatching, check if terminal is idle:

```bash
tmux capture-pane -t scripthammer:7 -p | tail -1 | grep -q "bypass permissions"
```

Only dispatch to idle terminals; skip those already processing.

## Alternatives Considered

### Alternative A: Polling Interval

Have generators run `/queue-check` on a timer (every 60 seconds).

**Rejected because**:

- Wastes tokens on empty polls
- Still has up to 60s delay
- Generators may be mid-task when poll fires

### Alternative B: File Watcher

Generators watch `.terminal-status.json` for changes.

**Rejected because**:

- Claude Code doesn't support background file watchers
- Would require external daemon
- Adds infrastructure complexity

### Alternative C: Webhook/External Service

External service monitors queue and triggers terminals.

**Rejected because**:

- Over-engineered for this use case
- Adds external dependency
- tmux is already available and sufficient

## Impact Assessment

| Area          | Impact                          | Mitigation                                 |
| ------------- | ------------------------------- | ------------------------------------------ |
| Codebase      | New skill + config file         | Contained to skills directory              |
| Workflow      | Eliminates manual dispatch      | Training: Planner uses /dispatch           |
| Documentation | Update CLAUDE.md with new skill | Add to wireframe-pipeline.md               |
| Security      | tmux command injection risk     | Validate terminal names, sanitize commands |

## Discussion Thread

### CTO 2026-01-16 - Initial Proposal

This RFC emerges from a production incident today. We lost hours because our dispatch model assumes terminals actively poll for work. They don't.

The fix is simple: when work is assigned, tell the terminal directly via tmux. We already use tmux for the multi-terminal workflow; this just leverages it for coordination.

Key question for Toolsmith: estimated effort to implement `/dispatch`?

Key question for Security: any concerns about tmux command injection? Proposed mitigation is whitelist of valid terminal names and command prefixes.

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: -
**Outcome**: -
**Decision ID**: -
