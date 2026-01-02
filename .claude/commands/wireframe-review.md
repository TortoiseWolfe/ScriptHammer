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

### Check 3: Text Readability (BLOCKING)

**Look at your screenshot. Can you read ALL text?**

For EVERY text element:
- [ ] Can you read every heading character-by-character?
- [ ] Can you read every label character-by-character?
- [ ] Can you read every annotation (FR-XXX codes)?
- [ ] Can you read every muted text element?

**⛔ If ANY text is too small to read → 🔴 REGENERATE immediately. Do not continue review.**

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

### First Checks Statement (MANDATORY)

**Before proceeding to detailed review, you MUST write:**

```
FIRST CHECKS COMPLETE:
- Theme: [Dark/Light] - [Correct/WRONG for feature type]
- Viewer: Screenshot captured at [X]% zoom
- Text readability: [All readable / Issues at: ...]
- Arrow paths: [Clear / Through content at: ...]
- Space utilization: [Good / Wasted space at: ...]
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

**If `:PAGE` was provided in arguments:**

1. List all SVG files in `docs/design/wireframes/[feature-folder]/`
2. Apply filter:
   - Numeric (`:01`, `:3`) → Match files starting with zero-padded number (`01-*.svg`)
   - Text (`:responsive`) → Match files containing the text (case-insensitive)
3. **If 0 matches**: Error with list of available SVGs
4. **If 1 match**: Extract spec path from SVG watermark:
   ```
   grep "SOURCE:" [target].svg | Extract path after "SOURCE: "
   ```
5. **If 2+ matches**: Ask user to clarify

**Per-page mode uses SVG watermark for context:**
- The SVG header contains `SOURCE: features/[category]/[feature]/spec.md`
- No need for user to specify spec path - extract from existing SVG
- Still read FULL spec for review context

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

**If per-page mode (`:PAGE` argument provided) AND existing WIREFRAME_ISSUES.md:**

1. Read existing WIREFRAME_ISSUES.md
2. Review ONLY the target SVG file (not all files)
3. **PRESERVE** sections for other files exactly as-is:
   - Keep their issue tables unchanged
   - Keep their Visual Descriptions unchanged
   - Keep their Overlap Matrices unchanged
4. **UPDATE** only the target file's section:
   - Replace its issue table with current findings
   - Update its Visual Description
   - Update its Overlap Matrix
5. **UPDATE** Summary section:
   - Recalculate totals from all file sections
   - Increment pass counter only for reviewed file

**Example**: Reviewing `004:02` when WIREFRAME_ISSUES.md already has entries for 01, 02, 03, 04:
```markdown
## Summary
- Files in feature: 4 SVGs
- Files reviewed this pass: 1 (02-content-typography.svg)
- Pass 3 for: 02-content-typography.svg

## 01-responsive-navigation.svg
[PRESERVED FROM PREVIOUS PASS - NOT REVIEWED]

## 02-content-typography.svg ← UPDATED
[NEW REVIEW RESULTS]

## 03-touch-targets.svg
[PRESERVED FROM PREVIOUS PASS - NOT REVIEWED]

## 04-breakpoint-system.svg
[PRESERVED FROM PREVIOUS PASS - NOT REVIEWED]
```

**Why this matters**: Per-page mode saves tokens by reviewing one file at a time. Preserving other sections maintains complete review history.

⚠️ **CRITICAL: "RESOLVED" does NOT mean "skip review"**

Files marked "✅ RESOLVED" or "✅ PASS" need EXTRA scrutiny, not less:
- Regenerated files often introduce NEW issues while fixing old ones
- Patched files may have unintended side effects
- Your previous review may have missed things

**Treat recently-fixed files with MORE suspicion than fresh files.**
**Never trust a status label. Verify visually. Every time.**

### Comparison Logic (after full review):

For each issue found in current pass:
1. **Check if it matches a previous issue** (same category, location, description)
   - If match found and issue still exists → Status: `Pass N` (where N = when first found)
   - If match found but issue resolved → Status: `✅ RESOLVED`
2. **If no match** → Status: `NEW Pass N` (current pass number)

For each previous issue NOT found in current pass:
- Mark as `✅ RESOLVED` (the fix worked!)

### Pass Completion Summary:

```
Pass 2 Complete:
- Issues from Pass 1: 12
- Resolved this pass: 6
- Still remaining: 4
- NEW issues found: 2
- Total remaining: 6

Next: /wireframe [feature] to fix remaining issues
```

### All Issues Resolved? ⚠️ FINAL VERIFICATION REQUIRED

**If remaining issues = 0, DO NOT immediately celebrate. Verify first:**

1. Did you complete the Devil's Advocate Checkpoint (Step 7)?
2. Did you write Visual Descriptions for EVERY file (Step 3)?
3. Did you actually VIEW the rendered wireframes, not just read SVG code?
4. Did you create an Overlap Matrix for EVERY file (Step 3b)?

### ⛔ File CANNOT pass if ANY of these are true:

- [ ] Overlap Matrix not created for this file
- [ ] Overlap Matrix has ANY ❌ entries (overlap detected)
- [ ] Visual Description not written for this file
- [ ] Devil's Advocate checkpoint not completed
- [ ] Any text is visibly truncated in screenshot (FR codes cut off, labels ending in "...")
- [ ] Any annotation label is not fully readable character-by-character
- [ ] Footer signature line missing or wrong format (must be `x="60" y="780"` with `[NNN:PP] | Title | ScriptHammer`)

**If ANY box above is checked, the file is 🔴 REGENERATE. No exceptions.**

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

**Before reviewing ANY wireframe, set up the viewer with the optimal viewing configuration.**

This eliminates the trial-and-error zoom/focus cycle. Do this ONCE at the start of every review session.

### 1a. Ensure Viewer is Running

```bash
# Check if viewer is already running
curl -s http://localhost:3000 | head -5

# If not running, start it:
cd docs/design/wireframes && npm run dev &
sleep 3
```

### 1b. Navigate and Configure Browser (Optimal Sequence)

Use MCP browser tools in this EXACT order:

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

// 3. Enter focus mode IMMEDIATELY (hides sidebar/footer)
mcp__MCP_DOCKER__browser_press_key({ key: "f" })

// 4. Reset zoom to 85% baseline
mcp__MCP_DOCKER__browser_press_key({ key: "0" })

// 5. Zoom out to fit all canvas sizes (55% fits 1600x1000)
mcp__MCP_DOCKER__browser_press_key({ key: "-" })  // 70%
mcp__MCP_DOCKER__browser_press_key({ key: "-" })  // 55%
mcp__MCP_DOCKER__browser_press_key({ key: "-" })  // 40% (for architecture diagrams)
```

### 1c. Zoom Levels Reference

| Canvas Size | Recommended Zoom | Key Presses After Reset |
|-------------|------------------|------------------------|
| 1400×800 (standard) | 55% | `0`, `-`, `-` |
| 1600×800 (wide) | 55% | `0`, `-`, `-` |
| 1600×1000 (architecture) | 40% | `0`, `-`, `-`, `-` |

### 1d. Take Screenshots with Persistent Output

**Screenshots are saved for reuse in tutorials and marketing.**

```javascript
// Screenshot naming convention: [FEATURE]-[PAGE]-[DESCRIPTION].png
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "003-01-login-signup.png"
})
```

**Output location**: `/tmp/playwright-output/` (inside MCP Docker container)

### 1e. Copy Screenshots to Persistent Location (After Review)

After completing a feature's review, copy screenshots to the repo:

```bash
# Create feature PNG directory
mkdir -p docs/design/wireframes/png/[FEATURE]/

# Copy from MCP container (find container name first)
docker ps | grep playwright
docker cp [CONTAINER]:/tmp/playwright-output/[FEATURE]-*.png docs/design/wireframes/png/[FEATURE]/
```

### 1f. Navigate Between Wireframes

Once in focus mode at correct zoom:

```javascript
// Next wireframe (maintains focus mode and zoom)
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowRight" })

// Previous wireframe
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowLeft" })

// Take screenshot after each navigation
mcp__MCP_DOCKER__browser_take_screenshot({ filename: "[FEATURE]-[PAGE]-[NAME].png" })
```

**DO NOT skip viewer setup. DO NOT discover zoom/focus mid-review.**

---

## Step 2: Quadrant Deep Inspection (MANDATORY)

After saving the full-page screenshot, zoom into each quadrant for detailed inspection.

### Why Quadrants
- Catches detail issues missed in overview (truncation, overlap, small text)
- Desktop content is left (~60%), mobile is right (~40%)
- Top areas have headers/nav, bottom has footers/legends
- No hardcoded coordinates - zoom dynamically to fill viewport

### Procedure
1. **Save fullscreen**: Take screenshot at current zoom (only PNG we save)
2. **Inspect top-left**: Zoom until left half fills viewport, inspect top area
3. **Inspect bottom-left**: Pan down within left half, inspect bottom area
4. **Inspect top-right**: Pan to right half, inspect top area
5. **Inspect bottom-right**: Pan down within right half, inspect bottom area

### What to Check per Quadrant

| Quadrant | Focus Areas |
|----------|-------------|
| Top-left | Header buttons, sidebar top, desktop nav overflow |
| Bottom-left | Footer signature (x=60, y=780), REQUIREMENTS KEY panel |
| Top-right | MOBILE label, phone frame top, status bar |
| Bottom-right | Mobile footer, touch targets, right-margin annotations |

### Checkpoint
Before proceeding to detailed categories:
- [ ] Fullscreen PNG saved: `[feature]-[page].png`
- [ ] All 4 quadrants visually inspected
- [ ] Obvious issues noted from inspection

---

## Critical Review Philosophy

**DO NOT give participation trophies.** These wireframes need to be BEST-IN-CLASS. Every pixel matters.

Your job is to find problems, not praise. Assume every wireframe has issues until proven otherwise. Be the harshest critic. If something looks "fine," look harder - there's always room for improvement.

The goal is not to validate - it's to CHALLENGE these wireframes to be better.

---

## Issue Categories - SCRUTINIZE EACH ONE

⛔ **STOP: Do NOT use these checklists until you have:**
1. **Viewed the rendered wireframes** (Review Process Step 2)
2. **Written Visual Descriptions** for each file (Review Process Step 3)

Reading these categories first will bias you toward "checking boxes" instead of actually seeing.
**Look first. Then use these as a second-pass verification.**

---

## Phase A: Structural Issues (from screenshots)

**Check these first - they require 🔴 REGENERATE if found.**

### 1. OVERLAP & COLLISION ISSUES (Look at EVERY row/section boundary)

- **Row collisions** - Does Row 1 content bleed into Row 2? Are sections fighting for the same space?
- **Label collisions** - Do annotation labels overlap with content?
- **Panel boundary violations** - Does content extend beyond its containing panel?
- **Mobile/Desktop overlap** - Does the mobile preview area collide with desktop content?
- **Z-index conflicts** - Are elements stacking incorrectly?
- **Indicator/badge overlay on text** - Do circular badges, score indicators, or status icons sit ON TOP of text, obscuring readability?
- **Decorative element layering** - Do decorative elements (rings, backgrounds, shapes) overlap and clip text content behind them?
- **Visual hierarchy violations** - Are informational elements (text, labels) being hidden by decorative elements (rings, backgrounds)?

### 2. CLIPPING & TRUNCATION (Check EVERY text element)

- **Text cut-off** - Is ANY text being clipped by its container?
- **Button label truncation** - Do button labels fit or get cut?
- **Long content handling** - What happens with longer strings?
- **Icon clipping** - Are icons fully visible?
- **Panel edge clipping** - Does content get too close to panel edges?
- **Text obscured by overlays** - Is text hidden behind circular indicators, badge elements, or other layered graphics?
- **Heading visibility under decorations** - Are section headings fully readable, not covered by decorative rings or score circles?
- **Container overflow** - Does content extend BELOW or OUTSIDE its containing panel? If rows/items don't fit, the container must be sized larger - content should never escape its bounds.

### 2b. ⛔ CONTAINER BOUNDARY MATH VALIDATION (MANDATORY)

**For every element inside a container, verify the math:**

```
element_x + element_width ≤ container_x + container_width   (right edge)
element_y + element_height ≤ container_y + container_height (bottom edge)
```

**Common overflow patterns to catch:**

| Pattern | How to check |
|---------|-------------|
| Button row in header | Find all buttons, sum their widths + gaps, compare to header width |
| Text in annotation box | Estimate text width (chars × ~7px), verify < box width |
| Stacked list items | Count items × item_height, verify < container height |
| Right-aligned controls | Find rightmost element, verify x + width < container right edge |

**Example validation (desktop header):**
```
Header: x=0, width=900 → ends at x=900
Buttons at x=760(w=44), x=812(w=44), x=864(w=44)
Rightmost: 864 + 44 = 908 > 900 ❌ OVERFLOW BY 8px
```

**Text width estimation:**
- Monospace 10px: ~6px/char
- System font 12px: ~7px/char
- System font 14px: ~8px/char

**DO NOT EYEBALL. Do the math. Log any violation as 🔴 REGENERATE.**

### 2c. ⛔ TRUNCATION SCAN (MANDATORY)

**For EVERY text element that contains dynamic content (FR codes, descriptions, labels):**

1. Find the text element in SVG
2. Estimate text width: chars × ~7px (monospace ~6px)
3. Find the containing element's width
4. Verify: text_width < container_width - padding

**Specifically check FR/SC annotation labels:**
- If annotation shows "FR-024, FR-0" → IT'S TRUNCATED
- Full text should be visible: "FR-024, FR-025, FR-026, FR-027"
- If any "..." or cut-off text → 🔴 REGENERATE

**Visual check in screenshot:** Can you read EVERY character of EVERY label? If not, it's truncated.

**Common truncation locations:**
- Annotation labels in cramped corners
- FR codes next to small panels
- Long text in narrow containers
- Labels near canvas edges

**DO NOT assume labels are complete. VERIFY by reading each one character by character.**

### 3. SPACING & DENSITY ISSUES (Measure with your eyes)

- **Cramped areas** - Where are things squeezed together that shouldn't be?
- **Inconsistent margins** - Are margins consistent between similar elements?
- **Inconsistent padding** - Is padding uniform within containers?
- **Gutter problems** - Are gaps between columns/rows consistent?
- **Touch target spacing** - Is there 8px minimum between tappable elements?

### 3b. ⛔ WASTED SPACE = MISSED OPPORTUNITY (MANDATORY CHECK)

**Wasted space is NOT acceptable. It's a 🔴 REGENERATE issue.**

If content is cramped OR arrows are routed around obstacles WHILE large empty areas exist, the solution is NOT "route around" - it's **MOVE THE CONTENT to use the space**.

**Canvas utilization check:**
1. Identify the bounding box of all content (leftmost to rightmost, topmost to bottommost)
2. Calculate: `used_area / canvas_area × 100 = utilization%`
3. If utilization < 70%, flag as 🔴 WASTED SPACE

**Common wasted space patterns (ALL are 🔴 REGENERATE):**

| Pattern | Wrong Fix | Right Fix |
|---------|-----------|-----------|
| Content at top, empty bottom | Route arrows around content | Move content down to center vertically |
| Content at left, empty right | Squeeze content tighter | Spread content to use full width |
| Cramped tables + empty space below | Route arrows below tables | Move tables down into the empty space |
| Dense header + empty body | Smaller header elements | Expand content to fill the space |

**Wasted space is a DESIGN FAILURE, not a feature.**

```
❌ WRONG: "Route arrows through empty space to avoid collision"
   This treats the symptom (collision) not the disease (bad layout)

✅ RIGHT: "Move tables down 150px to center content and eliminate collision"
   This uses available space AND fixes the collision
```

**When reviewing, ask:**
- Is there >100px of unused vertical space? → Move content down
- Is there >100px of unused horizontal space? → Spread content out
- Did the designer route AROUND something when they could have MOVED it?

**If the answer to any is YES → 🔴 REGENERATE with feedback: "Move [elements] to use wasted space at [location]"**

### 4. SIZE & PROPORTION ISSUES (Question every element's size)

- **Too small to read** - Is any text below 10px? Can annotations be read?
- **Too large/dominant** - Does any element visually overpower its importance?
- **Inconsistent sizing** - Are similar elements sized differently?
- **Aspect ratio issues** - Do avatars, icons maintain proper ratios?
- **Phone frame proportions** - Is the mobile frame realistically sized?

---

## Phase B: Alignment & Accessibility

**Visual polish and WCAG compliance checks.**

### 5. ALIGNMENT ISSUES (Check EVERY horizontal and vertical line)

- **Horizontal misalignment** - Are elements that should align horizontally actually aligned?
- **Vertical misalignment** - Are elements in columns properly aligned?
- **Baseline alignment** - Is text baseline-aligned where appropriate?
- **Center alignment** - Are "centered" elements actually centered?
- **Grid violations** - Does the layout follow a consistent grid?

### 6. CONTRAST & ACCESSIBILITY (WCAG AAA = 7:1 ratio minimum)

For AAA compliance, check these color combinations:
- **Light theme text** - Is `#4a5568` on `#e8d4b8` achieving 7:1? (Hint: it's not)
- **Dark theme muted text** - Is `#94a3b8` on `#1e293b` readable?
- **Annotation text** - Is `#8b5cf6` visible against both themes?
- **Button text contrast** - White text on `#8b5cf6` - sufficient?
- **Status indicators** - Are green/red status colors distinguishable without color?

---

## Phase C: Layout & Architecture

**Layout efficiency and architecture diagram validation.**

### 7. LAYOUT EFFICIENCY (Challenge the arrangement)

- **Could rows be rearranged?** - Would swapping sections reduce overlap?
- **Better use of whitespace?** - Could content spread into empty areas?
- **Horizontal vs vertical** - Should side-by-side elements stack instead?
- **Panel sizing** - Are panels appropriately sized for their content?
- **Information density** - Too sparse? Too dense?

### 8. ARCHITECTURE DIAGRAM SPECIFIC

- **Arrow endpoints** - Do ALL arrows connect to their targets?
- **Arrow occlusion** - Are arrows hidden behind elements?
- **Flow direction clarity** - Is the flow direction obvious?
- **Label positioning** - Are labels close to what they describe?
- **Connector gaps** - Are there suspicious gaps in connection lines?
- **Arrow-through-text collision** - Do ANY arrows pass through text/labels? (🔴 REGENERATE)

### 8b. ⛔ ARROW-THROUGH-TEXT DETECTION (MANDATORY for Architecture Diagrams)

**Flow arrows MUST NEVER cross through text, labels, or content. This is a 🔴 REGENERATE issue.**

**Detection method:**
1. Find ALL flow arrows (lines with arrow markers, path elements connecting components)
2. Find ALL text elements (headings, labels, annotations, section titles)
3. For each arrow, trace its path - does it visually cross any text?

**Common failure patterns:**

| Pattern | How to Detect |
|---------|---------------|
| Decision diamond arrow through section label | Arrow from diamond at y=X crosses label at y=Y where X < Y < target |
| Horizontal arrow through vertical label | Arrow path intersects label's bounding box |
| Bypass arrow cutting through panel title | Arrow routed "around" a panel but crosses its heading text |

**Visual check:**
- In the rendered wireframe, can you trace each arrow WITHOUT your eye crossing any text?
- If an arrow obscures even ONE character of text → 🔴 REGENERATE

**The fix is NEVER to move the text. The fix is to:**
1. Route the arrow around the text (orthogonal path with 90° turns)
2. Use available empty space for arrow channels
3. If no clear path exists, reorganize the layout to create flow channels

**If wasted space exists AND arrows cross text, the feedback should be:**
```
"Move [content] to use the wasted space at [location], creating a clear flow channel for arrows"
```

**Arrow-through-text + wasted space = DOUBLE DESIGN FAILURE**

---

## Phase D: Compliance Checks

**Touch targets, mobile, content, semantic, consistency, spec, legend, footer, and annotations.**

### 9. TOUCH TARGET COMPLIANCE (WCAG AAA = 44×44px minimum) ⚠️ CRITICAL

**This applies to BOTH desktop AND mobile. Check EVERY interactive element.**

For EACH of these element types, verify height ≥ 44px:
- **Buttons** (primary, secondary, icon) - Check `height` attribute
- **Input fields** (text, email, password, search) - Check `height` attribute
- **Navigation items** (sidebar links, tab items) - Check `height` attribute
- **List items** (if tappable/clickable) - Check `height` attribute
- **OAuth buttons** - Check `height` attribute
- **Form controls** (checkboxes, radios, toggles) - Check tap target area
- **Action links** (Revoke, Delete, Edit) - Must have invisible tap target rect

**How to verify**: Search SVG for `height="` and check values. Any value <44 on an interactive element is a 🔴 REGENERATE issue.

**Common failures**:
- `height="40"` - Close but fails (often buttons/inputs)
- `height="36"` - Fails (old template default)
- `height="32"` - Fails significantly
- Text links without tap target rect - Fails

**Common visual layering failures** (indicators overlapping text):

⚠️ **You MUST view the rendered wireframe to catch these. Reading SVG code alone will miss them.**

```
WRONG: Circle indicator (r=60) centered over heading text
- "Overall Score" heading at y=122
- Circle ring at cy=180, r=60 → top edge at y=120
- Result: Ring overlaps heading by 2px, clipping text

FIX options:
- Move heading above circle (y < 110)
- Use smaller circle (r=50 → top at y=130, no overlap)
- Reposition circle lower (cy=200)
- Add solid background behind heading text
```

**Common container overflow failures** (content escaping bounds):

⚠️ **You MUST view the rendered wireframe to catch these. Reading SVG code alone will miss them.**

```
WRONG: Table rows overflow below panel
- Panel height: 200px (y=100 to y=300)
- 4 rows at 40px each = 160px content + 20px header = 180px
- But padding/margins push last row to y=310
- Result: "Analytics" row escapes below panel boundary

FIX: Calculate actual content height including ALL rows, padding, and margins:
- Content height = header + (rows × row_height) + internal_padding
- Container height = content height + container_padding
- Never hardcode container sizes without counting content
```

### 10. MOBILE-SPECIFIC ISSUES

- **Safe area violations** - Does content intrude on notch/home indicator areas?
- **Touch target size** - Verify 44px (covered in section 9, double-check here)
- **Thumb zone** - Are important actions in the thumb-reachable zone?
- **Status bar overlap** - Does any content go behind the status bar?
- **Keyboard avoidance** - Would the keyboard cover input fields?

### 11. CONTENT & TYPOGRAPHY

- **Typos** - Spell-check EVERYTHING
- **Orphaned words** - Single words on their own line?
- **Widow lines** - Very short final lines in paragraphs?
- **Line length** - Are any lines too long (>75 characters)?
- **Placeholder vs real content** - Is there lazy "Lorem ipsum" anywhere?

### 12. ⛔ SEMANTIC POSITIONING VALIDATION (Data Visualizations)

**When a wireframe shows a spectrum, timeline, scale, or any proportional visualization:**

1. **Verify the origin is at the logical zero** - NOT at the minimum data value
2. **Verify positions are proportionally scaled**

**Breakpoint Spectrum Example (COMMON FAILURE):**

```
❌ WRONG: Mobile section at x=0 labeled "320px"
   - This treats 320px as the origin
   - The spectrum shows breakpoints, not viewport widths
   - 0px should be at the left edge, 320px should be positioned proportionally

✅ CORRECT: Origin at x=0 labeled "0px", mobile section starts at proportional position
   - Scale: 0 to 1440px mapped to canvas width
   - 320px position = (320/1440) × canvas_width
```

**Validation checklist for data visualizations:**

| Visualization | Check |
|--------------|-------|
| Breakpoint spectrum | Does 0px appear at origin? Is 320px positioned at ~22% of the width? |
| Timeline | Does the start date appear at left edge? Are events proportionally spaced? |
| Progress indicator | Does 0% appear at the start? Is 100% at the end? |
| Scale/axis | Is the zero point at the origin, not at the minimum value? |

**If the minimum data value is at the origin, log as 🔴 REGENERATE with feedback explaining the semantic error.**

---

### 13. ⛔ CROSS-WIREFRAME CONSISTENCY (MANDATORY for multi-file features)

**ALL wireframes in a single feature MUST have identical layout foundations.**

#### Consistency Check (MANDATORY before declaring ANY file as PASS)

For features with 2+ SVG files, you MUST verify:

| Dimension | Expected Value | How to Check |
|-----------|---------------|--------------|
| Mobile position | x=980, y=60 | `grep "transform=\"translate" *.svg` |
| MOBILE label | x=980 | `grep "MOBILE" *.svg` |
| Canvas size | 1400×800 (or consistent alternate) | Check `viewBox` in each file |
| Desktop start | x=40 | Verify first desktop element |

#### Detection Method

```bash
# Run this for every feature with 2+ wireframes:
grep -n "translate(.*," docs/design/wireframes/[feature]/*.svg
```

**Expected output (all positions identical):**
```
01-consent-modal.svg:150:  <g id="mobile-view" transform="translate(980, 60)">
02-privacy-settings.svg:175:  <g id="mobile-view" transform="translate(980, 60)">
```

**Failure (positions differ = 🔴 REGENERATE):**
```
01-consent-modal.svg:150:  <g id="mobile-view" transform="translate(980, 60)">
02-privacy-settings.svg:175:  <g id="mobile-view" transform="translate(770, 60)">  ❌ INCONSISTENT
```

#### Required Output in WIREFRAME_ISSUES.md

```markdown
## Cross-Wireframe Consistency Check

| File | Mobile Position | MOBILE Label | Status |
|------|-----------------|--------------|--------|
| 01-consent-modal.svg | x=980 | x=980 | ✅ |
| 02-privacy-settings.svg | x=980 | x=980 | ✅ |

**Consistency:** ✅ All files match
```

OR if issues found:

```markdown
## Cross-Wireframe Consistency Check

| File | Mobile Position | MOBILE Label | Status |
|------|-----------------|--------------|--------|
| 01-consent-modal.svg | x=980 | x=980 | ✅ |
| 02-privacy-settings.svg | x=770 | x=770 | ❌ INCONSISTENT |

**Consistency:** ❌ FAIL - 02-privacy-settings.svg deviates from standard
**Root Cause:** Mobile moved to fill empty space (ad-hoc layout decision)
**Fix:** 🔴 REGENERATE 02-privacy-settings.svg with mobile at x=980
```

#### Why This Matters

Users view wireframes in sequence. If mobile phones jump between x=770 and x=980:
- Creates visual jarring when navigating
- Suggests sloppy design process
- Makes side-by-side comparison impossible

**Inconsistency is a 🔴 REGENERATE issue, not 🟢 PATCH.**
Moving mobile position requires regenerating the entire layout.

---

### 14. SPEC COMPLIANCE (Cross-reference spec.md - MANDATORY)

**Before reviewing ANY wireframe, READ THE SPEC FIRST.**

Location: `features/[category]/[feature-folder]/spec.md`

#### Extraction Checklist
- [ ] List ALL functional requirements (FR-XXX)
- [ ] List ALL success criteria (SC-XXX)
- [ ] List ALL non-functional requirements (NFR-XXX)
- [ ] Note any user stories that imply specific UI elements

#### Coverage Verification
For EACH requirement, ask:
- **Is it visualized?** - Does ANY wireframe show this requirement?
- **Is it labeled?** - Is there an annotation pointing to where it's demonstrated?
- **Is it accurate?** - Does the wireframe match what the spec describes?

#### Common Gaps to Catch
- **Missing states** - Spec mentions error/loading/empty states, wireframe only shows happy path
- **Missing user roles** - Spec has admin vs member views, wireframe only shows one
- **Missing flows** - Spec describes multi-step process, wireframe only shows step 1
- **Missing edge cases** - Spec mentions "if X then Y", wireframe doesn't show Y
- **Phantom requirements** - Wireframe shows FR-XXX label but that FR doesn't exist in spec

#### Severity for Spec Issues
- **CRITICAL**: Entire FR/SC not visualized anywhere
- **MAJOR**: FR partially shown but missing key aspect
- **MINOR**: FR shown but not annotated/labeled

---

### 14b. REQUIREMENTS LEGEND PANEL VERIFICATION (MANDATORY)

**Every wireframe with FR or SC annotations MUST have a REQUIREMENTS KEY panel.**

#### Checklist
- [ ] **Legend exists**: REQUIREMENTS KEY panel present at y>=700
- [ ] **Legend complete**: Every FR and SC code in annotations appears in legend
- [ ] **No phantom entries**: Legend doesn't list FR/SC not on this page
- [ ] **Short statements present**: Each entry has descriptive text
- [ ] **MUST/SHOULD preserved**: Requirement keywords visible in FR statements
- [ ] **Metrics preserved**: SC statements include measurable values
- [ ] **Inline context**: ALL annotations show `XX-XXX: [context]`, not just codes
- [ ] **US inline-only**: US codes have inline context but NO legend entry

#### Detection Method
```bash
# Extract all FR/SC codes from annotations
grep -oE "(FR|SC)-[0-9]{3}" [file].svg | sort -u > page_reqs.txt

# Extract all FR/SC codes from legend
grep "requirements-legend" -A 50 [file].svg | grep -oE "(FR|SC)-[0-9]{3}" | sort -u > legend_reqs.txt

# Compare (should be identical)
diff page_reqs.txt legend_reqs.txt

# Check for US codes in legend (should be empty)
grep "requirements-legend" -A 50 [file].svg | grep -oE "US-[0-9]{3}"
```

#### Issue Classifications
| Issue | Classification |
|-------|----------------|
| Missing REQUIREMENTS KEY panel | 🔴 REGENERATE |
| Legend missing some page FR/SC | 🔴 REGENERATE |
| Legend has extra FR/SC not on page | 🔴 REGENERATE |
| US code appears in legend | 🔴 REGENERATE |
| FR/SC annotation missing inline context | 🟢 PATCH |
| US annotation missing inline context | 🟢 PATCH |
| Short statement too long (>45 chars) | 🟢 PATCH |

---

### 15. ⛔ FOOTER SIGNATURE LINE (Template Compliance - MANDATORY)

**Every SVG wireframe MUST have the standardized footer signature line.**

#### Required Format
```svg
<!-- Footer (MUST be at y=780, LEFT-ALIGNED at x=60) -->
<text x="60" y="780" text-anchor="start" class="text-muted">[feature:page] | [Page Title] | ScriptHammer</text>
```

#### Validation Checklist
- [ ] **Position**: `x="60"` (left-aligned, NOT centered at x=700)
- [ ] **Position**: `y="780"` (NOT y=790 or other values)
- [ ] **Anchor**: `text-anchor="start"` (NOT "middle")
- [ ] **Format**: `[NNN:PP] | [Title] | ScriptHammer` where NNN=feature number, PP=page number
- [ ] **Class**: `class="text-muted"`

#### Detection Method
```bash
# Check footer format in all SVGs for a feature:
grep -n "y=\"78[0-9]\".*text-anchor" docs/design/wireframes/[feature]/*.svg
grep -n "y=\"79[0-9]\".*ScriptHammer" docs/design/wireframes/[feature]/*.svg
```

#### Common Failures

| Found | Problem | Classification |
|-------|---------|----------------|
| `x="700" y="790" text-anchor="middle"` | Old centered format | 🔴 REGENERATE |
| No footer at all | Missing signature | 🔴 REGENERATE |
| `y="780"` with wrong content | Content text at footer position | 🔴 REGENERATE |
| Wrong page numbering format | e.g., "Feature 001" instead of "001:01" | 🔴 REGENERATE |

#### Reference (Correct Format)
From `000-rls-implementation/02-policy-patterns.svg`:
```svg
<text x="60" y="780" text-anchor="start" class="text-muted">000:02 | RLS Policy Patterns | ScriptHammer</text>
```

**Footer signature issues are ALWAYS 🔴 REGENERATE** - position changes are structural, not patchable.

---

### 16. ⛔ ANNOTATION CLARITY (Self-Explanatory Labels - MANDATORY)

**All annotations and labels MUST be self-explanatory WITHOUT reading spec.md.**

#### Success Criteria Labels Check
- [ ] **SC codes have context**: Not "SC-001: <3 min" but "SC-001: Signup <3 min"
- [ ] **Metrics specify WHAT**: Not "<2 sec" but "Login response <2 sec"
- [ ] **No cryptic abbreviations**: Reader can understand without external docs

**Examples of FAILURES:**
| Found | Problem | Should Be |
|-------|---------|-----------|
| `SC-001: <3 min` | What takes 3 min? | `SC-001: Signup flow <3 min` |
| `SC-002: <2 sec` | 2 sec for what? | `SC-002: Login response <2 sec` |
| `SC-004: 0 breach` | Zero breach of what? | `SC-004: Zero security breaches` |
| `1K users` | 1K users doing what? | `SC-003: Handle 1K concurrent logins` |

#### Color Legend Check
- [ ] **If semantic colors are used, is there a legend?**
- [ ] **Does the legend explain what each color means?**

**Common Color Issues:**
| Issue | Classification |
|-------|----------------|
| Green/yellow/purple borders with no legend | 🔴 REGENERATE - add legend |
| Success criteria codes without descriptions | 🔴 REGENERATE - add context |
| Metrics without specifying what's measured | 🔴 REGENERATE - add clarity |

#### Severity for Annotation Clarity
- **MAJOR**: Success criteria codes without descriptions
- **MAJOR**: Semantic colors without legend
- **MINOR**: Abbreviations not expanded (FR, SC, NFR)

**Note**: Cryptic labels waste space and communicate nothing. Every label should be instantly understandable to someone who hasn't read the spec.

---

## Severity Ratings

### CRITICAL (Must fix before implementation)
- Content completely unreadable
- Major layout collision/overlap
- Text obscured by decorative elements (badges, indicators, rings)
- Content overflowing outside container bounds (rows escaping panels)
- Missing functional requirements
- Accessibility failure (contrast below 4.5:1)
- Elements clipped to invisibility

### MAJOR (Should fix, impacts quality)
- Partial text truncation
- Significant spacing inconsistency
- Panel boundary violations
- Touch target too small
- AAA contrast failure (below 7:1)

### MINOR (Nice to fix, polish)
- Slight misalignment (1-2px)
- Minor spacing inconsistency
- Suboptimal arrangement
- Cosmetic imperfections

---

## Issue Classification (🟢 vs 🔴) - BINARY ONLY

**CRITICAL**: Every issue must be classified as EITHER patchable OR regeneration-required. There is NO third option.

### 🟢 PATCHABLE (safe to auto-fix)
- Missing CSS class definition
- Wrong color hex value
- Font size too small
- Typo in visible text

### 🔴 REGENERATE (do NOT attempt to patch)
- Layout overlap/collision
- Element positioning (x, y, transform)
- Spacing issues (cramped, gaps, wasted space)
- Canvas size problems
- Row/section arrangement
- Touch target sizing (may need layout reflow)
- **Missing content/rows** (e.g., "missing sessions row")
- **Any structural addition or removal**
- **Arrow-through-text collision** (flow arrows crossing labels/content)
- **Wasted space** (>100px unused while content is cramped or arrows detour)

### ❌ NO EXCEPTIONS - EVERY ISSUE GETS FIXED

If you find a problem, log it. If you log it, it gets fixed. No exceptions.

- 🟢 → will be patched in place by `/wireframe` (preserves layout)
- 🔴 → will be regenerated by `/wireframe` (uses feedback)

**There is no "acceptable as-is."** The review's job is to be rigorous. If something is wrong, it's wrong. Log it, classify it, and it will be fixed.

**Rule**: If ANY issue in a file is 🔴, the ENTIRE file needs regeneration. Do NOT patch other issues in that file - they'll be overwritten anyway.

---

## ⛔ AUTOMATIC 🔴 REGENERATE CONDITIONS (STOP REVIEW)

**These issues are SO FUNDAMENTAL that finding them means the file needs complete regeneration. Do NOT continue listing individual issues - just mark 🔴 REGENERATE and provide feedback.**

### Instant REGENERATE Triggers (Cannot Be Patched)

| Condition | How to Detect | Why It's Unfixable |
|-----------|---------------|-------------------|
| **Wrong theme** | Architecture diagram using light (#c7ddf5) background | Theme is baked into every color, gradient, and style |
| **Unreadable fonts** | Any text too small to read at intended zoom | Font sizes require layout reflow to avoid overflow |
| **Arrows through content** | Any arrow crossing text, labels, or panels | Arrow paths are structural - moving requires reorganizing |
| **Low contrast text** | Dark text on dark backgrounds, muted on purple | Contrast fixes may cascade to require layout changes |
| **Massive wasted space** | >100px unused while content is cramped | Layout is fundamentally wrong - needs redistribution |
| **Missing footer** | No `NNN:PP | Title | ScriptHammer` at y=780 | Footer positioning is template-level |
| **Wrong footer position** | Footer not at `x="60" y="780" text-anchor="start"` | Requires regeneration to fix consistently |
| **Mobile position wrong** | Mobile group not at `translate(980, 60)` | All wireframes in feature must match - structural |

### When You Find an Instant Trigger

**STOP the detailed review immediately. Output:**

```markdown
## ⛔ INSTANT REGENERATE: [filename.svg]

**Trigger:** [which condition from table above]
**Evidence:** [specific observation, e.g., "Light theme gradient #c7ddf5 in bgGrad"]
**Action:** 🔴 REGENERATE

### Feedback for Regeneration
- **Required theme:** [Dark/Light]
- **Required canvas:** [1400×800 / 1600×1000]
- **Key fix:** [e.g., "Use dark theme template, expand fonts to readable sizes"]
```

**Do NOT list individual issues for instant-trigger files. They're all irrelevant once you're regenerating.**

### Files That Just Need ✅ PASS Verification

If a file has no instant triggers and no 🔴 structural issues:
1. Still complete Visual Description
2. Still complete Overlap Matrix
3. Still verify Devil's Advocate checkpoint
4. Only then declare ✅ PASS

**A file without issues still requires full verification - don't assume correctness.**

---

## 🔴 Regeneration Feedback (REQUIRED)

When flagging a file for regeneration, you MUST provide constructive feedback - not just "regenerate":

### Template for Regeneration Cases

```markdown
## 🔴 REGENERATION REQUIRED: [filename.svg]

### Diagnosis
What's visually broken (be specific: coordinates, element names, overlap areas)

### Root Cause
WHY the layout doesn't work (not just "it overlaps" - explain the structural problem)

### Suggested Layout
Concrete alternative arrangement:
- Row 1: [what should be here]
- Row 2: [what should be here]
- Consider: [specific layout approach]

### Spec Requirements to Preserve
FR/SC items the regenerated version must still demonstrate
```

### Example Feedback (from 004 failure)

```markdown
## 🔴 REGENERATION REQUIRED: 01-responsive-navigation.svg

### Diagnosis
Mobile breakpoints row (4 devices horizontal at y=240) collides with Mobile Expanded Nav
phone frame. The 320px device extends to x=1090, but expanded nav starts at x=980.
They overlap by 110px.

### Root Cause
Trying to fit 4 mobile device previews + 1 full-height phone frame in a single row.
Too much horizontal content for 1400px canvas.

### Suggested Layout
- Row 1: Desktop + Tablet headers (1024px and 768px views)
- Row 2: Mobile breakpoints 2x2 grid (LEFT) + Expanded Nav phone (RIGHT)
- Row 3: Requirements panel (full width, below both)

This separates dense mobile content from the full-height phone, eliminating collision.

### Spec Requirements to Preserve
- FR-001: Viewport fit (320-428px, no h-scroll)
- FR-002: Proportional shrinking
- FR-004: 44x44px touch targets (show actual measurements)
- FR-005: 8px spacing minimum
```

**Why this matters**: This feedback passes to `/wireframe` so the regeneration attempt has guidance, not just "try again and hope for better."

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

### 1. Read the Spec FIRST (MANDATORY)

**See Category 14 (Spec Compliance) for the extraction checklist.**

### 2. MANDATORY: View Rendered Wireframes Visually ⚠️ CRITICAL

**Complete Step 1 (Viewer Setup) - you must view rendered wireframes, not just read SVG code.**

### 3. MANDATORY: Visual Description for Each Wireframe ⚠️ REQUIRED OUTPUT

**For EACH SVG file, you MUST write a visual description BEFORE listing issues.**

This forces you to actually observe the rendered image rather than pattern-match against code.

**Required format in WIREFRAME_ISSUES.md:**

```markdown
### [filename.svg]

**Visual Description** (what I see in the rendered image):
- Layout: [describe the major sections/panels and their arrangement]
- Score/indicator elements: [describe any circular indicators, badges, progress rings]
- Text readability: [can all text be read clearly? any clipping?]
- Mobile section: [describe the phone frame area]
- Overall impression: [does anything look "off" at first glance?]

**Issues Found:**
| # | Category | Severity | ... |
```

**If you cannot write a visual description, you did not look at the rendered image.**
**Skipping this section = automatic review failure.**

### 3b. MANDATORY: Overlap Matrix for Each Wireframe ⚠️ REQUIRED OUTPUT

**For EACH SVG file, you MUST create an overlap matrix showing every pair of adjacent regions.**

This forces you to explicitly verify that no regions collide. You cannot "glance and pass."

**Required format in WIREFRAME_ISSUES.md:**

```markdown
### [filename.svg] - Boundary Verification

| Region A | A-bounds | Region B | B-bounds | Gap/Overlap |
|----------|----------|----------|----------|-------------|
| Row 1 Test Suite | y=80-200 | Row 2 Test Criteria | y=220-375 | ✅ 20px gap |
| Time & Cognitive | x=890-1080, y=220-360 | BUILD FAILED | x=970-1110, y=260-360 | ❌ OVERLAP x=970-1080 |
| Desktop area | x=40-940 | Mobile area | x=980-1340 | ✅ 40px gap |

**Overlap detected: 1** → File cannot pass
```

**Rules:**
1. List EVERY pair of adjacent elements (horizontally or vertically adjacent)
2. Calculate actual pixel boundaries from SVG coordinates
3. If Gap/Overlap shows negative number or "OVERLAP" → File is 🔴 REGENERATE
4. You CANNOT declare ✅ PASS if the overlap matrix has ANY ❌ entries

**Minimum checks per wireframe:**
- Desktop section vs Mobile section (horizontal)
- Each row vs the row below it (vertical)
- Annotation labels vs their adjacent panels
- Any elements that appear "close" in the screenshot

**If you skip this section, the review is invalid.**
**No overlap matrix = No pass. Period.**

### 4. For EACH wireframe, work through ALL 16 category checklists above

Don't rush. Spend time on each SVG. Zoom in mentally on different regions.

### 5. Document EVERY issue found

```markdown
# Wireframe Issues: [Feature Name]

## Summary
- **Files reviewed**: X SVGs
- **Issues found**: X total (X critical, X major, X minor)
- **Pass**: N
- **Reviewed on**: YYYY-MM-DD

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 12 | - | 12 | 12 |
| 2 | 2026-01-01 | 8 | 6 | 2 | 8 |

## Issues by File

### [filename.svg]

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Row collision | Major | 🔴 | Pass 1 | y=240-280 | Mobile device row overlaps with "MOBILE EXPANDED NAV" section | Move expanded nav to right side or increase vertical spacing by 60px |
| 2 | Contrast | Major | 🟢 | ✅ RESOLVED | FR cards | #8b5cf6 text on #e8d4b8 = 3.2:1, fails AAA | Use #6d28d9 for 7:1 ratio |
| 3 | Cramped | Minor | 🔴 | NEW Pass 2 | 320px device | Logo and icons too close, no breathing room | Reduce logo width or stack icons |
```

**Status values:**
- `Pass N` - Issue first found in Pass N, still exists
- `NEW Pass N` - Issue newly discovered in Pass N
- `✅ RESOLVED` - Issue was fixed (keep for history)

### 6. Include "Suggested Fix" for every issue

Don't just identify problems - propose solutions.

### 7. Devil's Advocate Checkpoint ⚠️ REQUIRED BEFORE DECLARING "RESOLVED"

**Before marking ANY file as "✅ PASS" or declaring "All Issues Resolved", you MUST ask yourself:**

1. **What's the most likely issue I overlooked?**
   - Did I actually look at circular indicators overlapping text?
   - Did I check ALL text for clipping, not just headings?
   - Did I verify the mobile section separately from desktop?

2. **If I had to find ONE more issue, where would it be?**
   - Look there. Actually look.

3. **What would a fresh reviewer catch that I missed?**
   - You've been staring at this. You're blind to it now.
   - Assume you missed something. Find it.

4. **Did I create the Overlap Matrix?**
   - If no matrix exists for this file → review is INVALID
   - If matrix exists but has ANY ❌ entries → file CANNOT pass
   - Look at the screenshot again. Trace each region boundary with your eyes.

5. **The Overlap Blindness Test:**
   - Find TWO elements that are close together in this wireframe
   - State their exact boundaries: Region A at (x, y, width, height), Region B at (x, y, width, height)
   - Calculate the gap: `Region_B_start - Region_A_end = gap`
   - If you can't do this math for the closest pair of elements, **you didn't look carefully enough**

6. **The Truncation Blindness Test:**
   - Find the longest annotation label in the wireframe
   - Read it out loud, character by character
   - Does it end abruptly? Does it say "FR-024, FR-0" instead of "FR-024, FR-025, FR-026, FR-027"?
   - If you can't read the COMPLETE text of EVERY label, **it's truncated**

**Document your devil's advocate check:**
```markdown
## Devil's Advocate Check
- Most likely overlooked area: [where]
- I re-examined and found: [nothing new / new issue X]
- Fresh reviewer would catch: [what]
- Overlap Matrix created: [yes/no] - if no, STOP and create it
- Closest element pair: [Region A] at [bounds] vs [Region B] at [bounds] = [gap]px
- Longest label verified: "[full text of label]" - complete? [yes/no]
```

**Skipping this step = you WILL miss issues. This is not optional.**

### 8. Update Progress Tracker

File: `docs/design/WIREFRAME_REVIEW_PLAN.md`

---

## Report Format

```markdown
## Batch X Critical Review Complete

### Numbers
- Features: X
- SVGs: X
- **Critical issues**: X (MUST FIX)
- **Major issues**: X (SHOULD FIX)
- **Minor issues**: X (NICE TO FIX)

### Most Problematic Files
1. [filename.svg] - X issues (X critical)
2. [filename.svg] - X issues

### Issue Breakdown by Category
| Category | Count | Examples |
|----------|-------|----------|
| Overlap/Collision | X | Row 1/2 collision in 004-mobile-first |
| Spacing | X | Cramped device previews |
| Contrast | X | Muted text fails AAA |
| ... | | |

### Immediate Action Items
1. **CRITICAL**: [specific issue and file]
2. **CRITICAL**: [specific issue and file]

### Regeneration Candidates
These wireframes have enough issues to warrant regeneration rather than patching:
- [feature]: X issues, structural problems
```

---

## Arguments

- `batch 1-10` - Review specific batch
- `all` - Review everything
- `[feature-number]` - Single feature (e.g., `004`)
- `re-review [feature]` - Re-review after fixes

---

## Remember

**Your job is to make these wireframes BETTER, not to make the creator feel good.**

Find the flaws. Document them clearly. Propose fixes. Be relentless.

---

## After Review

### Single Command: `/wireframe [feature]`

The `/wireframe` command now handles everything intelligently:

```bash
/wireframe 004    # Smart: patches 🟢, regenerates 🔴, skips ✅
```

**What it does:**

| File has... | Action |
|-------------|--------|
| No issues | ✅ SKIP - already good |
| Only 🟢 issues | 🟢 PATCH in place (color, font, typo, CSS) |
| Any 🔴 issues | 🔴 REGENERATE with feedback |

The command will:
- Read WIREFRAME_ISSUES.md and triage each file
- Patch 🟢 files directly (preserves existing layout)
- Regenerate 🔴 files using the feedback (Diagnosis, Suggested Layout, etc.)
- Update WIREFRAME_ISSUES.md with completion status

### Simplified Workflow

```
/wireframe-review [feature]     # Review → classify 🟢/🔴 → create WIREFRAME_ISSUES.md
    ↓
/wireframe [feature]            # Smart: patches 🟢, regenerates 🔴, skips ✅
    ↓
(repeat until all issues resolved)
```

**Note**: `/wireframe-fix` is deprecated - `/wireframe` now handles both.

### Lesson Learned (004 Failure)

**DO NOT** try to patch structural issues. The 004-mobile-first-design attempt to "fix" overlap by extending canvas and moving elements made things WORSE - creating new overlaps and wasted space. When layout is broken, regenerate fresh.
