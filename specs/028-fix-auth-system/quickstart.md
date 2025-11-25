# Quickstart: Auth System Fixes

**Feature**: 028-fix-auth-system
**Date**: 2025-11-24

## Overview

This guide explains the auth system changes and how to use the new error handling and retry features.

## Using the Updated AuthContext

### Basic Usage (unchanged)

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <SignInPrompt />;

  return <AuthenticatedContent user={user} />;
}
```

### Handling Auth Errors (NEW)

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isLoading, error, retry, clearError } = useAuth();

  // Show error state with retry option
  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error.message}</span>
        {error.retryable && (
          <button className="btn btn-sm" onClick={retry}>
            Retry
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={clearError}>
          Dismiss
        </button>
      </div>
    );
  }

  if (isLoading) return <Loading />;
  // ... rest of component
}
```

### Sign Out Behavior (CHANGED)

Sign out now:

1. Clears local state immediately (fail-safe)
2. Attempts Supabase sign out in background
3. Redirects to home page via page reload

```tsx
function SignOutButton() {
  const { signOut } = useAuth();

  // No need to handle errors - sign out is fail-safe
  // Page will redirect after this call
  return <button onClick={signOut}>Sign Out</button>;
}
```

### Cross-Tab Behavior (NEW)

When a user signs out in one tab, ALL other tabs automatically:

1. Detect the sign out via Supabase auth state listener
2. Redirect to the home page

No code changes needed in components - this is handled by AuthContext.

## Error States Reference

| Error Code    | When It Happens           | What to Do                          |
| ------------- | ------------------------- | ----------------------------------- |
| `TIMEOUT`     | Auth init takes >5s       | Show retry button                   |
| `NETWORK`     | No internet/Supabase down | Show retry button + offline message |
| `AUTH_FAILED` | Bad credentials           | Show error, prompt re-entry         |
| `UNKNOWN`     | Unexpected error          | Show retry button                   |

## Testing Auth Flows

### Manual Testing

1. **Sign In**: Enter valid credentials, verify redirect to dashboard
2. **Sign Out**: Click sign out, verify redirect to home
3. **Cross-Tab**: Open two tabs, sign out in one, verify both redirect
4. **Timeout**: Throttle network to slow, verify timeout message appears

### E2E Tests

```bash
# Run auth E2E tests
docker compose exec scripthammer pnpm exec playwright test tests/e2e/auth/
```

## Migration Notes

### For Existing Components

Components using `useAuth()` continue to work unchanged. New fields are optional:

```tsx
// Old code still works
const { user, isLoading, signOut } = useAuth();

// New optional fields
const { error, retry, clearError } = useAuth();
```

### For Sign Out Handling

If your code checked for sign out errors, remove that handling:

```tsx
// BEFORE (no longer needed)
const { error } = await signOut();
if (error) handleError(error);

// AFTER (simpler)
await signOut();
// No error handling needed - page redirects
```

## Troubleshooting

### "Auth loading timeout" in console

This is expected when Supabase is slow. The new retry logic will automatically retry up to 3 times before showing an error to the user.

### Sign out doesn't work

Ensure you're using the latest AuthContext. The new fail-safe sign out clears local state even if the Supabase API call fails.

### Other tabs don't redirect on sign out

Verify all tabs are using the same Supabase project. Cross-tab sync uses the Supabase auth state listener which requires matching project configuration.
