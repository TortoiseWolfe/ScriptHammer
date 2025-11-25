# Requirements Quality Checklist: E2E Encryption Key Management

**Feature**: 032-fix-e2e-encryption
**Purpose**: Formal pre-release validation for QA/Security
**Created**: 2025-11-25
**Focus Areas**: Security, Migration, UX/Error Handling
**Depth**: Formal release gate (~45 items)

---

## Security Requirements Quality

### Cryptographic Algorithm Requirements

- [ ] CHK001 - Are Argon2 parameters (memory cost, time cost, parallelism) explicitly specified with values? [Clarity, Gap - only "Argon2" mentioned in Spec §FR-001]
- [ ] CHK002 - Is the Argon2 variant (argon2i, argon2d, argon2id) specified in requirements? [Completeness, Gap]
- [ ] CHK003 - Are hash length requirements for key derivation output documented (32 bytes for P-256)? [Completeness, Gap]
- [ ] CHK004 - Is the salt length requirement (16 bytes) explicitly specified in spec? [Clarity, Spec §FR-008 lacks specifics]
- [ ] CHK005 - Are requirements for salt generation method (CSPRNG) documented? [Completeness, Gap]
- [ ] CHK006 - Is the P-256 curve explicitly required, or is "ECDH" left ambiguous? [Clarity, Spec §Key Entities]

### Key Storage & Handling Requirements

- [ ] CHK007 - Are requirements clear that private keys must NEVER be transmitted to server? [Completeness, Spec §FR-002]
- [ ] CHK008 - Is the requirement to NOT persist private keys in IndexedDB explicitly stated? [Clarity, Spec §FR-007 implies but doesn't prohibit]
- [ ] CHK009 - Are requirements for clearing derived keys from memory on logout specified? [Gap, Plan mentions but spec doesn't require]
- [ ] CHK010 - Is the memory lifetime of derived keys defined (session only)? [Completeness, Gap]
- [ ] CHK011 - Are requirements for key zeroization after use specified? [Gap - security best practice]
- [ ] CHK012 - Is the requirement for atomic salt + public key updates documented? [Completeness, Gap]

### Authentication & Verification Requirements

- [ ] CHK013 - Are requirements for password verification via public key comparison defined? [Completeness, Spec §FR-004 mentions but lacks detail]
- [ ] CHK014 - Is the maximum number of password retry attempts specified? [Gap - brute force protection]
- [ ] CHK015 - Are requirements for rate limiting key derivation attempts documented? [Gap - timing attack protection]
- [ ] CHK016 - Is the public key mismatch error handling requirement specific enough? [Clarity, Spec §Edge Cases]

### Threat Model Requirements

- [ ] CHK017 - Are requirements addressing compromised IndexedDB (XSS) documented? [Gap - threat model]
- [ ] CHK018 - Are requirements for WASM integrity verification documented? [Gap - supply chain]
- [ ] CHK019 - Is the assumption "password strength is user's responsibility" documented? [Assumption, Gap]
- [ ] CHK020 - Are requirements for detecting key tampering on server specified? [Gap]

---

## Migration Requirements Quality

### Migration Detection Requirements

- [ ] CHK021 - Is the migration trigger condition precisely defined (salt = NULL)? [Clarity, Spec §Migration implies but Plan specifies]
- [ ] CHK022 - Are requirements for handling users with NO keys (new users) distinct from migration? [Consistency, Gap]
- [ ] CHK023 - Is the requirement for forced/blocking migration explicitly stated? [Completeness, Spec §Edge Cases]

### Migration Flow Requirements

- [ ] CHK024 - Are atomic transaction requirements for migration specified? [Completeness, Plan mentions but Spec doesn't require]
- [ ] CHK025 - Is the rollback behavior on migration failure defined? [Coverage, Gap]
- [ ] CHK026 - Are requirements for migration progress tracking specified? [Completeness, Spec §Edge Cases mentions indicator]
- [ ] CHK027 - Is the migration completion criteria precisely defined? [Measurability, Gap]
- [ ] CHK028 - Are requirements for partial migration recovery documented? [Edge Case, Gap]

### Data Integrity Requirements

- [ ] CHK029 - Are requirements for verifying messages are still readable post-migration specified? [Coverage, Gap]
- [ ] CHK030 - Is the requirement to delete old IndexedDB keys post-migration documented? [Completeness, Spec §Migration step 6]
- [ ] CHK031 - Are requirements for migration idempotency specified? [Gap - retry safety]
- [ ] CHK032 - Is data backup/recovery before migration addressed in requirements? [Gap - disaster recovery]

---

## UX & Error Handling Requirements Quality

### Re-Authentication UX Requirements

- [ ] CHK033 - Are requirements for the re-authentication modal content specified? [Completeness, Gap - Plan mentions, Spec doesn't]
- [ ] CHK034 - Is the trigger condition for showing re-auth prompt precisely defined? [Clarity, Gap]
- [ ] CHK035 - Are requirements for re-auth modal dismissibility documented? [Gap]
- [ ] CHK036 - Is the loading state during key derivation (<500ms) requirement in spec? [Clarity, Plan has goal, Spec lacks NFR]

### Error Message Requirements

- [ ] CHK037 - Are error messages for "wrong password" precisely specified? [Completeness, Gap]
- [ ] CHK038 - Are error messages for "Argon2 WASM failed to load" specified? [Coverage, Gap]
- [ ] CHK039 - Are error messages for "network failure during salt fetch" specified? [Coverage, Gap]
- [ ] CHK040 - Is the "Re-authentication required" error message content defined? [Clarity, Gap]
- [ ] CHK041 - Are requirements for distinguishing "wrong password" vs "corrupted data" defined? [Clarity, Gap]

### Password Change UX Requirements

- [ ] CHK042 - Is the warning text for password change precisely specified? [Completeness, Spec §US1-AC3 mentions warning, not content]
- [ ] CHK043 - Are requirements for user confirmation before password change re-encryption defined? [Gap]
- [ ] CHK044 - Is the progress indicator requirement for re-encryption specified? [Completeness, Spec §Edge Cases]
- [ ] CHK045 - Are requirements for cancellation during password change defined? [Edge Case, Gap]

### Edge Case UX Requirements

- [ ] CHK046 - Are requirements for handling zero messages (no re-encryption needed) specified? [Coverage, Gap]
- [ ] CHK047 - Are requirements for handling concurrent logins during migration defined? [Edge Case, Gap]
- [ ] CHK048 - Is the offline behavior during key derivation specified? [Coverage, Gap]
- [ ] CHK049 - Are requirements for expired session during migration defined? [Edge Case, Gap]

---

## Cross-Cutting Requirements Quality

### Success Criteria Measurability

- [ ] CHK050 - Can SC-001 "decrypt on any device" be objectively tested? [Measurability, Spec §SC-001]
- [ ] CHK051 - Can SC-003 "zero decryption errors" be measured in production? [Measurability, Spec §SC-003]
- [ ] CHK052 - Is the definition of "correct password" for success criteria clear? [Clarity, Spec §SC-003]

### Requirement Consistency

- [ ] CHK053 - Do Spec §FR-007 (re-derive on login) and Plan (session caching) align? [Consistency]
- [ ] CHK054 - Do Spec §FR-005 (no silent regen) and Tasks T012 (throw error) align? [Consistency]
- [ ] CHK055 - Are user story acceptance criteria consistent with functional requirements? [Consistency]

### Requirement Completeness

- [ ] CHK056 - Are non-functional requirements (performance, memory) in spec or only plan? [Completeness, Gap in Spec]
- [ ] CHK057 - Are accessibility requirements for modals (ReAuthModal, Migration) specified? [Gap]
- [ ] CHK058 - Are internationalization requirements for error messages specified? [Gap]
- [ ] CHK059 - Are logging/audit requirements for key operations specified? [Gap - compliance]

### Dependencies & Assumptions

- [ ] CHK060 - Is the assumption "argon2-wasm-esm works in all target browsers" validated? [Assumption]
- [ ] CHK061 - Is the assumption "Web Crypto API available" documented with fallback? [Assumption, Plan mentions fallback]
- [ ] CHK062 - Are Supabase RLS policy requirements for salt column documented? [Dependency, Gap]

---

## Summary

| Category               | Items  | Issues Found        |
| ---------------------- | ------ | ------------------- |
| Security Requirements  | 20     | _Fill after review_ |
| Migration Requirements | 12     | _Fill after review_ |
| UX/Error Handling      | 17     | _Fill after review_ |
| Cross-Cutting          | 13     | _Fill after review_ |
| **Total**              | **62** |                     |

---

## Identified Gaps Summary

**Critical Gaps** (blocking release):

- [ ] Argon2 parameters not specified in spec (CHK001-003)
- [ ] Key zeroization requirements missing (CHK011)
- [ ] Migration rollback requirements missing (CHK025)
- [ ] Rate limiting requirements missing (CHK015)

**Important Gaps** (should address):

- [ ] Re-authentication modal requirements sparse (CHK033-036)
- [ ] Error message content not specified (CHK037-041)
- [ ] NFR requirements only in plan, not spec (CHK056)

**Nice-to-Have Gaps** (can defer):

- [ ] I18n for error messages (CHK058)
- [ ] Audit logging (CHK059)

---

_Checklist generated by /speckit.checklist - Tests requirements quality, not implementation_
