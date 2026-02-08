# Feature: Sign-up E2E Tests

**Feature ID**: 032
**Category**: testing
**Source**: ScriptHammer_v_001/docs/specs/027-signup-e2e-tests
**Status**: Ready for SpecKit (Completed in v_001)

## Description

Comprehensive E2E testing infrastructure for user sign-up flows with proper test user management. Includes test user factory for creating/deleting users via admin API, cleanup utilities, and full sign-up flow testing.

## User Scenarios

### US-1: Test User Factory (P1)

Developers can create and clean up test users programmatically.

**Acceptance Criteria**:

1. Given test needs user, when factory called, then user created with auto-confirmed email
2. Given test complete, when cleanup called, then user and associated data deleted
3. Given admin client unavailable, when checked, then graceful fallback provided

### US-2: Successful Sign-up Flow (P1)

E2E test verifies complete sign-up flow with valid credentials.

**Acceptance Criteria**:

1. Given sign-up form, when valid data entered, then account created
2. Given account created, when email confirmed, then user can sign in
3. Given sign-up complete, when checking database, then profile exists

### US-3: Validation Error Testing (P2)

E2E tests verify all validation scenarios.

**Acceptance Criteria**:

1. Given duplicate email, when submitted, then error displayed
2. Given weak password, when submitted, then validation error shown
3. Given invalid email format, when submitted, then error displayed
4. Given password mismatch, when submitted, then error shown

### US-4: Navigation and UI Testing (P3)

E2E tests verify navigation and OAuth button presence.

**Acceptance Criteria**:

1. Given sign-up page, when "Sign in" clicked, then navigates to sign-in
2. Given sign-up page, when OAuth buttons visible, then Google/GitHub present
3. Given navigation complete, when checking URL, then correct route displayed

## Requirements

### Functional

**Test User Factory**

- FR-001: `createTestUser(email, password, options)` creates user with auto-confirmed email
- FR-002: `deleteTestUser(userId)` cleans up user and associated data
- FR-003: `deleteTestUserByEmail(email)` cleans up by email address
- FR-004: `createUserProfile(userId, username)` creates user_profiles record
- FR-005: `generateTestEmail(prefix)` generates unique test emails
- FR-006: `isAdminClientAvailable()` checks admin API configuration

**E2E Tests**

- FR-007: Successful sign-up with valid credentials
- FR-008: Duplicate email error handling
- FR-009: Weak password validation
- FR-010: Invalid email format validation
- FR-011: Password mismatch validation
- FR-012: Navigation to sign-in
- FR-013: OAuth button presence
- FR-014: Admin-created user sign-in flow

### Files Created/Modified

- `e2e/utils/test-user-factory.ts` (NEW)
- `e2e/utils/index.ts` (NEW)
- `e2e/auth/sign-up.spec.ts` (NEW)
- `tests/fixtures/test-user.ts` (MODIFIED)

### Dependencies

- `SUPABASE_SERVICE_ROLE_KEY` must be set for admin operations
- Supabase project must be running

### Out of Scope

- Email verification automation (requires external service)
- Social OAuth testing (requires provider credentials)
- Password reset flow testing

## Success Criteria

- SC-001: Test user factory can create/delete users via admin API
- SC-002: All sign-up E2E tests pass
- SC-003: Tests clean up after themselves (no orphaned data)
- SC-004: Duplicate email test works with admin client
- SC-005: Factory gracefully handles missing admin credentials
