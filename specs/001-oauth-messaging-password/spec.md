# Feature Specification: OAuth Messaging Password

**Feature Branch**: `001-oauth-messaging-password`
**Created**: 2025-11-28
**Status**: Draft
**Input**: User description: "OAuth Messaging Password: Update ReAuthModal to detect OAuth users without encryption keys and show 'Create messaging password' mode with confirm field, instead of confusing 'Enter password' prompt"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OAuth User Creates Messaging Password (Priority: P1)

An OAuth user (Google/GitHub sign-in) who has never set up messaging encryption accesses the messaging feature. Instead of seeing a confusing "Enter your password" prompt, they see a clear "Create a Messaging Password" form with password and confirm password fields.

**Why this priority**: This is the core problem - OAuth users are currently blocked from messaging because they have no password to enter. This story directly solves that issue.

**Independent Test**: Can be fully tested by signing in with OAuth, navigating to messages, and verifying the modal shows "Create" mode instead of "Enter" mode.

**Acceptance Scenarios**:

1. **Given** an OAuth user with no encryption keys, **When** they trigger the ReAuthModal (e.g., accessing messages), **Then** they see "Create a Messaging Password" title with password + confirm fields
2. **Given** an OAuth user in setup mode, **When** they enter matching passwords and submit, **Then** encryption keys are initialized and they can access messages
3. **Given** an OAuth user in setup mode, **When** they enter non-matching passwords, **Then** they see a validation error and cannot submit

---

### User Story 2 - Returning OAuth User Unlocks Messages (Priority: P2)

An OAuth user who previously created a messaging password returns to the app (new session or new device). They see "Unlock Your Messages" with clear copy explaining this is their messaging password, not their Google/GitHub password.

**Why this priority**: After setup (P1), users need to re-authenticate. Clear UX copy prevents confusion between OAuth credentials and messaging password.

**Independent Test**: Can be tested by having an OAuth user with existing keys trigger the modal and verifying the copy is clear.

**Acceptance Scenarios**:

1. **Given** an OAuth user with existing encryption keys, **When** they trigger the ReAuthModal, **Then** they see "Unlock Your Messages" with single password field
2. **Given** an OAuth user with existing keys, **When** they see the modal, **Then** subtext explains this is separate from their Google/GitHub login

---

### User Story 3 - Email/Password User Flow Unchanged (Priority: P3)

Users who signed up with email/password continue to see the existing behavior with no changes to their experience.

**Why this priority**: Non-regression. Email users already have passwords, so their flow should remain unchanged.

**Independent Test**: Sign in with email/password user, trigger ReAuthModal, verify behavior is unchanged.

**Acceptance Scenarios**:

1. **Given** an email/password user, **When** they trigger the ReAuthModal, **Then** they see the standard "Enter your password" prompt (existing behavior)

---

### Edge Cases

- What happens when OAuth user enters mismatched passwords in setup mode? → Show validation error, prevent submission
- What happens when OAuth user forgets their messaging password? → Display hint that encrypted messages cannot be recovered (existing behavior)
- What happens when user switches OAuth providers? → Keys tied to user_id, not provider - seamless

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST detect if current user authenticated via OAuth provider (Google/GitHub)
- **FR-002**: System MUST detect if user has existing encryption keys in the system
- **FR-003**: ReAuthModal MUST show "Create a Messaging Password" mode when OAuth user has no keys
- **FR-004**: Setup mode MUST include password and confirm password fields
- **FR-005**: Setup mode MUST validate passwords match before allowing submission
- **FR-006**: ReAuthModal MUST show "Unlock Your Messages" mode for OAuth users with existing keys
- **FR-007**: Both modes MUST include clear subtext explaining this is separate from OAuth credentials
- **FR-008**: Email/password users MUST continue to see existing modal behavior (no regression)

### Key Entities

- **User**: Has `app_metadata.provider` or `identities` array indicating auth method
- **UserEncryptionKeys**: Existing table storing user's encryption keys (if initialized)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: OAuth users can successfully create a messaging password on first encounter
- **SC-002**: OAuth users with existing keys can unlock messages without confusion
- **SC-003**: Email/password user experience is unchanged (regression test passes)
- **SC-004**: All existing ReAuthModal tests continue to pass
