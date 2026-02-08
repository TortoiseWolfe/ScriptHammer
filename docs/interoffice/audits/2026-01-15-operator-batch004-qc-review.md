# QC Review: Batch overviews_004

**Date:** 2026-01-15
**Reviewer:** Operator
**Batch:** `docs/design/wireframes/png/overviews_004/`
**PNG Count:** 22

---

## Summary

| Category   | Count | Description                                           |
| ---------- | ----- | ----------------------------------------------------- |
| SPEC-ORDER | 10    | User story sequence doesn't match UX visual flow      |
| REGEN      | 12    | Missing callouts, z-index issues, structural problems |
| PATCH      | 3     | Simple fixes: spacing, z-index redraw                 |
| DESIGN-GAP | 1     | Larger UX gap requiring Council escalation            |

---

## Detailed Findings

### 1. 000-landing-page_01-landing-page

- **Issue:** SPEC-ORDER - Callouts 2/3 need reversed
- **Detail:** "Getting Started" should precede "Feature Exploration" in UX flow
- **Action:** Technical Writer to reorder user stories in spec

### 2. 000-rls-implementation_01-policy-architecture

- **Issue:** REGEN - Annotation panel layout
- **Detail:** Callout 5 crammed under 1 when horizontal space available
- **Note:** Backend diagrams shouldn't show mobile viewport at all

### 3. 002-cookie-consent_02-cookie-preferences-panel

- **Issue:** PATCH - Callout order mismatch
- **Detail:** Callout 4 at top of UI but should be at bottom of annotation panel

### 4. 003-user-authentication_01-registration-sign-in

- **Issue:** REGEN - Mobile missing callouts 2 and 4

### 5. 003-user-authentication_02-verification-password-reset

- **Issues:**
  - REGEN: Desktop callouts 1/2 clipped behind containers (z-index)
  - REGEN: Mobile missing callouts 3/4
  - REGEN: Mobile callout 2 points to wrong element

### 6. 003-user-authentication_03-profile-session-management

- **Issue:** REGEN - Mobile missing callout 4

### 7. 005-security-hardening_01-security-ux-enhancements

- **Issue:** SPEC-ORDER - Callout 1 at bottom of UI but listed first
- **Action:** Technical Writer to reorder spec

### 8. 005-security-hardening_02-session-timeout-warning

- **Issue:** SPEC-ORDER - Callout 1 is last in UX flow but listed first

### 9. 006-template-fork-experience_01-service-setup-guidance

- **Issue:** PATCH - Callouts 5/6 crammed under 1/2
- **Fix:** Need spacing/breathing room in annotation panel

### 10. 006-template-fork-experience_02-rebrand-automation-flow

- **Issues:**
  - PATCH: Annotation spacing for callouts 5/6
  - REGEN: Mobile missing callout 4, mislabeled 5/6
  - DESIGN-ESCALATE: Confirm if callout 4 (Configuration Scope) intentionally not visualized

### 11. 007-e2e-testing-framework_01-test-architecture-diagram

- **Issue:** SPEC-ORDER - Callout numbering doesn't match visual flow

### 12. 008-on-the-account_01-avatar-upload-flow

- **Issues:**
  - REGEN: Callout 3 behind container (z-index)
  - REGEN: NO callouts on mobile at all
  - SPEC-ORDER: Callouts 1/2 need reordering
- **Action:** Flag for Technical Writer FIRST

### 13. 009-user-messaging-system_01-connection-and-chat

- **Issues:**
  - REGEN: Mobile missing callout 1 (Friend Request Flow)
  - DESIGN-GAP: **ESCALATE TO COUNCIL** - Social discovery gap in app
- **Note:** Finding friends is clunky, limited social interactions beyond blog comments

### 14. 009-user-messaging-system_02-settings-and-data

- **Issue:** PATCH - Z-index issue
- **Fix:** Callouts behind containers, redraw last

### 15. 010-unified-blog-content_01-editor-and-preview

- **Issue:** REGEN - Callouts missing throughout both desktop AND mobile

### 16. 010-unified-blog-content_02-conflict-resolution

- **Issue:** REGEN - Callouts missing both sides + larger structural issues

### 17. 011-group-chats_01-group-creation-messaging

- **Issues:**
  - REGEN: Mobile missing callouts
  - SPEC-ORDER: Desktop traces user stories in wrong order
- **Action:** Flag UX/UI designers in order decisions

### 18. 011-group-chats_02-member-management

- **Issues:**
  - REGEN: Mobile missing callouts
  - PATCH: Column gap in annotation panel

### 19. 012-welcome-message-architecture_01-user-onboarding-flow

- **Issues:**
  - REGEN: Mobile missing callout 3
  - PATCH: "Additional Requirements" row too high - move down
  - SPEC-ORDER: Mobile callout 2 at wrong position
- **Action:** Flag UI, UX, Technical Writer

### 20. 016-messaging-critical-fixes_01-message-input-visibility

- **Issue:** SPEC-ORDER - User story sequence doesn't match UX flow

### 21. 016-messaging-critical-fixes_03-conversation-error-states

- **Issue:** SPEC-ORDER - User story sequence doesn't match UX flow

### 22. 021-geolocation-map_02-markers-and-accessibility

- **Issue:** REGEN - Mobile missing callouts 1 and 3

---

## Recurring Patterns Identified

### 1. Z-index/Draw Order

Callouts drawn before containers appear behind them.
**Fix:** Draw callouts LAST in SVG to ensure higher z-index.

### 2. Mobile Missing Callouts

Frequent pattern: desktop has callouts, mobile missing them.
**Fix:** Generator must ensure all callouts render on mobile view.

### 3. SPEC-ORDER Issues

User story numbering doesn't match natural top-to-bottom UX flow.
**Fix:** Technical Writer reorder user stories to match visual flow.

### 4. Annotation Panel Spacing

User stories crammed together when space is available.
**Fix:** Even column distribution, breathing room between items.

---

## Required Escalations

### Council RFC Needed

- **009-user-messaging-system_01**: Social discovery/interaction gap
- Finding friends limited to liking blog comments
- Needs broader app feature discussion

### Technical Writer Queue (SPEC-ORDER)

1. 000-landing-page_01 (swap 2/3)
2. 005-security-hardening_01 (reorder 1)
3. 005-security-hardening_02 (reorder 1)
4. 007-e2e-testing-01 (full reorder)
5. 008-on-the-account_01 (swap 1/2)
6. 011-group-chats_01 (desktop order)
7. 012-welcome-message_01 (mobile order)
8. 016-messaging-01 (full reorder)
9. 016-messaging-03 (full reorder)

### UX/UI Designer Consultation

- 006-fork-02: Is callout 4 intentionally not visualized?
- 011-group-chats_01: Order of operations decisions
- 012-welcome-message_01: Layout decisions

---

## Next Actions

1. [x] Document findings (this file)
2. [ ] Log issues to respective \*.issues.md files
3. [ ] Dispatch SPEC-ORDER items to Technical Writer
4. [ ] Create Council RFC for social discovery gap
5. [ ] Queue REGEN items for Generator terminals
6. [ ] Queue PATCH items for quick fixes
