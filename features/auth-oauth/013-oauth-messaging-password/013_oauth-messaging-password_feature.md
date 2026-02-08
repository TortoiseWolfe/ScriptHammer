# Feature: OAuth Messaging Password

**Feature ID**: 013
**Category**: auth-oauth
**Source**: ScriptHammer_v_001/specs/001-oauth-messaging-password
**Status**: Ready for SpecKit
**Extended by**: 016-messaging-critical-fixes

## Description

Update ReAuthModal to detect OAuth users without encryption keys and show "Create messaging password" mode with confirm field, instead of confusing "Enter password" prompt.

**Relationship with Feature 016**: This feature (013) defines the core ReAuthModal detection and mode-switching logic. Feature 016 extends this with broader UX improvements including full-page setup flow, password manager integration, and the "Save this password" warning pattern. Implement 013 first, then 016.

## User Scenarios

### US-1: OAuth User Creates Messaging Password (P1)

An OAuth user (Google/GitHub sign-in) who has never set up messaging encryption accesses the messaging feature. Instead of seeing a confusing "Enter your password" prompt, they see a clear "Create a Messaging Password" form with password and confirm password fields.

**Acceptance Criteria**:

1. Given an OAuth user with no encryption keys, when they trigger the ReAuthModal, then they see "Create a Messaging Password" title with password + confirm fields
2. Given an OAuth user in setup mode, when they enter matching passwords and submit, then encryption keys are initialized and they can access messages
3. Given an OAuth user in setup mode, when they enter non-matching passwords, then they see a validation error and cannot submit

### US-2: Returning OAuth User Unlocks Messages (P2)

An OAuth user who previously created a messaging password returns to the app. They see "Unlock Your Messages" with clear copy explaining this is their messaging password, not their Google/GitHub password.

**Acceptance Criteria**:

1. Given an OAuth user with existing encryption keys, when they trigger the ReAuthModal, then they see "Unlock Your Messages" with single password field
2. Given an OAuth user with existing keys, when they see the modal, then subtext explains this is separate from their Google/GitHub login

### US-3: Email/Password User Flow Unchanged (P3)

Users who signed up with email/password continue to see the existing behavior with no changes.

**Acceptance Criteria**:

1. Given an email/password user, when they trigger the ReAuthModal, then they see the standard "Enter your password" prompt (existing behavior)

## Edge Cases

- Mismatched passwords in setup mode: Show validation error, prevent submission
- OAuth user forgets messaging password: Display hint that encrypted messages cannot be recovered
- User switches OAuth providers: Keys tied to user_id, not provider - seamless

## Requirements

### Functional

- FR-001: Detect if current user authenticated via OAuth provider (Google/GitHub)
- FR-002: Detect if user has existing encryption keys in the system
- FR-003: Show "Create a Messaging Password" mode when OAuth user has no keys
- FR-004: Setup mode includes password and confirm password fields
- FR-005: Validate passwords match before allowing submission
- FR-006: Show "Unlock Your Messages" mode for OAuth users with existing keys
- FR-007: Include clear subtext explaining this is separate from OAuth credentials
- FR-008: Email/password users continue to see existing modal behavior

### Key Entities

- **User**: Has `app_metadata.provider` or `identities` array indicating auth method
- **UserEncryptionKeys**: Existing table storing user's encryption keys

## Success Criteria

- SC-001: OAuth users can successfully create a messaging password on first encounter
- SC-002: OAuth users with existing keys can unlock messages without confusion
- SC-003: Email/password user experience is unchanged (regression test passes)
- SC-004: All existing ReAuthModal tests continue to pass
