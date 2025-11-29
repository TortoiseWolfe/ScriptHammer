# Feature Specification: OAuth UX Polish

**Feature Branch**: `004-feature-oauth-ux`
**Created**: 2025-11-28
**Status**: Draft
**Input**: User description: "Feature: OAuth UX Polish - Fix two UX issues discovered during testing: (1) OAuth users get NULL display_name - extract from user_metadata.full_name on first OAuth signin and populate user_profiles, (2) Message scroll broken - users can't scroll to see bottom of long messages in ChatWindow"

## Clarifications

### Session 2025-11-28

- Q: In the rare edge case where an OAuth provider returns NO email at all, what should be the final fallback display_name? → A: Use "Anonymous User" as literal string

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OAuth User Display Name Population (Priority: P1)

When a user signs in via OAuth (Google/GitHub), their display name should be automatically populated from the OAuth provider's metadata so they appear correctly in conversation lists and throughout the application.

**Why this priority**: This is the most critical issue because NULL display names cause users to appear as "null" in conversation lists, severely degrading the user experience and making it impossible to identify message participants.

**Independent Test**: Can be fully tested by signing in with Google/GitHub OAuth and verifying the user's display_name is populated in user_profiles table. Delivers immediate value by showing correct usernames.

**Acceptance Scenarios**:

1. **Given** a new user signs up via Google OAuth with user_metadata.full_name="Jon Pohlner", **When** the OAuth callback completes, **Then** user_profiles.display_name should be "Jon Pohlner"

2. **Given** a new user signs up via GitHub OAuth with user_metadata.name="johndoe", **When** the OAuth callback completes, **Then** user_profiles.display_name should be "johndoe"

3. **Given** an OAuth user has no full_name in metadata but has email "user@example.com", **When** the OAuth callback completes, **Then** user_profiles.display_name should fallback to "user" (email prefix)

4. **Given** an existing OAuth user already has a display_name set, **When** they sign in again, **Then** their display_name should NOT be overwritten

5. **Given** an OAuth user has avatar_url in user_metadata, **When** the OAuth callback completes, **Then** user_profiles.avatar_url should be populated (if currently NULL)

---

### User Story 2 - Message Scroll Fix (Priority: P2)

Users must be able to scroll to see the full content of long messages in the ChatWindow, particularly important for the welcome message which explains E2E encryption.

**Why this priority**: While important for readability, this is lower priority than display names since users can still receive and send messages even if they can't scroll to see the entire content.

**Independent Test**: Can be tested by opening a conversation with a long message (e.g., welcome message) and verifying the user can scroll to see the complete message content including the bottom.

**Acceptance Scenarios**:

1. **Given** a user opens a conversation with a long welcome message, **When** the ChatWindow renders, **Then** the user can scroll down to see the entire message content

2. **Given** a user is viewing messages on mobile viewport, **When** the ChatWindow renders, **Then** the message container has proper height constraints and scrolling works

3. **Given** the ChatWindow has multiple messages, **When** a new message arrives, **Then** the view auto-scrolls to the newest message

---

### User Story 3 - Existing OAuth User Migration (Priority: P3)

Existing OAuth users who signed up before this fix should have their display_name populated from their OAuth metadata.

**Why this priority**: This is a one-time data fix for existing users. New users will be handled by Story 1, so this is lower priority but ensures consistency across all users.

**Independent Test**: Can be tested by running a migration script and verifying existing OAuth users now have display_name values populated.

**Acceptance Scenarios**:

1. **Given** existing OAuth users with NULL display_name, **When** the migration runs, **Then** their display_name is populated from auth.users.raw_user_meta_data.full_name

2. **Given** existing OAuth users who already have display_name set, **When** the migration runs, **Then** their display_name is NOT overwritten

---

### Edge Cases

- What happens when OAuth provider returns no full_name AND no email? Use "Anonymous User" as literal fallback string
- How does system handle OAuth users who manually set a display_name later? Should not overwrite manual changes
- What happens if user_profiles row doesn't exist when OAuth callback runs? Should create it via existing database trigger
- How does system handle OAuth avatar_url that becomes invalid/expired? Store URL as-is, handle errors at display time
- What happens if OAuth user signs in with different providers on different occasions? First provider's data is used; subsequent sign-ins do not overwrite (FR-003 applies)
- What happens with concurrent OAuth callback execution (race condition)? Out of scope - single-user operation, low probability; database constraint prevents duplicate profiles
- What happens with special characters in full_name (e.g., emoji, unicode)? Preserved as-is; no sanitization required for display_name field
- What happens when email prefix is empty or only special characters (e.g., "@example.com")? Falls through cascade to "Anonymous User" per FR-005
- What happens with very long display names exceeding UI constraints? UI components handle truncation at display time; full value stored in database

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST extract display_name from OAuth user_metadata on first sign-in using fallback cascade (FR-005), executed BEFORE redirect to /profile
- **FR-002**: System MUST populate user_profiles.avatar_url from OAuth user_metadata.avatar_url when provider returns avatar_url in user_metadata
- **FR-003**: System MUST NOT overwrite existing display_name or avatar_url values (only populate NULL values)
- **FR-004**: System MUST ensure ChatWindow message container is scrollable by adding `h-full` class to drawer-content div in messages page
- **FR-005**: System MUST handle fallback cascade: full_name > name > email prefix > "Anonymous User"
- **FR-006**: System MUST include a one-time migration to fix existing OAuth users with NULL display_name; migration is idempotent and can be safely re-run

### Non-Functional Requirements

- **NFR-001**: Profile population errors MUST NOT block OAuth redirect - log error and continue to /profile
- **NFR-002**: Profile population events MUST be logged via createLogger for debugging and audit
- **NFR-003**: Migration MUST be reversible - rollback by setting display_name back to NULL for affected OAuth users if issues arise

### Key Entities

- **user_profiles**: Contains display_name and avatar_url that need population from OAuth metadata. Primary table affected by this feature.
- **auth.users**: Supabase auth table containing raw_user_meta_data from OAuth providers (read-only, source of truth for OAuth metadata)

### Technical Context

**Root Cause Analysis - OAuth Profile Gap:**

```
Current OAuth Flow:
1. User signs in with Google/GitHub
2. Supabase creates auth.users entry (with user_metadata.full_name, avatar_url)
3. Database trigger fires -> creates user_profiles with NULL display_name
4. OAuth metadata is NEVER copied to user_profiles
```

**Critical Files:**

- `src/app/auth/callback/page.tsx` - OAuth callback handler (needs to extract metadata)
- `src/lib/auth/oauth-utils.ts` - OAuth utility functions (add extractOAuthMetadata)
- `src/components/messaging/ChatWindow/ChatWindow.tsx` - Message display (scroll fix)
- `src/app/messages/page.tsx` - Messages page container (height constraints)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of new OAuth users have non-NULL display_name after first sign-in
- **SC-002**: 100% of existing OAuth users have non-NULL display_name after migration
- **SC-003**: Users can scroll to see 100% of message content in ChatWindow on all viewport sizes
- **SC-004**: No "null" text appears in conversation participant lists for OAuth users
- **SC-005**: OAuth avatar_url is populated when provider returns avatar_url in user_metadata (verified via user_profiles.avatar_url IS NOT NULL for users with OAuth avatar)
