# RFC-006: P1 Wave 1 Foundation Features Ready for Implementation

**Status**: proposed
**Author**: Product Owner
**Created**: 2026-01-15
**Target Decision**: 2026-01-17

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | pending | -          |
| Architect     | pending | -          |
| Security Lead | pending | -          |
| Toolsmith     | pending | -          |
| DevOps        | pending | -          |
| Product Owner | approve | 2026-01-15 |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

Following P0 implementation approval (RFC-005), this RFC seeks council approval to proceed with P1 Wave 1 - three foundation features that have no P0 dependencies and can begin implementation planning immediately after P0 work is queued:

- **001-WCAG-AA Compliance** - Accessibility foundation (AAA target)
- **004-Mobile-First Design** - Responsive design foundation
- **006-Template-Fork Experience** - Developer onboarding foundation

## Motivation

### Why Wave 1 Now?

These three features share critical characteristics:

1. **No P0 Dependencies**: Can be planned in parallel with P0 implementation
2. **Foundation Status**: Required by many downstream features
3. **Cross-Cutting Impact**: Affect all future UI development
4. **Wireframe Complete**: All 7 SVGs pass validation (0 errors)

### Dependency Analysis

```
001-WCAG-AA ────────► 017-Colorblind, 018-Font-Switcher, 037-A11y-Tests
004-Mobile-First ───► All UI features (implicit dependency)
006-Template-Fork ──► Developer adoption, fork experience
```

Delaying these features blocks:

- Accessibility enhancements (017, 018, 037)
- All mobile-responsive UI work
- Template adoption by external developers

## Proposal

### Approve P1 Wave 1 Features for Implementation Planning

| Feature           | P1 Stories | Wireframes | Validator |
| ----------------- | ---------- | ---------- | --------- |
| 001-WCAG-AA       | 4          | 3 SVGs     | 0 errors  |
| 004-Mobile-First  | 2          | 2 SVGs     | 0 errors  |
| 006-Template-Fork | 2          | 2 SVGs     | 0 errors  |

### Feature Details

#### 001-WCAG-AA Compliance

**Scope**: Automated accessibility testing, AAA contrast (7:1), keyboard navigation, screen reader compatibility, 44px touch targets, no time limits.

**Key Requirements**:

- FR-001 through FR-035 (35 functional requirements)
- CI/CD pipeline enforcement
- Real-time developer feedback
- Accessibility dashboard

**Success Criteria**:

- 100% pages pass WCAG 2.1 AAA automated tests
- All text meets 7:1 contrast ratio
- All interactive elements 44x44px minimum
- Content at grade 9 reading level

#### 004-Mobile-First Design

**Scope**: Responsive design from 320px, touch targets, Core Web Vitals, image optimization, virtual scrolling.

**Key Requirements**:

- FR-001 through FR-028 (28 functional requirements)
- Zero horizontal scroll at 320-428px widths
- LCP <2.5s, FID <100ms, CLS <0.1
- 44px touch targets with 8px spacing

**Success Criteria**:

- Zero horizontal scroll on any page at mobile widths
- 100% touch targets meet 44x44px minimum
- Core Web Vitals pass on mobile networks

#### 006-Template-Fork Experience

**Scope**: Automated rebranding CLI, comprehensive test mocks, auto-detect deployment paths, graceful degradation.

**Key Requirements**:

- FR-001 through FR-028 (28 functional requirements)
- Rebrand automation updates 200+ files
- Tests pass without external service configuration
- Git workflow works in containers

**Success Criteria**:

- Fork setup time: 2 hours → 5 minutes
- Test suite passes on fresh fork (0 service failures)
- Deployment works without manual path configuration

### Implementation Order

```
001-WCAG-AA ──┐
              ├──► Can run in parallel (no interdependencies)
004-Mobile ───┤
              │
006-Fork ─────┘
```

These three features have no dependencies on each other and can be implemented in parallel by different Developer terminals.

### Next Actions Upon Approval

1. Run `/speckit.plan` for each Wave 1 feature
2. Generate `plan.md` implementation designs
3. Queue for Developer terminals (can parallelize)
4. Begin implementation after P0 features are queued

## Alternatives Considered

### Alternative A: Wait for P0 Completion

Wait until all P0 features are fully implemented before starting P1.

**Rejected because**: Wave 1 features have no P0 code dependencies. Planning can begin immediately. Waiting adds 2-3 weeks of unnecessary delay.

### Alternative B: Include More P1 Features

Add 019-Google-Analytics or messaging features to Wave 1.

**Rejected because**:

- 019 depends on 002-Cookie-Consent (P0)
- Messaging features depend on 003-Auth (P0)
- Wave 1 should only include dependency-free features

### Alternative C: Prioritize Single Feature

Focus all resources on 001-WCAG-AA first.

**Rejected because**: These three features are independent. Parallel implementation maximizes throughput without merge conflicts.

## Impact Assessment

| Area          | Impact                                  | Mitigation                            |
| ------------- | --------------------------------------- | ------------------------------------- |
| Codebase      | Medium - 3 cross-cutting features       | Feature flags for incremental rollout |
| Workflow      | Low - Parallel implementation possible  | Clear terminal assignments            |
| Documentation | Medium - Standards documentation needed | Auto-generate from implementation     |
| Testing       | Medium - New test infrastructure        | 007-E2E (P0) provides foundation      |
| Accessibility | High - New compliance requirements      | Gradual enforcement, grace period     |

## Discussion Thread

### Product Owner (2026-01-15) - Initial Proposal

P1 Wave 1 features were reviewed as part of the comprehensive P1 AC audit. Key findings:

**001-WCAG-AA**:

- Targets AAA compliance (exceeds typical AA requirements)
- 35 functional requirements with measurable outcomes
- Development tooling included (real-time feedback)

**004-Mobile-First**:

- Specific device width targets (320px minimum)
- Core Web Vitals integration
- Touch target requirements align with 001-WCAG-AA

**006-Template-Fork**:

- Addresses real pain points from SpokeToWork fork feedback
- Reduces onboarding friction from hours to minutes
- Enables broader template adoption

All wireframes complete (7 SVGs, 0 errors). These features are the logical next step after P0 foundations.

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: -
**Outcome**: -
**Decision ID**: -
