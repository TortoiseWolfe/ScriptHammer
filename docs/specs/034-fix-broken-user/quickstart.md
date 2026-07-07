# Quickstart: Fix User Profile System

**Feature**: 034-fix-broken-user
**Date**: 2025-11-25

## Overview

This feature fixes the broken profile system where changes don't persist. After implementation:

- Profile changes (username, display name, bio) save correctly
- Users can be found by username or display name
- UI accurately describes what can be searched

## Key Changes

### 1. AccountSettings Now Saves to user_profiles

**Before**:

```typescript
await supabase.auth.updateUser({ data: { username, bio } });
```

**After**:

```typescript
await supabase
  .from('user_profiles')
  .update({ username, display_name: displayName, bio })
  .eq('id', user.id);
```

### 2. New useUserProfile Hook

```typescript
import { useUserProfile } from '@/hooks/useUserProfile';

function MyComponent() {
  const { profile, loading, error, refetch } = useUserProfile();

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return <div>Hello, {profile?.display_name || profile?.username}</div>;
}
```

### 3. Username Validation

```typescript
import {
  validateUsername,
  checkUsernameAvailable,
} from '@/lib/profile/validation';

// Sync validation (format only)
const result = validateUsername('john_doe');
// { valid: true }

const result2 = validateUsername('ab');
// { valid: false, error: 'Username must be between 3 and 30 characters' }

// Async validation (includes uniqueness check)
const available = await checkUsernameAvailable('john_doe');
// true or false
```

## Testing

### Unit Test Example

```typescript
import { validateUsername } from '@/lib/profile/validation';

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('john_doe').valid).toBe(true);
    expect(validateUsername('User123').valid).toBe(true);
  });

  it('rejects too short', () => {
    expect(validateUsername('ab').valid).toBe(false);
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('john@doe').valid).toBe(false);
  });
});
```

### E2E Test Flow

1. Sign in as test user
2. Navigate to Account Settings
3. Enter username and display name
4. Click "Update Profile"
5. Refresh page
6. Verify values persisted
7. Search for user from another account
8. Verify user appears in results

## Files Modified

| File                                                      | Purpose                          |
| --------------------------------------------------------- | -------------------------------- |
| `src/components/auth/AccountSettings/AccountSettings.tsx` | Main fix - save to user_profiles |
| `src/components/molecular/UserSearch/UserSearch.tsx`      | Fix misleading labels            |
| `src/hooks/useUserProfile.ts`                             | New hook for profile loading     |
| `src/lib/profile/validation.ts`                           | New validation utilities         |

## Common Issues

### "Username already taken" error

The username must be unique. If the user previously set a username via the (broken) old system, it went to auth.users.user_metadata, not user_profiles. They can now set their "real" username in user_profiles.

### Empty profile fields

Expected for existing users who haven't updated their profile since the fix. Simply entering values and saving will populate the fields.

### Display name vs Username

- **Username**: Unique identifier, used for @mentions and search (e.g., `john_doe`)
- **Display Name**: Friendly name, can be anything (e.g., `John Doe`)
