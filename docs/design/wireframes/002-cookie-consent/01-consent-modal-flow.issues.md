# Issues: 01-consent-modal-flow.svg

**Status**: 🟢 PATCHABLE (v11 - 4 issues remaining)
**Reviewed**: 2026-01-09
**Regenerated**: 2026-01-09

---

## v11 Issues (2026-01-09)

### 🔴 Issue 21: FR-004 Container Still Too Small (repeat of Issue 18)

**Location**: STATE 1 modal, FR-004 annotation (line 113-117)

| Element | Position | Width | Ends At |
|---------|----------|-------|---------|
| Container rect | x=170 | 165px | x=335 |
| Badge | x=175 | 60px | x=235 |
| Text "No dark patterns" | x=245 | ~115px | x=360 |

**Problem**: Text extends 25px past container right edge (360 > 335)

**Root cause**: Container width not recalculated. Wrote "165" but didn't verify text fits.

**Classification**: 🟢 PATCHABLE

---

### 🔴 Issue 22: FR-008 Wrong Position and Smaller Size (repeat of Issue 19)

**Location**: STATE 2 modal, FR-008 annotation (line 143-148)

| Element | FR-005 | FR-008 | Problem |
|---------|--------|--------|---------|
| Y position | y=55 | y=145 | FR-008 placed after Necessary category, not after FR-005 |
| Container height | 28px | 20px | FR-008 container smaller |
| Badge height | 20px | 16px | FR-008 badge smaller |
| Font size | 11px | 9px | FR-008 text smaller |

**Problem**:
- FR-008 should be immediately after FR-005 (y=88 or same row), not y=145
- FR-008 sizing should match FR-005 (container 28px, badge 20px, font 11px)

**Root cause**: Misunderstood "aligned with FR-005" as x-position only. Should mean same row AND same sizing.

**Classification**: 🟢 PATCHABLE

---

### 🔴 Issue 23: REQUIREMENTS KEY Collides with Footer (repeat of Issue 20)

**Location**: Requirements Legend (line 365-366) and Footer (line 432)

| Element | Y Position | Height | Ends At |
|---------|------------|--------|---------|
| Legend | y=950 | 90px | y=1040 |
| Footer | y=1050 | - | - |
| Gap | - | - | 10px (too tight) |

**Standard**: Legend should end at y≤1020 to maintain 30px gap to footer at y=1050

**Problem**: With height=90, legend ends at 1040, leaving only 10px gap. Text baselines visually overlap.

**Root cause**: Reduced height from 95 to 90 but still too tall. Should use height=70 max (y=950+70=1020, gap to 1050=30px).

**Classification**: 🟢 PATCHABLE

---

### 🟢 Issue 24: Font Sizes Too Small in REQUIREMENTS KEY and USER STORIES

**Location**: CSS classes in `<style>` block (lines 33, 38, 39)

| Class | Current | Should Be | Purpose |
|-------|---------|-----------|---------|
| `.legend-text` | 13px | 14px | REQUIREMENTS KEY descriptions |
| `.us-narrative` | 13px | 14px | User Story narrative text |
| `.us-title` | 13px | 14px | User Story titles |

**Standard** (from /wireframe skill):
- Body Text = 14px Regular
- 13px is the MINIMUM, not the target

**Classification**: 🟢 PATCHABLE (font size change only)

---

## v11 Summary

| Issue | Description | Status |
|-------|-------------|--------|
| 21 | FR-004 container still too small | 🟢 PATCHABLE |
| 22 | FR-008 wrong position and smaller size | 🟢 PATCHABLE |
| 23 | REQUIREMENTS KEY collides with footer | 🟢 PATCHABLE |
| 24 | Font sizes too small (legend-text, us-narrative, us-title) | 🟢 PATCHABLE |

---

## v11 Attempted Fixes (2026-01-09) - FAILED

### ✅ Issue 18: Text Overflows Annotation Containers - FIXED

**Fix applied**: Widened annotation container rects to fit badge + gap + text + padding:
- FR-001: 185px → 210px
- FR-004: 160px → 165px
- FR-005: 140px → 170px
- SC-002: 220px → 240px
- SC-001: 200px → 210px

**Classification**: ✅ FIXED

---

### ✅ Issue 19: FR-008 Alignment - FIXED

**Fix applied**: Moved FR-008 annotation from x=165 to x=15, aligning with FR-005 badge above.

**Classification**: ✅ FIXED

---

### ✅ Issue 20: REQUIREMENTS KEY Overflow - FIXED

**Fix applied**:
- Reduced legend height from 95px to 90px
- Consolidated to 2 rows instead of 3
- Row 1: All FR codes (FR-001 through FR-024) with abbreviated descriptions
- Row 2: All SC codes (SC-001, SC-002, SC-006, SC-007)
- Better horizontal spacing to use available 1840px width

**Classification**: ✅ FIXED

---

## v11 Summary

| Issue | Description | Status |
|-------|-------------|--------|
| 18 | Text overflows annotation containers | ✅ FIXED |
| 19 | FR-008 not aligned with FR-005 | ✅ FIXED |
| 20 | REQUIREMENTS KEY overflows into footer | ✅ FIXED |

---

## v10 Issues (Screenshot Review 2026-01-09) - ✅ ALL FIXED IN v11

### 🔴 Issue 18: Text Overflows Annotation Containers

**Location**: Multiple annotation groups

| Location | Badge | Text | Problem |
|----------|-------|------|---------|
| STATE 1 | FR-004 | "No dark patterns" | Text overflows container right edge |
| STATE 2 | FR-005 | "4 categories" | Text overflows container right edge |
| STATE 3 | SC-002 | "100% blocked until consent" | Text overflows container right edge |

**Root cause**: Container width not calculated to fit badge + gap + text + padding.

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v11

---

### 🔴 Issue 19: FR-008 Alignment

**Location**: STATE 2 modal, FR-008 badge

**Problem**: FR-008 badge is not horizontally aligned with FR-005 badge above it.

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v11

---

### 🔴 Issue 20: REQUIREMENTS KEY Overflow

**Location**: REQUIREMENTS KEY at y=950

**Problem**: Legend text overflows into footer signature area (y=1050) while there's empty horizontal space on the right side that could be used.

**Classification**: 🟢 PATCHABLE → ✅ FIXED in v11

---

## v10 Summary

| Issue | Description | Status |
|-------|-------------|--------|
| 18 | Text overflows annotation containers | ✅ FIXED in v11 |
| 19 | FR-008 not aligned with FR-005 | ✅ FIXED in v11 |
| 20 | REQUIREMENTS KEY overflows into footer | ✅ FIXED in v11 |

---

## v9 Issues (from screenshot review)

**Reviewed**: 2026-01-09 by user
**User feedback**: "best version yet" - but additional issues found

### ✅ Issue 10: FR-002/FR-004 Badge Text Overlap (FIXED)

**Location**: STATE 1 modal, bottom row of FR badges (y=310 area)

**Problem**: FR-004 badge positioned too close to FR-002, causing text overlap:
- "3 equal optio**ns**" text is cut off by FR-004 badge
- The badges are cramped horizontally

**Fixed**: 2026-01-09 - Stacked badges vertically:
- FR-002 at y=305 with text at y=319
- FR-004 at y=327 with text at y=341

**Classification**: ✅ FIXED

---

### ✅ Issue 11: "No dark patterns" Text Truncation (FIXED)

**Location**: STATE 1 modal, after FR-004 badge

**Problem**: Text "No dark patterns" appears truncated at the end

**Fixed**: 2026-01-09 - Stacked vertically, text now at x=90 with full width available

**Classification**: ✅ FIXED

---

### ✅ Issue 12: REQUIREMENTS KEY Not Consistent (FIXED)

**Location**: Requirements Legend at y=950

**Problem**: REQUIREMENTS KEY styling/format is not consistent with other SVGs in the wireframe set.

**Fixed**: 2026-01-09 - Updated to match standard format:
- Header y: 22 → 18
- Content transform: translate(180, 16) → translate(20, 38)
- Rect height: 35 → 75 (two rows)
- Added second row at translate(20, 60) for SC codes
- Proper multi-line formatting with indentation

**Classification**: ✅ FIXED

---

### ✅ Issue 13: REQUIREMENTS KEY Badges Not Clickable (FIXED)

**Location**: Requirements Legend - FR-001, FR-002, FR-004, FR-005, SC-001, SC-002, SC-006 badges

**Problem**: FR and SC badges in the REQUIREMENTS KEY are plain text, not wrapped in `<a href>` links. All badges MUST be clickable per /wireframe skill rules.

**Fixed**: 2026-01-09 - All 7 badges wrapped in `<a href>` links
- FR-001, FR-002, FR-004, FR-005 → `#functional-requirements`
- SC-001, SC-002, SC-006 → `#success-criteria-mandatory`

**Classification**: ✅ FIXED

---

### ✅ Issue 14: Mobile View Missing All Tags (FIXED in v10)

**Location**: Mobile section (x=1500, y=60)

**Problem**: Mobile view shows the cookie consent modal UI but has NO FR, SC, or US tags/badges anywhere. Desktop view has extensive requirement annotations, but mobile has zero.

**Missing**:
- No FR badges on mobile modal
- No SC badges on mobile
- No US references on mobile

**Fix**: Add FR/SC badges to mobile modal section. Key badges to add:
- FR-001 (first visit modal) near modal header
- FR-002 (3 options) near button group
- FR-005 (4 categories) near category toggles

**CRITICAL CONSTRAINT**: Badges MUST NOT overlap each other or any UI elements. Calculate positions carefully - mobile has only 320px content width. May need to place badges outside modal frame or use smaller sizing.

**Fixed**: 2026-01-09 (v10) - Added mobile "Requirements:" row at bottom with FR-001, FR-002, FR-005, SC-001, SC-002 badges.

**Classification**: ✅ FIXED

---

### ✅ Issue 15: Annotation Groups Need Distinct Backgrounds (FIXED in v10)

**Location**: All desktop FR/SC badge + description pairs within modals

**Problem**: The annotation groups (badge + descriptive text like "Show on first visit") look like they're part of the UI/UX, not callout annotations. The badge alone having a different color isn't enough - the entire annotation group needs visual separation.

**Current state**:
- Badge has colored fill but description text uses same styling as UI text
- No visual container separating annotation from UI element it describes
- Annotations blend into modal content

**Needed**: Each annotation group (badge + description) needs a distinct background container that clearly separates it from the UI mockup. The annotation should look like a callout/overlay, not embedded content.

**Fix**: Add background rect behind each (badge + text) annotation group with distinct styling (different fill, border, or opacity) that clearly marks it as an annotation layer.

**Fixed**: 2026-01-09 (v10) - Added `.annotation-bg` class with violet-tinted backgrounds (#ede9fe, #c4b5fd stroke) behind badge+text groups.

**Classification**: ✅ FIXED

---

### ✅ Issue 17: Duplicate Requirements Sections (FIXED in v10)

**Location**:
- "Accessibility Requirements" panel at y=565 (inside desktop viewport)
- "REQUIREMENTS KEY" legend at y=950 (below viewport)

**Problem**: Two separate sections doing the same thing - listing FR/SC requirements with descriptions. This is redundant and confusing:
- "Accessibility Requirements" has FR-022, FR-023, FR-024, SC-006, SC-007, FR-003, FR-008
- "REQUIREMENTS KEY" has FR-001, FR-002, FR-004, FR-005, SC-001, SC-002, SC-006

These are both partial attempts at the same purpose. Should be ONE consolidated section.

**Fix**: Merge into a single REQUIREMENTS KEY section with all FR/SC codes organized logically (not scattered across two locations).

**Fixed**: 2026-01-09 (v10) - Removed "Accessibility Requirements" panel, consolidated all FR/SC codes into expanded REQUIREMENTS KEY with 3 rows.

**Classification**: ✅ FIXED

---

### ✅ Issue 16: Font Size Too Small (FIXED)

**Location**:
- "USER STORIES" section label (`.label-desktop` class)
- REQUIREMENTS KEY explanation text (`.legend-text` class)

**Problem**: Fonts were too small for comfortable readability

**Fixed**: 2026-01-09 - Updated CSS class font sizes:
- `.label-desktop`: 15px → 18px
- `.legend-text`: 13px → 15px

**Classification**: ✅ FIXED

---

## v9 Summary

| Issue | Description | Status |
|-------|-------------|--------|
| 10 | Badge text overlap | ✅ FIXED |
| 11 | Text truncation | ✅ FIXED |
| 12 | Requirements Key inconsistent | ✅ FIXED |
| 13 | Legend badges not clickable | ✅ FIXED |
| 14 | Mobile missing all tags | ✅ FIXED (v10) |
| 15 | Annotation groups need distinct backgrounds | ✅ FIXED (v10) |
| 16 | Font size too small | ✅ FIXED |
| 17 | Duplicate requirements sections (A11y panel + Key) | ✅ FIXED (v10) |

**v9 status**: All 8 issues fixed (5 in v9, 3 in v10).

---

## v8 Issues (STRUCTURAL) - ✅ ALL FIXED IN v9

**Reviewed**: 2026-01-09 by user (screenshot review)

### 🔴 Issue 1: Massive Wasted Space

~300px empty gap between USER STORIES (ends ~y=510) and REQUIREMENTS KEY (at y=700+). Bottom 40% of desktop viewport is completely unused.

---

### 🔴 Issue 2: Content Crammed at Top

All 3 modals + Accessibility panel + USER STORIES squeezed into top 60% of viewport. Poor vertical distribution.

---

### 🔴 Issue 3: Accessibility Panel Cramped

Wedged awkwardly between STATE 2 and STATE 3 columns, creating visual clutter in that area while bottom half is empty.

---

### 🔴 Issue 4: Arrow Misalignment (PERSISTS from v6)

"Manage" and "Save" arrows point too high - not aligned with button centers. Still ~30px off.

---

### 🔴 Issue 5: STATE 3 Height Mismatch

"Confirmed" modal noticeably shorter than STATE 1/2, creates visual imbalance. Should match other modal heights.

---

### 🔴 Issue 6: Requirements Key Styling Inconsistent

REQUIREMENTS KEY at y=950 (correct position) but styling doesn't match other SVGs.

**Standard** (per /wireframe skill):
- Position: y=950
- Content must end at y≤920 (30px gap minimum)

**Current problem**: Legend position is correct but content ends at ~y=670, leaving ~280px of wasted space.

---

### 🔴 Issue 7: Headers Not Using Include Templates

Both desktop and mobile headers are inlined (copy/paste) instead of using `<use href>` references.

**Missing**:
- Desktop: `<use href="../includes/header-desktop.svg#desktop-header">`
- Mobile: `<use href="../includes/header-mobile.svg#mobile-header-group">`

**Problems**:
- Won't auto-update when templates change
- Inconsistent with SVGs that use the include pattern
- Icons manually copied instead of referenced

**Fix**: Replace inline headers with `<use href>` references.

---

### 🔴 Issue 8: Legend Isolated (Duplicate of Issue 1)

REQUIREMENTS KEY at y=950 is correct per standard, but content ending at y=670 creates ~280px of empty space. This is a symptom of Issue 1/2 (content crammed at top).

**Root cause**: Content not distributed to use full viewport height (y=60 to y=920).

---

### 🟡 Issue 9: USER STORIES Cards Tight

6 cards in 2 rows could use more breathing room. Cards are cramped while viewport space is wasted.

---

## v8 Summary

| Fixed from v6 | Still Broken | New Issues |
|---------------|--------------|------------|
| US/Legend collision | Arrow misalignment | Wasted space (~280px) |
| Touch targets (44px) | | Content crammed at top |
| | | Accessibility panel cramped |
| | | STATE 3 height mismatch |
| | | Headers not using `<use href>` |
| | | Cards tight |

**Root Cause**: Layout tried to fit everything in top 60% instead of distributing content across full viewport height (y=60 to y=920).

**Core fix needed**: Redistribute content vertically to fill the desktop viewport.

---

## v6 Summary (historical)

Changes from v5:

| Issue | v5 State | v6 Fix |
|-------|----------|--------|
| Canvas size | 1400x800 | 1920x1080 (correct) |
| Desktop viewport | Non-standard | 1366x768 (16:9 standard) |
| Mobile position | x=980 | x=1500 (correct) |
| Clickable links | None | All FR/SC/US badges linked |
| User stories | Missing full narratives | 6 cards with full context |
| Include templates | Not used | Header/footer icons injected |

### Content Coverage

| Content | Count | Status |
|---------|-------|--------|
| User Stories | 6/6 | All with full narratives + priority badges |
| FR codes | 12/24 | Core modal + categories + accessibility |
| SC codes | 4/8 | Performance + compliance |
| Clickable links | 25+ | All FR/SC/US badges |

### Layout

- **Canvas**: 1920x1080 (standard)
- **Desktop viewport**: x=40, y=60, 1366x768 (16:9)
  - 3-state flow: Initial Modal → Preferences → Confirmation
  - Flow arrows connecting states
  - Accessibility annotations panel
- **Mobile**: x=1500, y=60, 360x700 (phone frame)
  - Condensed STATE 1 view
  - Stacked buttons for touch
  - Active: Features nav tab
- **User Stories**: y=865, 6 cards in 2x3 grid
- **Requirements Legend**: y=1010, single row
- **Footer**: y=1050, left-aligned

### Theme Compliance
- Light theme (sky blue gradient background)
- Parchment panels (#e8d4b8, #dcc8a8)
- No white (#ffffff) panels
- All touch targets >= 44px
- Features nav active (desktop + mobile)

---

## v6 Issues (STRUCTURAL - requires v7 regeneration)

**Reviewed**: 2026-01-09 by user

### 🔴 Issue 1: User Stories / Legend Collision

User stories row 2 overlaps Requirements Legend by 5px.

| Element | Y Position | Height | Ends At |
|---------|------------|--------|---------|
| US Row 2 | 945 | 70 | 1015 |
| Legend | 1010 | 35 | 1045 |

**Collision**: 5px overlap (1015 > 1010)

---

### 🔴 Issue 2: Wasted Space / Poor Layout

348px of empty space inside desktop viewport (y=480-828) while user stories are crammed outside and overlapping.

**Fix**: Move USER STORIES inside desktop viewport, use empty space below Accessibility panel.

---

### 🔴 Issue 3: Arrow Misalignment

"Manage" flow arrow not aligned with "Manage Preferences" button.

| Element | Y Position |
|---------|------------|
| Button center | ~430 |
| Arrow | 385 |

**Misalignment**: 45px too high

---

### 🔴 Issue 4: Mobile Header Missing Icons

Mobile header (lines 415-426) missing right-side icons from template:
- Accessibility icon (eye)
- Settings icon (gear)
- User avatar

---

### 🔴 Issue 5: Touch Target Violations

| Element | Line | Height | Required |
|---------|------|--------|----------|
| Save Preferences | 304 | 20px | 44px |
| Close button | 349 | 20px | 44px |

---

### 🟢 Issue 6: SC-006 Position (minor)

SC-006 badge position could be improved but not critical.

---

## Previous Issues (v1-v5 historical reference)

### v5 Issues (STRUCTURAL - required regeneration)
- Wrong canvas: 1400x800 instead of 1920x1080
- Missing USER STORIES section with full narratives
- No clickable `<a href>` links on FR/SC badges
- Not using include templates for icons

### v4 Issues (FIXED in v5)
- FR-003, FR-004, FR-007, FR-023, SC-002 missing

### v3-v1 Issues (FIXED)
- Various layout and color issues

---

**Next Action**: Run `/wireframe 002:01` to regenerate as v7 with layout fixes.
