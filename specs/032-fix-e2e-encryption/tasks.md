# Tasks: Fix E2E Encryption Key Management

**Input**: Design documents from `/specs/032-fix-e2e-encryption/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story to enable independent implementation. All three user stories share priority P1 as they collectively fix the broken encryption system.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, ALL)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and core crypto infrastructure

- [ ] T001 [ALL] Install argon2-wasm-esm dependency: `docker compose exec scripthammer pnpm add argon2-wasm-esm`
- [ ] T002 [ALL] Create database migration for encryption_salt column in `supabase/migrations/032_add_encryption_salt.sql`
- [ ] T003 [P] [ALL] Apply migration to Supabase: run migration via Supabase dashboard or CLI

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core key derivation infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [ALL] Create key derivation types in `src/types/messaging.ts`:
  - Add `KeyDerivationParams` interface
  - Add `DerivedKeyPair` interface
  - Add `KeyDerivationError` class
  - Add `MigrationError` class
  - Add `ARGON2_CONFIG` constants

- [ ] T005 [ALL] Write FAILING unit tests for key derivation in `src/lib/messaging/__tests__/key-derivation.test.ts`:
  - Test: same password + salt = same key pair (determinism) - MUST FAIL initially
  - Test: different password = different key pair - MUST FAIL initially
  - Test: different salt = different key pair - MUST FAIL initially
  - Test: generateSalt produces 16 bytes - MUST FAIL initially
  - Test: derived key is valid P-256 format - MUST FAIL initially

- [ ] T006 [ALL] Implement key derivation service in `src/lib/messaging/key-derivation.ts`:
  - Import `argon2-wasm-esm`
  - Implement `generateSalt()` - 16 bytes random
  - Implement `deriveKeyPair(password, salt)` - Argon2id → P-256 seed → key pair
  - Implement `verifyPublicKey(derived, stored)` - JWK comparison
  - Run tests from T005 - ALL MUST PASS
  - See contracts/key-derivation.ts for interface

**Checkpoint**: Key derivation infrastructure ready - user story implementation can begin

---

## Phase 3: User Story 1 - Password-Derived Key Recovery (Priority: P1) 🎯 MVP

**Goal**: Users can log in on any device and decrypt all messages using their password

**Independent Test**: Log in on Device B, verify messages from Device A are readable

### Implementation for User Story 1

- [ ] T007 [US1] Update `src/services/messaging/key-service.ts` - Add salt fetch method:
  - Add `fetchUserSalt(userId)` - query `user_encryption_keys.encryption_salt`
  - Return null if no salt (triggers migration or new user flow)

- [ ] T008 [US1] Update `src/services/messaging/key-service.ts` - Add key derivation method:
  - Add `deriveKeys(password)` method using `keyDerivationService`
  - Store derived keys in memory (class property, NOT IndexedDB)
  - Add `getCurrentKeys()` getter for memory-cached keys
  - Add `clearKeys()` for logout

- [ ] T009 [US1] Update `src/services/messaging/key-service.ts` - Update initializeKeys for new users:
  - Modify `initializeKeys(password)` to accept password parameter
  - Generate salt via `keyDerivationService.generateSalt()`
  - Derive key pair from password + salt
  - Insert public_key AND encryption_salt to Supabase
  - Do NOT store private key in IndexedDB

- [ ] T010 [US1] Update `src/services/messaging/key-service.ts` - Add needsMigration check:
  - Add `needsMigration()` method
  - Returns true if user has public_key but encryption_salt is NULL
  - Used to detect legacy random-key users

- [ ] T010a [US1] Implement key mismatch detection in `src/services/messaging/key-service.ts`:
  - In `deriveKeys()`, compare derived public key with stored public key via `verifyPublicKey()`
  - If mismatch: throw `KeyMismatchError` with message "Incorrect password. The encryption key doesn't match. Please try again."
  - Do NOT proceed with derived keys if mismatch detected
  - Allow retry without client-side rate limiting (server-side handles brute force)

- [ ] T011 [US1] Update `src/services/messaging/message-service.ts` - Use derived keys:
  - Modify `sendMessage()` to get keys from `keyManagementService.getCurrentKeys()`
  - Modify `getMessageHistory()` to get keys from `keyManagementService.getCurrentKeys()`
  - Remove `encryptionService.getPrivateKey()` calls (no more IndexedDB reads)
  - Throw clear error if keys not derived (prompt re-authentication)

- [ ] T012 [US1] Update `src/services/messaging/message-service.ts` - Remove auto-key-generation:
  - Remove lines 465-468 that call `initializeKeys()` when private key missing
  - Instead, throw `EncryptionError` with message: "Re-authentication required"

**Checkpoint**: User Story 1 core logic complete - password derives same keys on any device

---

## Phase 4: User Story 2 - Seamless Multi-Device Support (Priority: P1)

**Goal**: Both phone and laptop can send/receive encrypted messages simultaneously

**Independent Test**: Send from Device A, verify readable on Device B within seconds

**Note**: US2 is primarily satisfied by US1's password-derived keys. This phase adds auth integration.

### Implementation for User Story 2

- [ ] T013 [US2] Update `src/contexts/AuthContext.tsx` - Add encryption state:
  - Add `encryptionKeys` state (DerivedKeyPair | null)
  - Add `encryptionStatus` state ('ready' | 'needs_auth' | 'migrating')
  - Add `deriveEncryptionKeys(password)` method
  - Add `clearEncryptionKeys()` method for logout

- [ ] T014 [US2] Update `src/contexts/AuthContext.tsx` - Integrate key derivation with sign-in:
  - Modify `signIn()` to accept password parameter
  - After Supabase auth success, call `keyManagementService.deriveKeys(password)`
  - Store result in `encryptionKeys` state
  - Handle `needsMigration()` case (set status to 'migrating')

- [ ] T015 [US2] Update `src/app/(auth)/sign-in/page.tsx` - Pass password to context:
  - Capture password from form before submission
  - Pass to `signIn(email, password)` (password available for key derivation)
  - Do NOT store password after key derivation completes

- [ ] T016 [US2] Update `src/contexts/AuthContext.tsx` - Handle sign-out:
  - In `signOut()`, call `keyManagementService.clearKeys()`
  - Set `encryptionKeys` to null
  - Set `encryptionStatus` to 'needs_auth'

**Checkpoint**: Auth flow derives keys on sign-in, clears on sign-out

---

## Phase 5: User Story 3 - Key Persistence Across Sessions (Priority: P1)

**Goal**: Closing/reopening browser keeps messages readable (after re-authentication)

**Independent Test**: Close browser, reopen, enter password, verify messages readable

### Implementation for User Story 3

- [ ] T017 [US3] Create re-authentication modal component in `src/components/organisms/ReAuthModal/`:
  - Create with component generator: `docker compose exec scripthammer pnpm run generate:component ReAuthModal organisms`
  - Password input field
  - "Decrypt Messages" button
  - Error message display for wrong password
  - Loading state during key derivation

- [ ] T017a [P] [US3] Create accessibility tests for ReAuthModal in `src/components/organisms/ReAuthModal/ReAuthModal.accessibility.test.tsx`:
  - Test: Modal is keyboard navigable
  - Test: Focus trapped within modal when open
  - Test: Password field has proper label association
  - Test: Error messages announced to screen readers
  - Test: Loading state communicated via aria-busy

- [ ] T018 [US3] Update `src/contexts/AuthContext.tsx` - Handle page refresh:
  - In `useEffect` that checks session on mount
  - If session exists but `encryptionKeys` is null, set `encryptionStatus` to 'needs_auth'
  - Do NOT auto-derive keys (password not available)

- [ ] T019 [US3] Integrate ReAuthModal with messaging pages:
  - In `src/app/messages/page.tsx` (or conversation page)
  - Show ReAuthModal when `encryptionStatus === 'needs_auth'`
  - On successful re-auth, derive keys and set status to 'ready'
  - Then load and decrypt messages

- [ ] T020 [US3] Update message display for needs_auth state:
  - In message list component, show placeholder when keys not available
  - "Enter password to decrypt X messages" instead of "[Message could not be decrypted]"
  - Count of encrypted messages waiting

**Checkpoint**: Page refresh prompts for password, then messages decrypt

---

## Phase 6: Migration Flow (Legacy Users)

**Purpose**: Users with old random-generated keys must migrate to password-derived keys

- [ ] T021 [ALL] Create migration UI component in `src/components/organisms/EncryptionMigration/`:
  - Create with component generator: `docker compose exec scripthammer pnpm run generate:component EncryptionMigration organisms`
  - Blocking modal: "Securing your messages"
  - Progress indicator (current/total conversations)
  - Cannot dismiss until migration complete
  - Error state with retry button

- [ ] T021a [P] [ALL] Create accessibility tests for EncryptionMigration in `src/components/organisms/EncryptionMigration/EncryptionMigration.accessibility.test.tsx`:
  - Test: Modal is keyboard navigable
  - Test: Progress indicator has aria-valuenow/max
  - Test: Blocking behavior prevents background interaction
  - Test: Error state announced to screen readers
  - Test: Completion state announced

- [ ] T022 [ALL] Implement migration logic in `src/services/messaging/key-service.ts`:
  - Add `migrateKeys(password, onProgress)` method
  - Steps:
    1. Generate new salt
    2. Derive new key pair from password
    3. Get old private key from IndexedDB
    4. For each conversation: re-derive shared secret, update if needed
    5. Update user_encryption_keys with new public_key AND encryption_salt
    6. Delete old private key from IndexedDB
  - Use transaction for atomicity
  - Call onProgress callback for UI updates

- [ ] T023 [ALL] Integrate migration with sign-in flow:
  - In AuthContext after detecting `needsMigration() === true`
  - Set `encryptionStatus` to 'migrating'
  - Show EncryptionMigration component
  - Call `keyManagementService.migrateKeys(password, onProgress)`
  - On success, set status to 'ready'
  - On failure, show error and allow retry

**Checkpoint**: Legacy users are forced to migrate on next sign-in

---

## Phase 7: Password Change Handling

**Purpose**: Re-encrypt all messages when user changes password

- [ ] T024 [ALL] Add password change warning in password change UI:
  - Find existing password change page/component
  - Add warning text: "Changing your password will re-encrypt all messages. This may take a few moments."
  - Add confirmation checkbox before proceeding

- [ ] T025 [ALL] Implement password change key update in `src/services/messaging/key-service.ts`:
  - Add `handlePasswordChange(oldPassword, newPassword, onProgress)` method
  - Steps:
    1. Derive old key pair from old password + current salt
    2. Generate new salt
    3. Derive new key pair from new password + new salt
    4. For each conversation: decrypt with old key, re-encrypt with new key
    5. Update user_encryption_keys with new public_key AND new salt
  - Call onProgress for UI feedback

- [ ] T026 [ALL] Integrate password change with existing flow:
  - Hook into Supabase password change callback
  - Before password change completes in Supabase, re-encrypt messages
  - Update keys in database
  - Then allow Supabase password change to proceed

**Checkpoint**: Password change triggers message re-encryption

---

## Phase 8: E2E Tests

**Purpose**: Verify all user stories work end-to-end

- [ ] T027 [P] [US1] Create E2E test in `e2e/messaging/password-derived-keys.spec.ts`:
  - New user signs up, sends message
  - Verify public key and salt stored in database
  - Verify no private key in IndexedDB

- [ ] T028 [P] [US2] Create E2E test in `e2e/messaging/multi-device-encryption.spec.ts`:
  - User A sends message on browser context 1
  - Same user logs in on browser context 2 (simulates different device)
  - Verify message is readable on context 2 without "[Message could not be decrypted]"

- [ ] T029 [P] [US3] Create E2E test in `e2e/messaging/session-persistence.spec.ts`:
  - User logs in, sends message
  - Close browser context, create new one
  - Log in again with same password
  - Verify messages readable after re-authentication

- [ ] T030 [ALL] Create E2E test for migration in `e2e/messaging/legacy-migration.spec.ts`:
  - Setup: Create user with old-style keys (no salt, random key in IndexedDB)
  - User logs in
  - Verify migration modal appears
  - After migration, verify messages still readable
  - Verify salt now exists in database

**Checkpoint**: All E2E tests pass

---

## Phase 9: Polish & Cleanup

**Purpose**: Remove old code paths, improve UX

- [ ] T031 [P] [ALL] Remove IndexedDB private key storage:
  - In `src/lib/messaging/encryption.ts`:
    - Keep `storePrivateKey()` for migration source only
    - Add `deletePrivateKey()` method for post-migration cleanup
  - After migration rollout, these can be fully removed

- [ ] T032 [P] [ALL] Add decryption error improvements:
  - Change "[Message could not be decrypted]" to more helpful message
  - If `encryptionStatus === 'needs_auth'`: "Enter password to view message"
  - If key mismatch: "Message encrypted with different key"

- [ ] T033 [ALL] Update CLAUDE.md with encryption notes:
  - Document password-derived key system
  - Document re-authentication requirement
  - Document migration for legacy users

- [ ] T034 [ALL] Run full test suite and fix any regressions:
  - `docker compose exec scripthammer pnpm test`
  - `docker compose exec scripthammer pnpm run type-check`
  - `docker compose exec scripthammer pnpm exec playwright test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 (needs key service updates)
- **Phase 5 (US3)**: Depends on Phase 4 (needs auth integration)
- **Phase 6 (Migration)**: Depends on Phase 3 (needs key derivation)
- **Phase 7 (Password Change)**: Depends on Phase 6 (similar logic)
- **Phase 8 (E2E Tests)**: Depends on all implementation phases
- **Phase 9 (Polish)**: Depends on Phase 8

### Parallel Opportunities

```bash
# Phase 1: All setup tasks in sequence (dependency on install)
T001 → T002 → T003

# Phase 2: Sequential (each builds on previous)
T004 → T005 → T006

# Phase 3: T007 → T008 → T009 → T010 (key-service.ts)
#          T011 → T012 (message-service.ts can parallel after T010)

# Phase 8: All E2E tests in parallel
Task: T027 (password-derived-keys.spec.ts)
Task: T028 (multi-device-encryption.spec.ts)
Task: T029 (session-persistence.spec.ts)
Task: T030 (legacy-migration.spec.ts)

# Phase 9: Polish tasks in parallel
Task: T031 (encryption.ts cleanup)
Task: T032 (error messages)
Task: T033 (CLAUDE.md docs)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1-3
2. **STOP and VALIDATE**: New users can decrypt on any device
3. Skip migration initially (only affects existing users)

### Full Implementation

1. Phases 1-3: Core key derivation ✓
2. Phase 4: Auth integration ✓
3. Phase 5: Re-auth modal ✓
4. Phase 6: Migration flow ✓
5. Phase 7: Password change ✓
6. Phases 8-9: Testing and polish ✓

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All 3 user stories share P1 priority (fix is urgent)
- Password must be captured during sign-in before form clears
- Private keys NEVER persisted - re-derived every session
- Migration is blocking - user cannot access app until complete
