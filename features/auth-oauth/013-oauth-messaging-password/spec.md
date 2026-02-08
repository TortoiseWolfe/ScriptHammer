# Feature Specification: OAuth Messaging Password

**Feature Branch**: `013-oauth-messaging-password`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Update the re-authentication modal to detect OAuth users without encryption keys and show a 'Create messaging password' mode with confirm field, instead of a confusing 'Enter password' prompt."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OAuth User Creates Messaging Password (Priority: P1)

As a user who signed in with Google or GitHub, when I first access the messaging feature, I need to create a separate messaging password for encryption instead of seeing a confusing prompt asking for a password I never created.

**Why this priority**: Core UX issue - OAuth users are confused when asked for a password they never set up. This is blocking adoption of secure messaging.

**Independent Test**: Can be tested by signing in with OAuth, navigating to messaging, and verifying the setup flow shows password creation with confirmation field.

**Acceptance Scenarios**:

1. **Given** an OAuth user with no encryption keys, **When** they access messaging for the first time, **Then** they see "Create a Messaging Password" form with password and confirm password fields
2. **Given** an OAuth user in setup mode, **When** they enter matching passwords and submit, **Then** their encryption keys are initialized and they can access messages
3. **Given** an OAuth user in setup mode, **When** they enter non-matching passwords, **Then** they see a validation error and cannot submit

---

### User Story 2 - Returning OAuth User Unlocks Messages (Priority: P2)

As a returning OAuth user who previously created a messaging password, I need to unlock my messages using that password, with clear messaging that this is separate from my Google/GitHub login.

**Why this priority**: Important for returning user experience - prevents confusion between OAuth credentials and messaging password.

**Independent Test**: Can be tested by signing in as OAuth user who already set up messaging, and verifying the unlock flow shows appropriate messaging about the separate password.

**Acceptance Scenarios**:

1. **Given** an OAuth user with existing encryption keys, **When** they access messaging, **Then** they see "Unlock Your Messages" with a single password field
2. **Given** an OAuth user viewing the unlock prompt, **When** they read the form, **Then** subtext clearly explains this is separate from their Google/GitHub login credentials

---

### User Story 3 - Email/Password User Flow Unchanged (Priority: P3)

As a user who signed up with email and password, my existing password entry experience should remain unchanged.

**Why this priority**: Regression prevention - existing users shouldn't notice any change.

**Independent Test**: Can be tested by signing in with email/password and verifying the standard password prompt appears with no changes to copy or behavior.

**Acceptance Scenarios**:

1. **Given** an email/password user, **When** they access messaging requiring re-authentication, **Then** they see the standard "Enter your password" prompt (unchanged behavior)

---

### Edge Cases

- What happens when passwords don't match in setup mode?
  - Show validation error, prevent submission, allow correction

- What happens if OAuth user forgets their messaging password?
  - Display clear warning that encrypted messages cannot be recovered without the password

- What happens when user switches OAuth providers (Google to GitHub)?
  - Keys are tied to user identity, not provider - seamless transition

- What happens if encryption key check fails or is slow?
  - Show loading state, gracefully handle timeout with retry option

---

## Requirements _(mandatory)_

### Functional Requirements

**Authentication Detection**

- **FR-001**: System MUST detect if current user authenticated via external provider (OAuth)
- **FR-002**: System MUST detect if user has existing encryption keys set up
- **FR-003**: System MUST distinguish between OAuth and email/password users

**Setup Mode (New OAuth Users)**

- **FR-004**: System MUST show "Create a Messaging Password" mode for OAuth users without keys
- **FR-005**: Setup mode MUST include both password and confirm password fields
- **FR-006**: System MUST validate that passwords match before allowing submission
- **FR-007**: System MUST display password strength feedback during entry
- **FR-008**: System MUST explain why a separate messaging password is needed

**Unlock Mode (Returning OAuth Users)**

- **FR-009**: System MUST show "Unlock Your Messages" mode for OAuth users with existing keys
- **FR-010**: Unlock mode MUST show single password field
- **FR-011**: System MUST include subtext explaining this password is separate from OAuth credentials
- **FR-012**: System MUST clearly identify which OAuth provider the user signed in with

**Email/Password Users**

- **FR-013**: Email/password users MUST see unchanged existing password prompt behavior
- **FR-014**: System MUST NOT display OAuth-specific messaging to email/password users

**Accessibility**

- **FR-015**: All form fields MUST have proper labels for screen readers
- **FR-016**: Error messages MUST be announced to assistive technologies
- **FR-017**: Focus MUST be properly managed when mode changes

### Key Entities

- **User Authentication Method**: Whether user signed in via OAuth (Google/GitHub) or email/password

- **Encryption Key Status**: Whether user has existing encryption keys set up in the system

- **Messaging Password**: User-created password separate from OAuth credentials, used for message encryption

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: OAuth users successfully create messaging password on first messaging access
- **SC-002**: OAuth users with existing keys can unlock messages without confusion about which password to use
- **SC-003**: Email/password user experience is unchanged (existing tests pass)
- **SC-004**: All re-authentication modal tests continue to pass
- **SC-005**: Zero support tickets asking "which password should I enter?" from OAuth users
- **SC-006**: Password validation errors are clear and actionable

---

## Constraints _(optional)_

- This feature handles modal-based setup only; full-page setup flow is handled by Feature 016
- Password manager integration improvements are deferred to Feature 016
- No password recovery mechanism (encrypted messages are unrecoverable without password)

---

## Dependencies _(optional)_

- Requires user authentication (003) for OAuth detection
- Extended by Feature 016 for comprehensive messaging UX improvements

---

## Assumptions _(optional)_

- OAuth providers (Google/GitHub) do not provide password information
- User identity is consistent across OAuth provider changes
- Messaging encryption requires user-provided password for key derivation
