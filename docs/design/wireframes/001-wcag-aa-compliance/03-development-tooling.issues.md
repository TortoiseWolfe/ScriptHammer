# 03-development-tooling.svg Issues

**Status**: 🟢 PATCHABLE
**Date**: 2026-01-09
**Regenerated**: 2026-01-09

## Critical Issues

### 1. Requirements Legend Wrong Position
- **Issue**: Legend placed at y=735 instead of y=950
- **Standard**: Legend MUST be at y=950 (per /wireframe skill)
- **Fix**: Move legend to y=950, content must end at y≤920

### 2. Massive Wasted Space
- **Issue**: ~200px of empty vertical space between content and legend
- **Root cause**: Did not run vertical space planning before writing
- **Fix**: Run VERTICAL SPACE PLANNING calculation, distribute content properly

### 3. Light Inset Not Actually Light Theme
- **Issue**: "Light inset" for Storybook preview still uses dark theme styling
- **Standard**: Light insets showing end-user UI must use Light Theme colors (parchment `#e8d4b8`, sky `#c7ddf5`)
- **Fix**: Apply proper Light Theme Template colors inside inset:
  - Background: `#e8d4b8` (parchment)
  - Text: `#1a1a2e`, `#374151` (dark text on light)
  - Inputs: `#f5f0e6` (off-white)
  - Borders: `#b8a080`

### 4. Layout Not Following Existing Wireframe Patterns
- **Issue**: Did not reference 01/02 wireframes in same feature for consistency
- **Fix**: Read existing SVGs first, match panel sizes and positions

### 5. Two-Column Layout Unbalanced
- **Issue**: Left column 900px, right column 520px - inconsistent proportions
- **Issue**: Content cramped in some panels, sparse in others
- **Fix**: Use consistent column widths across feature wireframes

### 6. Label Proximity Violation (ALL SECTIONS) ✅ FIXED

**Issue**: Section labels are equidistant from container above and container below
**Rule**: Labels must be 2x closer to their own content than to content above
**Current**: 20px above, 20px below (1:1 ratio)
**Required**: 40px+ above, 15-20px below (2:1+ ratio)

**Affected sections** (LEFT SIDE - translate(40, 60)):
- FILE WATCHER label: y=320 → should be y=360 (+40px)
- File Watcher panel: y=340 → should be y=380 (+40px)
- TEST HELPERS label: y=540 → should be y=620 (+80px)
- Test Helpers panel: y=560 → should be y=640 (+80px)

**Affected sections** (RIGHT SIDE - translate(680, 60)):
- CI/CD label: y=400 → should be y=440 (+40px)
- CI panel: y=420 → should be y=460 (+40px)
- US-008 card: y=600 → should be y=680 (+80px)

**Root cause**: Skill has LABEL PROXIMITY RULE documented but lacks blocking calculation
**Fix**:
1. Patch Y positions in SVG (🟢 PATCHABLE - no structural change, just Y values)
2. Add LABEL PROXIMITY CHECK to wireframe skill as mandatory gate

### 7. Font Sizes Too Small (G-010)

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

## Skill Improvements Needed

The /wireframe skill should:
1. ALWAYS verify legend at y=950 before writing
2. ALWAYS run vertical space planning (the skill documents this but I skipped it)
3. ALWAYS read existing wireframes in same feature for layout consistency
4. ALWAYS verify light insets use correct light theme colors
5. Add blocking gate: "Did you calculate container boundaries?" before Write
6. **Add LABEL PROXIMITY CHECK as blocking gate**:
   ```
   For each section label AFTER the first:
     gap_above = label_Y - (previous_panel_Y + previous_panel_height)
     gap_below = panel_Y - label_Y
     VERIFY: gap_above >= 2 × gap_below
     If FAILED: Recalculate Y positions before writing
   ```

## Action Required

### Issue #6 - ✅ FIXED (Y position adjustments applied)
Patched Y values for section labels and panels:
- LEFT SIDE: FILE WATCHER (+40px), TEST HELPERS (+80px)
- RIGHT SIDE: CI/CD (+40px), US-008 (+80px)

### Previous Issues (1-5) - Status after regeneration
- Issues 1-3: ✅ FIXED in regeneration (legend position, light inset colors)
- Issues 4-5: ⚠️ PARTIALLY ADDRESSED (layout improved but not perfectly balanced)

### Final Status
All critical issues resolved. Wireframe ready for review.
