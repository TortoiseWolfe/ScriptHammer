# Wireframe Issues: 001-WCAG-AA-Compliance

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 8 total (0 critical, 3 major, 5 minor)
- **Pass**: 3
- **Reviewed on**: 2026-01-01
- **Status**: ✅ ALL ISSUES RESOLVED - VERIFIED

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 8 | - | 8 | 8 |
| 2 | 2026-01-01 | - | 8 | 0 | 0 |
| 3 | 2026-01-01 | - | - | 0 | 0 |

## Pass 3 Verification Summary

All 8 previous issues confirmed resolved:

### 01-a11y-testing-pipeline.svg ✅
1. **FR-015 skip links** - VERIFIED: Line 177 shows "Live regions, Skip links" in Screen Reader panel
2. **FR-024-027 Time & Cognitive** - VERIFIED: Lines 183-195 add dedicated "TIME & COGNITIVE" panel at x=890
3. **SC-009 metric** - VERIFIED: Line 333 shows "✓ Dev feedback < 2 seconds (SC-009)"

### 02-a11y-dashboard.svg ✅
4. **Column alignment** - VERIFIED: Table columns at x=450, 520, 600 are consistent (lines 129-161)
5. **FR-032 Issue History** - VERIFIED: Lines 219-249 show enhanced history panel with "First detected", "Occurrences", "Trend sparkline"

### 03-dev-feedback-tooling.svg ✅
6. **Panel spacing** - VERIFIED: IDE ends at x=420 (40+380), Browser at x=440-800 (360px), gap to Mobile at x=840 = 40px gap
7. **FR-031 test helpers** - VERIFIED: Lines 149-158 show "Component Test Helpers" panel with jest-axe import
8. **Issue 3 button** - VERIFIED: Lines 307-308 show "Details" button on Issue 3 card

### New Issues Found: 0

No new issues discovered during Pass 3 verification.

## Spec Requirements Extracted

### Functional Requirements (FR-001 to FR-035)
- **FR-001-005**: Automated testing infrastructure (CI/CD, builds, WCAG 2.1 AAA, reports, ignore list)
- **FR-006-010**: Contrast and visual (7:1 normal, 4.5:1 large, 32 themes, focus 2px, all states)
- **FR-011-015**: Keyboard and interaction (keyboard only, focus order, no traps, focus visible, skip links)
- **FR-016-018**: Touch and motor (44x44px min, spacing, no timing)
- **FR-019-023**: Screen reader and semantic (alt text, labels, landmarks, live regions, ARIA patterns)
- **FR-024-027**: Time and cognitive (no time limits, pausable, reading level, abbreviations)
- **FR-028-031**: Development tooling (real-time warnings, audit panel, file watcher, test helpers)
- **FR-032-035**: Reporting and dashboard (historical data, scores, trends, severity categories)

### Success Criteria (SC-001 to SC-010)
- **SC-001**: 100% pages pass AAA automated tests
- **SC-002**: All text meets 7:1 contrast
- **SC-003**: All interactive elements 44x44px
- **SC-004**: Fully keyboard navigable
- **SC-005**: Screen reader compatible
- **SC-006**: No time-based restrictions
- **SC-007**: Grade 9 or below reading level
- **SC-008**: 95%+ regressions caught pre-merge
- **SC-009**: Real-time feedback < 2 seconds
- **SC-010**: Dashboard shows 90 days history

## Issues by File

### 01-a11y-testing-pipeline.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Spec Compliance | Minor | 🟢 | ✅ PATCHED | Test criteria panel | FR-015 (skip links) not visualized in pipeline | Add annotation to Screen Reader panel: "Skip links (FR-015)" |
| 2 | Spec Compliance | Minor | 🟢 | ✅ PATCHED | Test criteria panel | FR-024-FR-027 (time/cognitive requirements) not visualized | Add a 5th criteria box for "Time & Cognitive" requirements |
| 3 | Content | Minor | 🟢 | ✅ PATCHED | Metrics panel y=580 | Success metrics missing SC-009 (<2s feedback) | Add "✓ Dev feedback < 2 seconds" to metrics list |

**Overall Assessment**: This architecture diagram is well-structured. The flow is clear (Git Push → CI → Tests → Decision → Reports). All major testing components are represented. ✅ All 3 issues patched on 2026-01-01.

---

### 02-a11y-dashboard.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 4 | Alignment | Minor | 🟢 | ✅ REGENERATED | Desktop table rows | "ISSUES" column text at x=530 but values at x=545 - 15px misalignment | Change values x from 545 to 530 for consistent alignment |
| 5 | Spec Compliance | Major | 🔴 | ✅ REGENERATED | Detail panel | FR-035 (severity categories: error, warning, notice) shown but FR-032 historical tracking not demonstrated in detail view | Add "Issue History" section showing first detected date, occurrence count, trend |

**Overall Assessment**: Dashboard demonstrates FR-032/FR-033/FR-034 (scores, per-page breakdown, 90-day trends). Touch targets are properly sized (44px). Mobile view is well-adapted. The 90-day trend correctly implements SC-010. ✅ Regenerated on 2026-01-01 with enhanced Issue History panel (FR-032) and fixed column alignment.

---

### 03-dev-feedback-tooling.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 6 | Overlap | Major | 🔴 | ✅ REGENERATED | x=840-860 | Desktop browser panel (460-840) and mobile panel (860+) have only 20px gap - visually cramped | Increase gap to 40px or reduce browser panel width by 20px |
| 7 | Spec Compliance | Major | 🔴 | ✅ REGENERATED | Missing | FR-031 (test helpers for component-level testing) not visualized anywhere | Add annotation or panel showing "@testing-library/jest-axe helpers" |
| 8 | Touch Target | Minor | 🟢 | ✅ REGENERATED | Mobile Issue 3 card | Issue 3 card at y=425 is 70px tall but has no action button, inconsistent with other issue cards | Add "View" or "Details" button to maintain consistency with 44px touch target |

**Overall Assessment**: Strong visualization of FR-028 (console warnings), FR-029 (Storybook addon), FR-030 (file watcher). SC-009 response time is annotated. The IDE + Browser + Mobile triptych effectively shows the development workflow. ✅ Regenerated on 2026-01-01 with proper 40px panel gaps, FR-031 test helpers panel, and consistent action buttons.

---

## Regeneration Feedback

### 02-a11y-dashboard.svg

#### Diagnosis
The detail panel (x=700-940) shows issue details, remediation, and code location, but lacks the "Issue History" section required by FR-032. The existing "History" section at y=595 only shows static text, not a proper historical visualization.

#### Root Cause
The detail panel was designed for showing current issue details, not demonstrating the historical tracking capability that is central to FR-032 and SC-010.

#### Suggested Layout
- Keep existing structure (Overall Score, Trend, Page Breakdown, Issue Categories)
- Detail panel (x=700-940):
  - Row 1: Selected Issue Details (existing) - reduce height by 20px
  - Row 2: Remediation (existing) - reduce height by 20px
  - Row 3: Code Location (existing)
  - Row 4: Action Buttons (existing)
  - Row 5: **Enhanced Issue History** - show "First detected", "Occurrences", "Trend sparkline"
  - Row 6: Export button

#### Spec Requirements to Preserve
- FR-032: Accessibility scores persisted for historical tracking
- FR-033: Dashboard displays overall and per-page compliance scores
- FR-034: Dashboard shows trend data over time
- FR-035: Issues categorized by severity
- SC-010: Dashboard displays historical data for at least 90 days

---

### 03-dev-feedback-tooling.svg

#### Diagnosis
1. The gap between browser panel (ends at x=840) and mobile panel (starts at x=860) is only 20px, making the layout feel cramped
2. FR-031 (test helpers for component-level accessibility testing) is not visualized anywhere in the wireframe

#### Root Cause
1. The three-column layout (IDE 400px + Browser 380px + gap + Mobile 480px) uses 1280px of the 1400px canvas, but the gap allocation was too tight
2. FR-031 was overlooked - it's a development tooling requirement that should show test helper integration

#### Suggested Layout
- IDE Panel: 380px (reduce by 20px)
- Gap: 20px
- Browser Panel: 360px (reduce by 20px)
- Gap: 40px (increase from 20px)
- Mobile Panel: 460px (reduce by 20px)
- Total: 1280px with proper breathing room

Add to browser section or IDE terminal:
- New annotation showing `import { axe } from '@axe-core/react'` or similar
- Label: "FR-031: Test Helpers"

#### Spec Requirements to Preserve
- FR-028: Real-time accessibility warnings in development console
- FR-029: Component library includes accessibility audit panel
- FR-030: File watcher reports accessibility status on save
- FR-031: Test helpers provided for component-level testing
- SC-009: Real-time dev feedback latency under 2 seconds

---

## Classification Summary

| File | 🟢 Patchable | 🔴 Regenerate | Action | Status |
|------|-------------|---------------|--------|--------|
| 01-a11y-testing-pipeline.svg | 3 | 0 | PATCH | ✅ COMPLETE |
| 02-a11y-dashboard.svg | 1 | 1 | REGENERATE | ✅ COMPLETE |
| 03-dev-feedback-tooling.svg | 1 | 2 | REGENERATE | ✅ COMPLETE |

## Resolution Summary

All 8 issues resolved on 2026-01-01:

1. **01-a11y-testing-pipeline.svg** - PATCHED
   - Added FR-015 (skip links) to Screen Reader panel
   - Added "Time & Cognitive" criteria box (FR-024-027)
   - Added SC-009 to success metrics

2. **02-a11y-dashboard.svg** - REGENERATED
   - Fixed table column alignment
   - Added enhanced Issue History panel with trend sparkline (FR-032)
   - Added 90-day annotation (SC-010)

3. **03-dev-feedback-tooling.svg** - REGENERATED
   - Increased panel gaps to 40px (layout: 380px + 20px + 360px + 40px + 500px)
   - Added FR-031 Component Test Helpers panel with jest-axe import
   - Added "Details" button to Issue 3 card for consistent touch targets

## Next Steps

✅ Wireframe review complete for 001-wcag-aa-compliance.

Proceed to:
```bash
/speckit.plan 001-wcag-aa-compliance
```
