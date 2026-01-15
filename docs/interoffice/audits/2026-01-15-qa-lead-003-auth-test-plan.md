# Test Specification: 003-User Authentication & Authorization

**Author**: QA Lead Terminal
**Date**: 2026-01-15
**Feature**: 003-user-authentication
**Status**: Draft
**Total Test Cases**: 35

---

## Executive Summary

This test specification covers the User Authentication & Authorization feature (003), mapping all 6 primary user stories to testable scenarios across unit, integration, security, and E2E test categories.

| Category | Test Count | Priority |
|----------|------------|----------|
| Unit Tests | 8 | P0-P1 |
| Integration Tests | 10 | P0-P1 |
| Security Tests | 9 | P0 |
| E2E Tests | 8 | P0-P1 |
| **Total** | **35** | - |

---

## 1. User Story Mapping

### US-1: Email/Password Registration (P0)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US1-AC1 | Valid signup creates account + sends verification email | E2E | E2E-01 |
| US1-AC2 | Verification link within 24h confirms email | Integration | INT-01 |
| US1-AC3 | Signup with existing email shows error | Unit | UNIT-01 |

### US-2: User Sign In (P0)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US2-AC1 | Correct credentials → signed in + redirected | E2E | E2E-02 |
| US2-AC2 | "Remember Me" extends session to 30 days | Integration | INT-02 |
| US2-AC3 | No "Remember Me" → session expires 7 days | Integration | INT-03 |
| US2-AC4 | 5 failed attempts → 15 min lockout | Security | SEC-01 |

### US-3: Password Reset (P1)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US3-AC1 | Forgot password → reset email sent | E2E | E2E-03 |
| US3-AC2 | Reset link within 1h → password updated | Integration | INT-04 |
| US3-AC3 | Reset link after 1h → expired error | Integration | INT-05 |

### US-4: OAuth Sign In (P1)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US4-AC1 | GitHub OAuth → redirect → authenticated | E2E | E2E-04 |
| US4-AC2 | Google OAuth → redirect → authenticated | E2E | E2E-05 |
| US4-AC3 | OAuth provider unavailable → graceful error | Integration | INT-06 |

### US-5: Protected Route Access (P0)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US5-AC1 | Unauthenticated → payment page → redirect to signin | Integration | INT-07 |
| US5-AC2 | Authenticated → payment page → access granted | Integration | INT-08 |
| US5-AC3 | User sees only own transactions (RLS) | Security | SEC-02 |

### US-6: Profile Management (P2)

| ID | Acceptance Scenario | Test Type | Test ID |
|----|---------------------|-----------|---------|
| US6-AC1 | View profile shows email, display name, avatar | E2E | E2E-06 |
| US6-AC2 | Update display name persists | Integration | INT-09 |
| US6-AC3 | Account deletion cascades all data | Integration | INT-10 |

---

## 2. Unit Test Cases

### Password Validation

| ID | Test Case | Input | Expected | FR |
|----|-----------|-------|----------|-----|
| UNIT-01 | Reject existing email on signup | `existing@test.com` | Error: "Email already registered" | FR-001 |
| UNIT-02 | Reject invalid email format | `not-an-email` | Validation error | FR-002 |
| UNIT-03 | Reject password < 8 chars | `Short1!` | Validation error | FR-003 |
| UNIT-04 | Reject password without uppercase | `lowercase1!` | Validation error | FR-003 |
| UNIT-05 | Reject password without number | `NoNumbers!` | Validation error | FR-003 |
| UNIT-06 | Reject password without special char | `NoSpecial1` | Validation error | FR-003 |
| UNIT-07 | Accept valid password | `Valid1Pass!` | Validation passes | FR-003 |

### Token Generation

| ID | Test Case | Input | Expected | FR |
|----|-----------|-------|----------|-----|
| UNIT-08 | Verification token is unique | Generate 1000 tokens | All unique | FR-004 |

---

## 3. Integration Test Cases

### Auth Flow End-to-End

| ID | Test Case | Precondition | Steps | Expected | FR |
|----|-----------|--------------|-------|----------|-----|
| INT-01 | Email verification completes | Unverified account exists | Click verification link | `email_verified = true` | FR-004, FR-005 |
| INT-02 | Remember Me extends session | Valid credentials | Sign in with "Remember Me" | Session expiry = 30 days | FR-013 |
| INT-03 | Default session duration | Valid credentials | Sign in without "Remember Me" | Session expiry = 7 days | FR-014 |
| INT-04 | Password reset within expiry | Reset link < 1 hour | Click link, set new password | Password updated | FR-010, FR-011 |
| INT-05 | Password reset expired | Reset link > 1 hour | Click link | "Link expired" error | FR-011 |
| INT-06 | OAuth provider failure | OAuth unavailable | Attempt OAuth | "Unable to connect" error | US4-AC3 |
| INT-07 | Unauthenticated route protection | No session | Access `/payments` | Redirect to `/signin` | FR-017 |
| INT-08 | Authenticated route access | Valid session | Access `/payments` | Page renders | FR-017 |
| INT-09 | Profile update persists | Authenticated user | Update display name | Name persisted on refresh | FR-025 |
| INT-10 | Account deletion cascades | Authenticated user | Delete account | All user data removed | FR-027, FR-028 |

---

## 4. Security Test Cases

### Brute Force Protection

| ID | Test Case | Attack Vector | Expected | FR | SEC Finding |
|----|-----------|---------------|----------|-----|-------------|
| SEC-01 | Login rate limiting | 5+ failed attempts | 15 min lockout | FR-016 | - |
| SEC-02 | RLS user isolation | Query other user's data | Empty result set | FR-019 | - |
| SEC-03 | Session invalidation on password change | Change password | All other sessions invalidated | - | SEC-003 |

### Session Hijacking Prevention

| ID | Test Case | Attack Vector | Expected | SEC Finding |
|----|-----------|---------------|----------|-------------|
| SEC-04 | Token replay after logout | Reuse old token | 401 Unauthorized | - |
| SEC-05 | Session fixation | Pre-set session ID | New session generated on login | - |

### Information Leakage

| ID | Test Case | Attack Vector | Expected | SEC Finding |
|----|-----------|---------------|----------|-------------|
| SEC-06 | Email enumeration on signup | Probe existing emails | Timing-safe response | SEC-001 |
| SEC-07 | Password reset rate limiting | Spam reset requests | Rate limit (3/hr/email) | SEC-002 |

### OAuth Security

| ID | Test Case | Attack Vector | Expected | SEC Finding |
|----|-----------|---------------|----------|-------------|
| SEC-08 | PKCE enforcement | OAuth without PKCE | Request rejected | SEC-004 |
| SEC-09 | OAuth state validation | Tampered state param | Request rejected | FR-005-007 |

---

## 5. E2E Test Cases

### Registration Journey

| ID | Test Case | User Action | Expected Outcome | Priority |
|----|-----------|-------------|------------------|----------|
| E2E-01 | Complete signup flow | Enter email/password → Submit → Check email → Click verify | Account active, can sign in | P0 |
| E2E-02 | Complete signin flow | Enter credentials → Submit | Dashboard displayed | P0 |
| E2E-03 | Password reset journey | Click "Forgot Password" → Enter email → Check email → Click link → Set new password | Can sign in with new password | P1 |

### OAuth Journeys

| ID | Test Case | User Action | Expected Outcome | Priority |
|----|-----------|-------------|------------------|----------|
| E2E-04 | GitHub OAuth signup | Click "Sign in with GitHub" → Authorize → Return | Authenticated session | P1 |
| E2E-05 | Google OAuth signup | Click "Sign in with Google" → Authorize → Return | Authenticated session | P1 |

### Profile Journeys

| ID | Test Case | User Action | Expected Outcome | Priority |
|----|-----------|-------------|------------------|----------|
| E2E-06 | View and edit profile | Navigate to profile → Edit name → Save | Changes persisted | P2 |
| E2E-07 | Unverified user flow | Sign up → Skip verify → Access payments | Redirect to verification page | P1 |
| E2E-08 | Account deletion flow | Profile → Delete Account → Confirm | Account removed, redirected to home | P2 |

---

## 6. Test File Structure

```
tests/
├── auth/
│   ├── unit/
│   │   ├── password-validation.test.ts    # UNIT-01 to UNIT-07
│   │   └── token-generation.test.ts       # UNIT-08
│   ├── integration/
│   │   ├── email-verification.test.ts     # INT-01
│   │   ├── session-management.test.ts     # INT-02, INT-03
│   │   ├── password-reset.test.ts         # INT-04, INT-05
│   │   ├── oauth-flow.test.ts             # INT-06
│   │   ├── route-protection.test.ts       # INT-07, INT-08
│   │   ├── profile-management.test.ts     # INT-09, INT-10
│   ├── security/
│   │   ├── brute-force.test.ts            # SEC-01, SEC-03
│   │   ├── session-security.test.ts       # SEC-04, SEC-05
│   │   ├── info-leakage.test.ts           # SEC-06, SEC-07
│   │   ├── oauth-security.test.ts         # SEC-08, SEC-09
│   │   └── rls-isolation.test.ts          # SEC-02
│   └── e2e/
│       ├── registration.spec.ts           # E2E-01
│       ├── signin.spec.ts                 # E2E-02
│       ├── password-reset.spec.ts         # E2E-03
│       ├── oauth.spec.ts                  # E2E-04, E2E-05
│       └── profile.spec.ts                # E2E-06, E2E-07, E2E-08
└── fixtures/
    └── test-users.ts                      # Shared user factory
```

---

## 7. Test Fixtures Required

### User Factory

```typescript
interface TestUser {
  email: string;
  password: string;
  verified: boolean;
  rememberMe: boolean;
}

export const testUsers = {
  verified: { email: 'verified@test.com', password: 'Test1Pass!', verified: true },
  unverified: { email: 'unverified@test.com', password: 'Test1Pass!', verified: false },
  oauth: { email: 'oauth@test.com', provider: 'github' },
  locked: { email: 'locked@test.com', failedAttempts: 5 },
};
```

---

## 8. Success Criteria Mapping

| Criteria | Requirement | Test Coverage |
|----------|-------------|---------------|
| SC-001 | Registration < 3 min | E2E-01 (timing) |
| SC-002 | Sign-in < 2 sec (95%) | E2E-02 (performance) |
| SC-003 | 1,000 concurrent sessions | Load test (separate) |
| SC-004 | Zero unauthorized access | SEC-02, SEC-04, SEC-05 |
| SC-005 | Password reset < 2 min | E2E-03 (timing) |
| SC-006 | OAuth < 10 sec | E2E-04, E2E-05 (timing) |
| SC-007 | Auth events logged < 1 sec | INT-* (verify logging) |
| SC-008 | Expired sessions redirect | INT-07 |

---

## 9. Security Findings Coverage

| Finding | Description | Test ID | Status |
|---------|-------------|---------|--------|
| SEC-001 | Email enumeration via signup error | SEC-06 | Covered |
| SEC-002 | Password reset not rate-limited | SEC-07 | Covered |
| SEC-003 | Sessions not invalidated on password change | SEC-03 | Covered |
| SEC-004 | PKCE not required for OAuth | SEC-08 | Covered |
| SEC-005 | OAuth error messages may leak info | INT-06 | Partial |

---

## 10. Dependencies

| Dependency | Required For | Status |
|------------|--------------|--------|
| Supabase Auth | All tests | Required |
| Test email service | INT-01, E2E-01, E2E-03 | Required |
| OAuth test apps | E2E-04, E2E-05 | Required |
| Feature 000 (RLS) | SEC-02 | Complete |
| Feature 005 (Security) | SEC-* | Parallel |

---

## 11. Execution Notes

### Parallelization

| Test Group | Parallelizable | Notes |
|------------|----------------|-------|
| UNIT-* | Yes | No shared state |
| INT-01 to INT-06 | Yes | Independent flows |
| INT-07 to INT-10 | Partial | Share user state |
| SEC-* | No | Rate limit tests conflict |
| E2E-* | No | Browser state sensitive |

### Manual Verification Required

| Test | Reason |
|------|--------|
| E2E-04 | OAuth popup handling |
| E2E-05 | OAuth popup handling |
| SEC-06 | Timing analysis |

---

## Summary

| Metric | Value |
|--------|-------|
| User Stories Covered | 6/6 (US-1 to US-6) |
| Acceptance Scenarios | 16/16 |
| Security Findings Covered | 5/5 |
| Test Cases | 35 |
| Estimated Coverage | 95%+ |

**Next Steps**:
1. Implement test fixtures (`tests/fixtures/test-users.ts`)
2. Create unit test suite (`tests/auth/unit/`)
3. Create integration test suite (`tests/auth/integration/`)
4. Create security test suite (`tests/auth/security/`)
5. Create E2E test suite (`tests/auth/e2e/`)

---

*Test Specification completed by QA Lead Terminal*
*Report: docs/interoffice/audits/2026-01-15-qa-lead-003-auth-test-plan.md*
