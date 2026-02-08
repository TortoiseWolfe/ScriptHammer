# Broadcast: RFC-006 Voting Open - Auth Security Enhancements

**Date**: 2026-01-15
**From**: Security Lead
**Category**: announcement

## Summary

RFC-006 is now open for council voting. This RFC addresses two MEDIUM-severity findings from the Feature 003 security audit: session invalidation on password change and mandatory PKCE for OAuth flows.

## Details

### RFC-006: Auth Security Enhancements - Session Invalidation and PKCE

**Target Decision**: 2026-01-17

**Findings Addressed**:

| ID      | Finding                                     | Severity |
| ------- | ------------------------------------------- | -------- |
| SEC-003 | Sessions not invalidated on password change | MEDIUM   |
| SEC-004 | PKCE not explicitly required for OAuth      | MEDIUM   |

**Proposed Changes**:

1. **Feature 003** - Add session invalidation requirements:
   - FR-034: Invalidate all sessions on password change
   - FR-035: "Sign out everywhere" capability
   - FR-036: Notify user of invalidation count

2. **Feature 005** - Add PKCE requirements:
   - FR-048: PKCE required for all OAuth flows
   - FR-049: Cryptographic code_verifier generation
   - FR-050: S256 challenge method required
   - FR-051: Reject flows without valid PKCE

**Implementation Impact**: LOW - Supabase Auth SDK supports both features natively.

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

**Council members**: Review and vote on RFC-006.

```
# To vote:
/rfc-vote 006 approve    # or reject/abstain

# To view full RFC:
cat docs/interoffice/rfcs/RFC-006-auth-security-session-pkce.md
```

Consensus required from all non-abstaining stakeholders.

---

_This broadcast will be shown to all terminals on their next /prep._
