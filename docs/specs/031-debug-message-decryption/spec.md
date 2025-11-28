# Feature Specification: Debug Message Decryption Failure

**Feature Branch**: `031-debug-message-decryption`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Debug message decryption failure: Messages display [Message could not be decrypted] instead of actual content. Need diagnostic logging to trace decryption flow, verify private keys exist in IndexedDB, check public keys exist in Supabase for other users, and identify why decryption is failing silently."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Diagnostic Logging for Decryption Flow (Priority: P1)

As a developer debugging decryption failures, I need detailed console logs that trace the entire decryption flow so I can identify exactly where the failure occurs.

**Why this priority**: Cannot fix what we cannot see. Logging is the foundation for all other debugging work.

**Independent Test**: Can be tested by opening browser DevTools console, navigating to a conversation with encrypted messages, and verifying that detailed logs appear showing each step of the decryption process.

**Acceptance Scenarios**:

1. **Given** a user opens a conversation with messages, **When** messages are loaded, **Then** console logs show: "[Decryption] Starting for message {id}" with timestamp
2. **Given** decryption attempts to run, **When** private key is fetched from IndexedDB, **Then** console logs show: "[Decryption] Private key found/missing for user {id}"
3. **Given** decryption attempts to run, **When** public key is fetched from Supabase, **Then** console logs show: "[Decryption] Public key found/missing for user {otherId}"
4. **Given** decryption fails, **When** error is caught, **Then** console logs show exact error type, message, and stack trace before returning fallback text

---

### User Story 2 - Private Key Verification (Priority: P2)

As a user who cannot read my messages, I need to know if my private encryption key is missing so I understand why decryption fails and what action to take.

**Why this priority**: Most common cause of decryption failure - different browser/device or cleared storage.

**Independent Test**: Can be tested by checking IndexedDB in DevTools Application tab for 'messaging_keys' database and verifying key presence.

**Acceptance Scenarios**:

1. **Given** a user loads the messaging page, **When** no private key exists in IndexedDB, **Then** console logs "[Decryption] CRITICAL - No private key in IndexedDB for current user"
2. **Given** private key is missing, **When** key initialization runs on sign-in, **Then** logs show whether initialization succeeded or failed with specific error

---

### User Story 3 - Public Key Verification (Priority: P2)

As a developer, I need to verify that the other user's public key exists in Supabase before attempting decryption to identify missing key scenarios.

**Why this priority**: Second most common cause - other user never had keys initialized.

**Independent Test**: Can be tested by querying `user_encryption_keys` table for the other participant's user ID.

**Acceptance Scenarios**:

1. **Given** a message needs decryption, **When** fetching the sender's public key, **Then** logs show "[Decryption] Fetching public key for sender {userId}"
2. **Given** no public key exists for sender, **When** decryption is attempted, **Then** logs show "[Decryption] MISSING public key for user {userId} - cannot derive shared secret"

---

### User Story 4 - Shared Secret Derivation Verification (Priority: P3)

As a developer, I need to verify that ECDH shared secret derivation works correctly between the two keys.

**Why this priority**: Less common but cryptographically complex - key format or curve mismatch issues.

**Independent Test**: Can be tested by logging the shared secret derivation step and verifying it produces a valid 256-bit key.

**Acceptance Scenarios**:

1. **Given** both keys are present, **When** deriving shared secret, **Then** logs show "[Decryption] Deriving shared secret..." with success/failure
2. **Given** shared secret derivation fails, **When** error occurs, **Then** logs show specific crypto error (e.g., "InvalidAccessError", "OperationError")

---

### User Story 5 - AES-GCM Decryption Verification (Priority: P3)

As a developer, I need to verify the final AES-GCM decryption step to identify IV or ciphertext issues.

**Why this priority**: Final step - if we get here, keys are present but actual decryption fails.

**Independent Test**: Can be tested by logging the IV extraction and decrypt call.

**Acceptance Scenarios**:

1. **Given** shared secret is derived, **When** extracting IV from encrypted content, **Then** logs show IV length and first few bytes (not full content)
2. **Given** decryption call fails, **When** AES-GCM throws error, **Then** logs show "[Decryption] AES-GCM failed: {error}" with ciphertext length

---

### Edge Cases

- What happens when message was encrypted with a rotated/old key that no longer exists?
- How does system handle corrupted ciphertext (truncated or modified)?
- What happens when IndexedDB is unavailable (private browsing mode)?
- How does system handle key format version mismatch?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST log "[Decryption]" prefixed messages at each step of decryption flow
- **FR-002**: System MUST log whether private key exists in IndexedDB before attempting decryption
- **FR-003**: System MUST log whether public key exists in Supabase for message sender
- **FR-004**: System MUST log specific error type and message when decryption fails (not just catch and ignore)
- **FR-005**: System MUST preserve existing "[Message could not be decrypted]" fallback behavior
- **FR-006**: Logs MUST NOT expose actual key material or decrypted content (security requirement)
- **FR-007**: System SHOULD log message metadata (id, timestamp, sender) to correlate with database records

### Key Entities

- **Private Key**: User's ECDH P-256 private key stored in IndexedDB `messaging_keys` database
- **Public Key**: User's ECDH P-256 public key stored in Supabase `user_encryption_keys` table
- **Encrypted Message**: Contains IV (12 bytes) + ciphertext, stored in `messages.encrypted_content`
- **Shared Secret**: Derived via ECDH between sender's private key and recipient's public key

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Console logs clearly identify which step failed for any decryption failure within 30 seconds of viewing messages
- **SC-002**: Developer can determine if issue is missing private key, missing public key, or crypto error from logs alone
- **SC-003**: No regression - messages that were decrypting successfully continue to work
- **SC-004**: Logs provide enough information to write a fix without additional debugging sessions
