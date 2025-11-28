# Feature 027: Sign-up E2E Tests

## Overview

Add comprehensive E2E testing infrastructure for user sign-up flows with proper test user management.

## Problem Statement

Current E2E tests have issues:

1. Test users created during sign-up tests aren't cleaned up
2. No admin API integration for auto-confirming test users
3. Some messaging tests reference non-existent users

## Solution

### 1. Test User Factory (`e2e/utils/test-user-factory.ts`)

A utility module providing:

- `createTestUser(email, password, options)` - Create user with auto-confirmed email
- `deleteTestUser(userId)` - Clean up user and associated data
- `deleteTestUserByEmail(email)` - Clean up by email address
- `createUserProfile(userId, username)` - Create user_profiles record
- `generateTestEmail(prefix)` - Generate unique test emails
- `isAdminClientAvailable()` - Check if admin API is configured

### 2. Sign-up E2E Tests (`e2e/auth/sign-up.spec.ts`)

Comprehensive tests:

- Successful sign-up with valid credentials
- Duplicate email error handling
- Weak password validation
- Invalid email format validation
- Password mismatch validation
- Navigation to sign-in
- OAuth button presence
- Admin-created user sign-in flow

### 3. Test User Fixture Updates (`tests/fixtures/test-user.ts`)

Added:

- `TEST_EMAIL_TERTIARY` - Third test user for messaging tests
- `TEST_PASSWORD_TERTIARY` - Third test user password
- `TEST_USERNAME_TERTIARY` - Third test user username
- `hasTertiaryUser()` - Check if tertiary user is configured

## Files Changed

- `e2e/utils/test-user-factory.ts` (NEW)
- `e2e/utils/index.ts` (NEW)
- `e2e/auth/sign-up.spec.ts` (NEW)
- `tests/fixtures/test-user.ts` (MODIFIED)

## Success Criteria

- [ ] Test user factory can create/delete users via admin API
- [ ] Sign-up E2E tests pass
- [ ] Tests clean up after themselves
- [ ] Duplicate email test works (requires admin client)

## Dependencies

- `SUPABASE_SERVICE_ROLE_KEY` must be set for admin operations
- Supabase project must be running
