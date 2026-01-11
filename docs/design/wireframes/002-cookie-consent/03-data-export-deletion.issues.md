# Issues: 03-data-export-deletion.svg

**Status**: 🔴 DELETE (consolidate into 02)
**Reviewed**: 2026-01-10 (G-014: redundant wireframe)

---

## v2 Decision (2026-01-10) - CONSOLIDATE

### G-014: This wireframe is redundant

**Decision**: DELETE this SVG. Consolidate export/delete content into 02-privacy-settings-page.svg.

**Reason**:
- Export/Delete buttons belong on the Settings page (02)
- This wireframe uses filler sections ("User Stories Covered", "Key Requirements", "Acceptance Criteria") to pad space
- Same UI as 02, just different buttons

**Action**:
1. Add Export/Delete section to 02-privacy-settings-page.svg
2. Delete 03-data-export-deletion.svg
3. Update index.html navigation

---

## Previous Issues (for reference when consolidating)

### Issue 11: G-012 "Key Requirements" Duplicates Legend

**Classification**: 🔴 REGENERATE

**Location**: Lines 260-291 "Key Requirements" section

**Problem**: "Key Requirements" section lists FR-016, FR-017, FR-018, SC-005 with descriptions. This DUPLICATES the REQUIREMENTS KEY legend at y=950.

**Rule**: FR/SC codes appear in exactly TWO places:
1. **INLINE** - as annotations on the UI elements they reference
2. **REQUIREMENTS KEY legend** (y=950) - provides definitions

**Fix**: Remove "Key Requirements" section. Move FR/SC tags to inline positions on Export/Delete flow elements.

---

### Issue 12: G-013 "Acceptance Criteria" Wrong Terminology

**Classification**: 🔴 REGENERATE

**Location**: Lines 293-306 "Acceptance Criteria" section

**Problem**: Section labeled "Acceptance Criteria" but contains descriptions that should be Success Criteria. Wrong terminology.

**Rule**:
- **Success Criteria (SC)** = Measurable outcomes from spec.md
- **Acceptance Scenarios** = BDD Given/When/Then from User Stories (belong in US cards)

**Fix**: Remove "Acceptance Criteria" section entirely. SC codes already in legend.

---

## v1 Fixes (2026-01-10)

### ✅ Issue 7: G-010 Font Sizes - FIXED

**Fix applied**: Changed `.legend-text` from 13px to 14px in CSS `<style>` block.

**Classification**: 🟢 PATCHABLE → ✅ FIXED

---

## CONSISTENCY ISSUES (2026-01-10) - 🟢 PATCHABLE REQUIRED

### Issue 8: Inline FR Tags Missing Blue Pill Badge Pattern

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags in the content area use plain text styling instead of the blue pill badge pattern used in 01-consent-modal-flow.svg.

**Current (WRONG):**
```xml
<text class="tag-base fr-tag">FR-016</text>
```

**Expected (per 01-consent-modal-flow.svg lines 91-96):**
```xml
<rect class="annotation-bg"/>
<a href="...#functional-requirements" target="_blank">
  <g><rect width="60" height="20" rx="4" fill="#2563eb"/>
  <text fill="#fff" font-size="11">FR-016</text></g>
</a>
<text class="text-muted">Data export (Right of Access)</text>
```

**Affected inline tags**: FR-016, FR-017, FR-018, SC-005

---

### Issue 9: Inline FR Tags Missing Clickable Links

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags are NOT wrapped in `<a href>` links. Only legend has clickable links.

**Evidence**: Lines 102, 105, 137, 167 have bare `<text>` elements without `<a>` wrapper.

---

### Issue 10: Inline FR Tags Missing Descriptions

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags show only the code (e.g., "FR-016") without the short description that follows in 01's pattern.

**Expected pattern**:
- FR-016: Data export (Right of Access)
- FR-017: Data deletion (Right to Erasure)
- FR-018: Export all local data
- SC-005: Export <5 seconds

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

## Issue 2: "Acceptance Criteria" Wrong Terminology

**Classification**: 🟢 PATCHABLE

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

**Classification**: 🟢 PATCHABLE

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

## Issue 7: Font Sizes Too Small (G-010)

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
| Wrong "Acceptance Criteria" term | Content | 🟢 PATCHABLE |
| User Stories in wrong wireframe | Content | 🟢 PATCHABLE |
| G-002 Logo placeholder | Icon | 🟡 CHECK |
| Mobile icons unverified | Icon | 🟡 CHECK |
| Label proximity | Layout | 🟡 CHECK |
| Font sizes too small (G-010) | Style | ✅ FIXED (v1) |
| **Inline tags missing pill badge** | Consistency | 🟢 PATCHABLE |
| **Inline tags missing `<a href>`** | Consistency | 🟢 PATCHABLE |
| **Inline tags missing descriptions** | Consistency | 🟢 PATCHABLE |

**Status**: 🔴 REGENERATION REQUIRED for consistency with 01-consent-modal-flow.svg

**Reference**: See 01-consent-modal-flow.svg lines 91-96, 106-111, 130-135 for correct inline tag pattern.

**Additional fixes during regeneration**:
- Remove User Stories section (per skill rule: US only in wireframe 01)
- Use "Success Criteria" not "Acceptance Criteria" terminology
