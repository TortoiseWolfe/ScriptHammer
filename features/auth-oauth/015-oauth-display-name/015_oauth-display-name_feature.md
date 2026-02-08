# Feature: OAuth Display Name & Avatar Population

**Feature ID**: 015
**Category**: auth-oauth
**Source**: ScriptHammer/specs/004-feature-oauth-ux
**Status**: Ready for SpecKit

## Description

Fix OAuth UX issues:

1. OAuth users get NULL display_name - extract from user_metadata.full_name on first sign-in
2. Populate avatar_url from OAuth provider metadata

## User Scenarios

### US-1: OAuth User Display Name Population (P1)

When a user signs in via OAuth, their display name is automatically populated from the provider's metadata.

**Acceptance Criteria**:

1. Given a new user signs up via Google OAuth with user_metadata.full_name="Jon Pohlner", when the callback completes, then display_name is "Jon Pohlner"
2. Given a new user signs up via GitHub OAuth with user_metadata.name="johndoe", when the callback completes, then display_name is "johndoe"
3. Given an OAuth user has no full_name but has email "user@example.com", when the callback completes, then display_name falls back to "user"
4. Given an existing OAuth user already has a display_name, when they sign in again, then display_name is NOT overwritten
5. Given an OAuth user has avatar_url in user_metadata, when the callback completes, then avatar_url is populated

### US-2: Existing OAuth User Migration (P3)

Existing OAuth users who signed up before this fix should have their display_name populated.

**Acceptance Criteria**:

1. Given existing OAuth users with NULL display_name, when migration runs, then display_name is populated from auth.users.raw_user_meta_data
2. Given existing OAuth users who already have display_name, when migration runs, then display_name is NOT overwritten

## Edge Cases

- OAuth provider returns no full_name AND no email: Use "Anonymous User" as fallback
- OAuth user manually sets display_name later: Should not overwrite manual changes
- user_profiles row doesn't exist when callback runs: Create via database trigger
- OAuth avatar_url becomes invalid/expired: Store URL as-is, handle errors at display time
- User signs in with different providers: First provider's data used, subsequent sign-ins don't overwrite
- Special characters in full_name (emoji, unicode): Preserved as-is
- Email prefix empty or only special characters: Falls through to "Anonymous User"
- Very long display names: UI handles truncation, full value stored

## Requirements

### Functional

- FR-001: Extract display_name from OAuth user_metadata on first sign-in using fallback cascade, executed BEFORE redirect to /profile
- FR-002: Populate avatar_url from OAuth user_metadata.avatar_url when available
- FR-003: NEVER overwrite existing display_name or avatar_url values (only populate NULL)
- FR-004: Handle fallback cascade: full_name > name > email prefix > "Anonymous User"
- FR-005: Include idempotent one-time migration for existing OAuth users

### Non-Functional

- NFR-001: Profile population errors MUST NOT block OAuth redirect
- NFR-002: Profile population events logged for debugging
- NFR-003: Migration reversible (rollback by setting NULL for affected users)

### Key Entities

- **user_profiles**: Contains display_name and avatar_url
- **auth.users**: Supabase auth table with raw_user_meta_data (read-only source)

### Technical Context

**Root Cause - OAuth Profile Gap:**

```
Current OAuth Flow:
1. User signs in with Google/GitHub
2. Supabase creates auth.users entry (with user_metadata)
3. Database trigger fires -> creates user_profiles with NULL display_name
4. OAuth metadata is NEVER copied to user_profiles
```

**Critical Files:**

- `src/app/auth/callback/page.tsx` - OAuth callback handler
- `src/lib/auth/oauth-utils.ts` - OAuth utility functions

## Success Criteria

- SC-001: 100% of new OAuth users have non-NULL display_name after first sign-in
- SC-002: 100% of existing OAuth users have non-NULL display_name after migration
- SC-003: No "null" text appears in conversation participant lists
- SC-004: OAuth avatar_url populated when provider returns it
