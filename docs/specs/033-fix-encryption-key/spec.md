# Feature Specification: Fix Encryption Key Management

**Feature Branch**: `033-fix-encryption-key`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Fix encryption key management: NULL-salt keys are being created by legacy rotateKeys() method, causing users to get stuck in 'Your account needs to be updated' loop. Root cause: rotateKeys() uses random key generation without password derivation, creating keys without encryption_salt. Need to fix rotateKeys() to require password, improve needsMigration() to find ANY valid key, and delete legacy generate-keys-for-user.ts script."

## Clarifications

### Session 2025-11-25

- Q: For users with ONLY NULL-salt keys, what should happen when they sign in? → A: Auto-initialize new keys using their current sign-in password

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Unlock Encrypted Messages (Priority: P1)

As a user who has set up encryption, I want to be able to unlock my messages after signing in, so that I can read my conversations without getting stuck in an error loop.

**Why this priority**: This is the core user-facing bug - users cannot access their encrypted messages due to the "Your account needs to be updated" error loop.

**Independent Test**: Can be fully tested by signing in as test@example.com with password TestPassword123! and verifying the encryption unlock modal works without errors.

**Acceptance Scenarios**:

1. **Given** a user with a valid encryption key (has encryption_salt), **When** they sign in and enter their password in the unlock modal, **Then** they can access their encrypted messages without errors.
2. **Given** a user with multiple keys (some NULL-salt, some valid), **When** the system checks needsMigration(), **Then** it returns false if ANY non-revoked key has a valid salt.

---

### User Story 2 - Prevent Future NULL-Salt Keys (Priority: P2)

As a developer, I want the rotateKeys() method to use password-derived keys with proper salt, so that NULL-salt keys are never created in the future.

**Why this priority**: Prevents the root cause of the bug from recurring.

**Independent Test**: Can be tested by calling rotateKeys(password) and verifying the newly created key has a non-NULL encryption_salt in the database.

**Acceptance Scenarios**:

1. **Given** a user wants to rotate their keys, **When** rotateKeys(password) is called, **Then** the new key is created with a valid encryption_salt derived from Argon2id.
2. **Given** the old rotateKeys() signature (no password), **When** code tries to call it without a password, **Then** TypeScript compilation fails (breaking change is intentional).

---

### User Story 3 - Clean Up Legacy Code (Priority: P3)

As a developer, I want legacy scripts that create NULL-salt keys removed, so that there are no code paths that can create invalid keys.

**Why this priority**: Removes secondary source of NULL-salt keys (the generate-keys-for-user.ts script).

**Independent Test**: Can be tested by verifying the script file no longer exists and grep finds no references to it.

**Acceptance Scenarios**:

1. **Given** the legacy generate-keys-for-user.ts script exists, **When** the fix is applied, **Then** the script is deleted from the repository.

---

### Edge Cases

- What happens when user has ONLY NULL-salt keys (no valid keys at all)? System auto-initializes new password-derived keys using the password they just entered during sign-in.
- What happens when needsMigration() encounters database errors? Should return false (safe default) to avoid blocking users.
- What happens if rotateKeys() is called with an empty password? Should throw KeyDerivationError.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST update `rotateKeys()` method to require a password parameter for key derivation
- **FR-002**: System MUST include `encryption_salt` field in ALL key insertions to user_encryption_keys table
- **FR-003**: System MUST update `needsMigration()` to return false if ANY non-revoked key has a valid encryption_salt
- **FR-004**: System MUST delete the legacy `scripts/generate-keys-for-user.ts` script
- **FR-005**: System MUST use `KeyDerivationService.deriveKeyPair()` with Argon2id for all key creation
- **FR-006**: System MUST store derived keys in memory only (not IndexedDB) for password-derived keys

### Key Entities

- **user_encryption_keys**: Table storing user public keys with encryption_salt (Base64 Argon2 salt) - NULL salt indicates legacy random keys
- **KeyManagementService**: Service class managing key lifecycle - initializeKeys(), deriveKeys(), rotateKeys(), needsMigration()
- **KeyDerivationService**: Service for Argon2id password-based key derivation

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: test@example.com can sign in and unlock encryption without "Your account needs to be updated" error
- **SC-002**: All new keys created via rotateKeys() have non-NULL encryption_salt
- **SC-003**: needsMigration() returns false for users with at least one valid-salt key
- **SC-004**: TypeScript compilation succeeds with updated rotateKeys(password: string) signature
- **SC-005**: Legacy generate-keys-for-user.ts script is removed from codebase
