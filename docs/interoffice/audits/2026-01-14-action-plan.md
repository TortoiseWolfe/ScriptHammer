# Q1 2026 Audit Action Plan

**Created**: 2026-01-14
**Source**: [2026-01-14-organizational-review.md](./2026-01-14-organizational-review.md)
**Status**: In Progress

---

## Completed

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

---

## Outstanding: Quick-Win Skills

**Owner**: Toolsmith
**RFC Required**: No

| # | Skill | Purpose | Priority |
|---|-------|---------|----------|
| 1 | `/status` | Project health dashboard: feature completion, pending RFCs, queue depth | HIGH |
| 2 | `/queue` | Task queue management: add/remove/list items in `.terminal-status.json` | HIGH |
| 3 | `/review-queue` | Show SVGs awaiting review with age/timestamps | MEDIUM |
| 4 | `/wireframe-fix [svg]` | Auto-load `*.issues.md` context before regeneration | MEDIUM |
| 5 | `/viewer-status` | Health check: confirm container running, return URL | LOW |

---

## Outstanding: Other Action Items

| # | Item | Owner | Priority | Notes |
|---|------|-------|----------|-------|
| 8 | `/security-audit` skill | Security Lead + Toolsmith | MEDIUM | OWASP Top 10 checklist |
| 9 | `patterns.json` baseline | Inspector + Toolsmith | LOW | Machine-readable pattern standards |
| 10 | Component generator | Toolsmith + DevOps | HIGH | `pnpm run generate:component` - blocks implementation |
| 11 | Test infrastructure | Test Engineer + DevOps | HIGH | vitest.config.ts, playwright.config.ts - blocks implementation |

---

## Outstanding: `/prep` Context Enhancements

Several roles requested richer context loading. These can be implemented by updating `~/.claude/commands/prep.md`.

| Role | Current Gap | Requested Enhancement |
|------|-------------|----------------------|
| **DevOps** | No workflow visibility | Auto-load `.github/workflows/` contents |
| **Product Owner** | No wireframe context | Add wireframe paths for UX review |
| **Wireframe QA** | Must check JSON manually | Show pending review items directly |
| **Wireframe Generator** | Must read spec manually | Auto-load spec excerpt in `/wireframe-prep` |
| **Auditor** | Must navigate per-feature | Summary view of artifact status (exists/missing/outdated) |
| **Planner** | Must read specs individually | Consolidated "screen inventory" across 46 features |
| **Coordinator** | Queue depth only | Summary of active/blocked terminals at a glance |

### Implementation Notes

Most roles said context is "adequate" but enhancements would reduce manual file reads. Lower priority than skill creation.

---

## Pre-Implementation Blockers

These items **must** be completed before the implementation phase can begin:

1. **Component generator** (Action #10)
   - Constitution references `pnpm run generate:component` but it doesn't exist
   - Needed to enforce 5-file component pattern

2. **Test infrastructure** (Action #11)
   - No vitest.config.ts or playwright.config.ts
   - Blocks TDD workflow per constitution

3. **Wireframe completion**
   - 24 SVGs exist across 7 features
   - 39 features still need wireframes
   - Implementation depends on visual reference

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
