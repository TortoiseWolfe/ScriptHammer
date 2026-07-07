# Visual Consistency Audit Report

**Date:** 2026-01-16
**Role:** UI Designer
**Scope:** All 45 wireframes
**Focus:** G-044, G-047, Signature Alignment

---

## Executive Summary

QC review identified three recurring visual consistency issues affecting all 45 wireframes. All issues are **PATCH-level** fixes requiring no architectural decisions or RFCs.

| Issue Code | Description                        | Affected Files | Fix Type |
| ---------- | ---------------------------------- | -------------- | -------- |
| G-044      | Footer/nav missing rounded corners | 45 SVGs        | PATCH    |
| G-047      | Annotation bottom row inconsistent | 45 SVGs        | PATCH    |
| SIGNATURE  | Centered instead of left-aligned   | 18 SVGs        | PATCH    |

---

## Issue #1: G-044 - Footer/Nav Rounded Corners

### Problem

Footer and mobile bottom nav containers have square corners (`rx="0"` or no `rx` attribute) instead of rounded corners.

### Visual Standard

| Element                     | Required | Current             |
| --------------------------- | -------- | ------------------- |
| Desktop footer container    | `rx="8"` | `rx="0"` or missing |
| Mobile bottom nav container | `rx="8"` | `rx="0"` or missing |

### Fix Template

**Desktop Footer:**

```xml
<!-- BEFORE (wrong) -->
<rect x="0" y="640" width="1280" height="80" fill="#1f2937"/>

<!-- AFTER (correct) -->
<rect x="0" y="640" width="1280" height="80" rx="8" fill="#1f2937"/>
```

**Mobile Bottom Nav:**

```xml
<!-- BEFORE (wrong) -->
<rect x="0" y="664" width="360" height="56" fill="#1f2937"/>

<!-- AFTER (correct) - Note: corners handled by path shapes for tabs -->
<rect x="0" y="664" width="360" height="56" rx="8" fill="#1f2937"/>
```

### Classification

**PATCH** - Single attribute addition per element.

---

## Issue #2: G-047 - Annotation Bottom Row Inconsistent

### Problem

The row below user stories (above signature) uses inconsistent labels and cramped spacing:

| Variation Found            | Correct Standard |
| -------------------------- | ---------------- |
| "Additional Requirements:" | "Key Concepts:"  |
| y=750 (cramped)            | y=730            |
| No gap above               | 20px gap above   |

### Visual Standard

```
y=710  └─────────────────────────────────────────────────────────┘
                              ↓ 20px gap
y=730  Key Concepts: term1 | term2 | term3 | term4 | term5
                              ↓ remaining space
y=1060 NNN:NN | Feature Name | ScriptHammer
```

### Fix Template

```xml
<!-- Key Concepts row at y=730 with proper label -->
<g transform="translate(40, 730)">
  <text font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">
    Key Concepts:
  </text>
  <text x="110" font-family="system-ui, sans-serif" font-size="14" fill="#4b5563">
    term1 | term2 | term3 | term4 | term5
  </text>
</g>
```

### Affected Wireframes (Sample from Batch 006)

| Wireframe                    | Current Label            | Current y |
| ---------------------------- | ------------------------ | --------- |
| 004-01 responsive-navigation | Key Concepts:            | cramped   |
| 004-02 touch-targets         | Key Concepts:            | cramped   |
| 012-01 user-onboarding       | Additional Requirements: | cramped   |
| 019-01 consent-flow          | Key Concepts:            | cramped   |
| 019-02 analytics-dashboard   | Key Concepts:            | cramped   |

### Classification

**PATCH** - Text/coordinate edit.

---

## Issue #3: Signature Alignment

### Problem

18 wireframes have centered signatures instead of left-aligned.

### Visual Standard

| Property    | Wrong                  | Correct          |
| ----------- | ---------------------- | ---------------- |
| x position  | `x="960"`              | `x="40"`         |
| text-anchor | `text-anchor="middle"` | (remove or omit) |
| alignment   | Centered               | Left-aligned     |

### Fix Template

```xml
<!-- BEFORE (wrong) -->
<text x="960" y="1060" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature | ScriptHammer</text>

<!-- AFTER (correct) -->
<text x="40" y="1060" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature | ScriptHammer</text>
```

### Affected Files (18 total)

| Feature                      | Files      |
| ---------------------------- | ---------- |
| 003-user-authentication      | 01, 02, 03 |
| 007-e2e-testing-framework    | 02         |
| 008-on-the-account           | 01         |
| 010-unified-blog-content     | 01, 02     |
| 011-group-chats              | 01, 02     |
| 014-admin-welcome-email-gate | 01, 02     |
| 016-messaging-critical-fixes | 01, 02, 03 |
| 021-geolocation-map          | 01, 02     |
| 022-web3forms-integration    | 01, 02     |

### Classification

**PATCH** - Attribute edit.

---

## RFC Consideration

**Verdict: No RFC Required**

All three issues have clearly documented standards in GENERAL_ISSUES.md:

| Issue     | Standard Reference                | Documented? |
| --------- | --------------------------------- | ----------- |
| G-044     | GENERAL_ISSUES.md line 49         | Yes         |
| G-047     | GENERAL_ISSUES.md lines 1033-1094 | Yes         |
| Signature | GENERAL_ISSUES.md G-025, G-043    | Yes         |

These are implementation deviations from existing standards, not gaps requiring new decisions.

---

## Color Palette Verification

Confirmed correct palette usage in standards:

| Element          | Color     | Status     |
| ---------------- | --------- | ---------- |
| Panel background | `#e8d4b8` | Documented |
| Secondary panel  | `#dcc8a8` | Documented |
| Input fields     | `#f5f0e6` | Documented |
| Primary button   | `#8b5cf6` | Documented |
| Toggle OFF       | `#6b7280` | Documented |
| Toggle ON        | `#22c55e` | Documented |

No color standard changes needed.

---

## Typography Verification

Confirmed correct typography in standards:

| Element            | Size | Weight  | Status     |
| ------------------ | ---- | ------- | ---------- |
| Body text          | 14px | Regular | Documented |
| Annotation titles  | 16px | Bold    | Documented |
| Signature          | 18px | Bold    | Documented |
| Key Concepts label | 14px | Bold    | Documented |

No typography standard changes needed.

---

## Recommendations

### Immediate Actions (PATCH Queue)

1. **G-044**: Add `rx="8"` to footer/nav containers in all 45 SVGs
2. **G-047**: Standardize "Key Concepts:" label at y=730 with 20px gaps
3. **SIGNATURE**: Change x=960 to x=40, remove text-anchor in 18 SVGs

### Process Improvement

1. Update `/wireframe` skill template to include `rx="8"` on footer/nav by default
2. Add G-047 to pre-generation checklist
3. Consider sed/awk batch script for signature fixes (simple regex pattern)

---

## Batch Fix Commands (For Toolsmith)

```bash
# Signature alignment fix (18 files)
# Pattern: x="960" text-anchor="middle" → x="40"
sed -i 's/x="960" y="1060" text-anchor="middle"/x="40" y="1060"/g' *.svg

# Footer rx fix (all files with footer rects)
# Pattern: Add rx="8" to footer container rects
# Note: Requires context-aware editing, not simple sed
```

---

## Sign-off

**Visual Standards Compliance**: Standards are complete and well-documented.
**RFC Status**: Not required.
**Recommended Action**: Queue all three issues for PATCH processing.

---

_Report filed by UI Designer terminal. Forwarded to Architect per reporting structure._
