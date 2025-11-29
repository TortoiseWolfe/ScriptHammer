# Quickstart: OAuth UX Polish

**Feature**: 004-feature-oauth-ux
**Estimated Effort**: 2-3 hours

## Prerequisites

- Docker environment running (`docker compose up`)
- Access to Supabase dashboard (for migration)
- Test OAuth account (Google or GitHub)

## Implementation Order

### 1. OAuth Utilities (30 min)

**File**: `src/lib/auth/oauth-utils.ts`

Add three new functions:

```typescript
export function extractOAuthDisplayName(user: User | null): string;
export function extractOAuthAvatarUrl(user: User | null): string | null;
export function populateOAuthProfile(user: User): Promise<boolean>;
```

**Test with**:

```bash
docker compose exec scripthammer pnpm test src/lib/auth/oauth-utils.test.ts
```

### 2. Auth Callback Update (15 min)

**File**: `src/app/auth/callback/page.tsx`

Add profile population after user authenticated:

```typescript
import { isOAuthUser, populateOAuthProfile } from '@/lib/auth/oauth-utils';

// In useEffect after user check (line ~47)
if (user) {
  if (isOAuthUser(user)) {
    try {
      await populateOAuthProfile(user);
    } catch (err) {
      logger.error('OAuth profile population failed', { error: err });
    }
  }
  router.push('/profile');
}
```

### 3. Scroll Fix (5 min)

**File**: `src/app/messages/page.tsx`

Line 290, add `h-full`:

```tsx
// Before
<div className="drawer-content flex flex-col">

// After
<div className="drawer-content flex h-full flex-col">
```

### 4. Migration (One-time)

**File**: `supabase/migrations/20251006_complete_monolithic_setup.sql`

Add to the end of the migration (before final COMMIT):

```sql
-- Feature 004: Populate OAuth user profiles
UPDATE public.user_profiles p
SET
  display_name = COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'Anonymous User'
  ),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email';
```

Then run in Supabase SQL Editor (just the UPDATE statement for existing data).

## Verification

### Manual Testing

1. Sign out completely
2. Sign in with Google OAuth
3. Check `/profile` - display name should be populated
4. Go to `/messages` - open a conversation
5. Long messages should be scrollable

### Automated Tests

```bash
# Unit tests
docker compose exec scripthammer pnpm test oauth-utils

# E2E test (if available)
docker compose exec scripthammer pnpm exec playwright test welcome-message
```

## Rollback

If issues occur:

1. Revert auth-callback changes (OAuth will still work, just no auto-population)
2. Revert scroll fix if layout breaks
3. Migration is safe - only sets NULL values, never overwrites

## Files Modified

| File                               | Change                 |
| ---------------------------------- | ---------------------- |
| `src/lib/auth/oauth-utils.ts`      | Add 3 functions        |
| `src/lib/auth/oauth-utils.test.ts` | Add tests              |
| `src/app/auth/callback/page.tsx`   | Add profile population |
| `src/app/messages/page.tsx`        | Add h-full class       |
| `supabase/migrations/...`          | Add migration query    |
