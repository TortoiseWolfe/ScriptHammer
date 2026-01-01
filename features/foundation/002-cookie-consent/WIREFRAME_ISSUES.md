# Wireframe Issues: 002-cookie-consent

## Summary
- **Files reviewed**: 2 SVGs
- **Pass**: 2 (regenerated)
- **Reviewed on**: 2026-01-01
- **Issues from Pass 2**: 11
- **Regenerated**: 2 files
- **Total remaining**: 0 (pending verification)

## Review History

| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 3 | - | 3 | 3 |
| 2 | 2026-01-01 | 11 | 0 | 8 | 11 |
| 2.1 | 2026-01-01 | - | 11 (regen) | 0 | 0* |

*Pending Pass 3 verification

---

## Spec Requirements Extracted

### Functional Requirements (24 total)
- **FR-001**: Display consent modal on first visit before non-essential cookies
- **FR-002**: Provide "Accept All", "Reject All", "Manage Preferences" options
- **FR-003**: Block all non-essential cookies until explicit consent
- **FR-004**: No dark patterns (equal button styling)
- **FR-005**: Categorize cookies: Necessary, Functional, Analytics, Marketing
- **FR-006**: Allow granular enable/disable for non-necessary categories
- **FR-007**: Provide clear descriptions for each category
- **FR-008**: Necessary cookies cannot be disabled
- **FR-009**: Persist consent preferences across sessions
- **FR-010**: Provide accessible privacy settings page
- **FR-011**: Include persistent link in footer/settings menu
- **FR-012**: Allow preferences to be changed anytime with immediate effect
- **FR-013**: Track consent version for policy changes
- **FR-014**: Re-prompt users when consent policy is updated
- **FR-015**: Record timestamp of consent for audit
- **FR-016**: Provide data export functionality (GDPR Right of Access)
- **FR-017**: Provide data deletion request functionality (GDPR Right to Erasure)
- **FR-018**: Data export includes all locally stored user data
- **FR-019**: Conditionally load analytics based on consent
- **FR-020**: Update third-party consent states when preferences change
- **FR-021**: Not impact page performance when checking consent
- **FR-022**: Consent modal keyboard navigable
- **FR-023**: Consent modal screen reader compatible
- **FR-024**: Focus trapped within modal while open

### Success Criteria (8 total)
- **SC-001**: Modal appears within 500ms of first page load
- **SC-002**: 100% non-essential cookies blocked until consent
- **SC-003**: Preferences persist with zero data loss
- **SC-004**: Privacy settings accessible within 2 clicks
- **SC-005**: Data export completes within 5 seconds
- **SC-006**: WCAG AA accessibility audit pass
- **SC-007**: Consent mechanism adds <50ms to page load
- **SC-008**: Handle consent version changes without data corruption

---

## Issues by File

### 01-consent-modal.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Spec Compliance | Critical | 🔴 | Pass 1 | Lines 172-177 | Mobile view missing "Manage Preferences" button - FR-002 requires 3 options | Add third button, stack all 3 vertically on mobile |
| 2 | Spec Compliance | Major | 🟢 | Pass 1 | Desktop annotations | Missing FR-001, FR-002, FR-003 annotations for modal requirements | Add annotation boxes for blocking behavior and options |
| 3 | Touch Target | Major | 🔴 | NEW Pass 2 | Lines 173, 176 | Mobile buttons height="36" fails WCAG AAA 44px minimum | Increase to height="44" |
| 4 | Spacing | Minor | 🔴 | NEW Pass 2 | Lines 172-177 | Mobile buttons have only 10px vertical gap (y=170, y=170 same row) - cramped for touch | Stack vertically with 12px gaps, use full width |
| 5 | Contrast | Major | 🟢 | NEW Pass 2 | Line 24 `.text-muted` | `#4b5563` on `#f5f0e6` = ~5.8:1 (passes AA, fails AAA 7:1) | Change to `#374151` for 7:1+ |
| 6 | Spec Compliance | Minor | 🟢 | NEW Pass 2 | Annotations | Missing FR-005 through FR-008 labels for 4 cookie categories | Add "FR-005-008" near categories section |
| 7 | Accessibility | Minor | 🔴 | NEW Pass 2 | Mobile modal | No visible focus indicator or keyboard navigation hint (FR-022, FR-023, FR-024) | Add annotation showing "Tab to navigate, Space to toggle" |

**File verdict**: 🔴 REGENERATE (3 structural issues)

---

### 02-privacy-settings.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 8 | Spec Compliance | Major | 🟢 | Pass 1 | Consent History section | Missing FR-009, FR-012, FR-013-015 annotations for persistence/versioning | Add annotation box near Consent History |
| 9 | Touch Target | Major | 🔴 | NEW Pass 2 | Lines 161, 165, 169 | Quick Action buttons height="44" ✓ PASS | N/A |
| 10 | Touch Target | Major | 🔴 | NEW Pass 2 | Lines 139, 146 | Export/Delete buttons height="28" fails 44px minimum | Increase to height="44" |
| 11 | Touch Target | Major | 🔴 | NEW Pass 2 | Lines 267, 273 | Mobile Export/Delete buttons height="28" fails 44px | Increase to height="44" |
| 12 | Spacing | Minor | 🔴 | NEW Pass 2 | Desktop sidebar | Nav items at y=145,175,205 have 30px spacing but Privacy button at y=225 only has 20px gap from Settings | Normalize to 35px consistent gaps |
| 13 | Contrast | Major | 🟢 | NEW Pass 2 | Line 24 `.text-muted` | `#4b5563` on light backgrounds = ~5.8:1 (fails AAA) | Change to `#374151` |

**File verdict**: 🔴 REGENERATE (3 structural issues)

---

## 🔴 REGENERATION REQUIRED: 01-consent-modal.svg

### Diagnosis
1. Mobile view (lines 172-177) has only 2 buttons ("Accept All", "Reject All") arranged horizontally at y=170, both width=130. Missing the "Manage Preferences" button required by FR-002.
2. Mobile buttons use height="36" which fails WCAG AAA 44px touch target requirement.
3. Button arrangement is cramped - two buttons side-by-side at x=35 and x=175 with only 10px gap between them.

### Root Cause
The mobile layout tried to fit buttons horizontally to save vertical space, but this forced compromise on touch target size and omitted the third required button. Mobile should use vertical stacking for important CTAs.

### Suggested Layout
- **Mobile buttons**: Stack all 3 vertically (full width 270px, height 44px each, 12px gaps)
  - y=170: "Accept All" (44px height)
  - y=226: "Reject All" (44px height)
  - y=282: "Manage Preferences" (44px height)
- **Adjust content below**: Shift cookie categories and save button down by ~100px
- **Add FR annotations**: FR-001/FR-002 near modal trigger, FR-003/FR-004 near buttons, FR-005-008 near categories

### Spec Requirements to Preserve
- FR-001: First visit trigger
- FR-002: Three equal options (Accept All, Reject All, Manage Preferences)
- FR-003: Block non-essential until consent
- FR-004: No dark patterns - equal button styling (already shown)
- FR-005-008: 4 cookie categories with descriptions
- FR-022-024: Accessibility (keyboard nav, screen reader, focus trap)

---

## 🔴 REGENERATION REQUIRED: 02-privacy-settings.svg

### Diagnosis
1. Export Data button (line 139) height="28" and Delete Data button (line 146) height="28" both fail 44px touch target.
2. Mobile versions (lines 267, 273) also use height="28" for the same buttons.
3. Desktop sidebar nav items have inconsistent vertical spacing: 30px between Dashboard/Profile/Settings but only 20px gap before Privacy button.

### Root Cause
The GDPR data rights buttons were sized for visual compactness rather than touch accessibility. The layout didn't account for WCAG AAA touch requirements.

### Suggested Layout
- **Data rights buttons**: Increase to height="44" on both desktop and mobile
- **Adjust GDPR section height**: Increase section box from height="90" to height="106" to accommodate taller buttons
- **Sidebar spacing**: Normalize all nav item gaps to 35px
- **Add FR annotations**:
  - Near Consent History: "FR-009, FR-012-015" for persistence and versioning
  - The FR-016-018 annotation is already present for GDPR rights (line 153)

### Spec Requirements to Preserve
- FR-009: Preference persistence
- FR-010: Accessible privacy settings page
- FR-011: Footer link to privacy settings (shown)
- FR-012: Change preferences anytime
- FR-013-015: Consent versioning
- FR-016-018: GDPR data rights (already annotated)
- SC-004: Privacy settings within 2 clicks
- SC-005: Data export within 5 seconds

---

## Summary Statistics

| Classification | Count | Files Affected |
|----------------|-------|----------------|
| 🟢 PATCHABLE | 5 | Both files have patchable issues, but they'll be fixed in regeneration |
| 🔴 REGENERATE | 6 | 01, 02 |

**Note**: Since both files require regeneration, the patchable issues will be addressed during regeneration.

---

## CSS Fixes to Apply (during regeneration)

```css
/* AAA Contrast fix */
.text-muted { fill: #374151; }  /* was #4b5563 - now 7:1+ ratio */
```

---

## Regeneration Complete (Pass 2.1)

Both files were regenerated with all feedback incorporated:

### 01-consent-modal.svg - REGENERATED
- ✅ Added "Manage Preferences" button to mobile (3 buttons total)
- ✅ Stacked all 3 mobile buttons vertically at 44px height with 12px gaps
- ✅ Added FR-001/FR-002/FR-003 annotation box near modal header
- ✅ Added FR-004 annotation box near buttons (no dark patterns)
- ✅ Added FR-005-008 annotation box near categories
- ✅ Fixed `.text-muted` contrast to `#374151` (AAA compliant)
- ✅ Added accessibility hint text (FR-022-024)

### 02-privacy-settings.svg - REGENERATED
- ✅ Increased Export/Delete button heights to 44px (desktop and mobile)
- ✅ Normalized sidebar nav spacing (35px gaps)
- ✅ Added FR-009/FR-012-015 annotation box for persistence/versioning
- ✅ Fixed `.text-muted` contrast to `#374151` (AAA compliant)
- ✅ Added SC-004 and SC-005 references in info boxes

## Next Step

Run `/wireframe-review 002-cookie-consent` for Pass 3 verification.

After verification passes, clean up reference files:
```bash
rm docs/design/wireframes/002-cookie-consent/*.reference.svg
```
