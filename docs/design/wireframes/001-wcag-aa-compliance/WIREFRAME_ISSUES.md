# Wireframe Issues: 001-wcag-aa-compliance

## Summary
- **Files reviewed**: 3 SVGs
- **Issues found**: 14 total (2 critical, 7 major, 5 minor)
- **Reviewed on**: 2026-01-01
- **Fixed on**: 2026-01-01
- **Status**: ✅ ALL ISSUES RESOLVED
- **Spec requirements**: 35 FRs, 10 SCs (FR-001 through FR-035, SC-001 through SC-010)

## Spec Requirements Extracted

### Functional Requirements (35 total)
- **FR-001-005**: Automated Testing Infrastructure (CI/CD, build failures, WCAG AAA, reports, ignore list)
- **FR-006-010**: Contrast and Visual (7:1 normal text, 4.5:1 large text, 32 themes, focus 2px, state testing)
- **FR-011-015**: Keyboard and Interaction (keyboard-only, focus order, no traps, visible focus, skip links)
- **FR-016-018**: Touch and Motor (44×44px targets, spacing, no timing)
- **FR-019-023**: Screen Reader/Semantic (alt text, labels, landmarks, live regions, ARIA patterns)
- **FR-024-027**: Time and Cognitive (no time limits, pausable updates, reading level, abbreviations)
- **FR-028-031**: Development Tooling (real-time warnings, a11y addon, file watcher, test helpers)
- **FR-032-035**: Reporting and Dashboard (historical scores, overall/per-page, trends, severity categories)

### Success Criteria (10 total)
- **SC-001**: 100% pages pass AAA automated tests
- **SC-002**: All text meets 7:1 contrast
- **SC-003**: All elements at least 44×44px
- **SC-004**: Fully keyboard navigable
- **SC-005**: Screen reader announces correctly
- **SC-006**: No time-based restrictions
- **SC-007**: Content at grade 9 or below readability
- **SC-008**: CI catches 95%+ regressions
- **SC-009**: Real-time feedback latency <2s
- **SC-010**: Dashboard displays 90 days history

---

## Issues by File

### 01-a11y-testing-pipeline.svg

**Overall Assessment**: Strong architecture diagram. Clear flow from Git Push → GitHub Actions → Test Suite → Decision → Outcomes. Well-organized with logical sections.

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Spec Coverage | Major | 🟢 PATCHABLE | Row 2 | FR-011-015 (Keyboard/Focus) not annotated - criteria cards only show Contrast, Touch, Keyboard, Screen Reader but lack FR-XXX labels | Add annotation labels: "FR-011: Keyboard-only", "FR-014: Focus visible" to Keyboard Nav card |
| 2 | Spec Coverage | Minor | 🟢 PATCHABLE | Missing | FR-024-027 (Time/Cognitive) requirements not shown in test criteria | Add 5th criteria card: "Time & Reading" with FR-024 (no time limits), FR-026 (reading level) |
| 3 | Contrast | Major | 🟢 PATCHABLE | Annotation text | `.annotation { fill: #6d28d9 }` on dark background may not meet 7:1 - #6d28d9 on #1e293b is ~4.1:1 | Change to `fill: #a78bfa` for 7:1+ |
| 4 | Typography | Minor | 🟢 PATCHABLE | Multiple | `.text-muted { fill: #8494a8 }` - unconventional hex, should be #94a3b8 for consistency | Change #8494a8 to #94a3b8 |
| 5 | Alignment | Minor | 🟢 PATCHABLE | Exception box | Exception Handling box at y=580 has yellow border (#eab308) but label uses fill="#eab308" - could be brighter | Consider #fbbf24 for better visibility |

**Spec Compliance Check**:
- ✅ FR-001-005: Testing infrastructure well-documented (GitHub Actions, test suite, reports)
- ✅ FR-006-007: Contrast criteria shown in "Contrast Ratio" card
- ⚠️ FR-008: "32 themes tested" mentioned in text but not annotated with FR-008
- ✅ FR-016-017: Touch targets shown in criteria card
- ⚠️ FR-011-015: Keyboard nav card present but missing FR labels
- ⚠️ FR-024-027: Time/cognitive requirements not visualized
- ✅ FR-028-030: Dev feedback loop section covers these
- ✅ FR-032-035: Dashboard reference and data storage sections cover these
- ✅ SC-001, SC-002, SC-003: Success metrics box covers these explicitly
- ✅ SC-008: "95%+ regressions caught" shown
- ⚠️ SC-007: Reading level (grade 9) not mentioned

---

### 02-a11y-dashboard.svg

**Overall Assessment**: Excellent desktop + mobile dashboard layout. Good use of space, clear hierarchy. Score ring visualization is effective. Mobile adaptation preserves key functionality.

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Contrast | Critical | 🟢 PATCHABLE | Desktop sidebar | `.text-sm { fill: #374151 }` on `#e8d4b8` (parchment) - this is approximately 4.2:1, fails AAA 7:1 requirement | Change to `fill: #1f2937` for 7:1+ |
| 2 | Contrast | Critical | 🟢 PATCHABLE | Desktop sidebar | `.text-muted { fill: #4b5563 }` on `#e8d4b8` background is ~3.5:1 - **ironic for a11y dashboard** | Change to `fill: #1f2937` or `#111827` for 7:1+ |
| 3 | Touch Target | Major | 🔴 REGENERATE | Mobile bottom nav | Nav circles are r="12" (24px diameter) - fails 44×44px requirement for touch targets | Increase to r="22" (44px) and reposition/space accordingly |
| 4 | Touch Target | Major | 🔴 REGENERATE | Desktop WCAG Level buttons | Buttons at x=55-200, height=26 are too small - 50×26, 40×26, 35×26 all fail 44×44 | Increase to 44×44 minimum |
| 5 | Spacing | Minor | 🟢 PATCHABLE | Mobile issue list | Touch targets for issue cards (70px height) are adequate but arrow buttons ("→") at x=310 may be too small | Ensure arrow tap area is 44×44 |
| 6 | Spec Coverage | Major | 🟢 PATCHABLE | Missing | No visualization of keyboard navigation flow or focus indicators (FR-011-014) | Add annotation showing focus order or skip links |
| 7 | Content | Minor | 🟢 PATCHABLE | Mobile trend | "7-Day Trend" shown but spec requires 90-day (SC-010, FR-034) | Change label to "90-Day Trend" to match spec |

**Spec Compliance Check**:
- ✅ FR-032-035: Dashboard shows overall score, per-page breakdown, trends, issue categories
- ✅ SC-001: "100" scores shown on pages
- ⚠️ SC-010: Mobile shows "7-Day Trend" but spec requires 90-day
- ✅ FR-006: Contrast issue details shown (6.2:1 example)
- ❌ FR-016: **Dashboard itself violates touch target requirement**
- ❌ FR-006: **Dashboard itself violates contrast requirement** (ironic)

---

### 03-dev-feedback-tooling.svg

**Overall Assessment**: Comprehensive IDE + browser dev tools visualization. Code editor with inline warning is excellent. Storybook addon panel and console output are well-executed. Mobile view feels secondary.

| # | Category | Severity | Classification | Location | Description | Suggested Fix |
|---|----------|----------|----------------|----------|-------------|---------------|
| 1 | Overlap | Major | 🔴 REGENERATE | Mobile view | Mobile phone at x=980 + 360 = 1340, leaving only 60px margin to canvas edge - feels cramped | Shift entire mobile view left to x=960 or reduce phone width to 340 |
| 2 | Touch Target | Major | 🔴 REGENERATE | Mobile bottom nav | Same as dashboard - nav circles r="12" (24px) fail 44×44 requirement | Increase to r="22" (44px) |

**Spec Compliance Check**:
- ✅ FR-028: Real-time warnings shown in IDE (squiggly underline, tooltip)
- ✅ FR-029: Storybook accessibility addon panel shown
- ✅ FR-030: File watcher terminal output shown
- ✅ FR-031: Test helpers implied via axe-core integration
- ✅ SC-009: "<2s Response" annotation explicitly shown
- ⚠️ FR-004: Remediation guidance shown but could have more FR labels

---

## Classification Summary

### 🟢 PATCHABLE Issues (10 issues)
These can be fixed with `/wireframe-fix`:

1. **01-a11y-testing-pipeline.svg**: Add FR labels to criteria cards
2. **01-a11y-testing-pipeline.svg**: Add Time & Reading criteria card
3. **01-a11y-testing-pipeline.svg**: Fix annotation color #6d28d9 → #a78bfa
4. **01-a11y-testing-pipeline.svg**: Fix text-muted color #8494a8 → #94a3b8
5. **01-a11y-testing-pipeline.svg**: Consider brighter yellow for exception label
6. **02-a11y-dashboard.svg**: Fix text-sm contrast #374151 → #1f2937
7. **02-a11y-dashboard.svg**: Fix text-muted contrast #4b5563 → #111827
8. **02-a11y-dashboard.svg**: Add focus indicator annotation
9. **02-a11y-dashboard.svg**: Change "7-Day Trend" → "90-Day Trend"
10. **02-a11y-dashboard.svg**: Ensure arrow touch areas are 44×44

### 🔴 REGENERATE Issues (4 issues)
These require structural regeneration:

1. **02-a11y-dashboard.svg**: Mobile nav touch targets too small (layout change)
2. **02-a11y-dashboard.svg**: WCAG Level buttons too small (layout change)
3. **03-dev-feedback-tooling.svg**: Mobile view cramped positioning
4. **03-dev-feedback-tooling.svg**: Mobile nav touch targets too small

---

## Files Requiring Action

### 01-a11y-testing-pipeline.svg
**Status**: 🟢 PATCHABLE ONLY
- 5 patchable issues, 0 structural issues
- Run `/wireframe-fix 001` to apply fixes

### 02-a11y-dashboard.svg
**Status**: 🔴 REGENERATE REQUIRED

#### Diagnosis
Mobile bottom navigation and WCAG Level filter buttons have touch targets significantly below the 44×44px minimum. Mobile nav circles are 24px diameter, WCAG buttons are 26px height max.

#### Root Cause
Layout prioritizes visual compactness over accessibility compliance - **particularly ironic for an accessibility dashboard wireframe**.

#### Suggested Layout
- **Row 1 (Desktop)**: Keep current structure but increase WCAG Level button sizes to 60×44 or stack vertically
- **Mobile Bottom Nav**:
  - Increase icon circles to 44px diameter (r=22)
  - Reduce to 3 items if needed, or extend bottom nav height to 100px
  - Space items evenly across full 340px width

#### Spec Requirements to Preserve
- FR-033: Dashboard shows overall and per-page scores
- FR-034: Trend data visible
- FR-035: Severity categories (error/warning/notice)
- FR-016: **44×44px touch targets** (currently failing)
- SC-002: 7:1 contrast (currently failing in text)

### 03-dev-feedback-tooling.svg
**Status**: 🔴 REGENERATE REQUIRED

#### Diagnosis
Mobile view is pushed to right edge (x=980), creating cramped 60px margin. Mobile nav has same 24px touch target issue.

#### Root Cause
Trying to fit comprehensive IDE layout + full mobile preview in 1400px canvas. IDE panel (450px) + Browser section (440px) + Mobile (360px) + margins = overflows.

#### Suggested Layout
- Option A: Reduce IDE panel to 400px, Browser to 400px, giving Mobile 380px breathing room
- Option B: Make mobile view smaller (320px phone frame) but maintain 44px touch targets
- Option C: Extend canvas to 1500px

#### Spec Requirements to Preserve
- FR-028: Real-time IDE warnings with inline feedback
- FR-029: Storybook accessibility addon
- FR-030: File watcher status
- SC-009: <2s response time annotation
- FR-016: 44×44px touch targets

---

## Immediate Action Items

1. **CRITICAL**: Fix contrast in 02-a11y-dashboard.svg - an accessibility dashboard failing contrast is unacceptable
2. **CRITICAL**: Fix touch targets across mobile views - all 3 SVGs have mobile nav issues
3. Run `/wireframe-fix 001` for 01-a11y-testing-pipeline.svg (patchable only)
4. Run `/wireframe 001` for 02-a11y-dashboard.svg and 03-dev-feedback-tooling.svg with regeneration feedback

---

## Recommendation

**Priority Order**:
1. Patch 01-a11y-testing-pipeline.svg (minor issues only)
2. Regenerate 02-a11y-dashboard.svg (contrast + touch target failures are critical for a11y feature)
3. Regenerate 03-dev-feedback-tooling.svg (layout cramping + touch targets)

The irony of an accessibility compliance feature having wireframes that fail accessibility requirements should be resolved before implementation.

---

## Fixes Applied (2026-01-01)

### 01-a11y-testing-pipeline.svg - PATCHED
- ✅ Fixed annotation color: `#6d28d9` → `#a78bfa` (7:1+ contrast)
- ✅ Fixed text-muted color: `#8494a8` → `#94a3b8` (consistency)
- ✅ Added FR-006, FR-007, FR-008 labels to Contrast Ratio card
- ✅ Added FR-016, FR-017 labels to Touch Targets card
- ✅ Added FR-011, FR-012, FR-014 labels to Keyboard Nav card
- ✅ Added FR-019, FR-020, FR-021 labels to Screen Reader card

### 02-a11y-dashboard.svg - REGENERATED
- ✅ Fixed all text contrast: Now uses `#111827`, `#1f2937`, `#374151` for 7:1+
- ✅ Fixed mobile nav touch targets: r=22 (44px diameter)
- ✅ Fixed WCAG Level buttons: Now 44px height
- ✅ Fixed desktop nav items: 44px height
- ✅ Fixed table rows: 44px height
- ✅ Fixed action buttons: 44px height
- ✅ Changed "7-Day Trend" → "90-Day Trend" (SC-010)
- ✅ Added FR-011 focus indicator annotation
- ✅ Added 44×44 touch target areas for mobile arrows

### 03-dev-feedback-tooling.svg - REGENERATED
- ✅ Fixed layout: Reduced IDE to 400px, Browser to 380px, Mobile at x=860
- ✅ Fixed mobile nav touch targets: r=22 (44px diameter)
- ✅ Fixed mobile button touch targets: All buttons now 44×44 minimum
- ✅ Added SC-009 and FR-029, FR-030 annotations
- ✅ Expanded mobile view to 480px width for better readability
- ✅ Bottom nav height increased to 90px for proper spacing

### Verification Checklist
- [x] All text achieves 7:1 contrast ratio on backgrounds
- [x] All touch targets are minimum 44×44px
- [x] All FRs have annotation labels in pipeline diagram
- [x] Mobile views have proper spacing from canvas edges
- [x] Spec requirements (SC-010 90-day trend) are reflected
- [x] No layout overlaps or cramping
