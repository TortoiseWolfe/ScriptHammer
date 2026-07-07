# Contract: OAuth Utilities Extension

**Module**: `src/lib/auth/oauth-utils.ts`
**Feature**: 004-feature-oauth-ux

## New Functions

### extractOAuthDisplayName

Extracts display name from OAuth user metadata with fallback cascade.

```typescript
/**
 * Extract display name from OAuth user metadata
 * Fallback cascade: full_name > name > email prefix > "Anonymous User"
 *
 * @param user - Supabase User object
 * @returns Display name string (never null)
 */
export function extractOAuthDisplayName(user: User | null): string;
```

**Behavior:**
| Input | Output |
|-------|--------|
| `user.user_metadata.full_name = "Jon Pohlner"` | `"Jon Pohlner"` |
| `user.user_metadata.name = "johndoe"` | `"johndoe"` |
| `user.email = "user@example.com"` | `"user"` |
| `user = null` or no metadata | `"Anonymous User"` |

### extractOAuthAvatarUrl

Extracts avatar URL from OAuth user metadata.

```typescript
/**
 * Extract avatar URL from OAuth user metadata
 *
 * @param user - Supabase User object
 * @returns Avatar URL or null
 */
export function extractOAuthAvatarUrl(user: User | null): string | null;
```

**Behavior:**
| Input | Output |
|-------|--------|
| `user.user_metadata.avatar_url = "https://..."` | `"https://..."` |
| No avatar_url in metadata | `null` |
| `user = null` | `null` |

### populateOAuthProfile

Updates user_profiles with OAuth metadata (only if NULL).

```typescript
/**
 * Populate user_profiles with OAuth metadata
 * Only updates NULL fields, never overwrites existing data
 *
 * @param user - Supabase User object
 * @returns Promise<boolean> - true if updated, false if skipped
 */
export function populateOAuthProfile(user: User): Promise<boolean>;
```

**Behavior:**

- Checks if `display_name` is NULL in user_profiles
- If NULL, updates with `extractOAuthDisplayName(user)`
- Checks if `avatar_url` is NULL in user_profiles
- If NULL and OAuth provides avatar, updates with `extractOAuthAvatarUrl(user)`
- Returns `true` if any field was updated
- Returns `false` if nothing needed updating

**Side Effects:**

- Database write to `user_profiles` table
- Logging via createLogger

## Existing Functions (Unchanged)

### isOAuthUser

```typescript
export function isOAuthUser(user: User | null): boolean;
```

### getOAuthProvider

```typescript
export function getOAuthProvider(user: User | null): string | null;
```
