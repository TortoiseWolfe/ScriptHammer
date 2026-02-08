# Feature: Critical Messaging UX Fixes

**Feature ID**: 016
**Category**: auth-oauth
**Source**: ScriptHammer/specs/006-feature-006-critical
**Status**: Ready for SpecKit
**Depends on**: 013-oauth-messaging-password

## Description

Fix 5 critical messaging UX issues:

1. Message input clipped at bottom of viewport
2. OAuth users prompted to ENTER password they never CREATED
3. Password manager integration broken
4. Decryption failures show unhelpful error
5. Participant name shows "Unknown"

**Relationship with Feature 013**: Feature 013 implements the core ReAuthModal detection logic (OAuth vs email/password, has keys vs no keys). This feature (016) extends that foundation with:

- Full-page setup flow (`/messages/setup`) for first-time users (vs modal for unlock)
- Password manager `autocomplete` attributes
- "Save this password" warning at three points
- Additional UX fixes unrelated to OAuth (viewport, decryption errors, participant names)

Implement 013 first to establish the detection logic, then implement 016 for the full UX layer.

## User Scenarios

### US-1: Message Input Always Visible (P1)

As a user viewing a conversation, the message input field must be visible at all times.

**Acceptance Criteria**:

1. Given a user on mobile viewport (375x667), when they open a conversation, then message input is fully visible at bottom
2. Given a user on desktop viewport (1280x800), when they open a conversation, then input is visible with proper layout
3. Given a conversation with 50+ messages, when user scrolls, then input field remains fixed at bottom

**Root Cause**: CSS Grid height calculation fails in nested flex/grid context with DaisyUI drawer.

### US-2: OAuth User Password Setup Flow (P1)

As an OAuth user who has never set up messaging, I need to CREATE a password, not ENTER one.

**Acceptance Criteria**:

1. Given an OAuth user with NO encryption keys, when they navigate to /messages, then they see "Set Up Encrypted Messaging" with password + confirm fields
2. Given an OAuth user with NO keys, when they see setup modal, then text explains they need to CREATE a password
3. Given an OAuth user creating a password, when they enter and confirm, then keys are generated and messaging is accessible
4. Given an OAuth user who HAS set up keys previously, when they return, then they see "Enter your messaging password"

### US-3: Password Manager Integration (P2)

As a user setting up messaging encryption, password managers should detect and offer to save the password.

**Acceptance Criteria**:

1. Given a user on setup page, when they enter a password, then browser offers to save credentials
2. Given password form with email + password fields, when form has proper autocomplete attributes, then password managers detect it
3. Given the setup page, when rendered, then it includes email field with `autocomplete="username"` and password with `autocomplete="new-password"`
4. Given the setup page, when displayed, then "Save this password" warning appears: above password field, below confirm field, AND in post-setup toast

### US-4: Decryption Failure Explanation (P2)

When a message cannot be decrypted, show clear explanation of WHY and what to do.

**Acceptance Criteria**:

1. Given a message encrypted with revoked/old keys, when user views it, then they see lock icon + "Encrypted with previous keys" (not raw error)
2. Given multiple undecryptable messages, when displayed, then each shows lock icon individually
3. Given a decryption failure, when user hovers/focuses lock icon, then tooltip explains the situation

### US-5: Participant Name Resolution (P3)

As a user viewing a conversation, I need to see the participant's actual name, not "Unknown".

**Acceptance Criteria**:

1. Given a conversation with user "jonpohlner", when viewing, then header shows "jonpohlner", not "Unknown"
2. Given participant has display_name set, when viewing, then display_name is shown (preferred over username)
3. Given participant's account was deleted, when viewing, then show "Deleted User" (explicit, not "Unknown")

## Edge Cases

- OAuth user has keys but all revoked: Trigger setup mode (no VALID keys where revoked=false)
- Password manager doesn't support autocomplete: Provide explicit "save this password" reminder
- ALL messages in conversation undecryptable: Show conversation-level banner with lock icon
- Participant profile doesn't exist: Show "Unknown User" with visual indicator
- User closes setup modal without completing: Block access, re-show on next visit

## Requirements

### Functional

- FR-001: Message input visible on all viewports (320px to 1920px, portrait AND landscape)
- FR-002: Detect OAuth users with no encryption keys and show "Create" flow
- FR-003: Include proper `autocomplete` attributes for password manager compatibility
- FR-004: Show decryption failures as lock icon + "Encrypted with previous keys"
- FR-005: Resolve and display participant names from user_profiles with graceful fallback
- FR-006: Distinguish "setup mode" (zero valid keys) from "unlock mode" (keys exist but not loaded)
- FR-007: Query `user_encryption_keys WHERE revoked=false` - revoked keys don't count
- FR-008: Use full page (`/messages/setup`) for first-time, modal for subsequent unlocks
- FR-009: Display "Save this password" warning at three points

### Key Entities

- **UserEncryptionKeys**: Stores public_key, encryption_salt, revoked status
- **UserProfiles**: Stores username, display_name for participant resolution
- **Conversations**: Links participant_1_id and participant_2_id

## Success Criteria

- SC-001: Message input visible on 100% of viewport sizes (Playwright visual tests)
- SC-002: OAuth users with no valid keys see "Create" flow, not "Enter" prompt
- SC-003: Password managers detect and offer to save credentials (Chrome, Firefox tested)
- SC-004: Decryption errors show actionable explanation text
- SC-005: Participant names resolve correctly (0% "Unknown" for valid users)
