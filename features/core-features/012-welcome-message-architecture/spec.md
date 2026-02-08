# Feature Specification: Welcome Message Architecture

**Feature Branch**: `012-welcome-message-architecture`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "An automated welcome message system that sends new users an encrypted welcome message explaining end-to-end encryption, with idempotency to prevent duplicates and graceful error handling."

## Clarifications

### Session 2025-11-28

- Q: How should welcome message encryption be handled? → A: Client-side encryption using admin's pre-stored public key
- Q: How should admin public key setup be handled? → A: Auto-generate during initial system setup
- Q: Should existing users without welcome messages be backfilled? → A: No - fresh start approach
- Q: Should system setup create admin user if missing? → A: Yes - full automated setup

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Receives Welcome Message (Priority: P1)

As a new user who has just completed account setup, I automatically receive a welcome message from admin that explains how end-to-end encryption works in the messaging system.

**Why this priority**: Core onboarding feature - users need to understand E2E encryption to use messaging effectively.

**Independent Test**: Can be tested by creating a new user, completing key initialization, and verifying welcome message appears in their conversation list.

**Acceptance Scenarios**:

1. **Given** a new user has completed encryption key initialization, **When** the system processes their setup, **Then** a welcome message conversation with admin is created
2. **Given** the welcome system processes a new user, **When** admin's public key is available, **Then** the message is encrypted and only the user can decrypt it
3. **Given** a user already received a welcome message, **When** they re-initialize keys (device migration), **Then** no duplicate welcome message is sent

---

### User Story 2 - Idempotent Welcome Messages (Priority: P2)

As a user, I should never receive duplicate welcome messages even if system edge cases cause multiple processing attempts.

**Why this priority**: Prevents spam and user confusion if edge cases trigger multiple invocations.

**Independent Test**: Can be tested by triggering the welcome process multiple times for the same user and verifying only one welcome message exists.

**Acceptance Scenarios**:

1. **Given** a user has already received their welcome message, **When** the welcome process runs again, **Then** no new message is created
2. **Given** concurrent welcome processes are triggered, **When** both attempt to create the conversation, **Then** only one succeeds (idempotent pattern)

---

### User Story 3 - Graceful Error Handling (Priority: P3)

As a new user, if the welcome message system fails, my account creation should still complete successfully without errors.

**Why this priority**: System resilience - missing admin setup or system errors shouldn't block user registration.

**Independent Test**: Can be tested by simulating missing admin key and verifying user sign-in completes without errors.

**Acceptance Scenarios**:

1. **Given** admin public key is not configured, **When** the welcome process attempts to run, **Then** an error is logged and welcome message is skipped
2. **Given** the welcome process fails for any reason, **When** user completes sign-in, **Then** sign-in succeeds normally (welcome is non-blocking)

---

### Edge Cases

- What happens when admin public key is missing?
  - System logs error, skips welcome message, does not block user sign-in

- What happens when admin user profile doesn't exist?
  - System setup creates it automatically; if missing at runtime, process fails gracefully

- How does system handle encryption failures?
  - Logs error, skips welcome message, allows normal sign-in

- What happens if encryption capabilities are unavailable?
  - System catches error, logs warning, skips welcome

- What happens if conversation created but message insert fails?
  - Orphan conversation is harmless - next attempt uses existing conversation via idempotent pattern

- What happens if user signs in on multiple devices during key initialization?
  - Keys are derived consistently, so welcome message succeeds on one device and skips on others (idempotency)

- What is the initial state of welcome message tracking?
  - Default "not sent" for new users, marked "sent" after successful delivery

---

## Requirements _(mandatory)_

### Functional Requirements

**Welcome Message Delivery**

- **FR-001**: System MUST automatically send welcome message to new users after encryption key initialization
- **FR-002**: System MUST encrypt welcome message using asymmetric encryption with admin's public key
- **FR-003**: System MUST NOT require admin password or private key at runtime
- **FR-004**: System MUST use consistent participant ordering when creating conversations (alphabetical/sorted IDs)

**Idempotency**

- **FR-005**: System MUST track welcome message status per user
- **FR-006**: System MUST check welcome message status before sending (early return if already sent)
- **FR-007**: System MUST handle concurrent requests idempotently (no duplicates)
- **FR-008**: System MUST update welcome message status after successful delivery

**Error Handling**

- **FR-009**: System MUST NOT block user sign-in if welcome message fails
- **FR-010**: System MUST log errors without exposing sensitive information
- **FR-011**: System MUST fail gracefully if admin public key is missing

**Admin Setup**

- **FR-012**: System MUST support automated admin user and key setup during initialization
- **FR-013**: Admin public key MUST be pre-generated and stored securely
- **FR-014**: Admin private key MUST NOT be needed after initial setup (discarded)

### Key Entities

- **Admin User**: Designated system administrator account used as sender for welcome messages

- **Admin Public Key**: Pre-generated public key stored in the system, used for encryption derivation

- **Welcome Message Status**: Per-user tracking flag indicating whether welcome message has been sent

- **Welcome Conversation**: Standard conversation between admin and new user containing the welcome message

- **Welcome Message Content**: Static welcome text explaining E2E encryption features

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New users receive welcome message within reasonable time of key initialization
- **SC-002**: Zero errors related to missing admin credentials at runtime
- **SC-003**: Welcome messages function correctly in client-only deployment scenarios
- **SC-004**: No admin secrets required at runtime (public key only)
- **SC-005**: Users with "sent" status do not receive duplicate welcome messages
- **SC-006**: Failed welcome delivery does not block user sign-in or cause visible errors

---

## Constraints _(optional)_

- Welcome message content is static (not personalized)
- Admin cannot reply to welcome messages (one-way communication)
- Welcome message is not resendable by admin
- System operates in client-side deployment context (no server-side processing available)

---

## Dependencies _(optional)_

- Requires user messaging system (009) for conversation and message infrastructure
- Requires user authentication (003) for user identity
- Requires admin user setup during system initialization

---

## Assumptions _(optional)_

- Admin public key is pre-generated during initial system setup
- Users have compatible encryption capabilities in their client
- Welcome message explains E2E encryption in user-friendly terms
- Single welcome message per user (not per device)
