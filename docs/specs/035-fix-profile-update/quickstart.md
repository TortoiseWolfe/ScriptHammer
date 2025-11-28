# Quickstart: Fix Profile Update Silent Failure

## Problem

Clicking "Update Profile" in Account Settings has no effect. Changes don't persist.

## Root Cause

```typescript
// BROKEN: .update() returns error:null even when 0 rows updated
const { error: updateError } = await supabase
  .from('user_profiles')
  .update({ username, display_name, bio })
  .eq('id', user.id);

if (updateError) { ... }  // error is NULL!
else { setSuccess(true); } // FALSE SUCCESS
```

PostgreSQL treats "0 rows affected" as success (no error). If the user_profiles row doesn't exist or RLS blocks, the update silently does nothing.

## Solution

```typescript
// FIXED: Use upsert + validate returned data
const { data, error: updateError } = await supabase
  .from('user_profiles')
  .upsert(
    {
      id: user.id,
      username: username.trim().toLowerCase() || null, // Normalize case
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    },
    {
      onConflict: 'id',
    }
  )
  .select()
  .single();

if (updateError) {
  setError('Failed to update profile. Please try again.');
} else if (!data) {
  setError('Profile update failed - please try again.');
} else {
  setSuccess(true);
  await refetchProfile();
  setTimeout(() => setSuccess(false), 3000); // Auto-dismiss
}
```

## Key Changes

1. **`.update()` → `.upsert()`**: Handles missing rows by inserting
2. **`.select().single()`**: Returns the updated row for validation
3. **Check `data` exists**: Not just `!error`
4. **Lowercase username**: Match existing availability check
5. **Auto-dismiss success**: 3 second timeout

## Files to Modify

| File                                                                         | Change       |
| ---------------------------------------------------------------------------- | ------------ |
| `src/components/auth/AccountSettings/AccountSettings.tsx`                    | Main fix     |
| `src/components/auth/AccountSettings/AccountSettings.test.tsx`               | Update mocks |
| `src/components/auth/AccountSettings/AccountSettings.accessibility.test.tsx` | Update mocks |

## Test Verification

```bash
# Run unit tests
docker compose exec scripthammer pnpm test src/components/auth/AccountSettings

# Manual test
1. Sign in
2. Go to Account Settings
3. Change display name
4. Click "Update Profile"
5. Refresh page
6. Verify change persisted
```
