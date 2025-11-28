# Research: Fix User Profile System

**Feature**: 034-fix-broken-user
**Date**: 2025-11-25

## Problem Statement

Profile changes made in AccountSettings don't persist correctly because:

1. AccountSettings saves to `auth.users.user_metadata` (Supabase auth table)
2. User search queries `user_profiles` table
3. These two data stores are never synchronized

## Current Implementation Analysis

### AccountSettings.tsx (lines 43-60)

```typescript
const handleUpdateProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  const { error: updateError } = await supabase.auth.updateUser({
    data: { username, bio }, // ❌ Writes to auth.users.user_metadata
  });
  // ...
};
```

**Problem**: Uses `supabase.auth.updateUser()` which only updates `auth.users.raw_user_meta_data` column.

### user_profiles Table Schema

From `supabase/migrations/20251006_complete_monolithic_setup.sql` (lines 162-176):

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key observation**: Table already has `display_name` field that UI doesn't expose.

### RLS Policies (lines 547-562)

```sql
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

**Confirmed**: Users CAN update their own profile via direct table access.

### connection-service.ts searchUsers (lines 292-300)

```typescript
const searchPattern = `%${query}%`;
const { data: profiles, error } = await (supabase as any)
  .from('user_profiles')
  .select('id, username, display_name, avatar_url')
  .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
  .neq('id', user.id)
  .limit(input.limit || 10);
```

**Confirmed**: Search already queries `user_profiles` and supports partial matching.

### UserSearch.tsx (line 26-27)

```tsx
<span className="label-text">Search for users by email or username</span>
```

**Problem**: UI claims email search but email is not searchable.

## Root Cause Summary

```
┌─────────────────────┐
│ AccountSettings.tsx │
└──────────┬──────────┘
           │ supabase.auth.updateUser()
           v
    ┌──────────────────┐
    │ auth.users       │ ← Data goes here
    └──────────────────┘
           ✗ NO SYNC
    ┌──────────────────┐
    │ user_profiles    │ ← Search queries here (empty)
    └──────────────────┘
```

## Solution Design

### Option 1: Database Trigger (REJECTED)

Create trigger to sync auth.users.user_metadata → user_profiles.

**Why rejected**: Adds complexity, harder to debug, doesn't follow existing patterns.

### Option 2: Direct Table Update (SELECTED)

Update AccountSettings to write directly to user_profiles table.

**Why selected**:

- Simpler
- Uses existing RLS policies
- Consistent with how avatar already works (via storage, not auth)
- Single source of truth

## Implementation Approach

1. **Create useUserProfile hook**: Fetch current user's profile from user_profiles
2. **Update AccountSettings**:
   - Use hook for initial values
   - Add display_name field
   - Change save to update user_profiles table
3. **Add validation**: Username format and uniqueness checking
4. **Fix UserSearch labels**: Remove email reference

## Files to Modify

| File                                                      | Change                              |
| --------------------------------------------------------- | ----------------------------------- |
| `src/components/auth/AccountSettings/AccountSettings.tsx` | Update save logic, add display_name |
| `src/components/molecular/UserSearch/UserSearch.tsx`      | Fix label text                      |
| `src/hooks/useUserProfile.ts`                             | NEW - hook for profile data         |
| `src/lib/profile/validation.ts`                           | NEW - username validation           |

## Risks & Mitigations

| Risk                               | Impact | Mitigation                                                   |
| ---------------------------------- | ------ | ------------------------------------------------------------ |
| Breaking existing avatar flow      | High   | Avatar uses different mechanism (storage), won't be affected |
| Username collision                 | Medium | Validate uniqueness before save                              |
| Existing users have empty profiles | Low    | Graceful handling - just show empty fields                   |
