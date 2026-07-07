# Feature Specification: Critical Messaging UX Fixes

**Feature Branch**: `006-feature-006-critical`
**Created**: 2025-11-29
**Status**: Draft
**Input**: User description: "Fix broken messaging UX: (1) Scroll STILL broken - message input clipped at bottom of viewport despite CSS Grid fix, (2) OAuth users prompted to ENTER password they never CREATED - ReAuthModal shows 'Enter password' instead of 'Create messaging password' for new OAuth users with no encryption keys, (3) Password manager integration broken - form not triggering password save prompts, (4) Decrypted message shows '[Message could not be decrypted]' with no explanation, (5) Participant name shows 'Unknown' instead of actual username"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Message Input Always Visible (Priority: P1)

As a user viewing a conversation, I need to see and access the message input field at all times so I can type and send messages without scrolling or UI issues.

**Why this priority**: This is the most critical blocker - users literally cannot send messages if the input is clipped off screen. Zero functionality without this.

**Independent Test**: Navigate to /messages with any conversation selected. On all viewports from 320px to 1920px (portrait AND landscape), the message input textarea and Send button must be fully visible at the bottom of the chat area without any scrolling required.

**Acceptance Scenarios**:

1. **Given** a user on mobile viewport (375x667), **When** they open a conversation with messages, **Then** the message input is fully visible at bottom of screen, not clipped or hidden
2. **Given** a user on desktop viewport (1280x800), **When** they open a conversation, **Then** the message input is visible and the chat header, message thread, and input form all fit within the viewport
3. **Given** a conversation with 50+ messages, **When** the user scrolls through messages, **Then** the input field remains fixed at the bottom and does not scroll away

**Root Cause Analysis**:

- Current: `drawer-content` uses `grid grid-rows-[auto_1fr]` but mobile header takes space not accounted for
- The `main` element's height calculation fails in nested flex/grid context
- DaisyUI drawer pattern conflicts with CSS Grid height propagation

---

### User Story 2 - OAuth User Password Setup Flow (Priority: P1)

As an OAuth user (Google/GitHub sign-in) who has never set up messaging, I need to be guided to CREATE a messaging password, not asked to ENTER one that doesn't exist.

**Why this priority**: OAuth users are completely blocked from messaging. They're asked for a password they never created - this is a dead-end UX that makes the feature unusable.

**Independent Test**: Sign in with Google OAuth (new user with no encryption keys). Navigate to /messages. User should see a clear "Set Up Encrypted Messaging" flow with password creation fields (password + confirm), NOT an "Enter your password" prompt.

**Acceptance Scenarios**:

1. **Given** an OAuth user with NO encryption keys in database, **When** they navigate to /messages, **Then** they see "Set Up Encrypted Messaging" modal with password + confirm password fields
2. **Given** an OAuth user with NO encryption keys, **When** they see the setup modal, **Then** the modal text explains they need to CREATE a messaging password (not enter an existing one)
3. **Given** an OAuth user creating a messaging password, **When** they enter password and confirm, **Then** encryption keys are generated and stored, and they can access messaging
4. **Given** an OAuth user who HAS set up encryption keys previously, **When** they return and keys are not in memory, **Then** they see "Enter your messaging password" (unlock mode, not setup mode)

**Root Cause Analysis**:

- `ReAuthModal` checks `keyManagementService.hasKeys()` to determine setup vs unlock mode
- The `hasKeys()` method may return incorrect values
- Flow in `messages/page.tsx` checks `hasStoredKeys` - if false, redirects to `/messages/setup`
- But ReAuthModal is shown BEFORE the redirect check completes, or redirect isn't happening

---

### User Story 3 - Password Manager Integration (Priority: P2)

As a user setting up messaging encryption, I need my password manager to detect and offer to save my messaging password so I don't lose access to my encrypted messages.

**Why this priority**: Without password manager save prompts, users will forget their messaging password and lose access to all encrypted messages permanently.

**Independent Test**: On the messaging password setup screen, verify that browser password managers (Chrome, Firefox, 1Password, etc.) detect the form and offer to save the password.

**Acceptance Scenarios**:

1. **Given** a user on the messaging setup page (`/messages/setup`), **When** they enter a new password, **Then** their browser's password manager offers to save the credentials
2. **Given** a password form with email + password fields, **When** the form has proper autocomplete attributes, **Then** password managers detect it as a credential form
3. **Given** the setup page, **When** it renders, **Then** it includes a visible email field with `autocomplete="username"` and password field with `autocomplete="new-password"`
4. **Given** the setup page, **When** displayed, **Then** "Save this password" warning appears: (a) above password field, (b) below confirm field, AND (c) in post-setup toast

**Root Cause Analysis**:

- Password managers require specific HTML attributes: `autocomplete="username"` on email, `autocomplete="new-password"` on password
- Form must be a proper `<form>` element with submit handler
- Full page (`/messages/setup`) preferred over modal for first-time setup (better password manager detection)
- Modal (`ReAuthModal`) used only for subsequent unlocks when user already has saved password

---

### User Story 4 - Decryption Failure Explanation (Priority: P2)

As a user viewing messages, when a message cannot be decrypted, I need a clear explanation of WHY and what I can do about it, not just "[Message could not be decrypted]".

**Why this priority**: Cryptic error messages confuse users and provide no path forward. Users need to understand this is expected after password reset, not a bug.

**Independent Test**: View a conversation containing messages encrypted with old/invalid keys. The UI should show a helpful message explaining the decryption failure and what caused it.

**Acceptance Scenarios**:

1. **Given** a message encrypted with revoked/old keys, **When** the user views it, **Then** they see a lock icon + "Encrypted with previous keys" text (not "[Message could not be decrypted]")
2. **Given** multiple undecryptable messages in a row, **When** displayed, **Then** each message shows the lock icon indicator individually (per-message, Signal/WhatsApp pattern)
3. **Given** a decryption failure, **When** the user hovers OR focuses (keyboard navigation) the lock icon, **Then** a tooltip explains "This message was encrypted before your current encryption keys were set up"

---

### User Story 5 - Participant Name Resolution (Priority: P3)

As a user viewing a conversation, I need to see the other participant's username/display name, not "Unknown".

**Why this priority**: Lower priority as it's cosmetic, but still important for usability. Users need to know who they're talking to.

**Independent Test**: Open a conversation. The header should show the other participant's display_name or username, never "Unknown" unless the user account was actually deleted.

**Acceptance Scenarios**:

1. **Given** a conversation with user "jonpohlner", **When** viewing the conversation, **Then** the header shows "jonpohlner" (or their display_name), not "Unknown"
2. **Given** the other participant has a display_name set, **When** viewing conversation, **Then** display_name is shown (preferred over username)
3. **Given** the other participant's account was deleted (profile query returns null AND user exists in auth.users with deleted_at set), **When** viewing conversation, **Then** show "Deleted User" (explicit, not "Unknown")

**Root Cause Analysis**:

- `loadConversationInfo()` in messages/page.tsx queries `user_profiles` table
- Query may be failing silently or participant ID lookup is incorrect
- Fallback to "User" is too generic

---

### Edge Cases

- What happens when OAuth user has keys but they were all revoked? → Should trigger setup mode (no VALID keys where `revoked=false`)
- What happens when user's password manager doesn't support autocomplete? → Provide explicit "save this password" reminder text
- What happens when ALL messages in a conversation are undecryptable? → Show conversation-level banner: "All messages in this conversation were encrypted with previous keys" with lock icon, in addition to per-message indicators
- What happens when participant profile doesn't exist (orphaned conversation)? → Show "Unknown User" with visual indicator
- What happens when user closes setup modal without completing? → Block access to messaging, re-show unlock mode modal on next visit (setup is full page, not modal)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display message input fully visible on all viewports at these breakpoints: 320px (min), 375px (mobile), 667px landscape, 768px (tablet), 1024px landscape, 1280px (desktop), 1920px (max) - in both portrait AND landscape orientations
- **FR-002**: System MUST detect OAuth users with no encryption keys and show "Create messaging password" flow (not "Enter password")
- **FR-003**: System MUST include proper `autocomplete` attributes on password forms for password manager compatibility
- **FR-004**: System MUST show decryption failures as lock icon + "Encrypted with previous keys" text (not raw "[Message could not be decrypted]")
- **FR-005**: System MUST resolve and display participant names from user_profiles, falling back gracefully
- **FR-006**: System MUST distinguish between "setup mode" (zero rows in user_encryption_keys with `revoked=false`) and "unlock mode" (valid keys exist in database but not loaded in memory)
- **FR-007**: System MUST query `user_encryption_keys WHERE revoked=false` to determine valid keys - revoked keys do NOT count as "having keys"
- **FR-008**: System MUST use full page (`/messages/setup`) for first-time setup, modal for subsequent unlocks
- **FR-009**: System MUST display "Save this password" warning at three points: above password field, below confirm field, and in post-setup toast

### Key Entities

- **UserEncryptionKeys**: Stores public_key, encryption_salt, revoked status per user. `revoked=false` indicates valid key.
- **UserProfiles**: Stores username, display_name for participant name resolution
- **Conversations**: Links participant_1_id and participant_2_id to users

## Clarifications

### Session 2025-11-29

- Q: What happens when user forgets messaging password? → A: Self-service reset with data loss warning (industry standard). Full reset flow deferred to future feature; this feature focuses on password manager integration to prevent forgetting.
- Q: How should undecryptable messages display? → A: Per-message lock icon + "Encrypted with previous keys" text (Signal/WhatsApp pattern).
- Q: Should setup be full page or modal? → A: Full page (`/messages/setup`) for first-time setup, modal (`ReAuthModal`) for subsequent unlocks.
- Q: Which viewports must be tested? → A: All orientations + edge cases (320px min to 1920px max, portrait + landscape).
- Q: When to show "Save this password" warning? → A: All three points - above password field, below confirm field, and post-setup toast (maximum visibility).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Message input visible on 100% of viewport sizes (mobile/tablet/desktop) - verified via Playwright visual tests
- **SC-002**: OAuth users with no valid keys see "Create" flow, not "Enter" prompt - 100% of new OAuth user journeys
- **SC-003**: Password managers detect and offer to save credentials on setup form (tested with Chrome, Firefox)
- **SC-004**: Decryption errors show actionable explanation text (not raw error codes)
- **SC-005**: Participant names resolve correctly for all active user accounts (0% "Unknown" for valid users)
