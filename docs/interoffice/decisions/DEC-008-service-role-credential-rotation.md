# DEC-008: Service Role Credential Rotation Policy

**Date**: 2026-01-15
**RFC**: RFC-007
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote        | Date       |
| ------------- | ----------- | ---------- |
| CTO           | **approve** | 2026-01-15 |
| Architect     | **approve** | 2026-01-15 |
| Security Lead | **approve** | 2026-01-15 |
| Toolsmith     | **approve** | 2026-01-15 |
| DevOps        | **approve** | 2026-01-15 |
| Product Owner | **approve** | 2026-01-15 |

**Result**: Unanimous approval (6-0)

## Decision

Service role credential rotation requirements approved for Feature 000 (RLS):

### Non-Functional Requirements

Add to Feature 000 spec:

- **NFR-014**: Service role credentials MUST be rotated quarterly (minimum)
- **NFR-015**: Service role credentials MUST be rotated immediately upon suspected compromise
- **NFR-016**: Credential rotation MUST NOT cause service interruption (zero-downtime)
- **NFR-017**: Previous credentials MUST be revoked within 24 hours of rotation
- **NFR-018**: Credential rotation events MUST be logged in security audit trail

### Edge Case Addition

Add to Feature 000 spec edge cases:

- What happens when service role credentials are compromised?
  → Immediate rotation via runbook, audit log review, incident report, user notification if data accessed

### Runbook Requirement

Create `docs/runbooks/service-role-rotation.md` with:

- Scheduled rotation procedure (quarterly)
- Emergency rotation procedure (suspected compromise)
- Verification checklist

## Rationale

The service role bypasses ALL RLS policies - it's the highest-value credential. Without rotation:

- Leaked credentials provide indefinite access
- No compliance with SOC 2 / PCI-DSS
- Defense in depth is compromised

Quarterly rotation limits exposure window to 90 days maximum.

## Dissenting Views

None recorded.

## Impact

| Area             | Impact                               | Mitigation                 |
| ---------------- | ------------------------------------ | -------------------------- |
| Feature 000 Spec | Add 5 NFRs (NFR-014-018)             | Minor edit                 |
| Documentation    | Create rotation runbook              | One-time effort            |
| Operations       | Quarterly rotation task              | ~30 minutes per quarter    |
| DevOps           | Support secret refresh in deployment | Existing workflow supports |
| Compliance       | Meets SOC 2 / PCI-DSS                | Positive impact            |

## Implementation

- [ ] Update Feature 000 spec with NFR-014 through NFR-018
- [ ] Add edge case for credential compromise response
- [ ] Create `docs/runbooks/service-role-rotation.md`
- [ ] Add quarterly rotation reminder to project calendar
- [ ] Configure service role usage alerts (unexpected IP, off-hours)
