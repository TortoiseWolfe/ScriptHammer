# Feature Specification: OAuth Display Name & Avatar Population

**Feature Branch**: `015-oauth-display-name`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Fix OAuth UX issues where OAuth users get empty display names - extract from provider metadata on first sign-in and populate avatar."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OAuth User Display Name Population (Priority: P1)

As an OAuth user signing in for the first time, my display name is automatically populated from my provider account so I don't have to manually set it.

**Why this priority**: Core user experience - prevents "null" or empty names appearing in the application.

**Independent Test**: Can be tested by signing in via OAuth provider and verifying display name is populated.

**Acceptance Scenarios**:

1. **Given** a new user signs up via Google OAuth with name "Jon Pohlner", **When** the sign-in completes, **Then** display_name is "Jon Pohlner"
2. **Given** a new user signs up via GitHub OAuth with username "johndoe", **When** the sign-in completes, **Then** display_name is "johndoe"
3. **Given** an OAuth user has no full name but has email "user@example.com", **When** the sign-in completes, **Then** display_name falls back to "user" (email prefix)
4. **Given** an existing OAuth user already has a display_name set, **When** they sign in again, **Then** display_name is NOT overwritten
5. **Given** an OAuth user has an avatar in their provider profile, **When** the sign-in completes, **Then** avatar is populated

---

### User Story 2 - Existing OAuth User Migration (Priority: P3)

As a system operator, I need existing OAuth users who signed up before this fix to have their display names populated automatically.

**Why this priority**: Data cleanup - improves experience for all existing users, not just new ones.

**Independent Test**: Can be tested by running migration and verifying existing users with empty display names are populated.

**Acceptance Scenarios**:

1. **Given** existing OAuth users with empty display_name, **When** migration runs, **Then** display_name is populated from provider metadata
2. **Given** existing OAuth users who already have display_name set, **When** migration runs, **Then** display_name is NOT overwritten

---

### Edge Cases

- What if OAuth provider returns no name AND no email?
  - Use "Anonymous User" as fallback

- What if OAuth user manually sets display_name later?
  - Should not overwrite manual changes (only populate empty values)

- What if profile record doesn't exist when callback runs?
  - System creates profile automatically via standard profile creation

- What if OAuth avatar URL becomes invalid/expired?
  - Store URL as-is; handle errors at display time with fallback

- What if user signs in with different providers?
  - First provider's data used; subsequent sign-ins don't overwrite existing values

- What if full_name contains special characters (emoji, unicode)?
  - Preserved as-is without modification

- What if email prefix is empty or only special characters?
  - Falls through to "Anonymous User" fallback

- What if display name is very long?
  - Full value stored; UI handles truncation at display time

---

## Requirements _(mandatory)_

### Functional Requirements

**Display Name Population**

- **FR-001**: System MUST extract display_name from OAuth provider metadata on first sign-in
- **FR-002**: System MUST use fallback cascade: full name > username > email prefix > "Anonymous User"
- **FR-003**: System MUST execute profile population BEFORE redirecting user to application
- **FR-004**: System MUST NOT overwrite existing display_name values (only populate empty)

**Avatar Population**

- **FR-005**: System MUST populate avatar from OAuth provider metadata when available
- **FR-006**: System MUST NOT overwrite existing avatar values (only populate empty)

**Migration**

- **FR-007**: System MUST provide one-time migration for existing OAuth users with empty display names
- **FR-008**: Migration MUST be idempotent (safe to run multiple times)
- **FR-009**: Migration MUST be reversible (rollback by clearing affected values)

### Non-Functional Requirements

- **NFR-001**: Profile population errors MUST NOT block OAuth redirect (graceful degradation)
- **NFR-002**: Profile population events MUST be logged for debugging
- **NFR-003**: Population SHOULD complete within 500ms to avoid noticeable delay

### Key Entities

- **User Profile**: Contains display_name and avatar fields that need population

- **OAuth Provider Metadata**: Read-only source of user information from external authentication provider

- **Fallback Cascade**: Ordered list of metadata fields to check: full name → username → email prefix → default

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of new OAuth users have non-empty display_name after first sign-in
- **SC-002**: 100% of existing OAuth users have non-empty display_name after migration
- **SC-003**: Zero instances of "null" text appearing in participant lists or user interfaces
- **SC-004**: OAuth avatar populated when provider returns one (0% missing avatars when available)
- **SC-005**: Profile population completes within 500ms for 95% of sign-ins

---

## Constraints _(optional)_

- Population logic runs during OAuth callback flow
- Must not break existing OAuth sign-in experience
- Cannot modify provider-side metadata (read-only)
- Migration must not lock tables or impact application performance

---

## Dependencies _(optional)_

- Requires Feature 003 (user-authentication) for OAuth infrastructure
- Related to Feature 013 (oauth-messaging-password) for OAuth user handling

---

## Assumptions _(optional)_

- OAuth providers (Google, GitHub, etc.) include name/email in their metadata
- System has access to provider metadata during callback processing
- Existing profile creation mechanism remains in place
- Users prefer their provider name over a randomly generated one
