# Issues: 02-session-timeout-warning.svg

**Feature:** 005-security-hardening
**SVG:** 02-session-timeout-warning.svg
**Last Review:** 2026-01-15
**Validator:** v5.2

---

## Summary

| Status | Count |
|--------|-------|
| Open | 0 |

---

## Resolved Issues (2026-01-15)

### Modal Issues

| ID | Issue | Resolution |
|----|-------|------------|
| M-01 | Modal detected but no overlay | FALSE POSITIVE - timeout warning preview, not modal |

### Inspector Issues

| Check | Issue | Resolution |
|-------|-------|------------|
| title_x_oddball | x=960 flagged as oddball | CORRECT - x=960 is the standard position |

---

## Notes

- Cleaned up 2026-01-15 by Validator terminal
- Re-validation confirms 0 errors
- APPROVED by QA Review 2026-01-14
- Run validator to refresh: `python validate-wireframe.py 005-security-hardening/02-session-timeout-warning.svg`

## Reviewer Notes (2026-01-14)

**Visual Review Complete**

| Issue | Reviewer Assessment | Action |
|-------|---------------------|--------|
| M-01 | FALSE POSITIVE: This shows a PREVIEW of timeout warning within a panel, not an actual modal. | CLOSE - validator error |
| title_x_oddball | x=960 is CORRECT per spec! | INVERT - 960 is correct |

**Positive Observations:**
- Three-panel layout: Sign In form, Session Status, Timeout Warning Preview
- Remember Me checkbox with 7-day extended session explanation
- Session status indicator with green dot (#22c55e) and expiry countdown
- Timeout warning preview with amber warning icon (#f59e0b) and countdown timer
- "Stay Signed In" vs "Sign Out" action buttons in preview
- 4 callouts properly numbered on desktop and mobile
- Strong annotation panel with US-003, US-009, US-010 traceability

**False Positive Analysis:**
The validator flagged MODAL-001 because it detected modal-related content, but this wireframe shows session management UX with a PREVIEW of the timeout warning. The warning preview includes a dimmed indicator area to demonstrate how it will appear, but the page itself is NOT a modal.

**Overall Assessment:** Excellent session management wireframe. No regeneration needed.

**QA Review (2026-01-14):** Visual inspection confirms:
- Desktop: Sign In form, Session Active panel (green dot, 23h 45m expiry), Timeout Warning modal preview (0:59 countdown)
- Mobile: Session status, Sign In Options, Timeout Warning
- 4 callouts with traceability (US-003, US-009, US-010 + FR-xxx + SC-xxx)
- Session status correctly uses green dot (#22c55e)
- Warning icon uses amber (#f59e0b)
- Title position: x=960 CORRECT

**Status:** ~~APPROVED~~ → SPEC-ORDER issue (see Batch 004 review)

## WireframeQA Batch 004 Review (2026-01-15)

**PNG Source:** `overviews_004/005-security-hardening_02-session-timeout-warning_overview.png`
**Reviewer:** WireframeQA Terminal (Operator QC)

### New Issue Found

| ID | Issue | Classification | Escalation |
|----|-------|----------------|------------|
| SO-01 | Callout order doesn't match visual left-to-right UX flow | SPEC-ORDER | **Technical Writer** |

### SO-01: User Story Order Mismatch

**Current annotation panel order:**
```
[1] Session Timeout Warning → points to RIGHT panel (Timeout Warning - last in flow)
[2] Remember Me Option → points to LEFT panel (Sign In - first in flow)
[3] Session Activity → points to MIDDLE panel (Session Active)
[4] Session Recovery → points to MIDDLE panel (Sign Out button)
```

**Visual UX flow (left to right = chronological):**
```
LEFT:   Sign In form [callout 2] → User signs in with Remember Me option
MIDDLE: Session Active [callouts 3,4] → User has active session, can sign out
RIGHT:  Timeout Warning [callout 1] → Session about to expire, user chooses action
```

**Expected order (matching UX flow):**
```
[1] Remember Me Option (Sign In - entry point)
[2] Session Activity (active session state)
[3] Session Timeout Warning (warning appears near expiry)
[4] Session Recovery (user takes action: stay in or sign out)
```

**UX Rationale:**
- Three-panel layout represents CHRONOLOGICAL flow: Sign In → Active → Timeout
- Callout 1 (Timeout Warning) is the END of the session lifecycle, not the beginning
- Users read left-to-right; callout order should match this scanning pattern
- Current order places the final state (timeout) first, creating confusion

**Action Required:**
1. Technical Writer to reorder user stories in spec:
   - Move US-009 (Session Timeout Warning) from position 1 to position 3
   - Move US-003 (Remember Me Option) from position 2 to position 1
   - Keep US-009 (Session Activity) and US-010 (Session Recovery) as positions 2 and 4
2. After spec update, regenerate wireframe with corrected callout order

**Pattern Note:** This is the same SPEC-ORDER issue seen in:
- 000-landing-page/01-landing-page.issues.md (SO-01)
- 005-security-hardening/01-security-ux-enhancements.issues.md (SO-01)
