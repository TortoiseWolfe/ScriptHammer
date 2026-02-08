# Feature Specification: Critical Messaging UX Fixes

**Feature Branch**: `016-messaging-critical-fixes`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Fix 5 critical messaging UX issues: message input visibility, OAuth password confusion, password manager integration, decryption error messaging, and participant name resolution."

---

## User Scenarios & Testing _(mandatory)_

<!-- User stories reordered per UX_FLOW_ORDER.md (2026-01-16):
     Follows visual hierarchy: Header → Messages → Decryption → Input
     OAuth setup stories (different wireframe) follow the UX-visible ones -->

### User Story 1 - Participant Name Resolution (Priority: P3) [UX: Header]

As a user viewing a conversation, I need to see the actual participant's name, not "Unknown".

**Why this priority**: Basic usability - "Unknown" is confusing and unprofessional.

**Independent Test**: Can be tested by viewing a conversation with a known user and verifying their display name appears correctly.

**Acceptance Scenarios**:

1. **Given** a conversation with a valid user, **When** viewing the header, **Then** the user's name is displayed correctly
2. **Given** a participant with a display name set, **When** viewing, **Then** the display name is shown (preferred over username)
3. **Given** a participant whose account was deleted, **When** viewing, **Then** "Deleted User" is shown (not generic "Unknown")

---

### User Story 2 - Decryption Failure Explanation (Priority: P2) [UX: Message Area]

As a user viewing a conversation, when a message cannot be decrypted, I need to understand why and what (if anything) I can do.

**Why this priority**: Reduces confusion and support requests when messages show as errors.

**Independent Test**: Can be tested by viewing a message encrypted with revoked keys and verifying helpful explanation appears.

**Acceptance Scenarios**:

1. **Given** a message encrypted with old/revoked keys, **When** user views it, **Then** they see a lock icon with "Encrypted with previous keys" text
2. **Given** multiple undecryptable messages, **When** displayed, **Then** each shows the lock icon individually (not one generic error)
3. **Given** a decryption failure indicator, **When** user hovers or focuses on it, **Then** a tooltip explains the situation

---

### User Story 3 - Message Input Always Visible (Priority: P1) [UX: Fixed Bottom]

As a user viewing a conversation, the message input field must be visible at all times regardless of device or message count.

**Why this priority**: Core usability - users cannot send messages if input is hidden.

**Independent Test**: Can be tested by opening a conversation on various viewport sizes and verifying the input is always visible and usable.

**Acceptance Scenarios**:

1. **Given** a user on any mobile device, **When** they open a conversation, **Then** the message input is fully visible at the bottom of the screen
2. **Given** a user on desktop, **When** they open a conversation, **Then** the input is visible with proper layout
3. **Given** a conversation with many messages, **When** user scrolls through history, **Then** the input field remains fixed and accessible

---

### User Story 4 - OAuth User Full-Page Setup Flow (Priority: P1) [See: 02-oauth-setup-flow.svg]

As a first-time OAuth user accessing messaging, I need a dedicated setup page (not a modal) that clearly explains I'm creating a new messaging password, with password manager integration.

**Why this priority**: Reduces confusion and password loss - full-page experience is harder to dismiss accidentally and better for password managers.

**Independent Test**: Can be tested by signing in with OAuth as new user, navigating to messages, and verifying the full-page setup appears with proper form fields.

**Acceptance Scenarios**:

1. **Given** an OAuth user with no encryption keys, **When** they navigate to messaging, **Then** they are redirected to a full-page setup flow (not a modal)
2. **Given** a user on the setup page, **When** they view the form, **Then** they see "Set Up Encrypted Messaging" with password and confirm fields
3. **Given** the setup page, **When** displayed, **Then** a "Save this password" warning appears above the password field, below the confirm field, and after successful setup
4. **Given** a user completing setup, **When** they enter matching passwords, **Then** their encryption keys are created and they can access messaging

---

### User Story 5 - Password Manager Integration (Priority: P2) [See: 02-oauth-setup-flow.svg]

As a user setting up messaging encryption, my password manager should detect the form and offer to save the credentials.

**Why this priority**: Prevents password loss - users often forget messaging passwords because they're separate from login.

**Independent Test**: Can be tested by opening setup page in browser with password manager and verifying the save credential prompt appears.

**Acceptance Scenarios**:

1. **Given** a user on the setup page, **When** they enter a password, **Then** their browser/password manager offers to save credentials
2. **Given** the setup form, **When** rendered, **Then** it includes proper form attributes that password managers recognize
3. **Given** a user who completes setup, **When** they return later, **Then** password manager can autofill their messaging password

---

### Edge Cases

- What happens if OAuth user has keys but all are revoked?
  - Treat as no valid keys, show setup flow

- What if password manager doesn't support the form?
  - Explicit "Save this password" warnings appear at three points

- What if ALL messages in a conversation are undecryptable?
  - Show conversation-level banner explaining the situation

- What if participant's profile doesn't exist in database?
  - Show "Unknown User" with visual indicator that this is a data issue

- What if user closes setup page without completing?
  - Block messaging access, redirect back to setup on next visit

---

## Requirements _(mandatory)_

### Functional Requirements

**Input Visibility**

- **FR-001**: Message input MUST be visible on all viewport sizes (mobile to desktop)
- **FR-002**: Message input MUST remain fixed at bottom when scrolling through messages
- **FR-003**: Input MUST be visible in both portrait and landscape orientations

**OAuth Setup Flow**

- **FR-004**: System MUST detect OAuth users with no valid encryption keys
- **FR-005**: First-time OAuth users MUST see full-page setup (not modal)
- **FR-006**: Setup page MUST include both password and confirm password fields
- **FR-007**: System MUST distinguish "setup mode" (no valid keys) from "unlock mode" (keys exist)
- **FR-008**: Revoked keys MUST NOT count as valid keys for mode detection

**Password Manager Integration**

- **FR-009**: Setup form MUST include attributes that password managers recognize
- **FR-010**: System MUST display "Save this password" warning at three points: above password field, below confirm field, and after successful setup
- **FR-011**: Form structure MUST support credential autofill on return visits

**Decryption Error UX**

- **FR-012**: Undecryptable messages MUST show lock icon (not raw error text)
- **FR-013**: Lock icon MUST be accompanied by explanatory text
- **FR-014**: Hovering/focusing lock icon MUST show tooltip with details
- **FR-015**: Multiple undecryptable messages MUST each show individual indicators

**Participant Name Resolution**

- **FR-016**: System MUST resolve and display participant names correctly
- **FR-017**: Display name MUST take precedence over username when available
- **FR-018**: Deleted users MUST show "Deleted User" (not generic "Unknown")
- **FR-019**: Missing profile data MUST show "Unknown User" with visual indicator

### Key Entities

- **Encryption Key Status**: Whether user has valid (non-revoked) encryption keys

- **Participant Profile**: User's display name and username for conversation headers

- **Decryption Status**: Whether a message can be decrypted with current keys

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Message input visible on 100% of viewport sizes tested (mobile through desktop)
- **SC-002**: OAuth users with no valid keys see "Create" flow, never "Enter password" prompt
- **SC-003**: Password managers detect and offer to save credentials in major browsers
- **SC-004**: Decryption failures show user-friendly explanation (no raw errors or empty states)
- **SC-005**: Participant names resolve correctly for valid users (0% "Unknown")
- **SC-006**: "Save this password" warning displayed at all three required points

---

## Constraints _(optional)_

- Full-page setup only for first-time users; returning users see modal
- No password recovery mechanism (encrypted data is unrecoverable)
- Cannot decrypt messages encrypted with revoked keys

---

## Dependencies _(optional)_

- Requires Feature 013 for OAuth detection logic foundation
- Requires user messaging system (009) for conversation infrastructure
- Requires user authentication (003) for OAuth detection

---

## Assumptions _(optional)_

- Password managers follow standard form detection patterns
- Display names are optional; username is always available
- Revoked keys cannot be un-revoked
