# Release Gate Checklist: Fix Encryption Key Management

**Purpose**: Comprehensive QA pre-release validation of requirements quality for encryption key management bugfix
**Created**: 2025-11-25
**Feature**: [spec.md](../spec.md)
**Depth**: Formal (Release Gate)
**Audience**: QA Pre-release Verification

## Requirement Completeness

- [ ] CHK001 - Are all code paths that create encryption keys documented in requirements? [Completeness, Spec §FR-001/002]
- [ ] CHK002 - Is the complete list of affected methods (rotateKeys, initializeKeys, deriveKeys) specified? [Completeness, Spec §Key Entities]
- [ ] CHK003 - Are requirements defined for ALL callers of rotateKeys() that need signature updates? [Gap]
- [ ] CHK004 - Is the migration path for existing users with NULL-salt keys fully documented? [Completeness, Spec §Edge Cases]
- [ ] CHK005 - Are requirements specified for what happens to old encrypted messages after key rotation? [Gap]
- [ ] CHK006 - Is the complete database schema for user_encryption_keys documented? [Completeness, data-model.md]

## Requirement Clarity

- [ ] CHK007 - Is "valid encryption key" precisely defined (non-NULL salt, non-revoked)? [Clarity, Spec §FR-003]
- [ ] CHK008 - Is the Argon2id parameter set (memory, iterations, parallelism) explicitly specified? [Clarity, Spec §FR-005]
- [ ] CHK009 - Are the conditions for "needs migration" clearly enumerated? [Clarity, Spec §FR-003]
- [ ] CHK010 - Is "password-derived keys" distinguished from "random keys" with clear definitions? [Clarity, Spec §FR-001]
- [ ] CHK011 - Is the Base64 encoding format for encryption_salt explicitly specified? [Clarity, data-model.md]
- [ ] CHK012 - Is "legacy key" vs "valid key" terminology consistent throughout requirements? [Clarity]

## Requirement Consistency

- [ ] CHK013 - Do rotateKeys() requirements align with initializeKeys() for salt generation? [Consistency, Spec §FR-001/002]
- [ ] CHK014 - Are error types (KeyDerivationError, AuthenticationError) consistent across all methods? [Consistency, contracts/key-service.ts]
- [ ] CHK015 - Do database constraints align with application-layer validation requirements? [Consistency, data-model.md vs Spec §FR-002]
- [ ] CHK016 - Is the "memory-only storage" constraint consistently applied to all derived key handling? [Consistency, Spec §FR-006]

## Security Requirements Quality

- [ ] CHK017 - Are zero-knowledge encryption requirements explicitly stated? [Security, Spec §Constraints]
- [ ] CHK018 - Is the salt length requirement specified (should be ≥16 bytes for Argon2id)? [Security, Gap]
- [ ] CHK019 - Are key revocation requirements clear (what triggers revocation, who can revoke)? [Security, Spec §Key Entities]
- [ ] CHK020 - Is the private key storage requirement (memory-only, never IndexedDB) unambiguous? [Security, Spec §FR-006]
- [ ] CHK021 - Are requirements defined for clearing keys from memory on logout? [Security, Gap]
- [ ] CHK022 - Is the ECDH P-256 curve requirement explicitly documented? [Security, plan.md Technical Context]
- [ ] CHK023 - Are password handling requirements specified (not logged, not stored)? [Security, Gap]
- [ ] CHK024 - Is the threat model for NULL-salt keys documented (why they're insecure)? [Security, Gap]

## API Contract Requirements

- [ ] CHK025 - Is the rotateKeys(password: string) signature change documented as breaking? [API, Spec §FR-001]
- [ ] CHK026 - Are all return types for KeyManagementService methods specified? [API, contracts/key-service.ts]
- [ ] CHK027 - Are error conditions and exception types documented for each method? [API, contracts/key-service.ts]
- [ ] CHK028 - Is the Promise<boolean> return type for rotateKeys() justified vs void? [API, Clarity]
- [ ] CHK029 - Are async/await requirements consistent across the service interface? [API, Consistency]

## Data Requirements Quality

- [ ] CHK030 - Is the user_encryption_keys table schema complete with all constraints? [Data, data-model.md]
- [ ] CHK031 - Are foreign key relationships (user_id → auth.users) documented? [Data, data-model.md]
- [ ] CHK032 - Is the UNIQUE constraint on (user_id, device_id) explicitly specified? [Data, data-model.md]
- [ ] CHK033 - Are index requirements documented for query performance? [Data, data-model.md]
- [ ] CHK034 - Is the JSON structure of public_key (JWK format) specified? [Data, data-model.md]
- [ ] CHK035 - Are ON DELETE CASCADE requirements documented? [Data, data-model.md]

## Edge Case Coverage

- [ ] CHK036 - Is behavior defined when user has ONLY NULL-salt keys? [Edge Case, Spec §Edge Cases]
- [ ] CHK037 - Is behavior defined when needsMigration() encounters database errors? [Edge Case, Spec §Edge Cases]
- [ ] CHK038 - Is behavior defined when rotateKeys() is called with empty password? [Edge Case, Spec §Edge Cases]
- [ ] CHK039 - Is behavior defined when user has no keys at all (new user)? [Edge Case, Gap]
- [ ] CHK040 - Is behavior defined when multiple concurrent rotateKeys() calls occur? [Edge Case, Gap]
- [ ] CHK041 - Is behavior defined when Supabase connection fails mid-rotation? [Edge Case, Gap]
- [ ] CHK042 - Is behavior defined for partial key insertion failures? [Edge Case, Gap]

## Exception Flow Requirements

- [ ] CHK043 - Are all error types (AuthenticationError, KeyDerivationError, ConnectionError, KeyMismatchError) defined? [Exception, contracts/key-service.ts]
- [ ] CHK044 - Is error message content specified for user-facing vs logged errors? [Exception, Gap]
- [ ] CHK045 - Are retry requirements defined for transient failures? [Exception, Gap]
- [ ] CHK046 - Is rollback behavior specified when key rotation fails after revoking old keys? [Exception, Gap]

## Recovery Flow Requirements

- [ ] CHK047 - Are requirements defined for recovering from stuck "needs migration" state? [Recovery, Gap]
- [ ] CHK048 - Is manual intervention process documented for corrupted key states? [Recovery, Gap]
- [ ] CHK049 - Are database cleanup requirements specified for orphaned keys? [Recovery, Gap]

## Acceptance Criteria Quality

- [ ] CHK050 - Is SC-001 (test@example.com unlock) objectively measurable? [Acceptance, Spec §SC-001]
- [ ] CHK051 - Is SC-002 (non-NULL salt) verifiable via database query? [Acceptance, Spec §SC-002]
- [ ] CHK052 - Is SC-003 (needsMigration returns false) testable with specific input data? [Acceptance, Spec §SC-003]
- [ ] CHK053 - Is SC-004 (TypeScript compilation) a binary pass/fail criterion? [Acceptance, Spec §SC-004]
- [ ] CHK054 - Is SC-005 (script deleted) verifiable via file system check? [Acceptance, Spec §SC-005]

## Test Requirements Coverage

- [ ] CHK055 - Are unit test requirements specified for needsMigration() logic changes? [Test, plan.md Constitution Check]
- [ ] CHK056 - Are unit test requirements specified for rotateKeys(password) signature? [Test, plan.md]
- [ ] CHK057 - Are E2E test requirements specified for the unlock flow? [Test, Gap]
- [ ] CHK058 - Are test data requirements specified (test users, key states)? [Test, Spec §Independent Test]

## Dependencies & Assumptions

- [ ] CHK059 - Is the Supabase availability assumption documented? [Assumption]
- [ ] CHK060 - Is the browser SubtleCrypto support requirement documented? [Dependency, plan.md]
- [ ] CHK061 - Is the hash-wasm library version requirement specified? [Dependency, plan.md]
- [ ] CHK062 - Is the assumption that users have valid passwords validated? [Assumption]

## Traceability

- [ ] CHK063 - Do all functional requirements (FR-001 to FR-006) have corresponding acceptance criteria? [Traceability]
- [ ] CHK064 - Do all success criteria (SC-001 to SC-005) trace back to functional requirements? [Traceability]
- [ ] CHK065 - Are all user stories linked to specific functional requirements? [Traceability]

## Notes

- Check items off as completed: `[x]`
- Add findings inline with `FINDING:` prefix
- Mark blockers with `BLOCKER:` prefix
- This is a formal release gate checklist - all items should be reviewed before release
