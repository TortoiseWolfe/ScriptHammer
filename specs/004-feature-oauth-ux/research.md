# Phase 0 Research: OAuth UX Polish

**Feature**: 004-feature-oauth-ux
**Date**: 2025-11-28
**Status**: Complete

## Codebase Analysis

### Issue 1: OAuth User Display Name Population

**Current OAuth Flow (Problematic):**

```
1. User clicks Google/GitHub OAuth button
2. Supabase handles OAuth redirect
3. /auth/callback/page.tsx receives callback
4. AuthContext detects SIGNED_IN event
5. Database trigger creates user_profiles row (display_name = NULL)
6. User redirected to /profile
7. display_name remains NULL → shows as "null" in conversations
```

**Root Cause:** `src/app/auth/callback/page.tsx` (lines 46-59) only redirects after OAuth:

- Does NOT extract user_metadata.full_name
- Does NOT update user_profiles table
- Database trigger only creates empty profile

**OAuth Metadata Available:**

- Google: `user.user_metadata.full_name`, `user.user_metadata.avatar_url`
- GitHub: `user.user_metadata.name`, `user.user_metadata.avatar_url`
- Email prefix fallback: `user.email?.split('@')[0]`

**Existing Utility:** `src/lib/auth/oauth-utils.ts` has:

- `isOAuthUser(user)` - detects OAuth users
- `getOAuthProvider(user)` - gets provider name
- MISSING: `extractOAuthMetadata(user)` - needs to be added

**Fix Location:** Add profile population to OAuth callback:

```typescript
// In src/app/auth/callback/page.tsx after user is authenticated
if (user && isOAuthUser(user)) {
  await populateOAuthProfile(user);
}
```

### Issue 2: Message Scroll Problem

**Current Component Hierarchy:**

```
/messages/page.tsx
  └── MessagesContent (lines 23-417)
        ├── div.fixed.inset-0.top-16 (lines 278)
        │     └── div.drawer.h-full (line 280)
        │           └── div.drawer-content.flex.flex-col (line 290)
        │                 └── main.flex.flex-1.flex-col.overflow-hidden (line 322)
        │                       └── ChatWindow (line 349)
        │                             └── div.flex.h-full.flex-col (line 120)
        │                                   └── MessageThread (line 138)
        │                                         └── div.relative.flex-1 (line 308)
        │                                               └── div.h-full.overflow-y-auto (line 309-314)
```

**Analysis:**

- `ChatWindow` uses `flex h-full flex-col` (line 120)
- `MessageThread` uses `relative flex-1` wrapper (line 308)
- Inner scroll container uses `h-full overflow-y-auto` (line 312)
- Parent chain appears correct with proper flex/height constraints

**Potential Issue:** The `fixed inset-0 top-16` container combined with nested flex may not calculate height properly. The `drawer-content` div uses `flex flex-col` without explicit height.

**Investigation Needed:** Check if `drawer-content` needs `h-full` or if there's a CSS conflict with DaisyUI drawer component.

**Likely Fix:** Add `h-full` to the drawer-content div at line 290:

```tsx
<div className="drawer-content flex h-full flex-col">
```

### Issue 3: Migration for Existing OAuth Users

**Approach:** Run SQL update against user_profiles table:

```sql
UPDATE user_profiles p
SET display_name = COALESCE(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name',
  split_part(u.email, '@', 1),
  'Anonymous User'
)
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';
```

**Note:** This is a one-time data fix added to the monolithic migration file.

## Existing Patterns to Follow

### Component Pattern

All components follow 5-file structure:

- `index.tsx` - barrel export
- `Component.tsx` - main component
- `Component.test.tsx` - unit tests
- `Component.stories.tsx` - Storybook stories
- `Component.accessibility.test.tsx` - a11y tests

### Auth Utilities Pattern

OAuth utilities in `src/lib/auth/oauth-utils.ts`:

- Export typed functions with JSDoc
- Check `app_metadata.provider` first
- Fallback to `identities` array
- Return null for non-OAuth users

### Database Pattern

- Monolithic migration file: `supabase/migrations/20251006_complete_monolithic_setup.sql`
- Use `IF NOT EXISTS` for all DDL
- Add to existing transaction block

## Technical Decisions

### Display Name Extraction Function

```typescript
export function extractOAuthDisplayName(user: User | null): string {
  if (!user) return 'Anonymous User';

  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Anonymous User'
  );
}

export function extractOAuthAvatarUrl(user: User | null): string | null {
  return user?.user_metadata?.avatar_url || null;
}
```

### Profile Population Timing

Populate profile in OAuth callback (not AuthContext) because:

1. Callback runs once per OAuth flow
2. AuthContext runs on every page load
3. Callback has access to full user object with metadata

## Risk Assessment

| Risk                           | Impact | Mitigation                           |
| ------------------------------ | ------ | ------------------------------------ |
| OAuth metadata missing         | Medium | Fallback cascade to "Anonymous User" |
| Race condition with DB trigger | Low    | Check for NULL before update         |
| Breaking existing profiles     | Low    | Only update NULL display_name        |
| Scroll fix breaks mobile       | Medium | Test on mobile viewport              |

## Dependencies

- Supabase Auth (user_metadata access)
- Existing oauth-utils.ts module
- user_profiles table (no schema change needed)

## Test Strategy

### Unit Tests

- `extractOAuthDisplayName` with various metadata combinations
- `extractOAuthAvatarUrl` null handling

### Integration Tests

- OAuth callback profile population
- Existing profile not overwritten

### E2E Tests

- OAuth sign-in flow populates display_name
- Long message scroll in ChatWindow
