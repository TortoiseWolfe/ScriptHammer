# Data Model: Fix Profile Update Silent Failure

## Existing Entity: user_profiles

_No schema changes required - this documents the existing structure for reference._

### Table Definition

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

### Fields

| Field        | Type        | Constraints             | Notes                              |
| ------------ | ----------- | ----------------------- | ---------------------------------- |
| id           | UUID        | PK, FK to auth.users    | Cascades on delete                 |
| username     | TEXT        | UNIQUE, 3-30 chars      | **Normalize to lowercase on save** |
| display_name | TEXT        | Max 100 chars           | User's friendly name               |
| avatar_url   | TEXT        | None                    | Storage URL                        |
| bio          | TEXT        | Max 500 chars           | User biography                     |
| created_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-set                           |
| updated_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-updated via trigger           |

### RLS Policies (Existing)

```sql
-- Users can update their own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can insert (used by signup trigger)
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);
```

**Note**: The INSERT policy allows the upsert to work - it inserts if the row doesn't exist.

## State Transitions

```
Profile Update Flow:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Input     │ --> │   Upsert    │ --> │  Validate   │
│  (form)     │     │  (DB call)  │     │  (data?)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   ├── data exists → SUCCESS
                           │                   └── data null → ERROR
                           │
                           └── error → ERROR (show message)
```

## Validation Rules

From `src/lib/profile/validation.ts`:

| Field        | Rule                                  | Error Message                                                 |
| ------------ | ------------------------------------- | ------------------------------------------------------------- |
| username     | 3-30 chars, alphanumeric + underscore | "Username must be between 3 and 30 characters"                |
| username     | No spaces                             | "Username cannot contain spaces"                              |
| username     | Pattern: `/^[a-zA-Z0-9_]+$/`          | "Username can only contain letters, numbers, and underscores" |
| display_name | Max 100 chars                         | "Display name must be 100 characters or less"                 |
| bio          | Max 500 chars                         | "Bio must be 500 characters or less"                          |

## Changes Required

1. **Username normalization**: Save as `username.trim().toLowerCase()` instead of `username.trim()`
2. **Upsert pattern**: Use `.upsert()` with `onConflict: 'id'` to handle missing rows
3. **Data validation**: Check returned data exists, not just `!error`
