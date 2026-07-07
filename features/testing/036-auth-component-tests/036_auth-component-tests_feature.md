# Feature: Auth Component Tests

**Feature ID**: 036
**Category**: testing
**Source**: ScriptHammer README (SPEC-053)
**Status**: Ready for SpecKit

## Description

Expand 6 auth component tests with TODO comments. Complete test coverage for authentication-related components including sign-in, sign-up, password reset, and protected route handling.

## User Scenarios

### US-1: Sign-In Component Tests (P1)

Complete unit tests for sign-in form component.

**Acceptance Criteria**:

1. Given form rendered, when empty, then submit disabled
2. Given valid credentials, when submitted, then sign-in handler called
3. Given invalid credentials, when submitted, then error displayed
4. Given OAuth button, when clicked, then provider redirect triggered

### US-2: Sign-Up Component Tests (P1)

Complete unit tests for sign-up form component.

**Acceptance Criteria**:

1. Given form rendered, when empty, then submit disabled
2. Given passwords match, when validated, then no error
3. Given passwords mismatch, when validated, then error shown
4. Given weak password, when validated, then requirements shown

### US-3: Password Reset Tests (P2)

Complete unit tests for password reset flow components.

**Acceptance Criteria**:

1. Given reset request form, when email entered, then request sent
2. Given reset link, when followed, then new password form shown
3. Given new password, when submitted, then password updated

### US-4: Protected Route Tests (P2)

Complete unit tests for route protection components.

**Acceptance Criteria**:

1. Given unauthenticated user, when accessing protected route, then redirected
2. Given authenticated user, when accessing protected route, then content shown
3. Given loading state, when checking auth, then spinner displayed

## Requirements

### Functional

**Sign-In Component**

- FR-001: Test form rendering
- FR-002: Test input validation
- FR-003: Test submit handling
- FR-004: Test error display
- FR-005: Test OAuth buttons
- FR-006: Test loading states

**Sign-Up Component**

- FR-007: Test form rendering
- FR-008: Test password confirmation
- FR-009: Test password strength indicator
- FR-010: Test terms acceptance
- FR-011: Test submit handling
- FR-012: Test error display

**Password Reset**

- FR-013: Test request form
- FR-014: Test reset form
- FR-015: Test success handling
- FR-016: Test error handling

**Protected Routes**

- FR-017: Test unauthorized redirect
- FR-018: Test authorized access
- FR-019: Test loading state
- FR-020: Test auth context integration

### Components to Test

```
src/components/auth/
├── SignIn/SignIn.test.tsx
├── SignUp/SignUp.test.tsx
├── PasswordReset/PasswordReset.test.tsx
├── ProtectedRoute/ProtectedRoute.test.tsx
├── AuthProvider/AuthProvider.test.tsx
└── OAuth/OAuth.test.tsx
```

### Test Patterns

- Mock AuthContext for isolation
- Mock Supabase client
- Use React Testing Library
- Test accessibility (aria attributes)
- Test keyboard navigation

### Out of Scope

- E2E auth flow tests (covered by 032)
- OAuth provider integration tests
- Rate limiting tests

## Success Criteria

- SC-001: All 6 auth components have complete test coverage
- SC-002: No TODO comments remain in test files
- SC-003: Tests cover success and error paths
- SC-004: Accessibility tests included
- SC-005: Loading states tested
