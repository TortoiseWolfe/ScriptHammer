---
description: Critically review SVG wireframes with ruthless attention to detail. Find EVERY flaw.
---

## ⛔ MANDATORY FIRST CHECKS (BLOCKING - DO BEFORE ANYTHING ELSE)

**These checks are BLOCKING. You cannot proceed with the review until all pass. Do NOT skip to issue categories.**

### Check 1: Theme Verification (BLOCKING)

**Before reviewing ANY file, verify the theme is correct for the content type.**

1. Read the feature name and wireframe title
2. Does it contain: `architecture`, `RLS`, `API`, `auth`, `security`, `testing`, `integration`, `pipeline`, `database`, `schema`, `flow`, `system`?

| Feature Type | Required Theme | Background Check |
|--------------|----------------|------------------|
| Architecture/Backend | **DARK** | Look for `#0f172a` or `#1e293b` gradient |
| UI/UX screens | Light | Look for `#c7ddf5` or `#e8d4b8` parchment |

**How to verify:** Check SVG `<linearGradient id="bgGrad">` for background colors.

**⛔ If architecture/backend diagram uses LIGHT theme → 🔴 REGENERATE immediately. Do not continue review.**

### Check 2: Viewer Setup (BLOCKING)

**Complete Step 1 (Viewer Setup) before proceeding.**

**⛔ If you cannot see the ENTIRE wireframe in the screenshot → adjust zoom before continuing.**

### Check 3: Detail Inspection at 280% (BLOCKING)

**Zoom to 280% and pan through each quadrant. Look for issues invisible at overview zoom.**

At 280%, issues become visible that you'd miss at 130%:
- Text truncation, clipping, overlap
- Alignment problems, spacing inconsistencies
- Small font readability issues
- Arrow paths crossing content
- Container boundary violations

**⛔ If you find issues at 280% that require layout changes → 🔴 REGENERATE.**

### Check 4: Arrow Path Trace (BLOCKING for Architecture Diagrams)

**For EVERY arrow in the diagram, trace its path:**

- Does it pass through ANY text? → 🔴 REGENERATE
- Does it pass through ANY container/panel? → 🔴 REGENERATE
- Does it overlap ANY label? → 🔴 REGENERATE

**⛔ Arrow-through-content = DESIGN FAILURE. Do not list as an issue - just mark 🔴 REGENERATE.**

### Check 5: Wasted Space (BLOCKING)

**Look at your screenshot:**

- Is there >100px of unused vertical space while content is cramped? → 🔴 REGENERATE
- Is there >100px of unused horizontal space while content is cramped? → 🔴 REGENERATE
- Are arrows routed around obstacles when empty space could be used? → 🔴 REGENERATE

**⛔ Wasted space + cramped content + arrows through text = TRIPLE DESIGN FAILURE.**

### Check 6: Requirements Legend (BLOCKING)

**For EVERY wireframe with FR/SC/NFR annotations:**

1. Look for REQUIREMENTS KEY panel at y=690 (bottom-left, height grows upward)
2. Verify EVERY annotation code has a description in the legend
3. Verify NO extra codes in legend that aren't on the page

**⛔ If FR/SC annotations exist but no REQUIREMENTS KEY panel → 🔴 REGENERATE immediately.**

### First Checks Statement (MANDATORY)

**Before proceeding to detailed review, you MUST write:**

```
FIRST CHECKS COMPLETE:
- Theme: [Dark/Light] - [Correct/WRONG for feature type]
- Viewer: Overview screenshot at 130%, detail inspection at 280%
- Detail inspection: [All clear / Issues at: ...]
- Arrow paths: [Clear / Through content at: ...]
- Space utilization: [Good / Wasted space at: ...]
- Requirements legend: [Present with all FRs / Missing / Incomplete]
- BLOCKING ISSUES: [None / List any that require immediate REGENERATE]
```

**If ANY blocking issue exists, output:**
```
⛔ BLOCKING FAILURE: [issue description]
Action: 🔴 REGENERATE with feedback: "[specific guidance]"
```

**Do NOT proceed to detailed issue categories if blocking failures exist.**

---

## User Input

```text
$ARGUMENTS
```

### Arguments Format

- `FEATURE` - Review ALL SVGs in feature (batch mode)
- `FEATURE:PAGE` - Review SINGLE SVG only (per-page mode)

**Parsing Logic**:
1. Split input by `:` delimiter
2. If no `:` → full-feature mode (review all SVGs)
3. If `:` → per-page mode, extract page filter:
   - Numeric (`:01`, `:3`) → match `01-*.svg`, `03-*.svg`
   - Text (`:responsive`) → match `*responsive*.svg`

**Examples**:
- `/wireframe-review 004` → Review all SVGs in 004-mobile-first-design
- `/wireframe-review 004:01` → Only review `01-responsive-navigation.svg`
- `/wireframe-review 004:touch` → Only review `03-touch-targets.svg`

---

### Page Filter (Per-Page Mode Only)

**If `:PAGE` provided:**
1. List SVGs in `docs/design/wireframes/[feature-folder]/`
2. Filter: Numeric (`:01`) → `01-*.svg` | Text (`:responsive`) → `*responsive*.svg`
3. **0 matches** → Error with available list | **2+ matches** → Ask user
4. **1 match** → Extract spec from `grep "SOURCE:" [target].svg`

Spec path comes from SVG watermark. Still read FULL spec for context.

---

## Step 0: Check for Previous Review (Iterative Mode)

**Before starting the review, check if this is a subsequent pass.**

Look for existing `WIREFRAME_ISSUES.md` in the feature directory:
```
features/[category]/[feature-folder]/WIREFRAME_ISSUES.md
```

### If NO existing file:
- This is **Pass 1** (fresh review)
- Proceed with full review
- Create new WIREFRAME_ISSUES.md

### If existing file found:
- Read the file and extract:
  - **Current pass number** (from Review History table)
  - **Previous issues** (all rows from issue tables)
  - **Issue fingerprints** (Category + Location + Description hash for matching)
- Increment pass number
- Proceed with **FULL review of ALL files** (don't skip any - might catch overlooked issues)
- After review, compare findings against previous pass

### Per-Page Mode: Incremental Issue Tracking

**If `:PAGE` provided AND existing WIREFRAME_ISSUES.md:**

| Action | Scope |
|--------|-------|
| PRESERVE | Other files' issue tables, Visual Descriptions, Overlap Matrices |
| UPDATE | Target file's section only |
| RECALCULATE | Summary totals, increment pass counter for reviewed file |

Per-page mode saves tokens. Preserving other sections maintains history.

⚠️ **CRITICAL: "RESOLVED" does NOT mean "skip review"**

Files marked "✅ RESOLVED" or "✅ PASS" need EXTRA scrutiny, not less:
- Regenerated files often introduce NEW issues while fixing old ones
- Patched files may have unintended side effects
- Your previous review may have missed things

**Treat recently-fixed files with MORE suspicion than fresh files.**
**Never trust a status label. Verify visually. Every time.**

### Comparison Logic (after full review):

| Current Finding | Status |
|-----------------|--------|
| Matches previous issue, still exists | `Pass N` (when first found) |
| No match | `NEW Pass N` |
| Previous issue NOT found | `✅ RESOLVED` |

### All Issues Resolved? ⚠️ FINAL VERIFICATION REQUIRED

**If remaining issues = 0, verify before declaring PASS:**

### ⛔ File CANNOT pass if ANY of these are true:

| Blocker | Check |
|---------|-------|
| No Overlap Matrix | Must be created for every file |
| Overlap Matrix has ❌ | Any overlap detected = fail |
| No Visual Description | Must describe what you see |
| Devil's Advocate skipped | Must complete checkpoint |
| Truncated text | FR codes cut off, labels ending in "..." |
| Unreadable labels | Every annotation must be readable character-by-character |
| Footer wrong/missing | Must be `x="60" y="780"` with `[NNN:PP] | Title | ScriptHammer` |

**Any blocker = 🔴 REGENERATE. No exceptions.**

**Only after verification AND all boxes unchecked, output:**
```
All issues resolved - VERIFIED

Verification checklist:
- [x] Visual descriptions written for all X files
- [x] Overlap matrices created for all X files (all show ✅, no ❌)
- [x] Devil's advocate check completed
- [x] Rendered wireframes viewed (method: [browser/viewer/screenshot])
- [x] Re-examined "most likely overlooked" areas
- [x] All annotation labels verified character-by-character (no truncation)
- [x] Footer signature line verified: x=60, y=780, format [NNN:PP] | Title | ScriptHammer

Review History:
- Pass 1: X issues found
- Pass 2: X resolved, X new
- Pass N: X resolved, 0 new

Wireframes verified. Proceed to:
  /speckit.plan [feature]
```

**DO NOT use celebratory language. Verification is not celebration.**

---

## Step 1: Viewer Setup (MANDATORY) ⚠️ DO THIS FIRST

**Set up viewer ONCE at session start. Eliminates trial-and-error zoom/focus cycle.**

### 1a. Ensure Viewer is Running
```bash
curl -s http://localhost:3000 | head -5  # Check if running
cd docs/design/wireframes && npm run dev &  # Start if not
```

### 1b. Navigate and Configure Browser

```javascript
// 1. Navigate to viewer
mcp__MCP_DOCKER__browser_navigate({ url: "http://host.docker.internal:3000" })

// 2. Select wireframe via data-svg attribute (NOT click - avoids timeout)
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => {
    const link = document.querySelector('[data-svg="[FEATURE]/[FILE].svg"]');
    if (link) link.click();
    return !!link;
  }`
})

// 3. Enter FOCUS MODE (press 'f') - CRITICAL for accurate review
// ⚠️ Focus mode hides the viewer's sidebar and footer
// After pressing 'f', EVERYTHING on screen is part of the SVG
// This ensures screenshots contain ONLY the wireframe, no UI chrome
// Press 'Escape' to exit focus mode when done
mcp__MCP_DOCKER__browser_press_key({ key: "f" })

// 3b. Close legend if open (toggle off with 'l')
// Legend may be open by default - close it for clean screenshots
mcp__MCP_DOCKER__browser_press_key({ key: "l" })

// 4. Reset zoom to 85% baseline
mcp__MCP_DOCKER__browser_press_key({ key: "0" })

// Setup complete. Proceed to Step 2 for zoom/screenshot workflow.
// ⚠️ ArrowUp = zoom IN, ArrowDown = zoom OUT
```

### 1c. Zoom Levels (Two-Phase)

| Canvas Size | Overview Zoom | Detail Zoom | Overview Keys | Detail Keys |
|-------------|---------------|-------------|---------------|-------------|
| 1400×800 (standard) | 130% | 280% | `0`, `ArrowUp` x3 | `0`, `ArrowUp` x12 |
| 1600×800 (wide) | 130% | 280% | `0`, `ArrowUp` x3 | `0`, `ArrowUp` x12 |
| 1600×1000 (architecture) | 130% | 280% | `0`, `ArrowUp` x3 | `0`, `ArrowUp` x12 |
| **⚠️ CRITICAL** | `ArrowUp` = zoom IN | `ArrowDown` = zoom OUT | **Never use ArrowDown for detail** | |

**Two-phase approach:**
1. **Overview (130%)**: Structural check - layout, overlaps, theme (0, then ArrowUp x3)
2. **Detail (280%)**: Per-quadrant inspection - text readability, truncation (ArrowUp x9 more)

### 1d. Take Screenshots (Relative Paths)

**Screenshots save to `/tmp/playwright-output/` inside the container. Use relative filenames.**

```javascript
// Screenshot naming: [NNN]-[PP]-[description].png
// Example: 002-01-consent-modal-overview.png
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-[description].png"
})

// Quadrant screenshots (at 280% zoom)
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-TL.png"
})
```

**Naming Convention:**
| Component | Format | Example |
|-----------|--------|---------|
| Feature number | NNN | 002 |
| Page number | PP | 01 |
| Description | kebab-case | consent-modal-overview |
| Quadrant | TL/TR/BL/BR | quadrant-TL |

**Full example for 002-cookie-consent, page 01:**
- `002-01-consent-modal-overview.png` (130% overview)
- `002-01-quadrant-TL.png` (280% top-left)
- `002-01-quadrant-TR.png` (280% top-right)
- `002-01-quadrant-BL.png` (280% bottom-left)
- `002-01-quadrant-BR.png` (280% bottom-right)

### 1e. Copy Screenshots to Host (REQUIRED)

**After completing all screenshots for a feature, copy them from container to host:**

```bash
# Ensure target directory exists
mkdir -p docs/design/wireframes/png/[FEATURE]/

# Copy all PNGs from container to host
docker cp $(docker ps -q -f ancestor=mcp/playwright):/tmp/playwright-output/. \
  docs/design/wireframes/png/[FEATURE]/

# Verify copy succeeded
ls -la docs/design/wireframes/png/[FEATURE]/*.png
```

**Run this ONCE per feature, after all quadrant screenshots are complete.**

### 1f. Navigate Between Wireframes
```javascript
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowRight" })  // Next
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowLeft" })   // Previous
mcp__MCP_DOCKER__browser_take_screenshot({ filename: "[FEATURE]-[PAGE]-[NAME].png" })
```

### 1g. Verify Zoom Direction (MANDATORY)

**After pressing zoom keys, verify you're at the RIGHT zoom level:**
- **Overview = 130%** (0, then ArrowUp x3)
- **Detail inspection = 280%** (ArrowUp x9 more, text is LARGE and easy to read)
- If text appears SMALLER than at 130%, you pressed the WRONG key

| Symptom | Problem | Fix |
|---------|---------|-----|
| Text getting smaller | Used `ArrowDown` (zoom out) | Press `0` to reset, then use `ArrowUp` |
| Can't see full canvas | At 280% detail zoom | Press `0` to return to 85%, then ArrowUp x3 for 130% |
| Text blurry/unreadable | At <130% | Press `ArrowUp` repeatedly until clear |

**Rule: If you can't read every character clearly at detail zoom, you're zooming the WRONG direction.**

**DO NOT skip viewer setup. DO NOT discover zoom/focus mid-review.**

---

## Step 2: Quadrant Deep Inspection (MANDATORY)

1. **Reset and zoom to 130%** for overview (press '0' then ArrowUp x3)
2. **Take overview screenshot** at 130%
3. **Zoom to 280%** for quadrant detail (press ArrowUp x9 more)

```javascript
// OVERVIEW SCREENSHOT
// Step 1: Reset to center and fullscreen (85%)
mcp__MCP_DOCKER__browser_press_key({ key: "0" })  // Reset: center + 85%

// Step 2: Zoom to 130% with ArrowUp x3 (good for overview)
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // ~130% (overview zoom)

// Take overview screenshot at 130%
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-overview.png"
})

// QUADRANT DETAIL INSPECTION
// Step 3: Zoom 9 more ArrowUp to reach ~280%
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // ~280% (quadrant detail)
// Expected result: text is LARGE and easy to read, only ~15% of canvas visible
```

3. **Pan to each quadrant** using direct JavaScript (CLOCKWISE pattern: TL → TR → BR → BL):

```javascript
// Step 3: PAN to each quadrant at 280% zoom (CLOCKWISE pattern)
// At 280%, only ~430×285 canvas pixels visible. MUST pan to see all 4 quadrants.
// Use DIRECT JAVASCRIPT to set absolute pan coordinates (bypasses viewport drag limits).

// Quadrant Coverage (1600×1000 canvas):
// ┌─────────┬─────────┐
// │   TL    │   TR    │
// │ 0-800   │ 800-1600│
// │ 0-500   │ 0-500   │
// ├─────────┼─────────┤
// │   BL    │   BR    │
// │ 0-800   │ 800-1600│
// │ 500-1000│ 500-1000│
// └─────────┴─────────┘

// Pan values: positive panX = image moves right (shows LEFT of canvas)
//             positive panY = image moves down (shows TOP of canvas)

// TL - pan to show top-left corner
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = 1600; panY = 1000; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-TL.png"
})

// TR - pan to show top-right corner
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = -1600; panY = 1000; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-TR.png"
})

// BR - pan to show bottom-right corner
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = -1600; panY = -1000; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-BR.png"
})

// BL - pan to show bottom-left corner
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = 1600; panY = -1000; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-BL.png"
})
```

### Quadrant Inspection Protocol

#### BASE CHECKS (run in EVERY quadrant)

| Check | Question |
|-------|----------|
| **Text readable?** | Every heading, label, annotation - character by character |
| **Container overflow?** | Content stays within panel bounds |
| **Truncation?** | No labels ending in "..." or cut-off FR codes |
| **Touch targets?** | Interactive elements ≥44px height |
| **Spacing?** | No cramped elements, consistent margins |
| **Contrast?** | Text readable against background |

#### LOCATION-SPECIFIC CHECKS

**TOP-LEFT (Desktop header/sidebar)**
- [ ] Header buttons fit? (sum widths + gaps ≤ header width)
- [ ] Nav items complete? (no truncation)
- [ ] Sidebar panel edges respected?
- [ ] Logo/brand visible?

**BOTTOM-LEFT (Footer/REQUIREMENTS KEY)**
- [ ] Footer at `x=60, y=780`?
- [ ] Footer format: `NNN:PP | Title | ScriptHammer`?
- [ ] REQUIREMENTS KEY panel present at y=690?
- [ ] Legend FR/SC codes match page annotations?
- [ ] Content ends by y=750 (30px footer clearance)?

**TOP-RIGHT (Mobile frame)**
- [ ] MOBILE label at x=980?
- [ ] Phone frame at `translate(980, 60)`?
- [ ] Status bar not obscured by content?
- [ ] Mobile header complete?

**BOTTOM-RIGHT (Annotations/Mobile bottom)**
- [ ] Right-margin annotations complete?
- [ ] Annotation context clear? (not "SC-001: <3 min" but "SC-001: Signup <3 min")
- [ ] Mobile bottom nav visible (if applicable)?
- [ ] Touch targets ≥44px in mobile footer?

### Quadrant Checkpoint (MANDATORY per quadrant)

**Before moving to next quadrant, verify:**
- [ ] All text readable character-by-character?
- [ ] Container boundaries respected? (no overflow)
- [ ] Labels complete? (no truncation)
- [ ] Touch targets ≥44px?
- [ ] Issue found? → Note it with coordinates before moving on

**At 280%, for each quadrant**: Pan, run BASE checks, run LOCATION-SPECIFIC checks, note issues.

**Checkpoint**: Overview PNG saved at 130%, all 4 quadrants analyzed at 280%, issues noted.

---

## Critical Review Philosophy

Find problems, not praise. Assume every wireframe has issues. If something looks "fine," look harder.

---

## Issue Categories - SCRUTINIZE EACH ONE

⛔ **STOP**: View rendered wireframes and write Visual Descriptions BEFORE using these checklists. Look first, then use as second-pass verification.

---

## Phase A: Structural Issues (from screenshots)

**Check these first - they require 🔴 REGENERATE if found.**

### 1. OVERLAP & COLLISION ISSUES

| Check | Question |
|-------|----------|
| Row collisions | Does Row 1 bleed into Row 2? |
| Label collisions | Do annotations overlap content? |
| Panel boundary | Does content extend beyond container? |
| Mobile/Desktop | Does mobile collide with desktop? |
| Z-index | Are elements stacking correctly? |
| Badge/indicator overlay | Do badges obscure text? |
| Decorative layering | Do rings/backgrounds clip text? |

### 2. CLIPPING & TRUNCATION

| Check | Question |
|-------|----------|
| Text cut-off | Is ANY text clipped by container? |
| Button labels | Do labels fit or get cut? |
| Long content | What happens with longer strings? |
| Icon clipping | Are icons fully visible? |
| Panel edges | Content too close to edges? |
| Text under overlays | Hidden behind badges/indicators? |
| Heading visibility | Covered by decorative rings? |
| Container overflow | Content escaping below/outside panel? |

### 2b. ⛔ CONTAINER BOUNDARY MATH VALIDATION (MANDATORY)

```
element_x + element_width ≤ container_x + container_width
element_y + element_height ≤ container_y + container_height
```

| Pattern | Check |
|---------|-------|
| Button row | Sum widths + gaps ≤ header width |
| Annotation text | chars × ~7px ≤ box width |
| Stacked items | items × height ≤ container height |
| Right-aligned | x + width < container right edge |

Text width: ~6px/char (mono 10px), ~7px/char (12px), ~8px/char (14px).
**DO NOT EYEBALL. Do the math. Violation = 🔴 REGENERATE.**

**Example calculation:**
```
Header: x=0, width=900 → ends at x=900
Buttons at x=760(w=44), x=812(w=44), x=864(w=44)
Rightmost: 864 + 44 = 908 > 900 ❌ OVERFLOW by 8px
```

### 2c. ⛔ TRUNCATION SCAN (MANDATORY)

For every dynamic text (FR codes, labels): `text_width < container_width - padding`

**FR/SC check**: If annotation shows "FR-024, FR-0" → TRUNCATED. Full text must be visible.
**Visual check**: Can you read EVERY character of EVERY label? If not → 🔴 REGENERATE.

**Common truncation locations to check:**
- Cramped corners (annotation labels squeezed against edges)
- Small panels (FR codes in legend boxes)
- Narrow containers (mobile button labels)
- Canvas edges (right-margin annotations)
- Long requirement codes (FR-024-025 combined references)

**VERIFY by reading each label character by character. Don't skim.**

### 3. SPACING & DENSITY ISSUES

| Check | Question |
|-------|----------|
| Cramped areas | Where are things squeezed? |
| Inconsistent margins | Similar elements match? |
| Inconsistent padding | Uniform within containers? |
| Gutter problems | Column/row gaps consistent? |
| Touch target spacing | 8px minimum between tappables? |

### 3b. ⛔ WASTED SPACE = MISSED OPPORTUNITY (MANDATORY CHECK)

**Wasted space = 🔴 REGENERATE.** If utilization < 70%, it's wasted.

| Pattern | Wrong | Right |
|---------|-------|-------|
| Content top, empty bottom | Route arrows around | Move content down |
| Content left, empty right | Squeeze tighter | Spread to use width |
| Cramped + empty space | Route below | Move into empty space |

**Ask**: >100px unused while cramped? → 🔴 REGENERATE with feedback: "Move [elements] to use wasted space"

### 4. SIZE & PROPORTION ISSUES

| Check | Question |
|-------|----------|
| Too small | Any text <10px? Annotations readable? |
| Too dominant | Element overpowering its importance? |
| Inconsistent sizing | Similar elements differ? |
| Aspect ratios | Avatars, icons proper? |
| Phone frame | Mobile realistically sized? |

---

## Phase B: Alignment & Accessibility

### 5. ALIGNMENT ISSUES

| Check | Question |
|-------|----------|
| Horizontal | Elements aligned that should be? |
| Vertical | Columns properly aligned? |
| Baseline | Text baseline-aligned? |
| Center | "Centered" actually centered? |
| Grid | Layout follows consistent grid? |

### 6. CONTRAST & ACCESSIBILITY (WCAG AAA = 7:1)

| Combo | Check |
|-------|-------|
| Light theme | `#4a5568` on `#e8d4b8` = 7:1? |
| Dark muted | `#94a3b8` on `#1e293b` readable? |
| Annotations | `#8b5cf6` visible both themes? |
| Buttons | White on `#8b5cf6` sufficient? |
| Status | Green/red distinguishable without color? |

---

## Phase C: Layout & Architecture

### 7. LAYOUT EFFICIENCY

| Check | Question |
|-------|----------|
| Row arrangement | Swap sections to reduce overlap? |
| Whitespace use | Spread into empty areas? |
| H vs V | Side-by-side should stack? |
| Panel sizing | Appropriate for content? |
| Density | Too sparse or dense? |

### 8. ARCHITECTURE DIAGRAM SPECIFIC

| Check | Question |
|-------|----------|
| Arrow endpoints | All arrows connect? |
| Arrow occlusion | Hidden behind elements? |
| Flow direction | Direction obvious? |
| Label positioning | Close to what they describe? |
| Connector gaps | Suspicious gaps? |
| Arrow-through-text | Arrows cross text? → 🔴 REGENERATE |

### 8b. ⛔ ARROW-THROUGH-TEXT DETECTION (Architecture Diagrams)

**Arrows crossing text = 🔴 REGENERATE.** Trace each arrow - if it obscures any character, fail.

| Fix | Method |
|-----|--------|
| Route around | Orthogonal path with 90° turns |
| Use empty space | Create arrow channels |
| Reorganize layout | If no clear path exists |

**Arrow-through-text + wasted space = DOUBLE DESIGN FAILURE**

---

## Phase D: Compliance Checks

### 9. TOUCH TARGET COMPLIANCE (44×44px minimum) ⚠️ CRITICAL

**Both desktop AND mobile. Every interactive element ≥ 44px height.**

| Element | Check |
|---------|-------|
| Buttons, inputs, nav items | `height` attribute ≥ 44 |
| OAuth buttons, form controls | Tap target area ≥ 44 |
| Action links | Must have invisible tap target rect |

Common failures: `height="40"`, `height="36"`, `height="32"`, text links without tap rect. All = 🔴 REGENERATE.

**Visual layering/overflow failures** (⚠️ MUST view rendered wireframe):

| Failure | Example | Fix |
|---------|---------|-----|
| Circle over heading | Ring at cy=180, r=60 overlaps heading at y=122 | Move heading above, smaller circle, or reposition |
| Container overflow | 4 rows × 40px + padding > panel height | Calculate: header + (rows × height) + padding |

### 10. MOBILE-SPECIFIC ISSUES

| Check | Question |
|-------|----------|
| Safe area | Content in notch/home indicator areas? |
| Thumb zone | Important actions reachable? |
| Status bar | Content behind status bar? |
| Keyboard | Would it cover inputs? |

### 11. CONTENT & TYPOGRAPHY

| Check | Question |
|-------|----------|
| Typos | Spell-check everything |
| Orphans/widows | Single words alone? Short final lines? |
| Line length | Any >75 characters? |
| Placeholder | "Lorem ipsum" anywhere? |

### 12. ⛔ SEMANTIC POSITIONING (Data Visualizations)

**Origin must be at logical zero, NOT minimum data value.**

| Visualization | Check |
|--------------|-------|
| Breakpoint spectrum | 0px at origin? 320px at ~22%? |
| Timeline | Start date at left? Events proportionally spaced? |
| Progress | 0% at start, 100% at end? |

If minimum value at origin → 🔴 REGENERATE with semantic error feedback.

---

### 13. ⛔ CROSS-WIREFRAME CONSISTENCY (multi-file features)

**All wireframes in feature MUST have identical layout foundations.**

| Dimension | Expected | Detection |
|-----------|----------|-----------|
| Mobile position | x=980, y=60 | `grep "translate" *.svg` |
| MOBILE label | x=980 | `grep "MOBILE" *.svg` |
| Canvas size | 1400×800 | Check `viewBox` |
| Desktop start | x=40 | First desktop element |

**Inconsistency = 🔴 REGENERATE.** Moving mobile position requires full regeneration.

---

### 14. SPEC COMPLIANCE (Cross-reference spec.md - MANDATORY)

**Read spec FIRST.** Location: `features/[category]/[feature-folder]/spec.md`

For each FR/SC/NFR: Is it visualized? Labeled? Accurate?

| Gap Type | Example |
|----------|---------|
| Missing states | Only happy path, no error/loading/empty |
| Missing roles | Only one view, spec has admin vs member |
| Missing flows | Only step 1, spec has multi-step |
| Phantom reqs | FR-XXX label but FR doesn't exist in spec |

Severity: CRITICAL (entire FR missing) → MAJOR (partial) → MINOR (unlabeled)

---

### 14b. REQUIREMENTS LEGEND PANEL VERIFICATION (MANDATORY)

**Every wireframe with FR/SC annotations MUST have REQUIREMENTS KEY panel at y=690.**

| Check | Requirement |
|-------|-------------|
| Legend exists | Panel present at y=690 |
| Complete | Every annotation FR/SC in legend |
| No phantoms | Legend matches page only |
| US codes | Inline context only, NO legend entry |

| Issue | Classification |
|-------|----------------|
| Missing/incomplete legend | 🔴 REGENERATE |
| Extra FR/SC not on page | 🔴 REGENERATE |
| US in legend | 🔴 REGENERATE |
| Missing inline context | 🟢 PATCH |

---

### 15. ⛔ FOOTER SIGNATURE LINE (MANDATORY)

**Required**: `x="60" y="780" text-anchor="start"` with `[NNN:PP] | [Title] | ScriptHammer`

**Footer Checklist:**
- [ ] `x="60"` (left-aligned, not centered)
- [ ] `y="780"` (NOT y=790 or y=770)
- [ ] `text-anchor="start"` (left alignment)
- [ ] Format: `NNN:PP | Title | ScriptHammer`
- [ ] NNN = feature number (e.g., 002)
- [ ] PP = page number (e.g., 01, 02)

**Verify with grep:**
```bash
grep -n "y=\"78[0-9]\"" *.svg  # Find footer y positions
grep -n "text-anchor" *.svg   # Check alignment
```

| Failure | Classification |
|---------|----------------|
| Wrong position (x/y/anchor) | 🟢 PATCH |
| Wrong numbering format | 🟢 PATCH |
| Missing footer entirely | 🔴 REGENERATE |

---

### 16. ⛔ ANNOTATION CLARITY (MANDATORY)

**Labels MUST be self-explanatory WITHOUT reading spec.md.**

**FAILURE Examples (require 🔴 REGENERATE):**

| ❌ BAD (context missing) | ✅ GOOD (self-explanatory) |
|--------------------------|----------------------------|
| `SC-001: <3 min` | `SC-001: Signup flow <3 min` |
| `SC-002: <2 sec` | `SC-002: Login response <2 sec` |
| `<2 sec` | `Page load <2 sec` |
| `1K users` | `Handle 1K concurrent logins` |
| `FR-024` | `FR-024: Password reset` |
| `99.9%` | `Uptime 99.9%` |
| Green badge with no legend | Green = Active (in legend) |

**The test:** Could someone understand the annotation without reading spec.md? If NO → fail.

| Issue | Classification |
|-------|----------------|
| SC codes without context | 🔴 REGENERATE |
| Semantic colors without legend | 🔴 REGENERATE |
| Unexpanded abbreviations | 🟢 PATCH |

---

## Severity Ratings

| Level | Examples |
|-------|----------|
| CRITICAL | Unreadable content, major overlap, text obscured, missing FR, a11y failure (<4.5:1) |
| MAJOR | Partial truncation, spacing inconsistency, touch target <44px, AAA failure (<7:1) |
| MINOR | 1-2px misalignment, cosmetic imperfections |

---

## Issue Classification (🟢 vs 🔴) - BINARY ONLY

| 🟢 PATCHABLE | 🔴 REGENERATE |
|--------------|---------------|
| CSS class, color hex, font size, typo | Layout overlap, positioning, spacing |
| Footer position/format | Canvas size, row arrangement |
| Missing inline context | Touch target sizing (needs reflow) |
| | Missing content, structural changes |
| | Arrow-through-text, wasted space |

**Rule**: If ANY 🔴 in file → ENTIRE file regenerates. Don't patch 🟢 issues in that file.

---

## ⛔ AUTOMATIC 🔴 REGENERATE CONDITIONS (STOP REVIEW)

**Finding these = stop listing issues, just mark 🔴 REGENERATE with feedback.**

| Instant Trigger | Detection |
|-----------------|-----------|
| Wrong theme | Architecture using light (#c7ddf5) |
| Unreadable fonts | Text too small at intended zoom |
| Arrows through content | Arrow crossing text/labels |
| Low contrast | Dark on dark, muted on purple |
| Massive wasted space | >100px unused while cramped |
| Missing footer | No signature at y=780 |
| Mobile position wrong | Not at `translate(980, 60)` |

**No instant triggers?** Still complete Visual Description + Overlap Matrix + Devil's Advocate before ✅ PASS.

---

## 🔴 Regeneration Feedback (REQUIRED)

**Provide constructive feedback, not just "regenerate":**

```markdown
## 🔴 REGENERATION REQUIRED: [filename.svg]

### Diagnosis
[Specific: coordinates, element names, overlap areas]

### Root Cause
[WHY layout doesn't work - structural problem]

### Suggested Layout
- Row 1: [what]
- Row 2: [what]

### Spec Requirements to Preserve
[FR/SC items to keep]
```

This feedback passes to `/wireframe` for guided regeneration.

---

## Batch Mapping

| Batch | Features |
|-------|----------|
| 1 | 000-rls-implementation, 001-wcag-aa-compliance, 002-cookie-consent, 003-user-authentication, 004-mobile-first-design, 005-security-hardening, 006-template-fork-experience |
| 2 | 007-e2e-testing-framework, 008-on-the-account, 009-user-messaging-system, 010-unified-blog-content, 011-group-chats, 012-welcome-message-architecture |
| 3 | 013-oauth-messaging-password, 014-admin-welcome-email-gate, 015-oauth-display-name, 016-messaging-critical-fixes |
| 4 | 017-colorblind-mode, 018-font-switcher, 019-google-analytics, 020-pwa-background-sync, 021-geolocation-map |
| 5 | 022-web3forms-integration, 023-emailjs-integration, 024-payment-integration, 025-blog-social-features, 026-unified-messaging-sidebar |
| 6 | 027-ux-polish, 028-enhanced-geolocation, 029-seo-editorial-assistant, 030-calendar-integration |
| 7 | 031-standardize-test-users, 032-signup-e2e-tests, 033-seo-library-tests |

---

## Review Process

1. **Read spec FIRST** (see Category 14)
2. **View rendered wireframes** (complete Step 1 Viewer Setup)
3. **Write Visual Description** for each file BEFORE listing issues
4. **Create Overlap Matrix** for each file (all adjacent element pairs)
5. **Work through ALL 16 categories** - don't rush
6. **Document EVERY issue** with Suggested Fix
7. **Devil's Advocate Checkpoint** before ✅ PASS:
   - What did I overlook? Where would ONE more issue be?
   - Overlap Matrix created with no ❌ entries?
   - Longest label verified character-by-character?
8. **Update Progress Tracker**: `docs/design/WIREFRAME_REVIEW_PLAN.md`

**Status values**: `Pass N` (still exists), `NEW Pass N` (just found), `✅ RESOLVED`

---

## Report Format

```markdown
## Batch X Complete
- Features: X | SVGs: X
- Critical: X | Major: X | Minor: X

### Most Problematic
1. [file] - X issues (X critical)

### Regeneration Candidates
- [feature]: X issues, structural problems
```

---

## Arguments

| Arg | Action |
|-----|--------|
| `batch 1-10` | Review specific batch |
| `all` | Review everything |
| `[feature]` | Single feature (e.g., `004`) |
| `re-review [feature]` | Re-review after fixes |

---

## After Review

```bash
/wireframe [feature]    # Smart: patches 🟢, regenerates 🔴, skips ✅
```

| File has... | Action |
|-------------|--------|
| No issues | ✅ SKIP |
| Only 🟢 | 🟢 PATCH in place |
| Any 🔴 | 🔴 REGENERATE with feedback |

**Workflow**: `/wireframe-review` → `/wireframe` → repeat until resolved.

**Lesson**: DO NOT patch structural issues. When layout is broken, regenerate fresh.
