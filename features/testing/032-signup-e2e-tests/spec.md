# Feature Specification: Sign-up E2E Tests

**Feature ID**: 032-signup-e2e-tests
**Created**: 2025-12-31
**Status**: Specified
**Category**: Testing

## Overview

Comprehensive E2E testing infrastructure for user sign-up flows including a test user factory for programmatic user creation and cleanup. The factory uses admin API access to create users with auto-confirmed emails, enabling true end-to-end testing of the sign-up flow. Tests cover successful registration, validation errors, duplicate email handling, and navigation flows.

---

## User Scenarios & Testing

### User Story 1 - Test User Factory (Priority: P1)

A test developer needs to programmatically create and clean up test users to enable isolated, repeatable E2E tests.

**Why this priority**: Foundation for all E2E authentication tests. Without reliable user creation/cleanup, tests cannot be isolated or repeatable.

**Independent Test**: Create user via factory, verify user exists in database, delete user, verify user is removed.

**Acceptance Scenarios**:

1. **Given** test requires a new user, **When** factory createTestUser is called, **Then** user is created with auto-confirmed email status
2. **Given** test is complete, **When** factory cleanup is called, **Then** user and all associated data are deleted
3. **Given** unique email needed, **When** generateTestEmail is called, **Then** unique timestamped email is returned
4. **Given** admin credentials not configured, **When** factory methods called, **Then** graceful error with clear message is returned

---

### User Story 2 - Successful Sign-up Flow Test (Priority: P1)

An E2E test verifies the complete sign-up flow from form submission to successful account creation.

**Why this priority**: Core happy path test that validates the primary sign-up functionality works correctly.

**Independent Test**: Fill sign-up form with valid data, submit, verify account creation and profile existence.

**Acceptance Scenarios**:

1. **Given** sign-up form is displayed, **When** valid email, password, and confirmation entered, **Then** form submits successfully
2. **Given** account created via sign-up, **When** email is confirmed (via admin), **Then** user can sign in with credentials
3. **Given** sign-up complete, **When** checking database, **Then** user profile record exists with correct data

---

### User Story 3 - Validation Error Testing (Priority: P2)

E2E tests verify that all validation scenarios display appropriate error messages.

**Why this priority**: Important for user experience but tests secondary flows after happy path is verified.

**Independent Test**: Submit form with each type of invalid data, verify correct error message displays.

**Acceptance Scenarios**:

1. **Given** email already registered, **When** submitted, **Then** "Email already registered" error displays
2. **Given** password doesn't meet strength requirements, **When** submitted, **Then** password validation error displays
3. **Given** invalid email format entered, **When** submitted, **Then** email format error displays
4. **Given** password and confirmation don't match, **When** submitted, **Then** password mismatch error displays
5. **Given** required field empty, **When** submitted, **Then** required field error displays

---

### User Story 4 - Navigation and UI Testing (Priority: P3)

E2E tests verify page navigation links and OAuth button presence.

**Why this priority**: UI verification tests that are nice-to-have after core functionality is validated.

**Independent Test**: Click navigation links, verify correct pages load; check OAuth buttons are present.

**Acceptance Scenarios**:

1. **Given** sign-up page displayed, **When** "Sign in" link clicked, **Then** navigation to sign-in page occurs
2. **Given** sign-up page displayed, **When** checking OAuth section, **Then** Google and GitHub buttons are visible
3. **Given** navigation complete, **When** verifying URL, **Then** correct route path is displayed

---

### Edge Cases

**Admin Client Unavailable**:

- Service role key not configured or invalid
- Factory methods return clear error explaining missing configuration
- Tests skip gracefully with informative message

**User Already Exists**:

- Attempt to create user with existing email via factory
- Factory handles gracefully, either returns existing user or error
- Clear error message identifies conflict

**Cleanup Failure**:

- User deletion fails due to foreign key constraints
- Factory cascades deletion or handles gracefully
- Orphaned data is logged for manual cleanup

**Network Timeout**:

- Admin API request times out
- Appropriate timeout error returned
- Test can retry or fail cleanly

**Concurrent Test Execution**:

- Multiple tests create users simultaneously
- Unique email generation prevents collisions
- Tests remain isolated from each other

**Rate Limiting**:

- Too many user creations trigger rate limits
- Factory handles rate limit errors appropriately
- Tests wait and retry or skip with message

---

## Requirements

### Functional Requirements

**Test User Factory**:

- **FR-001**: Factory MUST provide createTestUser function that creates user with specified email and password
- **FR-002**: Factory MUST auto-confirm email for created users (bypassing email verification)
- **FR-003**: Factory MUST provide deleteTestUser function that removes user by ID
- **FR-004**: Factory MUST provide deleteTestUserByEmail function that removes user by email
- **FR-005**: Factory MUST cascade delete associated data (profile, sessions) when user deleted
- **FR-006**: Factory MUST provide createUserProfile function that creates profile record
- **FR-007**: Factory MUST provide generateTestEmail function that generates unique timestamped emails
- **FR-008**: Factory MUST provide isAdminClientAvailable check for configuration validation
- **FR-009**: Factory MUST return clear error messages when admin client is unavailable

**Sign-up Flow Tests**:

- **FR-010**: Tests MUST verify successful sign-up with valid credentials
- **FR-011**: Tests MUST verify user can sign in after admin-confirmed email
- **FR-012**: Tests MUST verify user profile is created upon sign-up

**Validation Tests**:

- **FR-013**: Tests MUST verify duplicate email error is displayed
- **FR-014**: Tests MUST verify weak password error is displayed
- **FR-015**: Tests MUST verify invalid email format error is displayed
- **FR-016**: Tests MUST verify password mismatch error is displayed
- **FR-017**: Tests MUST verify required field errors are displayed

**Navigation Tests**:

- **FR-018**: Tests MUST verify navigation from sign-up to sign-in page
- **FR-019**: Tests MUST verify OAuth buttons (Google, GitHub) are present on sign-up page

**Cleanup**:

- **FR-020**: Tests MUST clean up created test users after each test
- **FR-021**: Cleanup MUST run even if test fails (afterEach hook)
- **FR-022**: No orphaned test data MUST remain after test suite completes

### Non-Functional Requirements

**Reliability**:

- **NFR-001**: Test user factory MUST successfully create users 99%+ of the time when admin client available
- **NFR-002**: Cleanup MUST complete successfully to prevent data accumulation
- **NFR-003**: Tests MUST be deterministic (same result on each run)

**Performance**:

- **NFR-004**: User creation via factory MUST complete within 5 seconds
- **NFR-005**: User deletion via factory MUST complete within 3 seconds
- **NFR-006**: Full sign-up test suite MUST complete within 2 minutes

**Isolation**:

- **NFR-007**: Each test MUST be independent and not rely on state from other tests
- **NFR-008**: Unique email generation MUST prevent collisions between concurrent tests
- **NFR-009**: Test failures MUST NOT affect other tests in the suite

**Maintainability**:

- **NFR-010**: Factory functions MUST be reusable across multiple test files
- **NFR-011**: Error messages MUST clearly indicate cause of failure

### Key Entities

**Test User Factory**:

- Functions: createTestUser, deleteTestUser, deleteTestUserByEmail, createUserProfile, generateTestEmail, isAdminClientAvailable
- Dependencies: Admin API client with service role access
- Purpose: Enable isolated, repeatable user creation for tests

**Test User**:

- Attributes: email (generated unique), password, user_id, email_confirmed (true)
- Relationships: Has one user_profile
- Lifecycle: Created at test start, deleted at test end

**Sign-up Form**:

- Fields: email, password, confirm password
- Validations: email format, password strength, password match, required fields
- Actions: Submit, navigate to sign-in

**Test Files**:

- test-user-factory.ts: Factory implementation
- sign-up.spec.ts: E2E test suite
- test-user.ts: Shared fixtures

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Test user factory can create users with auto-confirmed email via admin API
- **SC-002**: Test user factory can delete users and associated data cleanly
- **SC-003**: All sign-up E2E tests pass (happy path, validation errors, navigation)
- **SC-004**: Tests clean up after themselves with no orphaned data remaining
- **SC-005**: Duplicate email test works correctly using admin-created users
- **SC-006**: Factory gracefully handles missing or invalid admin credentials
- **SC-007**: Test suite completes within 2 minutes
- **SC-008**: Tests are isolated and repeatable (run multiple times with same results)

---

## Dependencies

- **031-Standardize Test Users**: Test user patterns and conventions
- **003-User Authentication**: Sign-up flow being tested
- **007-E2E Testing Framework**: Testing infrastructure
- **Admin API Access**: Service role key for user management

## Out of Scope

- Email verification automation (requires email service integration)
- Social OAuth testing (requires provider OAuth credentials)
- Password reset flow testing (separate feature)
- Two-factor authentication testing
- Rate limiting bypass for tests

## Assumptions

- Admin API (service role) access is available for test environment
- Email confirmation can be bypassed via admin user creation
- Test database can be used without affecting production data
- Unique email generation prevents all collision scenarios
- Test cleanup permissions allow deletion of any test-created data
- Sign-up form uses standard selectors (`#email`, `#password`, etc.)
