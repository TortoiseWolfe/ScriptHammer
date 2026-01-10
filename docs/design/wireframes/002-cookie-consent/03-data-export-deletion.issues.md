# Issues: 03-data-export-deletion.svg

**Status**: 🔴 REGENERATE
**Reviewed**: 2026-01-09 (updated)

---

## Issue 1: Not Using Include Templates

**Classification**: 🔴 REGENERATE

**Problem**: Desktop and mobile headers/footers were manually written instead of using the shared include templates.

**Evidence**:
- Desktop header manually constructed
- Mobile header manually constructed
- Mobile bottom nav manually constructed
- Should use `<use href="../includes/header-desktop.svg#desktop-header">`
- Should use `<use href="../includes/header-mobile.svg#mobile-header-group">`
- Should use `<use href="../includes/footer-mobile.svg#mobile-bottom-nav">`

**Root Cause**: Ignored /wireframe skill's "Include Files (Build-Time Injection)" section.

**Fix**: Regenerate using proper `<use href>` includes with build-time injection.

---

## Issue 2: "Acceptance Criteria" Wrong Terminology

**Classification**: 🔴 REGENERATE

**Problem**: Used "Acceptance Criteria" instead of Success Criteria (SC codes). These are different concepts:
- SC codes = measurable outcomes from spec.md
- Acceptance Criteria = validation steps from user stories

**Evidence**:
- Section labeled "Acceptance Criteria" at line ~285
- Should reference SC codes not acceptance scenarios
- SC-005 is the only SC for this wireframe

**Root Cause**: Confused spec.md terminology. SC codes are Success Criteria, not Acceptance Criteria.

**Fix**: Use SC codes. If acceptance scenarios from user stories need to appear, they should be part of USER STORIES cards (wireframe 01 only), not separate sections.

---

## Issue 3: "User Stories Covered" Section Redundant

**Classification**: 🔴 REGENERATE

**Problem**: Wireframe 03 includes a "User Stories Covered" section. Per /wireframe skill:
> "USER STORIES section appears **only in wireframe 01** (first/overview wireframe per feature)"

**Evidence**:
- US-005 and US-006 cards appear in this wireframe
- Should only be in 01-consent-modal-flow.svg

**Root Cause**: Didn't follow the USER STORIES rule that limits full narratives to wireframe 01.

**Fix**: Remove User Stories section from this wireframe. US content lives ONLY in wireframe 01.

---

## Issue 4: G-002 Logo Placeholder

**Classification**: 🟡 CHECK

**Problem**: ScriptHammer logo appears to be a placeholder rectangle instead of actual logo path element.

**Evidence**:
- Desktop header shows filled rectangle where logo should be
- Should use exact `<path>` element from include files

**Fix**: Verify logo is using proper SVG path, not placeholder.

---

## Issue 5: Mobile Icons Unverified

**Classification**: 🟡 CHECK

**Problem**: Bottom nav icons (Home, Features, Docs, Account) may be placeholders rather than proper path elements.

**Evidence**:
- Mobile bottom navigation has icon-like shapes
- Need to verify these are actual SVG paths from includes, not rectangles/placeholders

**Fix**: Verify icons use proper `<path>` elements from include files.

---

## Issue 6: Label Proximity

**Classification**: 🟡 CHECK

**Problem**: Section labels need verification of 2:1 gap ratio (more space above than below).

**Evidence**:
- "Data Export Flow" and "Data Deletion Flow" section labels
- "User Stories Covered", "Key Requirements", "Acceptance Criteria" labels
- Required: gap_above >= 2 × gap_below

**Fix**: Verify during regeneration that label proximity rule is followed.

---

## Summary

| Issue | Type | Classification |
|-------|------|----------------|
| Not using include templates | Structure | 🔴 REGENERATE |
| Wrong "Acceptance Criteria" term | Content | 🔴 REGENERATE |
| User Stories in wrong wireframe | Content | 🔴 REGENERATE |
| G-002 Logo placeholder | Icon | 🟡 CHECK |
| Mobile icons unverified | Icon | 🟡 CHECK |
| Label proximity | Layout | 🟡 CHECK |

**Action Required**: 3 structural issues require regeneration; 3 items need verification.
