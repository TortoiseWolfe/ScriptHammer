# DEC-001: Add QA Lead Role

**Date**: 2026-01-14
**RFC**: RFC-001
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-14 |
| Architect     | approve | 2026-01-14 |
| Security Lead | approve | 2026-01-14 |
| Toolsmith     | approve | 2026-01-14 |
| DevOps        | approve | 2026-01-14 |
| Product Owner | approve | 2026-01-14 |

## Decision

Add a new **QA Lead** contributor role to handle manual testing, acceptance verification, exploratory testing, and user acceptance testing coordination.

## Rationale

The Q1 2026 organizational audit revealed that **5 out of 17 terminals** independently identified the need for a QA Lead role:

1. **Toolsmith**: "QA Lead for end-to-end workflow testing (not just unit tests)"
2. **Generator**: "QA Lead owns overall wireframe quality bar"
3. **Tester**: "QA Lead for exploratory/manual testing and acceptance criteria verification"
4. **Implementer**: "QA Lead distinct from Tester - manual QA verification, user acceptance testing"
5. **Auditor**: "QA Lead for process compliance, documentation quality, UAT coordination"

Currently, Tester handles automated test execution (Vitest, Playwright, Pa11y), but no role owns:

- Manual/exploratory testing
- Acceptance criteria verification
- Cross-browser validation
- User acceptance testing coordination
- End-to-end workflow testing across the full pipeline

## Dissenting Views

None recorded.

## Impact

**Positive**:

- Clear ownership of manual testing gap
- Reduces Implementer conflict of interest
- Enables systematic cross-browser testing
- Better acceptance criteria verification

**Negative**:

- One more terminal to prime and coordinate
- Potential bottleneck if QA Lead becomes overloaded
- Requires new skill development by Toolsmith

## Implementation

- [ ] Add QA Lead to CLAUDE.md Terminal Roles table
- [ ] Add QA Lead Terminal Primer to CLAUDE.md
- [ ] Update Contributors reporting hierarchy (under DevOps)
- [ ] Add QA Lead to workflow sequence
- [x] Create `/prime qa-lead` skill
- [ ] Create `/acceptance-check` skill
- [ ] Create `/manual-test` skill
- [ ] Create `/browser-test` skill
