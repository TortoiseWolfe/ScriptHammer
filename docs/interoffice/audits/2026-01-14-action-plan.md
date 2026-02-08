# Q1 2026 Audit Action Plan

**Created**: 2026-01-14
**Source**: [2026-01-14-organizational-review.md](./2026-01-14-organizational-review.md)
**Status**: In Progress
**Last Updated**: 2026-01-16

---

## Completed

### Phase 1: RFCs & Skills (2026-01-14)

- [x] RFC-001: Add QA Lead Role → DEC-001 (approved)
- [x] RFC-002: Add Technical Writer Role → DEC-002 (approved)
- [x] RFC-003: Role Rename Proposals → decided
  - Tester → Test Engineer
  - Viewer → Preview Host
  - Generator → Wireframe Generator
  - Reviewer → Wireframe QA
  - Implementer → Developer
  - Coordinator → kept
  - Auditor → kept
- [x] `/status` skill created (2026-01-14) - `~/.claude/commands/status.md`
- [x] `/queue` skill created (2026-01-14) - `~/.claude/commands/queue.md`
- [x] `/review-queue` skill created (2026-01-14) - `~/.claude/commands/review-queue.md`
- [x] `/wireframe-fix` skill created (2026-01-14) - `~/.claude/commands/wireframe-fix.md`
- [x] `/security-audit` skill created (2026-01-14) - `~/.claude/commands/security-audit.md`

### Phase 2: Automation Scripts (2026-01-15)

- [x] 33 Python scripts created (12,601 LOC total) - see [toolsmith-script-completion.md](./2026-01-15-toolsmith-script-completion.md)
- [x] `generate-component.py` created - component scaffold generator
- [x] `svg-autofix.py` created - deterministic SVG fixes
- [x] `rfc-consensus.py` created - RFC vote aggregation
- [x] `feature-context.py` created - feature context caching
- [x] `dispatch-precompute.py` created - task pre-computation
- [x] `dependency-graph.py` created - feature dependency resolution

### Phase 3: Wireframe Standards (2026-01-16)

- [x] Council vote 7/7 APPROVED (G-044, G-047, SIGNATURE-003 standards)
- [x] Batch patches applied to 41 SVGs
- [x] G-047 spec corrected: y=940 (inside annotation panel)

---

## Completed: Script Integration (2026-01-16)

**Result**: All 8 integrations complete. ~100,000 tokens/day savings achieved.
**Owner**: Toolsmith
**Tracking**: [2026-01-16-script-integration-tasks.md](./2026-01-16-script-integration-tasks.md)

| #   | Integration         | Script                   | Skill Updated                      | Token Savings    | Status |
| --- | ------------------- | ------------------------ | ---------------------------------- | ---------------- | ------ |
| 1   | SVG autofix         | `svg-autofix.py`         | `/wireframe-fix`                   | ~40,000/day      | ✅     |
| 2   | Dispatch precompute | `dispatch-precompute.py` | `tmux-dispatch.sh`                 | ~40,000/dispatch | ✅     |
| 3   | RFC consensus       | `rfc-consensus.py`       | `/rfc-vote`                        | ~17,500/cycle    | ✅     |
| 4   | Feature context     | `feature-context.py`     | `/wireframe-prep`, `/speckit.plan` | ~10,000/day      | ✅     |
| 5   | Dependency graph    | `dependency-graph.py`    | `/speckit.plan`, `/speckit.tasks`  | ~16,000/day      | ✅     |
| 6   | Constitution check  | `constitution-check.py`  | `/speckit.analyze`                 | ~5,000/day       | ✅     |
| 7   | Terminal health     | `terminal-health.py`     | `/status`                          | ~2,000/day       | ✅     |
| 8   | Audit template      | `audit-template.py`      | `/prime`                           | ~2,000/day       | ✅     |

---

## Outstanding: Quick-Win Skills

**Owner**: Toolsmith
**RFC Required**: No

| #   | Skill            | Purpose                                             | Priority | Status                    |
| --- | ---------------- | --------------------------------------------------- | -------- | ------------------------- |
| 5   | `/viewer-status` | Health check: confirm container running, return URL | LOW      | Exists (check if working) |

---

## Outstanding: Other Action Items

| #   | Item                     | Owner                  | Priority | Status                                                |
| --- | ------------------------ | ---------------------- | -------- | ----------------------------------------------------- |
| 9   | `patterns.json` baseline | Inspector + Toolsmith  | LOW      | Not started                                           |
| 10  | Component generator      | Toolsmith + DevOps     | HIGH     | ✅ COMPLETE - `pnpm run generate:component` available |
| 11  | Test infrastructure      | Test Engineer + DevOps | HIGH     | ❌ BLOCKED - no vitest.config.ts                      |

---

## Outstanding: `/prep` Context Enhancements

Several roles requested richer context loading. These can be implemented by updating `~/.claude/commands/prep.md`.

| Role                    | Current Gap                  | Requested Enhancement                                     |
| ----------------------- | ---------------------------- | --------------------------------------------------------- |
| **DevOps**              | No workflow visibility       | Auto-load `.github/workflows/` contents                   |
| **Product Owner**       | No wireframe context         | Add wireframe paths for UX review                         |
| **Wireframe QA**        | Must check JSON manually     | Show pending review items directly                        |
| **Wireframe Generator** | Must read spec manually      | Auto-load spec excerpt in `/wireframe-prep`               |
| **Auditor**             | Must navigate per-feature    | Summary view of artifact status (exists/missing/outdated) |
| **Planner**             | Must read specs individually | Consolidated "screen inventory" across 46 features        |
| **Coordinator**         | Queue depth only             | Summary of active/blocked terminals at a glance           |

### Implementation Notes

Most roles said context is "adequate" but enhancements would reduce manual file reads. Lower priority than skill creation.

---

## Pre-Implementation Blockers

These items **must** be completed before the implementation phase can begin:

1. **Component generator** (Action #10)
   - ✅ `generate-component.py` exists (scripts/)
   - ✅ `pnpm run generate:component` wrapper added to root package.json
   - Status: **COMPLETE**

2. **Test infrastructure** (Action #11)
   - ❌ No vitest.config.ts or playwright.config.ts
   - Blocks TDD workflow per constitution
   - Status: **NOT STARTED**

3. **Wireframe completion**
   - ✅ 46 SVGs exist across 11 features (was 24 across 7)
   - 35 features still need wireframes
   - Status: **~25% complete**

4. **Script integration** (Action #12)
   - ✅ 8/8 integrations complete
   - ~100,000 tokens/day savings achieved
   - Status: **COMPLETE**

---

## Dispatch Commands

When ready to dispatch work:

```bash
# Dispatch quick-win skills to Toolsmith
./scripts/tmux-dispatch.sh --tasks

# Dispatch queue items to Wireframe QA
./scripts/tmux-dispatch.sh --queue

# Check current state
./scripts/tmux-dispatch.sh --status
```

---

## Next Audit

**Scheduled**: 2026-Q2 (April)
