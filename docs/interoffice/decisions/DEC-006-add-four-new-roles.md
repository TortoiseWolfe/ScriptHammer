# DEC-006: Add Four New Roles to Multi-Terminal Workflow

**Date**: 2026-01-15
**RFC**: RFC-006
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Result**: Unanimous approval (6-0)

## Decision

Expand the ScriptHammer multi-terminal workflow from 22 to 26 terminals by adding four new specialized roles:

1. **UX Designer** (Council) - 7th voting member for user experience governance
2. **UI Designer** (Contributor) - Visual design execution, reports to Architect
3. **Business Analyst** (Contributor) - Requirements translation, reports to Product Owner
4. **Release Manager** (Contributor) - Release process ownership, reports to DevOps

## Rationale

Gap analysis of standard software development team roles identified missing coverage in:

- User experience design (strategic level)
- Visual design execution
- Requirements decomposition
- Release process ownership

Industry research confirmed these are standard roles in mature software teams.

## Dissenting Views

None recorded. All council members approved unanimously.

Key council observations:

- Architect: "7-member council may slow consensus, but diversity of perspectives is worth it"
- DevOps: "At 26 terminals, may need to revisit tmux architecture if we keep growing"
- Toolsmith: "New skills needed for each role - medium effort"

## Impact

| Area           | Before  | After   |
| -------------- | ------- | ------- |
| Terminal count | 22      | 26      |
| Council size   | 6       | 7       |
| RFC voting     | 6 votes | 7 votes |
| Contributors   | 16      | 19      |

## Implementation

- [x] Create RFC-006 with role definitions
- [x] Collect council votes (6-0 approve)
- [x] Create DEC-006 decision record
- [x] Create `.claude/roles/design.md` for UI Designer
- [x] Update `council.md` with UX Designer
- [x] Update `support.md` with Business Analyst
- [x] Update `implementation.md` with Release Manager
- [x] Update `docs/interoffice/CLAUDE.md` tier tables
- [x] Update root `CLAUDE.md` terminal count
- [x] Update `tmux-session.sh` with new primers
- [x] Update `tmux-dispatch.sh` with new window mappings

**Activation**: Next factory launch (new roles start tomorrow)
**Implementation Complete**: 2026-01-15
