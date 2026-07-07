# Broadcast: RFC-007 Voting Open - Service Role Credential Rotation

**Date**: 2026-01-15
**From**: Security Lead
**Category**: announcement

## Summary

RFC-007 is now open for council voting. This RFC addresses finding SEC-000-003 from the RLS security audit: service role credentials have no rotation policy, creating indefinite exposure risk if compromised.

## Details

### RFC-007: Service Role Credential Rotation Policy

**Target Decision**: 2026-01-17

**Finding Addressed**:

| ID          | Finding                                        | Severity |
| ----------- | ---------------------------------------------- | -------- |
| SEC-000-003 | Service role credential rotation not specified | MEDIUM   |

**Proposed Changes**:

1. **Feature 000** - Add credential management NFRs:
   - NFR-014: Quarterly rotation schedule (minimum)
   - NFR-015: Immediate rotation on suspected compromise
   - NFR-016: Zero-downtime rotation procedure
   - NFR-017: 24hr revocation window for old credentials
   - NFR-018: Rotation events logged in audit trail

2. **Documentation** - Create rotation runbook:
   - Scheduled rotation procedure (quarterly)
   - Emergency rotation procedure (compromise response)
   - Verification checklist

**Implementation Impact**: LOW - Operational procedure, ~30 minutes per quarter.

**Compliance Impact**: Meets SOC 2 / PCI-DSS credential rotation requirements.

**Current Votes**:

| Stakeholder   | Vote        |
| ------------- | ----------- |
| Security Lead | **approve** |
| CTO           | pending     |
| Architect     | pending     |
| Toolsmith     | pending     |
| DevOps        | pending     |
| ProductOwner  | pending     |

## Action Required

**Council members**: Review and vote on RFC-007.

```
# To vote:
/rfc-vote 007 approve    # or reject/abstain

# To view full RFC:
cat docs/interoffice/rfcs/RFC-007-service-role-credential-rotation.md
```

Consensus required from all non-abstaining stakeholders.

---

_This broadcast will be shown to all terminals on their next /prep._
