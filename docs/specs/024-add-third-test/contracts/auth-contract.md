# Contract: Authentication API

**Feature**: Comprehensive E2E Test Suite for User Messaging
**Contract Type**: Supabase Auth API
**Version**: 1.0.0
**Date**: 2025-11-24

## Overview

This contract defines the authentication API interactions required for test users to sign in, sign out, and maintain sessions during E2E testing.

## Endpoints

### 1. Sign In with Password

**Supabase Method**: `supabase.auth.signInWithPassword()`

**Request**:

```typescript
{
  email: string,      // Test user email
  password: string    // Test user password
}
```

**Success Response** (200 OK):

```typescript
{
  data: {
    user: {
      id: string,                    // UUID
      email: string,
      email_confirmed_at: string,    // ISO timestamp
      created_at: string,
      updated_at: string,
      user_metadata: {
        username?: string,
        display_name?: string
      }
    },
    session: {
      access_token: string,          // JWT
      refresh_token: string,
      expires_in: number,            // Seconds (3600)
      expires_at: number,            // Unix timestamp
      token_type: "bearer"
    }
  },
  error: null
}
```

**Error Response** (400 Bad Request):

```typescript
{
  data: {
    user: null,
    session: null
  },
  error: {
    message: "Invalid login credentials",
    status: 400
  }
}
```

**Test Cases**:

```typescript
// TC-AUTH-001: Sign in User A (primary test user)
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_USER_PRIMARY_EMAIL!,
  password: process.env.TEST_USER_PRIMARY_PASSWORD!,
});
expect(error).toBeNull();
expect(data.user.email).toBe(process.env.TEST_USER_PRIMARY_EMAIL);

// TC-AUTH-002: Sign in User B (tertiary test user)
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_USER_TERTIARY_EMAIL!,
  password: process.env.TEST_USER_TERTIARY_PASSWORD!,
});
expect(error).toBeNull();
expect(data.user.email).toBe(process.env.TEST_USER_TERTIARY_EMAIL);

// TC-AUTH-003: Invalid credentials
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'nonexistent@example.com',
  password: 'WrongPassword123!',
});
expect(error).not.toBeNull();
expect(error.message).toContain('Invalid login credentials');
```

---

### 2. Get Current Session

**Supabase Method**: `supabase.auth.getSession()`

**Request**: None (uses stored session from localStorage)

**Success Response** (200 OK):

```typescript
{
  data: {
    session: {
      access_token: string,
      refresh_token: string,
      expires_in: number,
      expires_at: number,
      token_type: "bearer",
      user: {
        id: string,
        email: string,
        /* ...user fields */
      }
    }
  },
  error: null
}
```

**No Session Response** (200 OK):

```typescript
{
  data: {
    session: null
  },
  error: null
}
```

**Test Cases**:

```typescript
// TC-AUTH-004: Active session after sign-in
await supabase.auth.signInWithPassword({ email, password });
const { data } = await supabase.auth.getSession();
expect(data.session).not.toBeNull();
expect(data.session.user.email).toBe(email);

// TC-AUTH-005: No session after sign-out
await supabase.auth.signOut();
const { data } = await supabase.auth.getSession();
expect(data.session).toBeNull();
```

---

### 3. Sign Out

**Supabase Method**: `supabase.auth.signOut()`

**Request**: None (uses current session)

**Success Response** (204 No Content):

```typescript
{
  error: null;
}
```

**Side Effects**:

- Clears localStorage session
- Invalidates refresh token
- Triggers `onAuthStateChange` event with 'SIGNED_OUT'

**Test Cases**:

```typescript
// TC-AUTH-006: Sign out User A
await supabase.auth.signInWithPassword({
  email: USER_A_EMAIL,
  password: USER_A_PASSWORD,
});
const { error } = await supabase.auth.signOut();
expect(error).toBeNull();

// Verify session cleared
const { data } = await supabase.auth.getSession();
expect(data.session).toBeNull();

// TC-AUTH-007: Sign out User B
await supabase.auth.signInWithPassword({
  email: USER_B_EMAIL,
  password: USER_B_PASSWORD,
});
const { error } = await supabase.auth.signOut();
expect(error).toBeNull();
```

---

## Session Lifecycle

### Session Duration

- **Access Token**: 3600 seconds (1 hour)
- **Refresh Token**: 604800 seconds (7 days)
- **Auto-refresh**: Handled by Supabase client 60 seconds before expiry

### Storage

- **Location**: `localStorage` (browser)
- **Key**: `sb-<project-ref>-auth-token`
- **Format**: JSON with `access_token`, `refresh_token`, `expires_at`

### Playwright Context Isolation

- Each browser context has isolated localStorage
- Test users in different contexts don't share sessions
- Clean slate for each test (no session leakage)

---

## Performance Requirements

**Success Criteria Mapping**:

- **SC-001**: Full workflow (including sign-in/sign-out) completes in <60 seconds
- Sign-in operation should complete in <2 seconds
- Sign-out operation should complete in <1 second

**Test Timeouts**:

```typescript
test.setTimeout(60000); // Overall test timeout

await expect(page)
  .toHaveURL('/') // After sign-in redirect
  .timeout(5000); // Max 5 seconds for auth flow

await page.click('[data-testid="sign-out-button"]');
await expect(page).toHaveURL('/sign-in').timeout(3000); // Max 3 seconds for sign-out redirect
```

---

## Error Handling

### Common Error Codes

**Invalid Credentials** (400):

```typescript
{
  message: "Invalid login credentials",
  status: 400
}
```

**Email Not Confirmed** (400):

```typescript
{
  message: "Email not confirmed",
  status: 400
}
```

**Network Error** (0):

```typescript
{
  message: "Failed to fetch",
  status: 0
}
```

### Test Error Scenarios

```typescript
// TC-AUTH-008: Handle network failure gracefully
// Mock network error
await page.route('**/auth/v1/token?grant_type=password', (route) =>
  route.abort()
);

await page.fill('[data-testid="email-input"]', email);
await page.fill('[data-testid="password-input"]', password);
await page.click('[data-testid="sign-in-button"]');

// Should show error message
await expect(page.locator('[data-testid="error-message"]')).toContainText(
  'Failed to sign in'
);
```

---

## Security Considerations

### Password Storage

- Passwords stored in `.env` file (NOT committed to repo)
- bcrypt hash in database (work factor 10)
- No plaintext passwords in logs or error messages

### Session Security

- JWT tokens signed with project secret
- Tokens stored in localStorage (client-side only)
- No tokens in URL or cookies (implicit flow)
- Auto-refresh before expiry

### Test User Isolation

- Test users have no real data or PII
- Separate test database/project recommended
- Service role key used ONLY for test cleanup

---

## Contract Validation

### Pre-conditions

1. ✅ Test users exist in `auth.users` table
2. ✅ Test user emails are confirmed (`email_confirmed_at` IS NOT NULL)
3. ✅ Test user profiles exist in `user_profiles` table
4. ✅ Environment variables configured (TEST_USER_PRIMARY_EMAIL, TEST_USER_TERTIARY_EMAIL)

### Post-conditions

1. ✅ After sign-in: Session exists in localStorage
2. ✅ After sign-in: User redirected to home page (/)
3. ✅ After sign-out: Session cleared from localStorage
4. ✅ After sign-out: User redirected to sign-in page (/sign-in)

### Contract Tests

Run contract tests with:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/auth/sign-in.spec.ts
```

Expected results:

- All test cases (TC-AUTH-001 through TC-AUTH-008) pass
- No console errors logged
- Performance criteria met (sign-in <2s, sign-out <1s)
