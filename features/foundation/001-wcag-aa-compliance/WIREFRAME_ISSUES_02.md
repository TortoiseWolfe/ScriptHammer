# Wireframe Review: 02-a11y-dashboard.svg

**Feature**: 001-wcag-aa-compliance
**File**: `docs/design/wireframes/001-wcag-aa-compliance/02-a11y-dashboard.svg`
**Review Date**: 2026-01-03
**Status**: 🔴 REGENERATE

---

## Review History

| Pass | Date | Issues Found | Resolved |
|------|------|--------------|----------|
| 1 | 2026-01-03 | 0 | N/A |
| 2 | 2026-01-03 | 3 | 0 |
| 3 | 2026-01-03 | 2 | 5 |
| 4 | 2026-01-03 | 6 | 6 |
| 5 | 2026-01-03 | 1 | 0 |

---

## Pass 2 Issues (RESOLVED)

1. ~~**Theme violation** - uses DARK theme but "DASHBOARD" keyword requires LIGHT theme~~
   - ✅ FIXED: Regenerated with v3 True Parchment light theme

2. ~~**Styling inconsistency** - 3 "View Fix →" buttons had mismatched styling~~
   - ✅ FIXED: All buttons now have consistent `fill="#8b5cf6"`

3. ~~**Cramped spacing** - FR-004 annotation too close to WARN panel above~~
   - ✅ FIXED: Proper spacing in regenerated file

---

## Pass 3 Issues (RESOLVED)

4. ~~**FR/SC tag color inconsistency** - SC-010 used `.annotation` (purple) instead of `.sc-tag` (orange)~~
   - ✅ FIXED: Line 139 now uses `class="tag-base sc-tag"`

5. ~~**FR/SC tag color inconsistency** - FR-033 used `.annotation` (purple) instead of `.fr-tag` (blue)~~
   - ✅ FIXED: Line 185 now uses `class="tag-base fr-tag"`

---

## Pass 4: Legend Color Consistency Fix

**ROOT CAUSE**: Used `.legend-code` class (purple #8b5cf6) for FR/SC codes in legend section.

**Fix Applied (6 lines):**

| Line | Before | After |
|------|--------|-------|
| 309 | `class="legend-code">FR-032:` | `class="tag-base fr-tag">FR-032:` |
| 313 | `class="legend-code">FR-033:` | `class="tag-base fr-tag">FR-033:` |
| 317 | `class="legend-code">FR-034:` | `class="tag-base fr-tag">FR-034:` |
| 321 | `class="legend-code">FR-035:` | `class="tag-base fr-tag">FR-035:` |
| 327 | `class="legend-code">SC-010:` | `class="tag-base sc-tag">SC-010:` |
| 331 | `class="legend-code">SC-001:` | `class="tag-base sc-tag">SC-001:` |

---

## Verification

- [x] LIGHT theme (v3 True Parchment) for dashboard type
- [x] FR tags: BLUE (#2563eb) via `.tag-base fr-tag`
- [x] SC tags: ORANGE (#ea580c) via `.tag-base sc-tag`
- [x] Button styling consistent
- [x] Footer signature: [001:02] | Accessibility Dashboard | ScriptHammer

---

## Pass 5: Layout Structure Issue

**Issue**: Wrong layout structure for light theme UI wireframe.

Light theme UI wireframes require desktop/mobile side-by-side layout:
- **Desktop area**: x=40, y=60, 900×680 (3-column: sidebar | main | detail)
- **Mobile area**: x=980, y=60, 360×700 phone frame

Current file uses architecture/single-panel layout instead.

**Action**:
1. Rename `02-a11y-dashboard.svg` → `02-a11y-dashboard.reference.svg`
2. Regenerate with proper desktop/mobile layout (1400×800)
3. Apply v3 True Parchment light theme + same FR/SC content
