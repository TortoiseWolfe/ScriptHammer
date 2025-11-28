# Feature 026: Standardize Test Users

## Overview

Update E2E messaging tests to use standardized test users (PRIMARY and TERTIARY) instead of non-existent user references.

## Problem Statement

4 E2E test files referenced test users that didn't exist:

- `friend-request-tester-a@example.com` - not in any seed script
- `friend-request-tester-b@example.com` - not in any seed script
- `test-deletion@example.com` - not in any seed script

These tests would fail because the users couldn't sign in.

## Solution

Update all affected files to use the standardized test users:

- **PRIMARY user**: `test@example.com` (pre-seeded, confirmed)
- **TERTIARY user**: `test-user-b@example.com` with username `testuser-b` (Feature 024)

## Files Changed

### e2e/messaging/friend-requests.spec.ts

- Updated USER_A to use PRIMARY test user
- Updated USER_B to use TERTIARY test user with username for search
- Added admin client for cleanup in beforeEach
- Fixed all form selectors (`#email`, `#password` instead of `input[name="..."]`)
- Fixed waitForURL patterns (`/.*\/profile/` instead of `/`)
- Added force clicks and proper timeouts
- Added test.setTimeout for longer tests

### e2e/messaging/encrypted-messaging.spec.ts

- Updated USER_A and USER_B to use standardized test users
- Fixed all form selectors and waitForURL patterns

### e2e/messaging/offline-queue.spec.ts

- Updated USER_A and USER_B to use standardized test users
- Fixed all form selectors

### e2e/messaging/gdpr-compliance.spec.ts

- Created TEST_USER constant from PRIMARY user
- Fixed form selectors and waitForURL patterns
- Added note about mocked deletion to prevent actual account deletion

## Key Selector Changes

All files updated from:

```javascript
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.waitForURL('/');
```

To:

```javascript
await page.fill('#email', email);
await page.fill('#password', password);
await page.waitForURL(/.*\/profile/, { timeout: 15000 });
```

## Search Pattern

Tests now search by username instead of email:

```javascript
const USER_B = {
  username: 'testuser-b', // Search uses exact username match
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

// Search by username
await searchInput.fill(USER_B.username);
await searchInput.press('Enter');
```

## Prerequisites

- Feature 024 must be merged (provides TERTIARY user seed script)
- Feature 027 must be merged (provides test-user-factory utilities)
