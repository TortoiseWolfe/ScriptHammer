# Issues: 02-privacy-settings-page.svg

**Status**: 🔴 REGENERATE (consolidate 03 into this)
**Reviewed**: 2026-01-10 (G-014: must integrate export/delete from 03)

---

## v6 Decision (2026-01-10) - CONSOLIDATE

### G-014: Integrate 03 content into this wireframe

**Decision**: This SVG must include Export/Delete functionality from 03-data-export-deletion.svg.

**Content to add**:
- "Your Data Rights" section with Export/Delete buttons (FR-016, FR-017, FR-018)
- SC-005 (export <5 seconds) annotation
- Mobile view showing export/delete buttons

**Content to NOT add** (was filler in 03):
- ❌ "User Stories Covered" section (belongs in 01 only)
- ❌ "Key Requirements" summary (G-012 - duplicates legend)
- ❌ "Acceptance Criteria" section (G-013 - wrong terminology)

**After regeneration**: Delete 03-data-export-deletion.svg

---

---

## v6 Issues (2026-01-10) - CURRENT

### Issue 23: FR-014 Annotation Lacks Clarity

**Classification**: 🟢 PATCHABLE

**Problem**: "Re-prompt on update" is ambiguous. Update of WHAT?

On this page showing "Your preferences saved: [timestamp]", it reads like saving preferences triggers a re-prompt - which makes no sense.

**Spec says**: FR-014 "System MUST re-prompt users when consent **POLICY** is updated"

**Two different "updates" exist**:
1. **User saves preferences** → FR-015 timestamp (what the settings page shows)
2. **Site updates cookie policy** → FR-014 re-prompt (triggers consent modal)

**Current annotation**: "FR-014: Re-prompt on update" - WRONG (ambiguous)

**Should say**: "FR-014: Re-prompt on policy change" or "FR-014: Modal shown when site policy version changes"

**Root cause**: Wireframes should provide CLARITY on requirements. This annotation creates confusion by using vague "update" without specifying WHAT is updated (policy version, not user settings).

**Pattern**: Wireframe annotations must be verbose enough to be self-explanatory without reading the spec.

---

## v5 Fixes (2026-01-10)

### ✅ Issue 19: Ambiguous Timestamp Text - FIXED

**Problem**: "Last updated: Today at 10:30 AM" - Updated WHAT? No context.

**Spec Reference**: FR-015 "record timestamp of consent for audit purposes"

**Fix applied**: Changed to "Your preferences saved: Jan 10, 2026 at 10:30 AM"

---

### ✅ Issue 20: FR-014 Misaligned with Annotation Column - FIXED

**Problem**: FR-014 was floating separately, not aligned with FR-016/FR-017/SC-004 column.

**Fix applied**: Moved FR-014 into data-rights group at translate(300, 150), aligning x-position with other annotations.

---

### ✅ Issue 21: SC-004 Position - FIXED

**Problem**: SC-004 was orphaned, not in annotation column.

**Fix applied**: Moved to translate(300, 185) within data-rights, below FR-014.

---

### ✅ Issue 22: Account Nav Overlay Position - FIXED

**Problem**: Nav overlay at x=810 covered "Docs" instead of "Account".

**Spec Reference**: Standard nav positions (Home=600, Features=680, Docs=780, Account=860)

**Fix applied**: Changed translate from (810, 73) to (860, 73).

---

## v4 Fixes (2026-01-10) - PARTIAL

### ⚠️ Issue 17: FR-014 Outside Desktop Viewport - PARTIALLY FIXED

**Fix attempted**: Moved settings metadata from y=740 to y=700.

**Result**: Still had alignment issues - needed structural move to annotation column.

### ✅ Issue 18: Account Nav Overlay Wrong Position - FIXED

**Fix applied**: Changed translate from (810, 73) to (860, 73) per standard nav positions.

---

## v4 Issues (2026-01-10) - ✅ ALL FIXED

### Issue 17: FR-014 Still Outside Desktop Viewport

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v4

**Problem**: FR-014 annotation renders OUTSIDE the desktop viewport container (on blue background, not parchment).

**Evidence**: Screenshot shows FR-014 "Re-prompt on update" below the rounded corner of the desktop viewport boundary.

**Root Cause**: Settings metadata at y=740 + viewport starts at y=60 = absolute y=800. Desktop viewport height=768, so bottom edge is y=828. But the VISUAL bottom of the content area is much higher due to rounded corners and padding.

**Calculation**:
- Desktop viewport: y=60, height=768 → bottom at y=828
- Settings metadata group: translate(75, 740)
- FR-014 at y=-18 relative → absolute y=722 within viewport → canvas y=782
- BUT: Content should end ~50px above viewport bottom for visual padding
- Safe content end: y ≤ 700 (within viewport group)

**Fix**: Moved settings metadata group from y=740 to y=700.

**Pattern**: G-011 - Annotations placed at container edge instead of inside safe content zone

---

### Issue 18: Account Nav Overlay Wrong Position

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v4

**Problem**: Active nav overlay at x=810 covered "Docs" instead of "Account".

**Fix applied**: Changed translate from (810, 73) to (860, 73) per standard nav positions.

---

## v3 Fixes (2026-01-10) - PARTIAL

### ⚠️ Issue 13: FR-014 Out of Container - NOT FULLY FIXED

**Fix attempted**: Moved settings metadata from y=780 to y=740.

**Result**: Still outside viewport - need to move higher or restructure.

### ✅ Issue 14: Wasted Desktop Space - FIXED

**Fix applied**: Moved "Your Data Rights" section from y=570 to y=550, improving vertical distribution.

### ✅ Issue 15: SC-004 Floating Orphaned - FIXED

**Fix applied**: Repositioned SC-004 annotation to translate(300, 60) within data-rights group, placing it adjacent to the Export/Delete buttons it references.

### Issue 16: Design Intent - RESOLVED

**Resolution**: Treating as full page design (current implementation is correct for Account settings context).

---

## v2 Issues (2026-01-10) - POST-REGENERATION - ✅ ALL FIXED IN v3

### Issue 13: FR-014 Out of Container

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v3

**Problem**: FR-014 annotation is positioned outside its logical container, breaking visual hierarchy.

**Evidence**: Settings metadata at `transform="translate(75, 780)"` with FR-014 annotation at relative y=-18, placing it awkwardly near viewport bottom.

**Root Cause**: Poor vertical space planning - content crammed at bottom of viewport instead of distributed evenly.

---

### Issue 14: Wasted Desktop Space / Poor Layout

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v3

**Problem**: Desktop layout has excessive wasted space. Content appears sparse and poorly organized rather than utilizing the full 1366×768 viewport effectively.

**Evidence**:
- Cookie toggles section is narrow (600px) leaving empty space to the right
- Large gaps between sections
- Overall layout feels like a modal jammed into a page, not a properly designed settings page

**Question**: Should this be shown AS A PAGE (full viewport content) or AS A MODAL overlay on a page background?

---

### Issue 15: SC-004 Floating Orphaned

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v3

**Problem**: SC-004 annotation ("2 clicks from any") is floating in space at x=550 within the data-rights group, disconnected from the UI elements it references.

**Evidence**: SC-004 positioned at x=550 while Export/Delete buttons are at x=0-280, creating a visual disconnect.

**Fix**: Either:
- Position SC-004 closer to the buttons with a visual connector
- Or integrate it into a summary annotation block with other SCs

---

### Issue 16: Design Intent Unclear - Page vs Modal

**Classification**: 🟡 CLARIFY → ✅ RESOLVED in v3

**Problem**: The current design shows content that looks like a modal (centered, constrained width) but rendered as a full page. This creates an identity crisis.

**Resolution**: Treating as full page within Account settings context (current implementation is correct).

---

## v1 Fixes (2026-01-10)

### ✅ Issue 9: G-010 Font Sizes - FIXED

**Fix applied**: Changed `.legend-text` from 13px to 14px in CSS `<style>` block.

**Note**: `.us-narrative` and `.us-tag` classes are defined but unused in this SVG (no user story cards on settings page).

**Classification**: 🟢 PATCHABLE → ✅ FIXED

---

## CONSISTENCY ISSUES (2026-01-10) - 🟢 PATCHABLE REQUIRED

### Issue 10: Inline FR Tags Missing Blue Pill Badge Pattern

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags in the content area use plain text styling instead of the blue pill badge pattern used in 01-consent-modal-flow.svg.

**Current (WRONG):**
```xml
<text class="tag-base fr-tag">FR-010</text>
```

**Expected (per 01-consent-modal-flow.svg lines 91-96):**
```xml
<rect class="annotation-bg"/>
<a href="...#functional-requirements" target="_blank">
  <g><rect width="60" height="20" rx="4" fill="#2563eb"/>
  <text fill="#fff" font-size="11">FR-010</text></g>
</a>
<text class="text-muted">Privacy settings page</text>
```

**Affected inline tags**: FR-010, FR-012, FR-016, FR-017, FR-014

---

### Issue 11: Inline FR Tags Missing Clickable Links

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags are NOT wrapped in `<a href>` links. Only legend has clickable links.

**Evidence**: Lines 106, 119, 192, 214, 231 have bare `<text>` elements without `<a>` wrapper.

---

### Issue 12: Inline FR Tags Missing Descriptions

**Classification**: 🟢 PATCHABLE

**Problem**: Inline FR tags show only the code (e.g., "FR-010") without the short description that follows in 01's pattern.

**Expected pattern**:
- FR-010: Privacy settings page
- FR-012: Immediate effect
- FR-016: Data export
- FR-017: Data deletion
- FR-014: Re-prompt on update

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

### v2 Issues (Current - Regenerated File)

| Issue | Type | Classification |
|-------|------|----------------|
| **FR-014 out of container** | Layout | 🟢 PATCHABLE |
| **Wasted desktop space** | Layout | 🟢 PATCHABLE |
| **SC-004 floating orphaned** | Layout | 🟢 PATCHABLE |
| **Page vs Modal unclear** | Design | 🟡 CLARIFY |

### v1 Issues (Original File - Now .reference.svg)

| Issue | Type | Classification |
|-------|------|----------------|
| Not using include templates | Structure | ✅ FIXED (v2) |
| SC documentation inconsistent | Content | 🟢 PATCHABLE |
| G-002 Logo placeholder | Icon | 🟡 CHECK |
| Wasted vertical space | Layout | 🟢 PATCHABLE |
| Mobile icons unverified | Icon | 🟡 CHECK |
| Inconsistent badge colors | Style | 🟡 CHECK |
| Label proximity | Layout | 🟡 CHECK |
| Mobile SC-004 orphaned | Content | 🟢 PATCH |
| Font sizes too small (G-010) | Style | ✅ FIXED (v1) |
| **Inline tags missing pill badge** | Consistency | ✅ FIXED (v2) |
| **Inline tags missing `<a href>`** | Consistency | ✅ FIXED (v2) |
| **Inline tags missing descriptions** | Consistency | ✅ FIXED (v2) |

**Status**: 🟢 PATCHABLE - v2 fixed consistency issues, layout issues are patchable

**Key Question**: Is privacy settings supposed to be a FULL PAGE, a MODAL, or a PANEL within account settings?
