# DEC-007: Auth Security Enhancements - Session Invalidation and PKCE

**Date**: 2026-01-15
**RFC**: RFC-006
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

Two security enhancements approved for Feature 003 (Auth) and Feature 005 (Security):

### Session Invalidation on Password Change

Add to Feature 003 spec:

- **FR-034**: System MUST invalidate all active sessions (except current) when user changes password
- **FR-035**: System MUST invalidate all active sessions when user requests "sign out everywhere"
- **FR-036**: System MUST notify user of session invalidation count after password change

### PKCE for OAuth

Add to Feature 005 spec:

- **FR-048**: System MUST use PKCE for all OAuth authorization flows
- **FR-049**: System MUST generate cryptographically random code_verifier (minimum 43 characters)
- **FR-050**: System MUST use S256 challenge method
- **FR-051**: System MUST reject OAuth flows without valid PKCE parameters

## Rationale

1. **Session invalidation** - Industry standard practice. If credentials are compromised and user changes password, attacker sessions must be terminated.

2. **PKCE** - Required for static site deployment (GitHub Pages). No backend to protect authorization codes. OAuth 2.1 mandates PKCE for all clients.

Both features supported natively by Supabase Auth SDK - minimal implementation effort.

## Dissenting Views

None recorded.

## Impact

| Area             | Impact                              | Mitigation                 |
| ---------------- | ----------------------------------- | -------------------------- |
| Feature 003 Spec | Add 3 FRs (FR-034-036)              | Minor edit                 |
| Feature 005 Spec | Add 4 FRs (FR-048-051)              | Minor edit                 |
| Implementation   | Minimal - Supabase SDK handles both | Document SDK configuration |
| Testing          | Add session invalidation test cases | Include in E2E suite       |

## Implementation

- [ ] Update Feature 003 spec with FR-034, FR-035, FR-036
- [ ] Update Feature 005 spec with FR-048, FR-049, FR-050, FR-051
- [ ] Verify Supabase client config includes `flowType: 'pkce'`
- [ ] Add E2E tests for session invalidation on password change
