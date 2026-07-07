# Requirements Quality Checklist: Critical Messaging UX Fixes

**Purpose**: Release readiness gate - validate requirements quality before merge to main
**Created**: 2025-11-29
**Feature**: 006-feature-006-critical
**Depth**: Comprehensive (all dimensions)

---

## Requirement Completeness

- [ ] CHK001 - Are viewport breakpoints exhaustively defined (320px, 375px, 667px landscape, 768px, 1024px landscape, 1280px, 1920px)? [Completeness, Spec §FR-001]
- [ ] CHK002 - Are all CSS properties that affect scroll behavior specified (grid-rows, min-h-0, overflow, safe-area)? [Completeness, Plan §US1]
- [ ] CHK003 - Are password setup vs unlock mode criteria explicitly defined? [Completeness, Spec §FR-006]
- [ ] CHK004 - Are all three "Save this password" warning locations specified (above field, below confirm, toast)? [Completeness, Spec §FR-009]
- [ ] CHK005 - Are decryption error display requirements defined for both single and multiple failed messages? [Completeness, Spec §US4]
- [ ] CHK006 - Are participant name fallback values specified for all scenarios (missing profile, deleted user)? [Completeness, Spec §US5]
- [ ] CHK007 - Are keyboard safe-area requirements documented for mobile viewports? [Gap, Plan §US1]

## Requirement Clarity

- [ ] CHK008 - Is "message input fully visible" quantified with specific CSS constraints? [Clarity, Spec §FR-001]
- [ ] CHK009 - Is the distinction between "no keys" vs "keys not in memory" unambiguous? [Clarity, Spec §FR-006]
- [ ] CHK010 - Are `autocomplete` attribute values explicitly specified ("username", "new-password", "current-password")? [Clarity, Spec §FR-003]
- [ ] CHK011 - Is the lock icon + text format for decryption errors precisely defined? [Clarity, Spec §US4 AC1]
- [ ] CHK012 - Is "Encrypted with previous keys" the exact text or a paraphrase? [Clarity, Spec §US4]
- [ ] CHK013 - Are tooltip contents for decryption errors word-for-word specified? [Clarity, Spec §US4 AC3]
- [ ] CHK014 - Is the hasKeys() fix (.single() → .maybeSingle()) explicitly documented? [Clarity, Plan §US2]

## Requirement Consistency

- [ ] CHK015 - Are password form requirements consistent between /messages/setup page and ReAuthModal? [Consistency, Spec §FR-008]
- [ ] CHK016 - Are viewport requirements consistent across US1 acceptance scenarios and FR-001? [Consistency]
- [ ] CHK017 - Are "setup mode" criteria consistent between key-service.ts and ReAuthModal logic? [Consistency, Plan §US2]
- [ ] CHK018 - Is error text handling consistent between message-service.ts and gdpr-service.ts? [Consistency, Plan §US4]
- [ ] CHK019 - Are participant name fallbacks consistent between loadConversationInfo() and message senderName? [Consistency, Plan §US5]

## Acceptance Criteria Quality

- [ ] CHK020 - Can US1 acceptance criteria be verified via automated Playwright tests? [Measurability, Spec §US1]
- [ ] CHK021 - Can US2 "setup mode" vs "unlock mode" be objectively distinguished in tests? [Measurability, Spec §US2]
- [ ] CHK022 - Can password manager detection be reliably tested across Chrome/Firefox? [Measurability, Spec §SC-003]
- [ ] CHK023 - Are success criteria SC-001 through SC-005 all objectively measurable? [Measurability, Spec §SC]
- [ ] CHK024 - Is "100% of viewport sizes" testable without infinite viewports? [Measurability, Spec §SC-001]

## Scenario Coverage

- [ ] CHK025 - Are requirements defined for portrait AND landscape orientations? [Coverage, Clarifications Q4]
- [ ] CHK026 - Are requirements defined for OAuth users with REVOKED keys (edge case)? [Coverage, Spec §Edge Cases]
- [ ] CHK027 - Are requirements defined when user closes setup modal without completing? [Coverage, Spec §Edge Cases]
- [ ] CHK028 - Are requirements defined for ALL messages undecryptable in conversation? [Coverage, Spec §Edge Cases]
- [ ] CHK029 - Are requirements defined for orphaned conversations (deleted participant)? [Coverage, Spec §Edge Cases]
- [ ] CHK030 - Are requirements defined for concurrent key check race conditions? [Gap, Exception Flow]

## Edge Case Coverage

- [ ] CHK031 - Is behavior defined for 320px minimum viewport (edge case)? [Edge Case, Clarifications Q4]
- [ ] CHK032 - Is behavior defined for 1920px maximum viewport (edge case)? [Edge Case, Clarifications Q4]
- [ ] CHK033 - Is behavior defined when password manager doesn't support autocomplete? [Edge Case, Spec §Edge Cases]
- [ ] CHK034 - Is behavior defined for soft keyboard appearing on mobile? [Edge Case, Plan §US1]
- [ ] CHK035 - Is behavior defined for hasKeys() returning error vs returning false? [Edge Case, Plan §US2]
- [ ] CHK036 - Is behavior defined for participant profile query timeout? [Gap, Exception Flow]

## Non-Functional Requirements

- [ ] CHK037 - Are performance implications of CSS Grid changes considered? [NFR, Gap]
- [ ] CHK038 - Are accessibility requirements defined for lock icon (alt text, aria-label)? [NFR, Gap]
- [ ] CHK039 - Are accessibility requirements defined for password warning alerts? [NFR, Gap]
- [ ] CHK040 - Is keyboard navigation defined for decryption error tooltips? [NFR, Gap]
- [ ] CHK041 - Are mobile touch target sizes (min 44x44px) specified for new UI elements? [NFR, Constitution §V]

## Dependencies & Assumptions

- [ ] CHK042 - Is the assumption that DaisyUI drawer is compatible with CSS Grid validated? [Assumption, Plan §US1]
- [ ] CHK043 - Is the assumption that .maybeSingle() handles PGRST116 documented? [Assumption, Plan §US2]
- [ ] CHK044 - Is the dependency on env(safe-area-inset-bottom) browser support documented? [Dependency, Gap]
- [ ] CHK045 - Is the dependency on password manager autocomplete detection documented? [Dependency, Spec §US3]

## Ambiguities & Conflicts

- [ ] CHK046 - Is "full page for setup, modal for unlocks" applied consistently in code paths? [Ambiguity, Spec §FR-008]
- [ ] CHK047 - Does hasKeys() fix conflict with existing migration flow? [Conflict Check, Plan §US2]
- [ ] CHK048 - Does decryptionError flag addition conflict with existing DecryptedMessage consumers? [Conflict Check, Plan §US4]
- [ ] CHK049 - Is the priority order (P1 before P2 before P3) enforced in implementation? [Ambiguity, Plan §Implementation]

## Traceability

- [ ] CHK050 - Are all 9 functional requirements (FR-001 to FR-009) traceable to user stories? [Traceability]
- [ ] CHK051 - Are all 5 success criteria (SC-001 to SC-005) traceable to acceptance scenarios? [Traceability]
- [ ] CHK052 - Are all clarification decisions (Q1-Q5) reflected in updated requirements? [Traceability, Clarifications §Session]

---

**Item Count**: 52
**Categories**: 10
**Traceability**: 100% items include reference markers
