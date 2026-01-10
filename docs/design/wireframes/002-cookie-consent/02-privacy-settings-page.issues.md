# Issues: 02-privacy-settings-page.svg

**Status**: 🟢 PATCHABLE
**Reviewed**: 2026-01-09 (updated)

---

## Issue 1: Not Using Include Templates

**Classification**: 🟢 PATCHABLE

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

## Issue 2: Success Criteria Inconsistent Documentation

**Classification**: 🟢 PATCHABLE

**Problem**: SC codes in wireframe don't align with proper documentation pattern. Some SC codes have elaboration inline, some in legend, terminology inconsistent.

**Evidence**:
- SC-003, SC-004, SC-007, SC-008 appear in legend
- Inline descriptions use different wording
- No clear hierarchy of where SC elaboration lives

**Root Cause**: Didn't follow /wireframe skill's Requirements Legend Panel specification.

**Fix**: Requirements Key is THE single source of truth for all SC elaboration.

---

## Issue 3: G-002 Logo Placeholder

**Classification**: 🟡 CHECK

**Problem**: ScriptHammer logo appears to be a placeholder rectangle instead of actual logo path element.

**Evidence**:
- Desktop header shows filled rectangle where logo should be
- Should use exact `<path>` element from include files

**Fix**: Verify logo is using proper SVG path, not placeholder.

---

## Issue 4: Wasted Vertical Space

**Classification**: 🟢 PATCHABLE

**Problem**: ~150px empty gap between footer (y~600) and REQUIREMENTS KEY (y~700).

**Evidence**:
- Large empty area between page content and requirements legend
- Content could be distributed more evenly

**Root Cause**: G-003 pattern - cramped layouts with wasted space elsewhere.

**Fix**: Redistribute vertical space during regeneration.

---

## Issue 5: Mobile Icons Unverified

**Classification**: 🟡 CHECK

**Problem**: Bottom nav icons (Home, Features, Docs, Account) may be placeholders rather than proper path elements.

**Evidence**:
- Mobile bottom navigation has icon-like shapes
- Need to verify these are actual SVG paths from includes, not rectangles/placeholders

**Fix**: Verify icons use proper `<path>` elements from include files.

---

## Issue 6: Inconsistent Badge Colors

**Classification**: 🟡 CHECK

**Problem**: FR badges are purple, SC badges are green - verify if this color distinction is intentional and consistent with other wireframes.

**Evidence**:
- FR-010, FR-012, etc. shown in purple
- SC-004, SC-005, etc. shown in green

**Fix**: Verify color scheme matches established pattern across wireframes.

---

## Issue 7: Label Proximity

**Classification**: 🟡 CHECK

**Problem**: Section labels ("Cookie Preferences", "Your Data Rights") need verification of 2:1 gap ratio (more space above than below).

**Evidence**:
- Need to measure gap_above vs gap_below for each section label
- Required: gap_above >= 2 × gap_below

**Fix**: Verify during regeneration that label proximity rule is followed.

---

## Issue 8: Mobile SC-004 Orphaned

**Classification**: 🟢 PATCH

**Problem**: "SC-004 2 clicks from any page" floats alone below buttons without clear visual association to what it references.

**Evidence**:
- SC-004 annotation appears at bottom of mobile view
- No arrow or clear connection to "Export My Data" / "Delete My Data" buttons

**Fix**: Add visual indicator connecting SC-004 to the buttons it describes.

---

## Issue 9: Font Sizes Too Small (G-010)

**Classification**: 🟢 PATCHABLE

**Location**: CSS `<style>` block

| Class | Current | Should Be |
|-------|---------|-----------|
| `.legend-text` | 13px | 14px |
| `.us-narrative` | 13px | 14px |
| `.us-title` | 13px | 14px |

**Standard**: Body text = 14px (not 13px minimum)
**Reference**: G-010 in GENERAL_ISSUES.md

---

## Summary

| Issue | Type | Classification |
|-------|------|----------------|
| Not using include templates | Structure | 🟢 PATCHABLE |
| SC documentation inconsistent | Content | 🟢 PATCHABLE |
| G-002 Logo placeholder | Icon | 🟡 CHECK |
| Wasted vertical space | Layout | 🟢 PATCHABLE |
| Mobile icons unverified | Icon | 🟡 CHECK |
| Inconsistent badge colors | Style | 🟡 CHECK |
| Label proximity | Layout | 🟡 CHECK |
| Mobile SC-004 orphaned | Content | 🟢 PATCH |
| Font sizes too small (G-010) | Style | 🟢 PATCHABLE |

**Action Required**: 3 structural issues require regeneration; 4 items need verification; 2 patchable.
