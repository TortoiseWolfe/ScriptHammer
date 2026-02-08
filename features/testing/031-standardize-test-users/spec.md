# Feature Specification: Standardize Test Users

**Feature ID**: 031-standardize-test-users
**Created**: 2025-12-31
**Status**: Specified
**Category**: Testing

## Overview

Standardize all E2E messaging tests to use consistent, pre-seeded test users (PRIMARY and TERTIARY) instead of ad-hoc or non-existent user references. This ensures tests can reliably sign in, interact, and validate messaging functionality without authentication failures caused by missing users. Also standardizes form selectors and search patterns across all test files.

---

## User Scenarios & Testing

### User Story 1 - Consistent Test User Authentication (Priority: P1)

A test developer runs E2E messaging tests and expects all user sign-ins to succeed using pre-seeded test accounts.

**Why this priority**: Tests cannot execute without valid users. This is the fundamental fix that enables all other test functionality.

**Independent Test**: Run any messaging E2E test, verify PRIMARY and TERTIARY users can sign in successfully.

**Acceptance Scenarios**:

1. **Given** any E2E messaging test requires user authentication, **When** test uses PRIMARY user credentials, **Then** sign-in succeeds and user reaches profile page
2. **Given** test requires a second user for interaction, **When** test uses TERTIARY user credentials, **Then** sign-in succeeds for the second user
3. **Given** messaging tests require two-way interaction, **When** both users participate, **Then** both users exist in database and can authenticate
4. **Given** test user credentials are used, **When** database is seeded, **Then** credentials match seeded user records exactly

---

### User Story 2 - Consistent Form Selectors (Priority: P1)

A test developer writes or maintains tests using standardized selectors that match the actual DOM structure.

**Why this priority**: Incorrect selectors cause test failures even when functionality works. Standardization prevents selector drift.

**Independent Test**: Run all E2E tests, verify zero selector-related failures for sign-in forms.

**Acceptance Scenarios**:

1. **Given** sign-in form needs to be filled, **When** test uses email selector, **Then** `#email` selector finds the input element
2. **Given** sign-in form needs password, **When** test uses password selector, **Then** `#password` selector finds the input element
3. **Given** navigation verification needed, **When** test waits for profile page, **Then** regex pattern `/.*\/profile/` matches the URL
4. **Given** any test file updated, **When** form selectors are used, **Then** they match actual DOM element IDs

---

### User Story 3 - Username-Based User Search (Priority: P2)

A test locates users by username rather than email to match the application's user-facing search behavior.

**Why this priority**: Aligns test behavior with actual user experience. Less critical than authentication but improves test realism.

**Independent Test**: Search for TERTIARY user by username in test, verify exact match is returned.

**Acceptance Scenarios**:

1. **Given** test needs to find a user, **When** searching by username, **Then** user search uses username field not email
2. **Given** username search executed, **When** results returned, **Then** exact match is found for known username
3. **Given** user selected from search, **When** identifying user, **Then** correct user profile is identified

---

### Edge Cases

**Database Not Seeded**:

- Test runs against empty or unseeded database
- Tests fail fast with clear error about missing seed data
- Error message identifies which users are missing

**User Email/Password Changed**:

- Seeded user credentials differ from test expectations
- Tests fail at sign-in with clear authentication error
- Credential mismatch is identifiable in error logs

**Selector Changed in Application**:

- DOM element IDs change without test update
- Test fails with element not found error
- Failure points to specific selector needing update

**Concurrent Test Execution**:

- Multiple tests run using same test users
- Tests should be designed to not conflict
- Each test cleans up its own test data artifacts

**TERTIARY User Not Seeded**:

- Only PRIMARY user exists, TERTIARY is missing
- Multi-user tests fail with specific user not found
- Clear error identifies TERTIARY user as missing

---

## Requirements

### Functional Requirements

**Test User Standards**:

- **FR-001**: PRIMARY test user MUST use standardized credentials available in seeded database
- **FR-002**: TERTIARY test user MUST use standardized credentials available in seeded database
- **FR-003**: TERTIARY user MUST have a defined username for search-based lookups
- **FR-004**: All multi-user tests MUST use PRIMARY and TERTIARY users only
- **FR-005**: No test MUST reference users that don't exist in seeded database

**Form Selector Standards**:

- **FR-006**: Email input selector MUST use `#email` ID selector
- **FR-007**: Password input selector MUST use `#password` ID selector
- **FR-008**: Profile page wait MUST use regex pattern matching `/profile` path
- **FR-009**: All selectors MUST match actual DOM element IDs in the application
- **FR-010**: Selector patterns MUST be consistent across all test files

**Search Standards**:

- **FR-011**: User search in tests MUST use username instead of email
- **FR-012**: Username search MUST return exact matches

**Test File Updates**:

- **FR-013**: Friend requests test file MUST be updated to use standardized users and selectors
- **FR-014**: Encrypted messaging test file MUST be updated to use standardized users and selectors
- **FR-015**: Offline queue test file MUST be updated to use standardized users and selectors
- **FR-016**: GDPR compliance test file MUST be updated to use standardized users and selectors

**Error Handling**:

- **FR-017**: Tests MUST fail with clear error messages when users cannot authenticate
- **FR-018**: Tests MUST fail fast if required seed data is missing

### Non-Functional Requirements

**Reliability**:

- **NFR-001**: All E2E messaging tests MUST pass when run against properly seeded database
- **NFR-002**: Tests MUST NOT have intermittent failures due to user credential issues
- **NFR-003**: Test failures MUST clearly indicate root cause (authentication vs. functionality)

**Maintainability**:

- **NFR-004**: User credentials MUST be defined in a single location for easy updates
- **NFR-005**: Selector patterns MUST be consistent to reduce maintenance burden
- **NFR-006**: Test files MUST follow same patterns for predictability

**Performance**:

- **NFR-007**: User authentication in tests MUST complete within reasonable timeout (30 seconds)
- **NFR-008**: Tests MUST NOT be slowed by authentication retries due to invalid credentials

### Key Entities

**PRIMARY Test User**:

- Purpose: Main authenticated user in tests
- Credentials: Pre-defined email/password in seed data
- State: Always exists in seeded database, email confirmed

**TERTIARY Test User**:

- Purpose: Second user for multi-user interaction tests
- Credentials: Pre-defined email/password in seed data
- Username: Defined for search-based lookups
- State: Always exists in seeded database, email confirmed

**Form Selectors**:

- Email input: `#email`
- Password input: `#password`
- Profile URL pattern: `/.*\/profile/`

**Test Files (scope)**:

- friend-requests.spec.ts
- encrypted-messaging.spec.ts
- offline-queue.spec.ts
- gdpr-compliance.spec.ts

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four E2E messaging test files use standardized PRIMARY and TERTIARY test users
- **SC-002**: All form selectors (`#email`, `#password`) match actual DOM elements
- **SC-003**: All E2E messaging tests pass when run against properly seeded database
- **SC-004**: Zero references to non-existent or ad-hoc users remain in test files
- **SC-005**: User search in tests uses username instead of email
- **SC-006**: Test authentication failures produce clear, actionable error messages

---

## Dependencies

- **007-E2E Testing Framework**: Provides testing infrastructure and patterns
- **003-User Authentication**: Defines authentication flow being tested
- **Database Seed Scripts**: Must include PRIMARY and TERTIARY users

## Out of Scope

- Creating new test users dynamically at runtime
- Modifying database seed scripts (assumes they exist)
- Changing the authentication flow or UI
- Adding new test files (only updating existing four files)
- Test user factory utilities (handled by separate feature)

## Assumptions

- Database seed scripts already include PRIMARY test user
- Database seed scripts can be extended to include TERTIARY user
- DOM element IDs for sign-in form are stable (`#email`, `#password`)
- Profile page URL follows `/profile` pattern
- E2E test framework supports regex URL matching
- Test users have confirmed email status in seeded data
