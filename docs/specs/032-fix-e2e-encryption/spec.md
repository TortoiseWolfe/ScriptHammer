# Feature Specification: Fix E2E Encryption Key Management

**Feature Branch**: `032-fix-e2e-encryption`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Fix E2E encryption key management: keys are lost on every session because IndexedDB storage is unreliable and there's no key recovery mechanism. Need password-derived keys or encrypted key backup so users can decrypt messages across devices and sessions."

## Problem Statement

The current E2E encryption implementation has a critical design flaw:

- Private keys are stored only in browser IndexedDB
- Keys are regenerated on every new session/device
- No key recovery or sync mechanism exists
- Messages encrypted with old keys become permanently unreadable

This makes the messaging system unusable for real-world scenarios where users:

- Switch devices
- Clear browser data
- Use multiple browsers
- Reinstall the app

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Password-Derived Key Recovery (Priority: P1)

User logs into the app on a new device. Instead of generating completely new encryption keys, the system derives the same key pair from their password using a deterministic key derivation function (KDF). This means the user automatically has access to all their previous messages.

**Why this priority**: This is the core fix - without it, the encryption system is fundamentally broken. Users cannot use the app across devices.

**Independent Test**: User can log in on Device B and read messages that were sent/received on Device A.

**Acceptance Scenarios**:

1. **Given** a user with existing encrypted messages, **When** they log in on a new device, **Then** they can read all their previous messages without any additional steps
2. **Given** a user logging in for the first time, **When** they set up their account, **Then** their key is derived from their password and stored on the server (public key only)
3. **Given** a user who changes their password, **When** the password change completes, **Then** they are warned that this will re-encrypt all messages with a new key

---

### User Story 2 - Seamless Multi-Device Support (Priority: P1)

User uses the app on phone and laptop simultaneously. Both devices can send and receive encrypted messages. Messages sent from either device are readable on both.

**Why this priority**: Multi-device is table stakes for any messaging app. This must work.

**Independent Test**: Send message from phone, verify it appears and is readable on laptop within seconds.

**Acceptance Scenarios**:

1. **Given** a user logged in on two devices, **When** they send a message from Device A, **Then** it is readable on Device B
2. **Given** a user logged in on two devices, **When** they receive a message, **Then** it appears on both devices

---

### User Story 3 - Key Persistence Across Sessions (Priority: P1)

User closes browser, clears some cache, or restarts computer. When they return to the app, their encryption keys still work and all messages are readable.

**Why this priority**: Basic session persistence must work - this is currently broken.

**Independent Test**: Close browser completely, reopen, verify messages are still decryptable.

**Acceptance Scenarios**:

1. **Given** a user with existing messages, **When** they close and reopen the browser, **Then** all messages remain readable
2. **Given** a user who clears browser cache (but not all data), **When** they return to the app, **Then** key can be re-derived from password

---

### Edge Cases

- **Password change**: Re-derive new key, decrypt all messages with old key, re-encrypt with new key. Show progress indicator.
- **Key derivation fails**: Show clear error message, do not silently generate new keys, allow retry
- **Public key mismatch**: If server has public key but derived key doesn't match, user entered wrong password - prompt to retry
- **Existing users migration**: Forced migration on next login (see Migration section)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST derive encryption keys deterministically from user's password using Argon2id with parameters: memory=65536 (64MB), timeCost=3, parallelism=4, hashLength=32 bytes
- **FR-002**: System MUST NOT store private keys on server - only derived public keys
- **FR-003**: System MUST produce identical key pairs when same password is used on any device
- **FR-004**: System MUST detect key mismatch (different password = different keys) and notify user
- **FR-005**: System MUST NOT silently regenerate keys when existing encrypted messages exist
- **FR-006**: System MUST provide migration path for existing users with random-generated keys
- **FR-007**: System MUST re-derive keys on every login (not persist in IndexedDB)
- **FR-008**: System MUST use a unique salt per user stored on server for key derivation

### Non-Functional Requirements

- **NFR-001**: Key derivation MUST complete in under 500ms on modern desktop browsers (Chrome 120+, Firefox 120+, Safari 17+)
- **NFR-002**: Key derivation memory usage MUST NOT exceed 64MB peak allocation
- **NFR-003**: System MUST gracefully degrade if Argon2 WASM fails to load (show error, do not silently fail)
- **NFR-004**: Re-authentication modal MUST be accessible (WCAG 2.1 AA compliant)
- **NFR-005**: Migration progress indicator MUST update at least every 2 seconds during processing

### Key Entities

- **User Encryption Salt**: Server-stored random salt unique to each user, used for key derivation
- **Derived Key Pair**: ECDH P-256 key pair derived from password + salt
- **Message Key**: Per-conversation shared secret derived via ECDH (unchanged)

## Technical Approach

### Key Derivation Flow

```
password + user_salt → Argon2 → seed bytes → ECDH P-256 key pair
```

1. On login, fetch user's salt from server
2. Derive deterministic seed from password + salt
3. Use seed to generate ECDH key pair (deterministic generation)
4. Use key pair for all encryption/decryption
5. Never persist private key - re-derive on each session

### Migration for Existing Users (Forced)

1. On login, detect if user has old-style random keys (public key exists but no salt)
2. Block access until migration completes - show "Securing your messages" screen
3. Derive new key pair from password using Argon2
4. Re-encrypt all message keys with new derived key
5. Upload new public key, store salt on server
6. Delete old random keys from IndexedDB and server
7. Allow access to app

## Clarifications

### Session 2025-11-25

- Q: Which key derivation function should be used? → A: Argon2 (modern standard, better brute-force resistance)
- Q: How should existing users with old random-generated keys be migrated? → A: Force migration on next login
- Q: When user changes password, what happens to existing messages? → A: Re-encrypt all messages with new key
- Q: Where should the per-user encryption salt be stored? → A: `user_encryption_keys` table (keeps cryptographic data together, single atomic fetch)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: User can decrypt messages on any device after logging in with correct password
- **SC-002**: Closing/reopening browser does not break message decryption
- **SC-003**: Zero "[Message could not be decrypted]" errors for users using correct password
- **SC-004**: E2E tests pass consistently without cross-test decryption failures
- **SC-005**: Password change triggers clear warning about message re-encryption
