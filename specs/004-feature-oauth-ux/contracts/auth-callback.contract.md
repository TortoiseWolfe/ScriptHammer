# Contract: Auth Callback Enhancement

**Module**: `src/app/auth/callback/page.tsx`
**Feature**: 004-feature-oauth-ux

## Current Behavior

The OAuth callback page:

1. Checks for errors in URL params
2. Waits for AuthContext to authenticate user
3. Redirects to `/profile` on success
4. Redirects to `/sign-in` with error on failure

## Enhanced Behavior

After user is authenticated (line 46-59), add OAuth profile population:

```typescript
// Current flow (line 46-59)
if (!isLoading && !error) {
  if (user) {
    // NEW: Populate OAuth profile before redirect
    if (isOAuthUser(user)) {
      await populateOAuthProfile(user);
    }

    logger.info('User authenticated, redirecting to profile');
    router.push('/profile');
  } else {
    // ... existing timeout logic
  }
}
```

## Integration Points

### Dependencies Added

```typescript
import { isOAuthUser, populateOAuthProfile } from '@/lib/auth/oauth-utils';
```

### Error Handling

- Profile population failure should NOT block redirect
- Log error but continue to `/profile`
- User can manually update profile later

```typescript
try {
  if (isOAuthUser(user)) {
    await populateOAuthProfile(user);
  }
} catch (err) {
  logger.error('Failed to populate OAuth profile', { error: err });
  // Continue with redirect - non-blocking
}
```

## Timing Guarantee

Profile population runs:

- After Supabase auth completes
- After database trigger creates user_profiles row
- Before redirect to /profile

This ensures user_profiles row exists before we attempt to update it.
