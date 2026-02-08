# Script Integration Task List

**Created**: 2026-01-16
**Owner**: Toolsmith (primary), QC-Operator (tracking)
**Source**: [2026-01-14-action-plan.md](./2026-01-14-action-plan.md)

---

## Summary

| Metric                  | Value            |
| ----------------------- | ---------------- |
| Scripts Built           | 33 (12,601 LOC)  |
| Scripts Integrated      | ~8 (~24%)        |
| Estimated Token Savings | 100,000+/day     |
| Integration Tasks       | 8 (8 complete) ✓ |

---

## P0: Critical Path (Do First)

### Task 1: Wire `svg-autofix.py` into `/wireframe-fix`

**Script**: `scripts/svg-autofix.py`
**Skill**: `~/.claude/commands/wireframe-fix.md`
**Token Savings**: ~40,000/day

**Current Workflow**:

1. Inspector finds structural issues (wrong x/y, missing font-weight, wrong color)
2. Generator receives PATCH task with AI prompt
3. AI reads entire SVG, regenerates section (~5,000 tokens)

**Target Workflow**:

1. Inspector finds structural issues
2. `/wireframe-fix` runs `python scripts/svg-autofix.py <file> --apply`
3. Script fixes deterministic issues in <1 second
4. AI only handles semantic issues (layout, content)

**Integration Steps**:

- [x] Test `svg-autofix.py` on sample SVG with known issues
- [x] Update `/wireframe-fix` to check if issue is auto-fixable
- [x] Add `--dry-run` check before applying
- [x] Add fallback to AI for non-structural issues
- [x] Update PATCH task template to prefer script fix

**Acceptance Criteria**:

- [x] Structural issues (position, color, font-weight) fixed by script
- [x] No AI tokens spent on deterministic fixes
- [x] Manual override available for complex cases

---

### Task 2: Wire `dispatch-precompute.py` into `tmux-dispatch.sh`

**Script**: `scripts/dispatch-precompute.py`
**Target**: `scripts/tmux-dispatch.sh`
**Token Savings**: ~40,000/dispatch

**Current Workflow**:

1. `tmux-dispatch.sh` sends 500+ character prompt to each terminal
2. Each terminal (26 total) parses audit files independently
3. Each terminal extracts its own tasks (~2,000 tokens each)

**Target Workflow**:

1. `dispatch-precompute.py` parses audit once → JSON
2. `tmux-dispatch.sh` reads JSON
3. Each terminal receives only its specific task (~50 tokens)

**Integration Steps**:

- [x] Test `dispatch-precompute.py --audit 2026-01-16`
- [x] Update `tmux-dispatch.sh` to call precompute first
- [x] Modify dispatch prompts to use pre-computed assignments
- [x] Add `--no-precompute` flag for fallback

**Acceptance Criteria**:

- [x] Single audit parse per dispatch cycle
- [x] Terminal prompts reduced from ~500 to ~50 characters
- [x] Fallback to current behavior if script fails

---

## P1: High Value (Do Second)

### Task 3: Wire `rfc-consensus.py` into `/rfc-vote`

**Script**: `scripts/rfc-consensus.py`
**Skill**: `~/.claude/commands/rfc-vote.md`
**Token Savings**: ~17,500/cycle

**Integration Steps**:

- [x] Test `rfc-consensus.py --pending`
- [x] Test `rfc-consensus.py 006 --tally`
- [x] Update `/rfc-vote` to use script for vote counting
- [x] Add auto-DEC generation on consensus

**Acceptance Criteria**:

- [x] Vote tallying done by script, not AI
- [x] Automatic consensus detection
- [x] DEC-XXX file generated automatically

---

### Task 4: Wire `feature-context.py` into `/wireframe-prep`

**Script**: `scripts/feature-context.py`
**Skills**: `~/.claude/commands/wireframe-prep.md`, `/speckit.plan`
**Token Savings**: ~10,000/day

**Integration Steps**:

- [x] Test `feature-context.py 003 --full`
- [x] Update `/wireframe-prep` to load cached JSON
- [x] Add context caching to `/speckit.plan`
- [x] Implement cache invalidation on spec.md change

**Acceptance Criteria**:

- [x] Feature context parsed once, cached as JSON
- [x] Skills read from cache instead of re-parsing
- [x] Cache auto-invalidates on source file change

---

### Task 5: Wire `dependency-graph.py` into `/speckit.plan`

**Script**: `scripts/dependency-graph.py`
**Skills**: `~/.claude/commands/speckit.plan.md`, `/speckit.tasks`
**Token Savings**: ~16,000/day

**Integration Steps**:

- [x] Test `dependency-graph.py 003-auth --deps`
- [x] Test `dependency-graph.py --next`
- [x] Update `/speckit.plan` to use script for dep resolution
- [x] Update `/speckit.tasks` to respect dependency order

**Acceptance Criteria**:

- [x] IMPLEMENTATION_ORDER.md parsed by script
- [x] Dependency chains resolved deterministically
- [x] `--next` returns correct next implementable feature

---

## P2: Nice to Have (Do Later)

### Task 6: Wire `constitution-check.py` into `/speckit.analyze`

**Script**: `scripts/constitution-check.py`
**Skill**: `.claude/commands/speckit.analyze.md`
**Token Savings**: ~5,000/day

**Integration Steps**:

- [x] Test `constitution-check.py spec.md --json`
- [x] Update `/speckit.analyze` to run script first
- [x] AI handles semantic analysis only

**Acceptance Criteria**:

- [x] Script runs before AI analysis (added step 1.5)
- [x] Structural constitution checks automated
- [x] Report includes script-generated findings

---

### Task 7: Wire `terminal-health.py` into `/status`

**Script**: `scripts/terminal-health.py`
**Skill**: `~/.claude/commands/status.md`
**Token Savings**: ~2,000/day

**Integration Steps**:

- [x] Test `terminal-health.py --summary`
- [x] Update `/status` to include health metrics
- [x] Add alerts for low-context terminals

**Acceptance Criteria**:

- [x] Health summary line at top of dashboard
- [x] Script used for blocked/idle/stale detection
- [x] Low-context alerts documented with display format

---

### Task 8: Wire `audit-template.py` into `/prime`

**Script**: `scripts/audit-template.py`
**Skill**: `~/.claude/commands/prime.md`
**Token Savings**: ~2,000/day

**Integration Steps**:

- [x] Test `audit-template.py toolsmith skills`
- [x] Update `/prime` to offer audit template generation
- [x] Standardize audit format across all terminals

**Acceptance Criteria**:

- [x] `/prime [role] --audit <topic>` generates template
- [x] Available templates documented by role
- [x] Audit format standard documented for all terminals

---

## Dispatch Plan

```bash
# Send to Toolsmith terminal
tmux send-keys -t scripthammer:Toolsmith "Read docs/interoffice/audits/2026-01-16-script-integration-tasks.md and start with Task 1 (svg-autofix integration)"
tmux send-keys -t scripthammer:Toolsmith Enter
```

---

## Progress Tracking

| Task                                    | Status       | Assigned    | Completed  |
| --------------------------------------- | ------------ | ----------- | ---------- |
| 1. svg-autofix → wireframe-fix          | **complete** | Toolsmith   | 2026-01-16 |
| 2. dispatch-precompute → tmux-dispatch  | **complete** | Toolsmith-2 | 2026-01-16 |
| 3. rfc-consensus → rfc-vote             | **complete** | Toolsmith   | 2026-01-16 |
| 4. feature-context → wireframe-prep     | **complete** | Toolsmith   | 2026-01-16 |
| 5. dependency-graph → speckit.plan      | **complete** | Toolsmith   | 2026-01-16 |
| 6. constitution-check → speckit.analyze | **complete** | Toolsmith   | 2026-01-16 |
| 7. terminal-health → status             | **complete** | Toolsmith   | 2026-01-16 |
| 8. audit-template → prime               | **complete** | Toolsmith   | 2026-01-16 |

---

## Related Documents

- [2026-01-15-toolsmith-script-completion.md](./2026-01-15-toolsmith-script-completion.md)
- [2026-01-15-architect-automation-review.md](./2026-01-15-architect-automation-review.md)
- [2026-01-14-action-plan.md](./2026-01-14-action-plan.md)
