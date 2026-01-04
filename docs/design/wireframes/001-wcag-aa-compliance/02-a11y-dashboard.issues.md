# Wireframe Review: 02-a11y-dashboard.svg

**Feature**: 001-wcag-aa-compliance
**File**: `docs/design/wireframes/001-wcag-aa-compliance/02-a11y-dashboard.svg`
**Review Date**: 2026-01-04
**Status**: ❌ FAIL (Pass 8 - post-downsize issues)

---

## First Checks (13 Blocking)

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | File exists and loads | PASS | |
| 2 | Canvas 1600x1000 | PASS | Extended for complex dashboard |
| 3 | Theme correct (Light for dashboard/UI) | PASS | |
| 4 | Watermark header present | PASS | |
| 5 | FR tags blue (#2563eb) | PASS | |
| 6 | SC tags orange (#ea580c) | PASS | |
| 7 | Min font 13px+ | PASS | |
| 8 | Footer at y=980, x=60 | PASS | |
| 9 | Legend at y=890 | PASS | |
| 10 | Requirements mapped | PASS | |
| 11 | No text cutoff | PASS | |
| 12 | No element overlap | PASS | Legend at x=1120, mobile at x=1180 |
| 13 | Logical flow readable | PASS | |

---

## Critical Issues (🔴 REGENERATE)

### Issue 1: GREEN TEXT FAILS WCAG CONTRAST

**Severity**: 🔴 CRITICAL - Accessibility failure in accessibility dashboard (ironic!)

**Problem**: The `.success` class uses `fill: #22c55e` (Tailwind green-500) on parchment backgrounds (#e8d4b8, #dcc8a8, #f5f0e6).

**Contrast Analysis**:
| Background | Text Color | Approx Ratio | WCAG AA (4.5:1) |
|------------|------------|--------------|-----------------|
| #e8d4b8 (parchment) | #22c55e (green) | ~1.6:1 | ❌ FAIL |
| #dcc8a8 (darker tan) | #22c55e (green) | ~1.8:1 | ❌ FAIL |
| #f5f0e6 (chart bg) | #22c55e (green) | ~1.5:1 | ❌ FAIL |

**Affected Elements**:
- Line 74: `+8% (90d)` on score card
- Line 134: `91%` on trend chart
- Lines 225, 228, 231, 234: Checkmarks in User Story coverage
- Line 258: `↑8% (90 days)` in mobile view

**Fix Required**: Use a darker green that meets WCAG AA:
- Option A: `#166534` (green-800) - ~4.8:1 on parchment ✅
- Option B: `#15803d` (green-700) - ~4.2:1 on parchment ⚠️ (close)
- Option C: `#064e3b` (emerald-900) - ~6.5:1 on parchment ✅

---

### Issue 2: "Review" Pill Buttons Undersized

**Severity**: 🔴 CRITICAL - Touch target fails WCAG AAA

**Problem**: The "Review" buttons in the per-page table are only 20px tall:
```xml
<rect x="430" y="6" width="60" height="20" rx="10" fill="#fef3c7"/>
```

**WCAG AAA requires 44×44px minimum touch targets.**

**Affected Lines**: 155, 162, 169, 176

**Fix Required**:
- Height: 20 → 44
- Adjust y position to center text
- Consider making the entire row tappable instead

---

### Issue 3: "View Fix" Buttons Undersized

**Severity**: 🔴 CRITICAL - Touch target fails WCAG AAA

**Problem**: The "View Fix" buttons in the issues panel are only 24px tall:
```xml
<rect x="420" y="10" width="90" height="24" rx="4" fill="#8b5cf6"/>
```

**Affected Lines**: 197, 207

**Fix Required**: Height: 24 → 44

---

### Issue 4: Mobile Quick Stats Badges Undersized

**Severity**: 🟡 MODERATE - If tappable, fails WCAG AAA

**Problem**: The severity breakdown badges in mobile view are only 24px tall:
```xml
<rect x="0" y="0" width="70" height="24" rx="4" fill="#22c55e20" stroke="#22c55e"/>
```

**Affected Lines**: 267, 269, 271

**Decision Needed**: Are these tappable filters or display-only?
- If tappable: Height must be 44px
- If display-only: Current size is acceptable, but consider adding `role="status"` indication

---

## Moderate Issues (🟢 PATCHABLE - but fixing in regeneration)

### Issue 5: Green Success Indicator at End of Trend Line

**Severity**: 🟢 Minor

**Problem**: Line 133 shows a green circle (#22c55e) as a "success" data point. While not text, it may be hard to distinguish for colorblind users.

**Fix**: Add a secondary indicator (checkmark icon, larger size, or shape change)

---

### Issue 6: Orange Badges Use Transparent Fill

**Severity**: 🟢 Minor

**Problem**: Lines 267-272 use `#22c55e20` (green at 20% opacity) and `#eab30820` (yellow at 20% opacity). These extremely low-opacity fills may be invisible on some displays.

**Fix**: Use solid fills with appropriate colors, or increase opacity to at least 40%

---

## Requirements Coverage Analysis

| Code | Spec Requirement | In Wireframe? | Accessible? |
|------|------------------|---------------|-------------|
| FR-004 | Detailed violation reports | Yes | ⚠️ Buttons too small |
| FR-032 | Persist scores for history | Yes | ✅ |
| FR-033 | Overall + per-page scores | Yes | ⚠️ Green text contrast |
| FR-034 | Trend data over time | Yes | ✅ |
| FR-035 | Severity categories | Yes | ✅ |
| SC-001 | 100% AAA pass | Yes | ❌ IRONIC: Dashboard fails AAA |
| SC-010 | 90-day history | Yes | ✅ |

---

## Recommendations for Regeneration

### 1. Fix Green Text Contrast (CRITICAL)

Replace `.success { fill: #22c55e; }` with:
```css
.success { fill: #166534; } /* green-800: 4.8:1 contrast on parchment */
```

### 2. Fix Button Sizes (CRITICAL)

All interactive buttons need 44px height:
- Review pills: 60×44 (was 60×20)
- View Fix buttons: 90×44 (was 90×24)
- Consider making entire table rows tappable with proper padding

### 3. Consider Colorblind-Friendly Success Indicators

Instead of relying solely on green color:
- Add ✓ checkmark icons
- Use shape differentiation (filled circle for success, hollow for pending)
- Consider using blue (#2563eb) for positive indicators (passes both AA and colorblind tests)

---

## Review History

| Pass | Date | Issues Found | Status |
|------|------|--------------|--------|
| 1 | 2026-01-04 | 1 (layout) | Regenerated |
| 2 | 2026-01-04 | 6 (3 critical) | 🔴 REGENERATE |
| 3 | 2026-01-04 | +1 (legend overlap) | 🔴 REGENERATE |
| 4 | 2026-01-04 | Layout fixed, missed contrast | Regenerated |
| 5 | 2026-01-04 | 4 (3 critical accessibility) | 🔴 REGENERATE |
| 6 | 2026-01-04 | 0 (all fixed) | ✅ PASS |
| 7 | 2026-01-04 | Legend alignment | ✅ PASS |
| 8 | 2026-01-04 | 5 (post-downsize: desktop panel, mobile size, FR-035 clip) | 🔴 REGENERATE |

---

## Verdict

**Status: ✅ PASS**

All critical accessibility issues have been fixed in Pass 6 regeneration:

### Fixes Applied:
1. ✅ **Green text contrast** - Changed from `#22c55e` to `#166534` (green-800, 4.8:1 ratio)
2. ✅ **Review buttons** - Increased from 20px to 44px height
3. ✅ **View Fix buttons** - Increased from 24px to 44px height
4. ✅ **Colorblind-friendly indicators** - Added checkmark icons (✓) alongside colors
5. ✅ **Solid badge fills** - Changed from 20% opacity to solid fills

### Requirements Coverage (All Accessible)

| Code | Requirement | Status |
|------|-------------|--------|
| FR-004 | Detailed violation reports | ✅ Buttons properly sized |
| FR-032 | Persist scores for history | ✅ |
| FR-033 | Overall + per-page scores | ✅ Green text meets contrast |
| FR-034 | Trend data over time | ✅ |
| FR-035 | Severity categories | ✅ |
| SC-001 | 100% AAA pass | ✅ Dashboard now meets AAA |
| SC-010 | 90-day history | ✅ |

**The accessibility dashboard wireframe now meets WCAG AAA accessibility requirements.**

---

## Pass 7 Alignment (2026-01-04) - ✅ COMPLETE

**Action**: Legend alignment to match cross-feature standard.

### Changes Applied

| Element | Before | After | Standard |
|---------|--------|-------|----------|
| Legend rect height | 70 | 75 | 75 (2-row) |
| Header y | 18 | 18 | 18 (already correct) |
| Row 1 translate | (20, 36) | (20, 38) | (20, 38) |
| Row 2 translate | (20, 54) | (20, 60) | (20, 60) |

### Standard Legend Spacing

All wireframes with 2-row legends should use:
- Rect height: 75
- Header: y=18
- Row 1: translate(20, 38)
- Row 2: translate(20, 60)

**Verdict**: ✅ PASS - Locked with `chmod 444`

---

## Pass 8 Review (2026-01-04) - ❌ FAIL (Post-Downsize)

**Action**: Downsized canvas from 1600×1000 to standard 1400×800 for consistency.

**New Issues Found**: 5 structural problems introduced during downsize.

### First Checks (Blocking)

| Check | Status | Notes |
|-------|--------|-------|
| Theme | ✅ | Light theme correct |
| Canvas size | ✅ | 1400×800 (downsized) |
| Desktop container | ❌ | **MISSING - no background panel** |
| Mobile frame size | ❌ | **360×620 - should be 360×700** |
| Mobile screen area | ❌ | **340×600 - should be 340×680** |
| Mobile status bar icons | ❌ | **MISSING 📶 🔋 icons** |
| Legend text clipping | ❌ | **FR-035 clips at right edge** |
| Footer | ✅ | x=60, y=780, format correct |

### Issues

| # | Category | Severity | Location | Description | Classification |
|---|----------|----------|----------|-------------|----------------|
| P8-1 | Layout | CRITICAL | Desktop section | Desktop content has NO background container panel - floats on sky blue background. 002 wireframes use `<rect fill="#e8d4b8" stroke="#b8a080"/>` as container | 🔴 REGENERATE |
| P8-2 | Mobile | CRITICAL | Phone frame (line 213) | Mobile frame is 360×620 instead of standard 360×700 | 🔴 REGENERATE |
| P8-3 | Mobile | CRITICAL | Screen area (line 214) | Mobile screen is 340×600 instead of standard 340×680 | 🔴 REGENERATE |
| P8-4 | Mobile | MAJOR | Status bar (line 217) | Missing status bar icons (📶 🔋) that 002 wireframes have | 🔴 REGENERATE |
| P8-5 | Text Clipping | MAJOR | Legend row 1 (lines 299-300) | FR-035 + "Severity categories" clips at right edge. x=720 + "FR-035:" + x=780 + text = ~899px (0px margin to 900px boundary) | 🔴 REGENERATE |

### Container Boundary Math

**Desktop Panel (MISSING)**:
```
Expected: <rect x="40" y="60" width="900" height="560" rx="8" fill="#e8d4b8" stroke="#b8a080"/>
Actual: No container panel - content floats on sky blue background

Other light wireframes (002:01, 002:02) have desktop container.
This wireframe is visually inconsistent.
```

**Mobile Frame (WRONG SIZE)**:
```
Current: 360×620, screen 340×600
Standard: 360×700, screen 340×680

Difference: 80px shorter than 002 wireframes
```

**Legend FR-035 (CLIPPING)**:
```
Legend width: 900px
FR-035 at x=720 + "FR-035:" (~56px) = x=776
"Severity categories" at x=780 + (~119px) = x=899

Margin: 1px - visually clips on render
```

### Comparison with 002 Wireframes

| Element | 001:02 (Current) | 002:01 (Standard) | Issue |
|---------|------------------|-------------------|-------|
| Desktop container | None | `<rect x="40" y="60" w="900" h="580" fill="#e8d4b8"/>` | Missing |
| Mobile frame | 360×620 | 360×700 | 80px short |
| Mobile screen | 340×600 | 340×680 | 80px short |
| Status icons | Missing | `📶 🔋` present | Missing |

### Summary

| Classification | Count |
|----------------|-------|
| 🔴 REGENERATE | 5 |
| 🟢 PATCHABLE | 0 |

**Verdict**: ❌ **FAIL** - 5 structural issues require regeneration

### Regeneration Requirements

1. **Add desktop background panel**:
   ```xml
   <g id="desktop-view">
     <rect x="40" y="60" width="900" height="560" rx="8" fill="#e8d4b8" stroke="#b8a080"/>
     <!-- existing content inside -->
   </g>
   ```

2. **Fix mobile frame to standard size**:
   ```xml
   <rect x="0" y="0" width="360" height="700" rx="24" fill="#c8b898" stroke="#a08860" stroke-width="2"/>
   <rect x="10" y="10" width="340" height="680" rx="16" fill="#e8d4b8"/>
   ```

3. **Add status bar icons**:
   ```xml
   <text x="310" y="28" text-anchor="end" class="text-sm">📶 🔋</text>
   ```

4. **Fix legend layout** - options:
   - Move FR-035 to row 2
   - Shorten "Severity categories" to "Severity"
   - Tighten x-spacing

5. **Preserve**: All previous fixes (green-800 contrast, 44px buttons, checkmark icons)
