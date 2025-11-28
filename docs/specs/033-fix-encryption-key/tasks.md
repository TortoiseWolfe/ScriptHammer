# Tasks: Fix Encryption Key Management

**Input**: Design documents from `/specs/033-fix-encryption-key/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/key-service.ts, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for changes

- [x] T001 Verify branch `033-fix-encryption-key` exists and is checked out
- [x] T002 [P] Verify TypeScript compilation passes before changes: `docker compose exec scripthammer pnpm run type-check`
- [x] T003 [P] Review current key-service.ts implementation at `src/services/messaging/key-service.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database cleanup that MUST be complete before code changes

**CRITICAL**: No user story work can begin until database state is clean

- [x] T004 Revoke all NULL-salt keys for affected users via Supabase API
  - Target: `user_encryption_keys` where `encryption_salt IS NULL AND revoked = false`
  - Set `revoked = true` for these records
- [x] T005 Verify only valid-salt keys remain active in database
  - Query: `SELECT * FROM user_encryption_keys WHERE revoked = false`
  - All results must have non-NULL `encryption_salt`

**Checkpoint**: Database state clean - code changes can now proceed

---

## Phase 3: User Story 1 - Unlock Encrypted Messages (Priority: P1)

**Goal**: Users with valid encryption keys can unlock messages without "Your account needs to be updated" error

**Independent Test**: Sign in as test@example.com / TestPassword123! and verify encryption unlock works

### Tests for User Story 1

- [ ] T006 [P] [US1] Unit test for needsMigration() logic in `src/services/messaging/__tests__/key-service.test.ts`
  - Test: returns false when ANY non-revoked key has valid salt
  - Test: returns true only when ALL non-revoked keys have NULL salt
  - Test: returns false when user has no keys (new user)
  - Test: returns false on database error (safe default)

### Implementation for User Story 1

- [x] T007 [US1] Fix `needsMigration()` in `src/services/messaging/key-service.ts:222-257`
  - Change from checking only most recent key to checking ANY valid key
  - Use `.not('encryption_salt', 'is', null)` query pattern
  - Add error logging for debugging
  - Reference: `specs/033-fix-encryption-key/quickstart.md` lines 37-70

- [ ] T008 [US1] Verify fix with manual test
  - Sign in as test@example.com / TestPassword123!
  - Confirm no "Your account needs to be updated" error appears
  - Confirm encryption unlock modal accepts password

**Checkpoint**: User Story 1 complete - users with valid keys can unlock messages

---

## Phase 4: User Story 2 - Prevent Future NULL-Salt Keys (Priority: P2)

**Goal**: rotateKeys() method uses password-derived keys with proper salt

**Independent Test**: Call rotateKeys(password) and verify new key has non-NULL encryption_salt

### Tests for User Story 2

- [ ] T009 [P] [US2] Unit test for rotateKeys(password) in `src/services/messaging/__tests__/key-service.test.ts`
  - Test: new signature requires password parameter
  - Test: creates key with non-NULL encryption_salt
  - Test: throws KeyDerivationError for empty password
  - Test: revokes old keys before creating new one

### Implementation for User Story 2

- [x] T010 [US2] Update `rotateKeys()` signature in `src/services/messaging/key-service.ts:344-413`
  - Change from `rotateKeys()` to `rotateKeys(password: string)`
  - Use `KeyDerivationService.deriveKeyPair()` instead of `encryptionService.generateKeyPair()`
  - Include `encryption_salt: keyPair.salt` in database insert
  - Reference: `specs/033-fix-encryption-key/quickstart.md` lines 5-35

- [x] T011 [US2] Update contract documentation in `specs/033-fix-encryption-key/contracts/key-service.ts`
  - Document breaking signature change
  - Update JSDoc comments

- [x] T012 [US2] Verify TypeScript compilation with new signature
  - Run: `docker compose exec scripthammer pnpm run type-check`
  - Any callers of old signature will fail compilation (intentional)

**Checkpoint**: User Story 2 complete - rotateKeys() cannot create NULL-salt keys

---

## Phase 5: User Story 3 - Clean Up Legacy Code (Priority: P3)

**Goal**: Remove all code paths that can create NULL-salt keys

**Independent Test**: Verify generate-keys-for-user.ts no longer exists

### Implementation for User Story 3

- [x] T013 [US3] Delete legacy script `scripts/generate-keys-for-user.ts`
  - Command: `rm scripts/generate-keys-for-user.ts`

- [x] T014 [P] [US3] Grep for any remaining references to deleted script
  - Command: `grep -r "generate-keys-for-user" --include="*.ts" --include="*.md"`
  - Remove any found references

- [x] T015 [US3] Verify no other code paths create NULL-salt keys
  - Search: `grep -r "generateKeyPair" src/`
  - Audit each usage to ensure salt is included

- [x] T015a [US1] Handle users with ONLY NULL-salt keys in SignInForm
  - File: `src/components/auth/SignInForm/SignInForm.tsx`
  - When needsMigration() returns true AND hasKeys() returns true but no valid keys exist
  - Auto-call initializeKeys(password) with the password user just entered
  - Reference: spec.md Edge Cases line 62

**Checkpoint**: User Story 3 complete - no legacy code paths remain

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and documentation

- [x] T016 [P] Run full type-check: `docker compose exec scripthammer pnpm run type-check`
- [ ] T017 [P] Run unit tests: `docker compose exec scripthammer pnpm test`
- [x] T018 [P] Update plan.md progress tracking to mark all phases complete
- [ ] T019 Manual E2E verification per quickstart.md test scenarios:
  1. Sign in as test@example.com / TestPassword123!
  2. Verify no "Your account needs to be updated" error
  3. Check database: only valid-salt keys should be non-revoked
  4. Verify TypeScript compilation succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P2) → US3 (P3) in priority order
  - OR can run in parallel since they modify different methods
- **Polish (Phase 6)**: Depends on all user stories complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Implementation changes one method at a time
- Verify after each story before proceeding

### Parallel Opportunities

```bash
# Phase 1 - All setup tasks in parallel:
Task: "Verify TypeScript compilation"
Task: "Review current key-service.ts"

# Phase 3-5 - User stories can run in parallel (different methods):
Task: "Fix needsMigration() [US1]"
Task: "Update rotateKeys() [US2]"
Task: "Delete legacy script [US3]"

# Phase 6 - Polish tasks in parallel:
Task: "Run type-check"
Task: "Run unit tests"
Task: "Update plan.md"
```

---

## Success Criteria Mapping

| Success Criteria                                      | Task(s)          | User Story |
| ----------------------------------------------------- | ---------------- | ---------- |
| SC-001: test@example.com unlock works                 | T007, T008, T019 | US1        |
| SC-002: rotateKeys() creates valid-salt keys          | T010, T012       | US2        |
| SC-003: needsMigration() returns false for valid keys | T007             | US1        |
| SC-004: TypeScript compilation succeeds               | T012, T016       | US2        |
| SC-005: Legacy script removed                         | T013, T014       | US3        |
| Edge Case: NULL-salt only users                       | T015a            | US1        |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This is a bugfix feature - minimal new code, mostly modifications
- TDD approach: write failing tests first, then implement
- Commit after each completed user story
