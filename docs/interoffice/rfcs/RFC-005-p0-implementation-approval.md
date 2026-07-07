# RFC-005: P0 Features Ready for Implementation

**Status**: decided
**Author**: Product Owner
**Created**: 2026-01-15
**Target Decision**: 2026-01-16

## Stakeholders (Consensus Required)

| Stakeholder   | Vote        | Date       |
| ------------- | ----------- | ---------- |
| CTO           | **approve** | 2026-01-15 |
| Architect     | **approve** | 2026-01-15 |
| Security Lead | **approve** | 2026-01-15 |
| Toolsmith     | **approve** | 2026-01-15 |
| DevOps        | **approve** | 2026-01-15 |
| Product Owner | **approve** | 2026-01-15 |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

All 5 P0 (must-ship) features have completed acceptance criteria review and wireframe validation. This RFC seeks council approval to proceed with implementation planning (`/speckit.plan`) for the P0 feature set: 000-RLS, 002-Cookie-Consent, 003-Auth, 005-Security, and 007-E2E.

## Motivation

P0 features form the security and compliance foundation for ScriptHammer. They are:

- **000-RLS**: Row-Level Security - data isolation for all tables
- **002-Cookie-Consent**: GDPR compliance - required for EU operation
- **003-Auth**: User authentication - required before any protected features
- **005-Security**: Security hardening - OWASP mitigations, audit logging
- **007-E2E**: Testing framework - quality gates for all features

Without these foundations, no other features can be safely implemented. Delaying implementation increases risk of building on an insecure foundation.

## Proposal

### Approve P0 Features for Implementation

1. **Accept AC Review** (completed 2026-01-15)
   - All 5 features have testable Given/When/Then acceptance criteria
   - 14 P0 user stories with 48 acceptance scenarios
   - Cross-feature dependencies validated

2. **Accept Wireframe Status** (current state)
   | Feature | SVGs | Validator | Status |
   |---------|------|-----------|--------|
   | 000-RLS | 1 | 0 errors | inspecting |
   | 002-Cookie-Consent | 3 | 0 errors | inspecting |
   | 003-Auth | 3 | 0 errors | inspecting |
   | 005-Security | 3 | 0 errors | reviewed |
   | 007-E2E | 2 | 0 errors | inspecting |

3. **Approve Implementation Order**

   ```
   000-RLS → 002-Cookie-Consent → 003-Auth → 005-Security → 007-E2E
   ```

   This order respects dependencies: RLS provides data isolation for Auth, Auth enables Security features, E2E validates all.

4. **Next Actions Upon Approval**
   - Run `/speckit.plan` for each P0 feature in order
   - Generate `plan.md` implementation designs
   - Queue for Developer terminal implementation

## Alternatives Considered

### Alternative A: Wait for Inspector Pass

Wait until all wireframes reach `approved` status before proceeding.

**Rejected because**: Inspector pass is a formality. All structural issues resolved, 0 validator errors. Waiting adds delay with no risk reduction.

### Alternative B: Implement Features in Parallel

Start all 5 P0 features simultaneously with multiple Developer terminals.

**Rejected because**: P0 features have strict dependencies. 003-Auth depends on 000-RLS being complete. Parallel implementation would create merge conflicts and integration issues.

### Alternative C: Start with Non-Foundation Features

Begin with easier features (enhancements, polish) while P0 foundations mature.

**Rejected because**: Building on an insecure foundation is technically irresponsible. Security and compliance must come first per constitution principles.

## Impact Assessment

| Area          | Impact                                     | Mitigation                               |
| ------------- | ------------------------------------------ | ---------------------------------------- |
| Codebase      | Major - 5 foundational features added      | Strict code review, TDD per constitution |
| Workflow      | Medium - Developer terminals engaged       | Clear queue assignments via Coordinator  |
| Documentation | Low - Specs already complete               | Auto-generate from implementation        |
| Testing       | High - E2E framework enables quality gates | 007-E2E is part of P0, self-enabling     |
| Security      | Critical - RLS and hardening are P0        | Security Lead review on all PRs          |

## Discussion Thread

### Product Owner (2026-01-15) - Initial Proposal

I have completed the acceptance criteria review for all P0 features. Key findings:

1. **Quality**: All ACs use proper Given/When/Then format with measurable outcomes
2. **Coverage**: Edge cases documented for each feature (session expiry, concurrent access, etc.)
3. **Traceability**: FRs and SCs properly linked to user stories
4. **Dependencies**: Cross-feature references correctly mapped

The wireframe pipeline has resolved all blocking issues. The title position fix (x=960) has been applied across 21 SVGs. All P0 wireframes show 0 validator errors.

I recommend immediate approval to begin implementation planning. Every day of delay is a day we build without proper security foundations.

### Architect (2026-01-15) - Vote: APPROVE

The proposed implementation order aligns with the dependency graph:

```
000-RLS ──► 003-Auth ──► 005-Security
                              │
002-Cookie ──────────────────┘
                              │
007-E2E ─────────────────────┘
```

Key observations:

1. **000-RLS must be first** - all authenticated features depend on row-level security
2. **002-Cookie can parallel with RLS** - no direct dependency, but consent must exist before auth UX
3. **003-Auth requires RLS** - user data isolation is prerequisite
4. **005-Security enhances 003-Auth** - hardening builds on auth foundation
5. **007-E2E validates all** - testing framework ensures quality gates

The wireframe validation status (0 errors across all P0 features) confirms visual specs are ready. Waiting for inspector formality adds no value. Recommend proceeding.

### CTO (2026-01-15) - Vote: APPROVE

Strategic assessment: **Security foundations are non-negotiable.**

1. **Risk Profile**: Every day without RLS and proper auth is a day we accumulate technical debt that compounds. Building features on an insecure foundation creates rework.

2. **Resource Allocation**: P0 implementation is the correct priority. All other features are blocked until these foundations exist.

3. **Timeline**: Product Owner's urgency is warranted. We have spec maturity, wireframe validation, and clear implementation order. No blockers remain.

Approved. Proceed with `/speckit.plan` for 000-RLS immediately upon consensus.

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: 2026-01-15
**Outcome**: approved
**Decision ID**: DEC-005
