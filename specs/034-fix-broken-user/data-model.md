# Data Model: Fix User Profile System

**Feature**: 034-fix-broken-user
**Date**: 2025-11-25

## Schema Overview

No schema changes required. Using existing `user_profiles` table.

## Entities

### user_profiles (EXISTING - NO CHANGES)

| Column       | Type        | Constraints             | Description                     |
| ------------ | ----------- | ----------------------- | ------------------------------- |
| id           | UUID        | PK, FK→auth.users       | User's unique identifier        |
| username     | TEXT        | UNIQUE, 3-30 chars      | User's unique handle for search |
| display_name | TEXT        | Max 100 chars           | Friendly display name           |
| avatar_url   | TEXT        | -                       | URL to avatar image             |
| bio          | TEXT        | Max 500 chars           | User biography                  |
| created_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation time            |
| updated_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update time                |

### Indexes (EXISTING)

- `idx_user_profiles_username` - For username search
- `idx_user_profiles_updated_at` - For ordering by recency

### RLS Policies (EXISTING)

```sql
-- Users can view their own profile
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- All authenticated users can search profiles (for friend discovery)
CREATE POLICY "Authenticated users can search profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update only their own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role creates profiles on signup
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);
```

## Data Flow

### Before (Broken)

```
AccountSettings → supabase.auth.updateUser() → auth.users.user_metadata
                                                        ↓
                                                   (no sync)
                                                        ↓
searchUsers() → user_profiles table ← (empty/stale data)
```

### After (Fixed)

```
AccountSettings → supabase.from('user_profiles').update() → user_profiles
                                                                ↓
searchUsers() → user_profiles table ← (fresh data)
```

## Validation Rules

### Username

| Rule               | Constraint        | Error Message                                                 |
| ------------------ | ----------------- | ------------------------------------------------------------- |
| Required length    | 3-30 characters   | "Username must be between 3 and 30 characters"                |
| Allowed characters | `[a-zA-Z0-9_]`    | "Username can only contain letters, numbers, and underscores" |
| Uniqueness         | UNIQUE constraint | "This username is already taken"                              |
| No spaces          | Regex check       | "Username cannot contain spaces"                              |

### Display Name

| Rule       | Constraint     | Error Message                                 |
| ---------- | -------------- | --------------------------------------------- |
| Max length | 100 characters | "Display name must be 100 characters or less" |
| Optional   | NULL allowed   | -                                             |

### Bio

| Rule       | Constraint     | Error Message                        |
| ---------- | -------------- | ------------------------------------ |
| Max length | 500 characters | "Bio must be 500 characters or less" |
| Optional   | NULL allowed   | -                                    |

## TypeScript Interfaces

```typescript
// Existing in src/types/messaging.ts
export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

// New validation types
export interface UsernameValidation {
  valid: boolean;
  error?: string;
}

export interface ProfileUpdateInput {
  username?: string;
  display_name?: string;
  bio?: string;
}
```

## Migration

No database migration required. Existing users will have empty/null username and display_name until they update their profile.
