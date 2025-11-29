# Data Model: OAuth UX Polish

**Feature**: 004-feature-oauth-ux
**Date**: 2025-11-28

## No Schema Changes Required

This feature does not require database schema changes. The existing `user_profiles` table already has the `display_name` and `avatar_url` columns that need to be populated.

## Existing Schema (Reference)

### user_profiles Table

```sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,        -- Target field for OAuth population
  avatar_url TEXT,          -- Target field for OAuth avatar
  bio TEXT,
  location TEXT,
  website TEXT,
  welcome_message_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
```

### auth.users Table (Supabase Managed)

```sql
-- Relevant fields for OAuth metadata extraction
auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB,  -- Contains OAuth provider metadata
  raw_app_meta_data JSONB,   -- Contains provider type
  ...
);
```

## OAuth Metadata Structure

### Google OAuth user_metadata

```json
{
  "full_name": "Jon Pohlner",
  "avatar_url": "https://lh3.googleusercontent.com/...",
  "email": "jon@example.com",
  "email_verified": true,
  "iss": "https://accounts.google.com",
  "sub": "12345..."
}
```

### GitHub OAuth user_metadata

```json
{
  "name": "johndoe",
  "avatar_url": "https://avatars.githubusercontent.com/...",
  "email": "johndoe@github.com",
  "preferred_username": "johndoe"
}
```

## Data Flow

### Before (Current - Broken)

```
OAuth Sign-in → auth.users created (with metadata)
            → DB trigger fires
            → user_profiles created (display_name = NULL)
            → User appears as "null" in conversations
```

### After (Fixed)

```
OAuth Sign-in → auth.users created (with metadata)
            → DB trigger fires
            → user_profiles created (display_name = NULL)
            → OAuth callback extracts metadata
            → user_profiles.display_name = "Jon Pohlner"
            → user_profiles.avatar_url = "https://..."
            → User appears correctly in conversations
```

## Migration Query (Existing Users)

Add to monolithic migration file for one-time fix:

```sql
-- Populate display_name for existing OAuth users with NULL display_name
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

## Constraints

- **display_name**: No NOT NULL constraint (allows empty for email users who haven't set it)
- **avatar_url**: No constraints (optional field)
- **Idempotency**: Only update NULL values, never overwrite existing data
