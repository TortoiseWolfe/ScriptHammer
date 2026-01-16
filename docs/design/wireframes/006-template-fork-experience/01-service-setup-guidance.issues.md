# Issues: 01-service-setup-guidance.svg

**Feature:** 006-template-fork-experience
**SVG:** 01-service-setup-guidance.svg
**Last Review:** 2026-01-15
**Validator:** v5.2

---

## Summary

| Status | Count |
|--------|-------|
| Open | 0 |

---

## Resolved Issues (2026-01-15)

### Callout Issues

| ID | Issue | Resolution |
|----|-------|------------|
| X-01 | Callout overlaps button | FIXED - callouts properly positioned |

### Inspector Issues

| Check | Issue | Resolution |
|-------|-------|------------|
| title_x_position | x=700 instead of x=960 | FIXED - title now at x=960 |

---

## Notes

- Cleaned up 2026-01-15 by Validator terminal
- Re-validation confirms 0 errors
- Run validator to refresh: `python validate-wireframe.py 006-template-fork-experience/01-service-setup-guidance.svg`

## Inspector Issues (2026-01-15)

| Check | Expected | Actual | Classification |
|-------|----------|--------|----------------|
| footer_nav_corners | desktop footer has rx="4-8" | desktop footer missing rx attribute | PATTERN_VIOLATION |
| footer_nav_corners | mobile nav has rx="4-8" | mobile nav missing rx attribute | PATTERN_VIOLATION |

## Visual Review (2026-01-15)

**Reviewer:** Validator Terminal

| Aspect | Status | Notes |
|--------|--------|-------|
| Title | ✓ PASS | Centered at top: "TEMPLATE FORK - SERVICE SETUP GUIDANCE" |
| Signature | ✓ PASS | Left-aligned, correct format: "006:01 \| Template Fork Experience \| ScriptHammer" |
| Desktop mockup | ✓ PASS | Project Dashboard with 4 service status cards + Quick Actions |
| Mobile mockup | ✓ PASS | Dashboard view with service status indicators |
| Desktop nav | ✓ PASS | "Docs" tab has annotation callout (feature appropriate) |
| Mobile nav | ✓ PASS | Standard 4-tab nav with icons |
| Annotation panel | ✓ PASS | 6 well-distributed callout groups with proper badges |

### Summary

Clean wireframe with good service status visualization. Footer corners need G-044 fix.

## WireframeQA Batch 004 Review (2026-01-15)

**PNG Source:** `overviews_004/006-template-fork-experience_01-service-setup-guidance_overview.png`
**Reviewer:** WireframeQA Terminal (Operator QC)

### New Issue Found

| ID | Issue | Classification | Priority |
|----|-------|----------------|----------|
| L-01 | Annotation panel callouts 5 and 6 cramped under 1 and 2 | PATCH | Low |

### L-01: Annotation Panel Spacing

**Current layout (cramped):**
```
Row 1: [1: Graceful Degradation] [2: Service Status] [3: Automated Rebranding] [4: Dev Environment]
Row 2: [5: Deployment Works] [6: Tests Pass] [empty space---------------] [empty space--------]
```

**Problem:**
- Callouts 5 and 6 are stacked directly below callouts 1 and 2
- Large empty space on right side of row 2 (under callouts 3 and 4)
- Creates visual imbalance and cramped appearance
- Hand-drawn blue annotation circle highlights the cramped area

**Suggested fixes (any of these would work):**

**Option A - Spread across row 2:**
```
Row 1: [1] [2] [3] [4]
Row 2: [5]----centered----[6]
```

**Option B - Move 5 and 6 to fill empty space:**
```
Row 1: [1] [2] [3] [4]
Row 2: [empty] [empty] [5] [6]
```

**Option C - Single row with smaller cards:**
```
Row 1: [1] [2] [3] [4] [5] [6]
```

**Classification:** PATCH - spacing adjustment only, no content changes needed
