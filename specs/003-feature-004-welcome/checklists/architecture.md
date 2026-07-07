# Architecture Requirements Quality Checklist

**Feature**: 003-feature-004-welcome (Welcome Message Redesign)
**Purpose**: Validate completeness, clarity, and consistency of architecture-fix requirements
**Created**: 2025-11-28
**Focus**: Cryptographic approach, static hosting constraints, data integrity

---

## Requirement Completeness

- [x] CHK001 - Are requirements for admin public key format (JWK structure) explicitly specified? [Completeness, Gap] ✅ FIXED: Added JWK format to Key Entities: `{ kty: "EC", crv: "P-256", x, y }`
- [x] CHK002 - Is the ECDH curve (P-256) requirement documented for both admin and user keys? [Completeness, Spec §FR-003] ✅ FIXED: Added FR-011 for ECDH P-256 requirement
- [x] CHK003 - Are requirements for the WELCOME_MESSAGE_CONTENT constant location documented? [Completeness, Gap] ✅ FIXED: Added location in Key Entities (contracts/welcome-service.ts → src/services/messaging/welcome-service.ts)
- [x] CHK004 - Is the admin user UUID (`00000000-...0001`) requirement traceable across all relevant sections? [Completeness, Spec §Key Entities] ✅ VERIFIED: Referenced in Key Entities, One-Time Setup, and contracts/welcome-service.ts
- [x] CHK005 - Are requirements for SignInForm integration changes fully specified given "NO CHANGE" status? [Completeness, Spec §Files NOT Changed] ✅ FIXED: Changed to "Files Changed (Minimal Modifications)" with specific change documented

---

## Requirement Clarity

- [x] CHK006 - Is "within 5 seconds of key initialization" measurable from a specific start point? [Clarity, Spec §SC-001] ✅ FIXED: Added "(timer starts after `generateKeyPair()` completes in SignInForm)"
- [x] CHK007 - Is "canonical conversation ordering" clearly defined with comparison algorithm? [Clarity, Spec §FR-006] ✅ FIXED: Added "(participant_1 = min(userId, adminId), participant_2 = max(userId, adminId) using string comparison)"
- [x] CHK008 - Is "pre-stored public key" location (table vs constant) unambiguously specified? [Ambiguity, Spec §FR-001 vs §Technical Approach] ✅ FIXED: Clarified "stored in `user_encryption_keys` table (NOT as a constant - must be fetched from database)"
- [x] CHK009 - Are "errors without blocking" criteria quantified (timeout, retry limits)? [Clarity, Spec §FR-008] ✅ FIXED: Added "(no retries, fail immediately with graceful degradation, 10 second timeout max)"
- [x] CHK010 - Is "simplified internally" for welcome-service.ts change scope clearly bounded? [Clarity, Spec §Files to Modify] ✅ FIXED: Added explicit list of removals (ADMIN_CONFIG.password, initializeAdminKeys, ensureAdminKeys, adminKeys) and additions (getAdminPublicKey, sendWelcomeMessage signature change)

---

## Requirement Consistency

- [x] CHK011 - Do acceptance scenarios in User Story 1 align with new client-side approach (references to "trigger fires" appear outdated)? [Conflict, Spec §User Story 1] ✅ FIXED: Updated to "welcome service is called client-side"
- [x] CHK012 - Does User Story 3 (Admin Key Self-Healing via Vault secret) align with clarification that no Vault is used? [Conflict, Spec §User Story 3 vs §Clarifications] ✅ FIXED: Rewrote as "Graceful Admin Key Missing Handling"
- [x] CHK013 - Are Edge Cases section references to "Vault secret not configured" consistent with new approach? [Conflict, Spec §Edge Cases] ✅ FIXED: Removed all Vault references
- [x] CHK014 - Is terminology consistent between "trigger fires" in acceptance scenarios and actual client-side flow? [Consistency] ✅ FIXED: All scenarios use client-side terminology
- [x] CHK015 - Do all FR references to idempotency align with single mechanism (welcome_message_sent flag)? [Consistency, Spec §FR-005, §FR-007] ✅ VERIFIED: FR-005 checks flag, FR-007 updates flag, US2 documents upsert pattern, Data Integrity section explains race condition handling

---

## Acceptance Criteria Quality

- [x] CHK016 - Can SC-001 (5 seconds) be objectively measured with current instrumentation? [Measurability, Spec §SC-001] ✅ FIXED: Added specific start point "(timer starts after `generateKeyPair()` completes in SignInForm)"
- [x] CHK017 - Is SC-002 (zero client-side errors) testable with specific error class definitions? [Measurability, Spec §SC-002] ✅ VERIFIED: Testable by searching for "TEST_USER_ADMIN_PASSWORD" references in console errors
- [x] CHK018 - Can SC-003 (works on GitHub Pages) be verified without production deployment? [Measurability, Spec §SC-003] ✅ VERIFIED: Static export (`next build && next export`) can be tested locally with `serve out/`
- [x] CHK019 - Is SC-004 (no admin password required) verifiable through code inspection criteria? [Measurability, Spec §SC-004] ✅ VERIFIED: Code inspection - grep for `TEST_USER_ADMIN_PASSWORD` should return 0 references in welcome-service.ts

---

## Scenario Coverage

- [x] CHK020 - Are requirements defined for admin public key not found in database? [Coverage, Exception Flow, Gap] ✅ VERIFIED: Covered by US3 acceptance scenarios and Edge Cases section
- [x] CHK021 - Are requirements specified for Web Crypto API unavailability (older browsers)? [Coverage, Edge Case, Gap] ✅ FIXED: Added browser targets (Chrome 60+, Firefox 57+, Safari 11+, Edge 79+) with graceful degradation
- [x] CHK022 - Are requirements documented for concurrent sign-ups attempting welcome message simultaneously? [Coverage, Spec §User Story 2] ✅ VERIFIED: US2 acceptance scenario 2 documents upsert pattern, Data Integrity section explains race condition handling
- [x] CHK023 - Are requirements specified for partial failure (conversation created, message insert fails)? [Coverage, Recovery Flow, Gap] ✅ FIXED: Added to Edge Cases "Orphan conversation is harmless - next attempt will use existing conversation via upsert"
- [x] CHK024 - Are requirements defined for user signing in on multiple devices during key initialization? [Coverage, Edge Case, Gap] ✅ FIXED: Added to Edge Cases "Each device has same derived keys (password-based), so welcome message will succeed on one and skip on others"

---

## Security Requirements

- [x] CHK025 - Are RLS policy requirements for admin-created conversations explicitly specified? [Security, Spec §Security Considerations] ✅ FIXED: Added detailed RLS explanation for welcome message special case
- [x] CHK026 - Is the security rationale for discarding admin private key documented? [Security, Spec §One-Time Setup] ✅ FIXED: Added "(a) welcome messages are encrypted by the user, not admin, (b) ECDH symmetry"
- [x] CHK027 - Are requirements for preventing impersonation (user creating fake "from admin" messages) addressed? [Security, Gap] ✅ FIXED: Added Impersonation prevention section in Security Considerations
- [x] CHK028 - Is the threat model for exposed admin public key documented? [Security, Spec §Security Considerations] ✅ FIXED: Added "Threat model: An attacker with the public key cannot derive the shared secret without the user's private key"

---

## Data Integrity Requirements

- [x] CHK029 - Are atomicity requirements specified for the multi-step welcome flow (check → create → insert → update)? [Data Integrity, Gap] ✅ FIXED: Added Data Integrity section explaining non-atomic but idempotent design
- [x] CHK030 - Is the idempotency mechanism (welcome_message_sent flag) race-condition safe? [Data Integrity, Spec §FR-005] ✅ FIXED: Added "Concurrent calls handled by database upsert pattern and idempotency flag check at start"
- [x] CHK031 - Are requirements for welcome_message_sent flag initial state documented? [Data Integrity, Gap] ✅ FIXED: Added to Edge Cases and Data Integrity section "defaults to `false` in user_profiles table"

---

## Dependencies & Assumptions

- [x] CHK032 - Is the assumption that user's private key is available during welcome send validated? [Assumption, Spec §Flow] ✅ FIXED: Added Dependencies section "keyPair.privateKey is available in SignInForm after generateKeyPair() completes"
- [x] CHK033 - Is the dependency on existing encryptionService.deriveSharedSecret documented? [Dependency, Gap] ✅ FIXED: Added Dependencies section "Uses existing encryptionService.deriveSharedSecret() from src/lib/messaging/encryption.ts"
- [x] CHK034 - Are seed script execution requirements (when, by whom, idempotency) specified? [Dependency, Spec §One-Time Setup] ✅ FIXED: Added Dependencies section "Must run once per environment BEFORE any user signs up. Seed script is idempotent"
- [x] CHK035 - Is the assumption that admin profile always exists after seed run validated? [Assumption] ✅ FIXED: Added Dependencies section "Seed script creates auth user, profile, AND encryption keys atomically"

---

## Documentation Requirements

- [x] CHK036 - Are CLAUDE.md update requirements specific about content to add? [Completeness, Spec §FR-009] ✅ FIXED: Added Documentation Updates section with exact markdown content
- [x] CHK037 - Is the static hosting constraint wording explicitly provided? [Clarity, Spec §FR-009, §SC-006] ✅ FIXED: Added full section content in Documentation Updates section

---

## Summary

| Category            | Items | Fixed | Remaining Gaps |
| ------------------- | ----- | ----- | -------------- |
| Completeness        | 5     | 5     | None           |
| Clarity             | 5     | 5     | None           |
| Consistency         | 5     | 5     | None           |
| Acceptance Criteria | 4     | 4     | None           |
| Scenario Coverage   | 5     | 5     | None           |
| Security            | 4     | 4     | None           |
| Data Integrity      | 3     | 3     | None           |
| Dependencies        | 4     | 4     | None           |
| Documentation       | 2     | 2     | None           |

**Total: 37/37 checklist items resolved**

**Remediation Complete (2025-11-28)**:

_Phase 1 - Initial Analysis Fixes:_

- ✅ CHK001: Added JWK format specification to Key Entities
- ✅ CHK002: Added FR-011 for ECDH P-256 curve requirement
- ✅ CHK005: Changed "Files NOT Changed" to "Files Changed (Minimal Modifications)"
- ✅ CHK006: Added timing start point to SC-001
- ✅ CHK009: Added retry/timeout limits to FR-008
- ✅ CHK011-CHK014: Fixed all trigger/Vault terminology inconsistencies
- ✅ CHK021: Added browser compatibility targets with graceful degradation

_Phase 2 - Comprehensive Remediation:_

- ✅ CHK003: Added WELCOME_MESSAGE_CONTENT location (contracts → service)
- ✅ CHK004: Verified admin UUID traceability across sections
- ✅ CHK007: Added canonical ordering algorithm (min/max string comparison)
- ✅ CHK008: Clarified public key is in table, not constant
- ✅ CHK010: Added explicit removal/addition list for welcome-service.ts changes
- ✅ CHK015: Verified idempotency mechanism alignment
- ✅ CHK016-CHK019: Verified acceptance criteria measurability
- ✅ CHK020: Verified US3 covers missing admin key
- ✅ CHK022: Verified US2 covers concurrent sign-ups
- ✅ CHK023-CHK024: Added partial failure and multi-device edge cases
- ✅ CHK025-CHK028: Added RLS, private key rationale, impersonation prevention, threat model
- ✅ CHK029-CHK031: Added Data Integrity section (atomicity, race conditions, initial state)
- ✅ CHK032-CHK035: Added Dependencies section (key availability, encryption service, seed script, admin guarantee)
- ✅ CHK036-CHK037: Added Documentation Updates section with exact CLAUDE.md content

**Status**: ✅ ALL CHECKLIST ITEMS RESOLVED - Ready for implementation
