# RFC-006: Auth Security Enhancements - Session Invalidation and PKCE

**Status**: decided
**Author**: Security Lead
**Created**: 2026-01-15
**Target Decision**: 2026-01-17
**Source**: Security Audit `docs/interoffice/audits/2026-01-15-security-003-auth-audit.md`

## Stakeholders (Consensus Required)

| Stakeholder   | Vote        | Date       |
| ------------- | ----------- | ---------- |
| CTO           | **approve** | 2026-01-15 |
| Architect     | **approve** | 2026-01-15 |
| Security Lead | **approve** | 2026-01-15 |
| Toolsmith     | **approve** | 2026-01-15 |
| DevOps        | **approve** | 2026-01-15 |
| ProductOwner  | **approve** | 2026-01-15 |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

This RFC proposes two security enhancements to Feature 003 (User Authentication) identified during security audit:

1. **SEC-003**: Require session invalidation when a user changes their password
2. **SEC-004**: Mandate PKCE (Proof Key for Code Exchange) for all OAuth flows

Both findings are rated MEDIUM severity and should be addressed before implementation begins.

## Motivation

### SEC-003: Session Invalidation on Password Change

**Current State**: Feature 003 spec allows password changes (FR-026) but does not require invalidation of existing sessions.

**Risk**: If a user's credentials are compromised and they change their password, the attacker's existing session remains valid. This defeats the purpose of password rotation as a security recovery measure.

**Real-World Scenario**:

1. Attacker obtains user credentials via phishing
2. Attacker creates persistent session with "Remember Me" (30-day validity)
3. User notices suspicious activity and changes password
4. Attacker's session remains valid for up to 30 days

### SEC-004: PKCE for OAuth

**Current State**: Feature 005 specifies OAuth state parameter validation (FR-005-007) but does not explicitly require PKCE.

**Risk**: ScriptHammer deploys as a static site (GitHub Pages). Without PKCE, authorization code interception attacks are possible, especially on mobile browsers or shared networks.

**OWASP Recommendation**: PKCE is now required for ALL OAuth clients (not just mobile/native) per OAuth 2.1 draft specification.

## Proposal

### Change 1: Add Session Invalidation Requirement

Add to Feature 003 spec.md:

```markdown
**Session Security**

- **FR-034**: System MUST invalidate all active sessions (except current) when user changes password
- **FR-035**: System MUST invalidate all active sessions when user requests "sign out everywhere"
- **FR-036**: System MUST notify user of session invalidation count after password change
```

### Change 2: Add PKCE Requirement

Add to Feature 005 spec.md:

```markdown
**OAuth Security (Enhanced)**

- **FR-048**: System MUST use PKCE (Proof Key for Code Exchange) for all OAuth authorization flows
- **FR-049**: System MUST generate cryptographically random code_verifier (minimum 43 characters)
- **FR-050**: System MUST use S256 challenge method (SHA-256 hash of code_verifier)
- **FR-051**: System MUST reject OAuth flows that do not include valid PKCE parameters
```

### Implementation Notes

**Session Invalidation**:

- Supabase Auth supports `signOut({ scope: 'global' })` for invalidating all sessions
- On password change, call global signout then create fresh session for current user
- Display toast: "Password changed. X other sessions have been signed out."

**PKCE**:

- Supabase Auth JS SDK supports PKCE by default since v2.0
- Verify `flowType: 'pkce'` is set in Supabase client configuration
- No additional implementation work required if using current SDK

## Alternatives Considered

### Alternative A: Session Invalidation - User Choice

Allow users to choose whether to invalidate other sessions on password change.

**Pros**:

- More flexible for users with legitimate multiple devices
- Matches some competitor behavior (Google, Microsoft)

**Cons**:

- Users often don't understand security implications
- Default should be secure; opt-out for convenience is risky
- Adds UX complexity

**Verdict**: Rejected. Security-first approach requires automatic invalidation.

### Alternative B: PKCE - Optional Based on Provider

Only require PKCE for providers that support it (GitHub supports it, older providers may not).

**Pros**:

- Maximum provider compatibility

**Cons**:

- Creates inconsistent security posture
- All modern providers (GitHub, Google) support PKCE
- OAuth 2.1 mandates PKCE universally

**Verdict**: Rejected. Both target providers (GitHub, Google) support PKCE.

### Alternative C: Do Nothing

Accept the current spec and rely on Supabase defaults.

**Pros**:

- No spec changes required
- Supabase may handle some of this automatically

**Cons**:

- Implicit security is not auditable
- Spec should explicitly state security requirements
- Cannot verify compliance without explicit requirements

**Verdict**: Rejected. Explicit requirements enable verification.

## Impact Assessment

| Area             | Impact                                        | Mitigation                       |
| ---------------- | --------------------------------------------- | -------------------------------- |
| Feature 003 Spec | Add 3 new FRs (FR-034 to FR-036)              | Minor edit, no structural change |
| Feature 005 Spec | Add 4 new FRs (FR-048 to FR-051)              | Minor edit, no structural change |
| Implementation   | Minimal - Supabase SDK handles both           | Document SDK configuration       |
| Testing          | Add test cases for session invalidation       | Include in E2E test suite        |
| User Experience  | Password change flow shows invalidation count | Positive security feedback       |
| Documentation    | Update auth flow diagrams                     | Include in plan.md               |

## Discussion Thread

### Security Lead - 2026-01-15 - Initial Proposal

These findings emerged from the security audit of Feature 003. Both are industry standard practices:

1. **Session invalidation on password change** is implemented by all major platforms (Google, Apple, Microsoft, GitHub). Users expect this behavior.

2. **PKCE** is required by OAuth 2.1 (draft) and recommended by OWASP for ALL clients since 2020. Our static site deployment makes this especially critical.

The good news: Supabase Auth SDK supports both features natively. This is primarily a specification clarification to ensure we configure the SDK correctly and can audit compliance.

I recommend fast-tracking this RFC given the low implementation impact and clear security benefit.

### Architect (2026-01-15) - Vote: APPROVE

Both proposals are architecturally sound:

**Session Invalidation (SEC-003)**:

- Aligns with principle #6 (Privacy First) - user control over sessions
- Supabase `signOut({ scope: 'global' })` provides clean implementation path
- FRs 034-036 are well-scoped and testable

**PKCE (SEC-004)**:

- Critical for static site deployment (GitHub Pages has no backend secret storage)
- OAuth 2.1 compliance future-proofs the implementation
- Supabase SDK v2.0+ defaults to PKCE - minimal config change required

Implementation impact is correctly assessed as minimal. The spec changes formalize what should be default behavior, enabling audit verification. Strongly support.

### CTO (2026-01-15) - Vote: APPROVE

Both enhancements are table stakes for a modern auth system:

1. **Session invalidation on password change** - Users expect this. It's a trust signal. Failing to implement would be a UX regression compared to every major platform.

2. **PKCE** - Our static site deployment model (GitHub Pages) makes this critical. We have no backend to guard authorization codes. PKCE is the only defense against code interception.

The fact that Supabase SDK handles both natively is fortunate. We're formalizing requirements, not adding implementation burden.

Approved. Fast-track recommended given low effort and clear security benefit.

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: 2026-01-15
**Outcome**: APPROVED (6-0 unanimous)
**Decision ID**: DEC-007

Session invalidation on password change (FR-034-036) and PKCE requirement (FR-048-051) approved. Update Feature 003 and 005 specs accordingly.
