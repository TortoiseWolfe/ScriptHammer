# SPEC-ORDER Fixes Summary

**Date:** 2026-01-16
**Author:** TechWriter Terminal
**Source:** `docs/interoffice/audits/2026-01-15-operator-batch004-qc-review.md`

---

## Overview

Reviewed 9 SPEC-ORDER issues from Batch 004 QC review. After analysis:

- **5 features** had genuine spec order issues → Fixed via assignments.json updates
- **3 features** were misclassified → Actually REGEN issues (callout placement)
- **1 feature** not applicable → Single user story, no reorder possible

---

## Completed Fixes (assignments.json Updated)

### 1. 000-landing-page/01-landing-page.svg

**Issue:** Callouts 2/3 in wrong UX flow order
**Fix:** Created new assignments.json with user stories reordered:

- Before: US-001, US-002, US-003, US-004
- After: US-001, US-003, US-002, US-004
- Rationale: "Get Started" CTA (US-003) should precede "Feature Exploration" (US-002)

### 2. 005-security-hardening/01-security-ux-enhancements.svg

**Issue:** Callout 1 at bottom of UI but listed first
**Fix:** Updated userStories array:

- Before: ["US-3", "US-7", "US-8"]
- After: ["US-7", "US-8", "US-3"]
- Rationale: Email Validation (top) → Password Strength (middle) → Brute Force Prevention (bottom)

### 3. 005-security-hardening/02-session-timeout-warning.svg

**Issue:** Session timeout shown first but it's the end of session lifecycle
**Fix:** Updated userStories array:

- Before: ["US-9", "US-10"]
- After: ["US-3", "US-9", "US-10"]
- Rationale: Remember Me Option (sign in) → Session Activity → Timeout Warning (expiry)

### 4. 007-e2e-testing-framework/01-test-architecture-diagram.svg

**Issue:** Callout numbering didn't match architecture data flow
**Fix:** Updated userStories array:

- Before: ["US-1", "US-2", "US-7"]
- After: ["US-2", "US-1", "US-6", "US-7"]
- Rationale: User Journey Testing (specs) → Cross-Browser Execution (browsers) → CI/CD Integration → Test Debugging (artifacts)

### 5. 008-on-the-account/01-avatar-upload-flow.svg

**Issue:** Callouts 1/2 need reordering
**Fix:** Created new assignments.json with user stories reordered:

- Before: (no assignments.json)
- After: ["US-2", "US-1", "US-3"]
- Rationale: Replace Avatar flow shown first (existing user state), then Upload, then Remove

### 6. 016-messaging-critical-fixes/03-conversation-error-states.svg

**Issue:** User story sequence doesn't match UI layout
**Fix:** Updated userStories array:

- Before: ["US-004", "US-005"]
- After: ["US-005", "US-004"]
- Rationale: Name Resolution (header/top) → Decryption Failure (messages/middle)

---

## Misclassified as SPEC-ORDER (Actually REGEN Issues)

### 011-group-chats/01-group-creation-messaging.svg

**Original Classification:** SPEC-ORDER - desktop order
**Technical Writer Assessment:** NOT A SPEC-ORDER ISSUE

The annotation panel sequence IS correct:

1. Create Group Chat (US-1)
2. Send/Receive Messages (US-2)
3. Typing Indicators (US-2)
4. Add Members (US-3)

**Actual Issue:** Callout 4 points to wrong UI element (Sarah Wilson contact instead of Add Members button)
**Correct Classification:** REGEN - semantic callout placement error

### 012-welcome-message-architecture/01-user-onboarding-flow.svg

**Original Classification:** SPEC-ORDER - mobile order
**Technical Writer Assessment:** NOT A SPEC-ORDER ISSUE

The desktop annotation panel sequence IS correct:

1. New User Receives Welcome Message (US-1)
2. Idempotent Welcome Messages (US-2)
3. Graceful Error Handling (US-3)
4. Message Encryption (US-4)

**Actual Issue:** Mobile callout 2 points to wrong element; callout 3 missing
**Root Cause:** Mobile mockup shows only success state, cannot represent all user stories
**Correct Classification:** REGEN + Council UX review for mobile state design

### 016-messaging-critical-fixes/01-message-input-visibility.svg

**Original Classification:** SPEC-ORDER - full reorder
**Technical Writer Assessment:** NOT APPLICABLE

**Reason:** This wireframe contains only US-001 (single user story). Cannot reorder what doesn't exist.
**Correct Classification:** REGEN - signature format and pattern violations

---

## Summary Table

| Feature                | SVG | Original Issue | Status       | Action Taken                            |
| ---------------------- | --- | -------------- | ------------ | --------------------------------------- |
| 000-landing-page       | 01  | Swap 2/3       | FIXED        | Created assignments.json                |
| 005-security-hardening | 01  | Reorder 1      | FIXED        | Updated assignments.json                |
| 005-security-hardening | 02  | Reorder 1      | FIXED        | Updated assignments.json                |
| 007-e2e-testing        | 01  | Full reorder   | FIXED        | Updated assignments.json                |
| 008-on-the-account     | 01  | Swap 1/2       | FIXED        | Created assignments.json                |
| 011-group-chats        | 01  | Desktop order  | RECLASSIFIED | Not SPEC-ORDER, needs REGEN             |
| 012-welcome-message    | 01  | Mobile order   | RECLASSIFIED | Not SPEC-ORDER, needs REGEN + UX review |
| 016-messaging-01       | 01  | Full reorder   | N/A          | Single user story, no reorder possible  |
| 016-messaging-03       | 03  | Full reorder   | FIXED        | Updated assignments.json                |

---

## Next Actions

1. **Generator Queue:** 6 wireframes need REGEN with corrected user story order
   - 000-landing-page/01-landing-page.svg
   - 005-security-hardening/01-security-ux-enhancements.svg
   - 005-security-hardening/02-session-timeout-warning.svg
   - 007-e2e-testing-framework/01-test-architecture-diagram.svg
   - 008-on-the-account/01-avatar-upload-flow.svg
   - 016-messaging-critical-fixes/03-conversation-error-states.svg

2. **Separate REGEN Queue:** 3 wireframes need REGEN for callout positioning (not spec order)
   - 011-group-chats/01-group-creation-messaging.svg
   - 012-welcome-message-architecture/01-user-onboarding-flow.svg
   - 016-messaging-critical-fixes/01-message-input-visibility.svg

3. **Council Review:** 2 features have UX design gaps requiring escalation
   - 011-group-chats: Add Members button affordance unclear
   - 012-welcome-message: Mobile cannot represent all user stories

---

## Files Modified

- `docs/design/wireframes/000-landing-page/assignments.json` (created)
- `docs/design/wireframes/005-security-hardening/assignments.json` (updated)
- `docs/design/wireframes/007-e2e-testing-framework/assignments.json` (updated)
- `docs/design/wireframes/008-on-the-account/assignments.json` (created)
- `docs/design/wireframes/016-messaging-critical-fixes/assignments.json` (updated)
- `docs/design/wireframes/011-group-chats/01-group-creation-messaging.issues.md` (assessment added)
- `docs/design/wireframes/012-welcome-message-architecture/01-user-onboarding-flow.issues.md` (assessment added)
- `docs/design/wireframes/016-messaging-critical-fixes/01-message-input-visibility.issues.md` (assessment added)
