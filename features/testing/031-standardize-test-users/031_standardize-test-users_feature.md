# Feature: Standardize Test Users

**Feature ID**: 031
**Category**: testing
**Source**: ScriptHammer/docs/specs/026-standardize-test-users
**Status**: Ready for SpecKit (Completed in v_001)

## Description

Update E2E messaging tests to use standardized test users (PRIMARY and TERTIARY) instead of non-existent user references. Fixes tests that would fail because referenced users couldn't sign in.

## User Scenarios

### US-1: Consistent Test Users (P1)

E2E tests use pre-seeded, consistent test users that exist in the database.

**Acceptance Criteria**:

1. Given any E2E test, when users needed, then PRIMARY/TERTIARY users are used
2. Given test user sign-in, when attempted, then sign-in succeeds
3. Given messaging tests, when users interact, then both users exist and can authenticate

### US-2: Form Selector Consistency (P1)

All test files use consistent form selectors.

**Acceptance Criteria**:

1. Given sign-in form, when filled, then uses `#email` and `#password` selectors
2. Given waitForURL, when checking navigation, then uses regex pattern `/.*\/profile/`
3. Given all tests, when selectors used, then they match actual DOM elements

### US-3: User Search by Username (P2)

Tests search for users by username instead of email for better UX matching.

**Acceptance Criteria**:

1. Given user search needed, when searching, then username is used
2. Given username search, when executed, then exact match found
3. Given search results, when user selected, then correct user is identified

## Requirements

### Functional

- FR-001: PRIMARY user is `test@example.com` (pre-seeded, confirmed)
- FR-002: TERTIARY user is `test-user-b@example.com` with username `testuser-b`
- FR-003: All form selectors use `#email`, `#password` format
- FR-004: WaitForURL uses regex patterns with appropriate timeouts
- FR-005: User search uses username instead of email

### Files Changed

| File                                        | Change                                |
| ------------------------------------------- | ------------------------------------- |
| `e2e/messaging/friend-requests.spec.ts`     | Use standardized users, fix selectors |
| `e2e/messaging/encrypted-messaging.spec.ts` | Use standardized users, fix selectors |
| `e2e/messaging/offline-queue.spec.ts`       | Use standardized users, fix selectors |
| `e2e/messaging/gdpr-compliance.spec.ts`     | Use standardized users, fix selectors |

### Prerequisites

- Feature 024 merged (provides TERTIARY user seed script)
- Feature 027 merged (provides test-user-factory utilities)

### Out of Scope

- Creating new test users dynamically
- Modifying database seed scripts
- Changing authentication flow

## Success Criteria

- SC-001: All E2E messaging tests use standardized test users
- SC-002: Form selectors match actual DOM elements
- SC-003: Tests pass when run against seeded database
- SC-004: No references to non-existent users remain
