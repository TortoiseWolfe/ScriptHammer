---
description: Critically review SVG wireframes with ruthless attention to detail. Find EVERY flaw.
---

## ⚠️ CRITICAL REVIEW PHILOSOPHY

**NEVER TRUST. ALWAYS VERIFY.**

- Assume EVERY wireframe has issues. If you found zero, you're blind.
- The default is FAIL until proven otherwise, not PASS until proven broken.
- Finding 0 issues on Pass 1 is a REVIEW FAILURE, not a wireframe success.
- Do NOT rubber-stamp. Do NOT auto-pass. Do NOT skip checks.
- If something looks "fine," look harder. You missed something.

**The user found 21 issues on a wireframe you passed with "no issues detected."
That is unacceptable. Every check exists to catch problems, not to confirm success.**

---

## ⛔ MANDATORY FIRST CHECKS (BLOCKING - DO BEFORE ANYTHING ELSE)

**These checks are BLOCKING. You cannot proceed with the review until all pass. Do NOT skip to issue categories.**

### Check 1: Theme Verification (BLOCKING)

**Before reviewing ANY file, verify the theme is correct for the content type.**

1. Read the feature name and wireframe title
2. Check for keyword matches:

| Theme | Keywords | Background |
|-------|----------|------------|
| **LIGHT** (UI/UX) | `dashboard`, `form`, `modal`, `screen`, `page`, `settings`, `profile`, `login`, `signup`, `checkout`, `cart`, `menu`, `navigation` | `#c7ddf5` or `#e8d4b8` parchment |
| **DARK** (Backend) | `architecture`, `RLS`, `API`, `auth`, `security`, `testing`, `integration`, `pipeline`, `database`, `schema`, `flow`, `system` | `#0f172a` or `#1e293b` gradient |

**Priority:** UI/UX keywords take precedence. "Dashboard" = LIGHT even if title also contains "system".

**How to verify:** Check SVG `<linearGradient id="bgGrad">` for background colors.

**⛔ If UI/UX wireframe uses DARK theme → 🔴 REGENERATE immediately. Do not continue review.**
**⛔ If architecture/backend diagram uses LIGHT theme → 🔴 REGENERATE immediately. Do not continue review.**

**Exception - Hybrid Themes:**
Dark wireframes MAY contain light-themed insets for:
- Storybook/component previews
- UI mockups showing end-user views
- Browser window simulations

Light insets use existing Light Theme (parchment/sky) with border to separate from dark parent.

**⚠️ HYBRID TRIGGER KEYWORDS in dark wireframes:**
| Keyword | Expected Behavior |
|---------|-------------------|
| `Storybook` | Light-themed panel showing component preview/a11y tab |
| `Preview` | Light inset showing end-user view |
| `Browser` | Light window simulation |

**If dark wireframe contains Storybook panel → verify it uses LIGHT inset, not dark.**
**Missing light inset for hybrid content → 🔴 REGENERATE.**

### Check 2: Viewer Setup (BLOCKING)

**Complete Step 1 (Viewer Setup) before proceeding.**

**⛔ If you cannot see the ENTIRE wireframe in the screenshot → adjust zoom before continuing.**

### Check 3: Detail Inspection at 200% (BLOCKING)

**Zoom to 200% and pan through each quadrant. Look for issues invisible at overview zoom.**

At 200%, issues become visible that you'd miss at 100%:
- Text truncation, clipping, overlap
- Alignment problems, spacing inconsistencies
- Small font readability issues
- Arrow paths crossing content
- Container boundary violations
- Vertical stacked items exceeding container height (step lists, card grids)

**⛔ If you find issues at detail zoom that require layout changes → 🔴 REGENERATE.**

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

### Check 6: Light Theme Consistency (BLOCKING for Light Wireframes)

**For wireframes using Light theme (parchment/sky background), verify these mandatory elements:**

| Element | Standard | How to Check |
|---------|----------|--------------|
| Desktop container | `<rect x="40" y="60" width="900" height="580" rx="8" fill="#e8d4b8" stroke="#b8a080"/>` | Search for `desktop-view` group, verify rect exists inside |
| Mobile frame | 360×700 (rx=24) | Check first rect dimensions in `mobile-view` group |
| Mobile screen | 340×680 (rx=16) | Check second rect in `mobile-view` group |
| Status bar icons | `📶 🔋` at x=310, text-anchor="end" | Search for emoji text in status bar area |

**Comparison reference**: 002-cookie-consent wireframes have correct Light Theme structure.

**⛔ If Light wireframe missing any of these elements → 🔴 REGENERATE immediately.**

### Check 7: Requirements Legend (BLOCKING)

**For EVERY wireframe with <kbd>**FR**</kbd> / <kbd>**SC**</kbd> / <kbd>**NFR**</kbd> annotations:**

1. Look for **REQUIREMENTS KEY** panel at y=690 (bottom-left, height grows upward)
2. Verify EVERY annotation code has a description in the legend
3. Verify NO extra codes in legend that aren't on the page

**⛔ If <kbd>**FR**</kbd> / <kbd>**SC**</kbd> annotations exist but no REQUIREMENTS KEY panel → 🔴 REGENERATE immediately.**

### Check 8: Styling Inconsistency (BLOCKING)

**Scan for visual inconsistencies in repeated/similar elements:**

| Pattern | Example | What to Check |
|---------|---------|---------------|
| Missing fill | Button with transparent bg, siblings have solid | Background color consistency |
| Outline vs solid | 2 buttons filled, 1 only has stroke (no fill) | All same-type buttons identical |
| Border mismatch | One card has border, others don't | Stroke/border consistency |
| Font mismatch | Same label type but different font-size | Typography consistency |
| Color drift | Same element type, slightly different colors | Fill/stroke hex values |
| Padding mismatch | List items with uneven internal spacing | Consistent inner spacing |
| Text alignment drift | Same-purpose labels with different text-anchor or x values | Check text-anchor consistency |

**⚠️ COMMON FAILURE: List items with action buttons**
- Scan ALL repeated list items (issues list, table rows, card grids)
- Each item's button/badge/indicator MUST have identical styling
- Example: 3 "View Fix →" buttons where 2 are solid fill, 1 is outline-only = 🟢 PATCHABLE (fix fill attribute)

**Visual scan method:**
1. Group similar elements (all buttons, all cards, all list items)
2. Compare styling within each group - should be IDENTICAL
3. Look for "one of these is not like the others" patterns
4. Check that repeated UI patterns have consistent fills, strokes, fonts

**⛔ If similar elements have mismatched styling → 🟢 PATCHABLE (fix fill/stroke/font attributes).**

### Check 9: SVG Syntax Validation (BLOCKING)

**Parse the SVG file for syntax errors that break rendering.**

Common syntax errors to scan for:
| Pattern | Example of Error | Detection |
|---------|------------------|-----------|
| Broken transform | `transform="translate(320"` | Missing `)` or comma |
| Unclosed quotes | `fill="#8b5cf6` | Quote without closing |
| Malformed attributes | `y="40">` after transform | Wrong attribute placement |
| Invalid coordinates | `translate(NaN, 100)` | Non-numeric values |

**Validation method:**
```bash
# Quick syntax check - if this fails, SVG is broken
grep -n 'transform="[^"]*[^")]"' *.svg  # Unclosed transform
```

**⛔ If SVG has syntax errors that break rendering → 🔴 REGENERATE immediately.**

### Check 9: Text Truncation Detection (BLOCKING)

**Systematically verify ALL FR/SC/NFR tags are FULLY visible.**

At 200% zoom, read every annotation character-by-character:
- Does "FR-011-014" show all characters, or is it cut to "FR-011-01"?
- Does "FR-022-025" fit within its panel, or does it bleed past the edge?
- Can you read the ENTIRE text of every annotation?

**High-risk locations:**
- Panel corners (tags squeezed at edges)
- Right margins (text extending past canvas)
- Dense areas (multiple tags competing for space)
- Narrow containers (mobile screens, small panels)

**⛔ If ANY tag is truncated (even 1 character cut off) → 🔴 REGENERATE immediately.**

### Check 10: Multi-Column Text Overlap (BLOCKING)

**For any multi-column layout (User Stories, Feature grids, side-by-side lists):**

1. Identify all multi-column areas
2. Check each row: Does Column 1 text run into Column 2 text?
3. Check vertical: Does Row N text collide with Row N+1?

**Common failure patterns:**
- User Stories in 2 columns: US-001 collides with US-004
- Feature grids: Long labels overlapping adjacent cells
- Two-column legends: Left column running into right

**Visual test:** At 200%, can you read EVERY label without any text touching?

**⛔ If text from adjacent elements collides → 🔴 REGENERATE immediately.**

### Check 11: Flow Diagram Completeness (BLOCKING for Architecture)

**For EVERY decision point in flow diagrams:**

1. Trace the "Yes" path → Does it reach a terminal state?
2. Trace the "No" path → Does it reach a terminal state?
3. Check arrow lengths → Does any arrow just "stop" mid-canvas?

**RLS flow must show:**
```
Query Request
     ↓
RLS Enabled? ──No──→ ALLOW (green)
     ↓ Yes
Policy Match? ──Yes──→ ALLOW (green)
     ↓ No
   DENY (red) ← This MUST exist!
```

**Detection:**
- Arrow drops only 10-20px then stops → TRUNCATED
- Decision has two branches but only one destination → INCOMPLETE
- "No" and "Yes" both lead to same outcome → MISLEADING

**⛔ If any flow path is incomplete or misleading → 🔴 REGENERATE immediately.**

### Check 12: Color Consistency (BLOCKING)

**Related elements MUST use matching colors.**

| Pattern | Check |
|---------|-------|
| Role → Badge | If `authenticated` is purple, its badges should be purple (not blue) |
| Status → Legend | If ALLOW is blue in legend, all ALLOW badges must be blue |
| Theme coherence | Role icons, badges, and legends using same palette |

**Detection method:**
1. Identify the color for each role/status in the legend
2. Find all instances of that role/status in the diagram
3. Verify colors match

**Example failure:** `authenticated` role box is purple (#8b5cf6) but "ALLOW (own)" badges are blue (#2563eb).

**⛔ If color assignments are inconsistent → 🔴 REGENERATE immediately.**

### Check 13: Element Boundary Violations (BLOCKING)

**Tags and labels must NOT overlap panel borders or other structural elements.**

At 200% zoom, check every FR/SC tag:
- Is the tag INSIDE the panel it describes?
- Does the tag overlap the panel border (dashed/solid line)?
- Is the tag positioned on TOP of another element?

**Common failures:**
- FR-001-005 positioned on top of audit_logs dashed border
- SC tags overlapping panel corners
- Annotations bleeding across container boundaries

**⛔ If any tag overlaps panel borders or structural elements → 🔴 REGENERATE immediately.**

### First Checks Statement (MANDATORY)

**Before proceeding to detailed review, you MUST write:**

```
FIRST CHECKS COMPLETE:
- Theme: [Dark/Light] - [Correct/WRONG for feature type]
- Viewer: Overview screenshot at 100%, detail inspection at 200%
- Detail inspection: [All clear / Issues at: ...]
- Arrow paths: [Clear / Through content at: ...]
- Space utilization: [Good / Wasted space at: ...]
- Requirements legend: [Present with all FRs / Missing / Incomplete]
- Styling consistency: [Consistent / Mismatch at: ...]
- SVG syntax: [Valid / BROKEN at line: ...]
- Text truncation: [None / Truncated at: ...]
- Multi-column overlap: [None / Overlap at: ...]
- Flow completeness: [Complete / Missing terminal at: ...]
- Color consistency: [Consistent / Mismatch at: ...]
- Toggle colors (if present): [On=#22c55e, Off=#64748b / WRONG: ...]
- Element boundaries: [Respected / Violation at: ...]
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

**Each SVG gets its own issues file** alongside the SVG:
```
docs/design/wireframes/[feature]/01-page-name.svg
docs/design/wireframes/[feature]/01-page-name.issues.md
```

### If NO existing .issues.md for this SVG:
- This is **Pass 1** (fresh review)
- Proceed with full review
- Create new `[svg-name].issues.md`

### If existing .issues.md found:
- Read the file and extract:
  - **Current pass number** (from Review History)
  - **Previous issues** (all rows from issue table)
  - **Issue fingerprints** (Category + Location + Description hash for matching)
- Increment pass number
- Compare findings against previous pass

### File Naming Convention

| SVG File | Issues File |
|----------|-------------|
| `01-consent-modal.svg` | `01-consent-modal.issues.md` |
| `02-privacy-settings.svg` | `02-privacy-settings.issues.md` |
| `03-auth-flow.svg` | `03-auth-flow.issues.md` |

**One issues file per SVG. Never combine multiple SVGs into one issues file.**

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

### ⛔ MINIMUM ISSUE GATE (CHECK FIRST)

| Pass Number | Required | Found | Gate |
|-------------|----------|-------|------|
| Pass 1 | ≥5 | [count] | [✅/⛔] |
| Pass 2+ | ≥3 | [count] | [✅/⛔] |

**If gate = ⛔ → STOP. Re-run the 16 issue categories. You missed something.**

### ⛔ File CANNOT pass if ANY of these are true:

| Blocker | Check |
|---------|-------|
| No Overlap Matrix | Must be created for every file |
| Overlap Matrix has ❌ | Any overlap detected = fail |
| No Visual Description | Must describe what you see |
| Devil's Advocate skipped | Must complete checkpoint |
| Truncated text | FR codes cut off, labels ending in "..." |
| Unreadable labels | Every annotation must be readable character-by-character |
| Footer wrong/missing | Must be `x="60" y="780"` with `NNN:PP | Title | ScriptHammer` (no brackets, fill="#94a3b8") |

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

### 1b. Resize Browser and Navigate

```javascript
// 0. FIRST: Resize browser to 1920x1080 for proper quadrant coverage
// Default Playwright viewport (780x493) is too small - quadrant shots miss content
mcp__MCP_DOCKER__browser_resize({ width: 1920, height: 1080 })

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

// 3. Focus mode and legend are OFF by default - no need to toggle
// If you need focus mode (hide sidebar/footer), press 'f'
// If you need legend drawer, press 'l'
// Both are toggles, so only press if you specifically want them ON
// mcp__MCP_DOCKER__browser_press_key({ key: "f" })
// mcp__MCP_DOCKER__browser_press_key({ key: "l" })

// 4. Reset zoom to 85% baseline
mcp__MCP_DOCKER__browser_press_key({ key: "0" })

// Setup complete. Proceed to Step 2 for zoom/screenshot workflow.
// ⚠️ ArrowUp = zoom IN, ArrowDown = zoom OUT
```

### 1c. Zoom Levels (Two-Phase)

| Canvas Size | Overview Zoom | Detail Zoom | Overview Keys | Detail Keys |
|-------------|---------------|-------------|---------------|-------------|
| All sizes | 100% | 200% | `0`, `ArrowUp` x1 | `0`, `ArrowUp` x8 |
| **⚠️ CRITICAL** | `ArrowUp` = zoom IN | `ArrowDown` = zoom OUT | **Never use ArrowDown for detail** | |

**Two-phase approach:**
1. **Overview (100%)**: Structural check - layout, overlaps, theme (0, then ArrowUp x1)
2. **Detail (200%)**: Per-quadrant inspection - text readability, truncation (0, then ArrowUp x8)

### 1d. Take Screenshots (Relative Paths)

**Screenshots save to `/tmp/playwright-output/` inside the container. Use relative filenames.**

```javascript
// Screenshot naming: [NNN]-[PP]-[description].png
// Example: 002-01-consent-modal-overview.png
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-[description].png"
})

// Quadrant screenshots (at 200% zoom)
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
| Quadrant | CENTER/TL/TR/BL/BR | quadrant-CENTER |

**Full example for 002-cookie-consent, page 01:**
- `002-01-consent-modal-overview.png` (100% overview)
- `002-01-quadrant-CENTER.png` (200% center)
- `002-01-quadrant-TL.png` (200% top-left)
- `002-01-quadrant-TR.png` (200% top-right)
- `002-01-quadrant-BL.png` (200% bottom-left)
- `002-01-quadrant-BR.png` (200% bottom-right)

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
- **Overview = 100%** (0, then ArrowUp x1)
- **Detail inspection = 200%** (0, then ArrowUp x8, 5 shots cover full canvas)
- If text appears SMALLER than at 100%, you pressed the WRONG key

| Symptom | Problem | Fix |
|---------|---------|-----|
| Text getting smaller | Used `ArrowDown` (zoom out) | Press `0` to reset, then use `ArrowUp` |
| Can't see full canvas | At 200% detail zoom | Press `0` to return to 85%, then ArrowUp x1 for 100% |
| Text blurry/unreadable | At <100% | Press `ArrowUp` repeatedly until clear |

**Rule: If you can't read every character clearly at detail zoom, you're zooming the WRONG direction.**

**DO NOT skip viewer setup. DO NOT discover zoom/focus mid-review.**

---

## Step 2: Quadrant Deep Inspection (MANDATORY)

1. **Reset and zoom to 100%** for overview (press '0' then ArrowUp x1)
2. **Take overview screenshot** at 100%
3. **Zoom to 200%** for quadrant detail (press '0' then ArrowUp x8)

```javascript
// OVERVIEW SCREENSHOT
// Step 1: Reset to center and fullscreen (85%)
mcp__MCP_DOCKER__browser_press_key({ key: "0" })  // Reset: center + 85%

// Step 2: Zoom to 100% with ArrowUp x1 (good for overview of 1600×1000)
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // ~100% (overview zoom)

// Take overview screenshot at 100%
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-overview.png"
})

// QUADRANT DETAIL INSPECTION
// Step 3: Reset and zoom to 200% (0, then ArrowUp x8)
mcp__MCP_DOCKER__browser_press_key({ key: "0" })  // Reset first
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x1
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x2
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x3
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x4
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x5
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x6
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // Zoom in x7
mcp__MCP_DOCKER__browser_press_key({ key: "ArrowUp" })  // ~200% (quadrant detail)
// At 200%, ~960×540 canvas pixels visible - 5 shots (CENTER + 4 corners) cover full 1600×1000
```

3. **Pan to each quadrant** using direct JavaScript (pattern: CENTER → TL → TR → BR → BL):

```javascript
// Step 3: PAN to each quadrant at 200% zoom
// At 200%, ~960×540 canvas pixels visible. 5 shots (CENTER + 4 corners) cover full canvas.
// Use DIRECT JAVASCRIPT to set absolute pan coordinates (bypasses viewport drag limits).
//
// Pan formula: panX = (canvasWidth/2 - canvasX) * zoom
//              panY = (canvasHeight/2 - canvasY) * zoom
// Positive pan → reveals that side of canvas (e.g., +panX reveals LEFT)

// Screenshot Coverage (1600×1000 canvas):
// ┌─────────┬─────────┐
// │   TL    │   TR    │
// │ (480,   │ (1120,  │
// │  270)   │  270)   │
// ├────┬────┼────┬────┤
// │    │ CENTER │    │
// │    │(800,500)│    │
// ├────┴────┼────┴────┤
// │   BL    │   BR    │
// │ (480,   │ (1120,  │
// │  730)   │  730)   │
// └─────────┴─────────┘

// CENTER - shows middle of canvas where all quadrants overlap
// At panX=0, panY=0, viewport is centered on canvas center (800, 500)
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = 0; panY = 0; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-CENTER.png"
})

// TL - at 200% zoom, center (480, 270) → panX=+640, panY=+460
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = 640; panY = 460; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-TL.png"
})

// TR - at 200% zoom, center (1120, 270) → panX=-640, panY=+460
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = -640; panY = 460; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-TR.png"
})

// BR - at 200% zoom, center (1120, 730) → panX=-640, panY=-460
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = -640; panY = -460; updateTransform(); }`
})
mcp__MCP_DOCKER__browser_take_screenshot({
  filename: "[NNN]-[PP]-quadrant-BR.png"
})

// BL - at 200% zoom, center (480, 730) → panX=+640, panY=-460
mcp__MCP_DOCKER__browser_evaluate({
  function: `() => { panX = 640; panY = -460; updateTransform(); }`
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

**CENTER (Flow diagrams, central content)**
- [ ] Flow diagram arrows clear and readable?
- [ ] Central panels fully visible?
- [ ] No content split awkwardly between corners?
- [ ] Labels in center area complete?

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

**At 200%, for each shot**: Pan, run BASE checks, run LOCATION-SPECIFIC checks, note issues.

**Checkpoint**: Overview PNG saved at 100%, all 5 detail shots (CENTER + 4 corners) analyzed at 200%, issues noted.

---

## Critical Review Philosophy

Find problems, not praise. Assume every wireframe has issues. If something looks "fine," look harder.

---

## ⛔ MINIMUM ISSUE REQUIREMENTS (NON-NEGOTIABLE)

**Every wireframe has issues. If you found zero, you're not looking hard enough.**

| Pass | Minimum Issues | Consequence |
|------|----------------|-------------|
| Pass 1 (fresh review) | **≥5 issues** | Cannot declare PASS until 5+ found |
| Pass 2+ (subsequent) | **≥3 issues** | Cannot declare PASS until 3+ found |

**If you can't find enough issues, you haven't completed the existing review process thoroughly:**
- Did you zoom to 200% and inspect all 5 quadrants?
- Did you complete the Overlap Matrix for ALL adjacent element pairs?
- Did you run through ALL 16 issue categories?
- Did you do the Devil's Advocate checkpoint?
- Did you verify every label character-by-character?

**The techniques are in this skill. Use them. DO NOT DECLARE PASS UNTIL MINIMUM MET.**

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
| Stacked item overflow | Last item in list bleeds below container bottom? |

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

**⚠️ NUMBERED STEP LISTS (Flow diagrams, processes)**
- For each numbered list inside a panel:
  1. Count the steps (e.g., 4 steps)
  2. Calculate: `step_count × step_height + gaps + padding`
  3. Compare to container height
  4. Example: 4 steps × 66px + 3 gaps × 14px + 40px padding = 346px
     - Container height 280px → OVERFLOW by 66px!

| Check | Formula |
|-------|---------|
| Step list fits | (steps × height) + ((steps-1) × gap) + padding ≤ container_height |
| Last step visible | last_step_y + last_step_height < container_bottom_y |

**⛔ If last step bleeds below container → 🔴 REGENERATE.**

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

### 3c. ⛔ SECTION VERTICAL GAP CHECK (MANDATORY for Multi-Section Layouts)

**For multi-section layouts, verify gaps between sections.**

| Check | Method |
|-------|--------|
| Find all `translate(x, Y)` | `grep -n "translate" *.svg` |
| Calculate gap | next_Y - (current_Y + content_height) |
| Minimum gap | 60px between sections, 30px to footer |

**Gap Analysis Formula:**
```
gap = next_section_Y - (current_section_Y + current_section_height)
```

**Common failure**: Sections at Y=560, Y=600 with 180px content = 40px gap (TOO TIGHT)

**Detection**: If gap < 60px between sections → 🟢 PATCHABLE (adjust translate Y values +20-40px)

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
| <kbd>**FR**</kbd> Tags | **`#2563eb`** (blue) visible both themes? |
| <kbd>**SC**</kbd> Tags | **`#ea580c`** (orange) + **dashed** border? |
| <kbd>**US**</kbd> Tags | **`#0891b2`** (teal) + **dotted** border? |
| RLS Allow | **`#2563eb`** (blue) + **✓** icon? |
| RLS Deny | **`#991b1b`** (dark red) + **✗** + stripes? |
| RLS Conditional | **`#eab308`** (yellow) + **?** + dashed? |
| Status | Colorblind-safe with icons/patterns? |
| Badge text | Text MUST be readable against badge background, not parent background |
| All text | Every text element must pass contrast test against its IMMEDIATE background |

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

**⚠️ LEGEND INTERNAL SPACING STANDARD (Cross-Feature Consistency)**

| Element | Standard Value | Verify With |
|---------|----------------|-------------|
| Legend y | 690 | `grep "requirements-legend" *.svg` |
| Header y | 18 | `grep "legend-header" *.svg` |
| Row 1 translate | (20, 38) | `grep "translate(20," *.svg` |
| Row 2 translate | (20, 60) | (if 2-row legend) |
| Rect height | 60 (1-row) / 75 (2-row) | `grep "height=" *.svg` |

**Alignment Check Command:**
```bash
grep -E "(height=\"[67][05]\"|legend-header|translate\(20, [36])" *.svg
```

| Issue | Classification |
|-------|----------------|
| Missing/incomplete legend | 🔴 REGENERATE |
| Extra FR/SC not on page | 🔴 REGENERATE |
| US in legend | 🔴 REGENERATE |
| Missing inline context | 🟢 PATCH |
| Wrong internal spacing | 🟢 PATCH (align to standard) |

---

### 15. ⛔ FOOTER SIGNATURE LINE (MANDATORY)

**Required**: `x="60" y="780" text-anchor="start"` with `NNN:PP | [Title] | ScriptHammer`

**Footer Checklist:**
- [ ] `x="60"` (left-aligned, not centered)
- [ ] `y="780"` (NOT y=790 or y=770)
- [ ] `text-anchor="start"` (left alignment)
- [ ] Format: `NNN:PP | Title | ScriptHammer` (NO square brackets around NNN:PP)
- [ ] NNN = feature number (e.g., 002)
- [ ] PP = page number (e.g., 01, 02)
- [ ] `fill="#94a3b8"` (slate-400, NOT `#64748b` which is too dark)

**Verify with grep:**
```bash
grep -n "y=\"78[0-9]\"" *.svg  # Find footer y positions
grep -n "text-anchor" *.svg   # Check alignment
grep -n 'fill="#64748b"' *.svg  # Should return NOTHING (too dark)
grep -n 'fill="#94a3b8"' *.svg  # Should find footer
grep -n '\[0[0-9][0-9]:' *.svg  # Should return NOTHING (brackets are wrong)
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

**Note**: Styling mismatches (inconsistent fills/borders/fonts) are 🟢 PATCHABLE, not instant regenerate triggers.

---

## ⛔ COMMON FAILURE PATTERNS (CHECK EVERY TIME)

| Pattern | Example | Detection |
|---------|---------|-----------|
| Badge-on-badge contrast | "OWN" purple text on purple badge | Text same color as background |
| Redundant panels | REQUIREMENTS KEY duplicates FR/SC list | Same content in 2 places |
| Cut-short legends | Legend ends mid-canvas with room right | Legend width << available width |
| Row label clipping | Flow diagram labels too close vertically | Gap < font-size between rows |
| Header bloat | Table header wider than data columns | Header text overflows column |
| Container overflow | Badges extend past panel bounds | Element right edge > panel right edge |
| Unused space + cramped | Empty areas while content overlaps | Wasted space + overlap in same file |

---

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

## ⛔ TAG POSITION CHECKLIST (Pass 12 Learning)

**Verify ALL tags meet this standard:**

- [ ] Tags positioned in top-right corner of container
- [ ] 15px margin from right edge (x = container_width - 15)
- [ ] y=17 for first tag, y=35 for second tag
- [ ] `text-anchor="end"` for right-alignment
- [ ] FR tags before SC tags (consistent ordering: FR top/left, SC bottom/right)

**Example verification**:
```
Container: width=280
Expected tag x: 280 - 15 = 265
Actual tag x: [check SVG]
✅ PASS if x=265 with text-anchor="end"
❌ FAIL if x != 265 or missing text-anchor="end"
```

---

## ⛔ FOOTER CHECKLIST (Pass 13 Learning - Light Theme)

**Verify footer matches standard:**

- [ ] Uses `class="text-muted"` (NOT inline fill color)
- [ ] Position: x=60, y=780
- [ ] Alignment: `text-anchor="start"` (left-aligned)
- [ ] Format: `NNN:PP | Title | ScriptHammer`

**Common failures**:
- ❌ `fill="#64748b"` - too light (slate-500)
- ❌ `fill="#94a3b8"` - way too light (slate-400)
- ✅ `class="text-muted"` - correct (#4b5563 gray-600)

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

---

## Status Update (MANDATORY)

After completing review, update `docs/design/wireframes/wireframe-status.json`:

### At Review START

Set feature status to `review`:
```json
{
  "000-rls-implementation": {
    "status": "review",
    ...
  }
}
```

### At Review END

Based on review results:

| Result | Feature Status | SVG Status |
|--------|----------------|------------|
| All SVGs pass (✅ PASS) | `approved` | `approved` |
| Any 🔴 REGENERATE issues | `issues` | `issues` (files with issues) |
| Only 🟢 PATCHABLE issues | `patchable` | `patchable` (files with issues) |

**Update steps:**
1. Read `docs/design/wireframes/wireframe-status.json`
2. Find feature object
3. Update `status` field based on worst issue severity
4. Update each SVG status in `svgs` object individually
5. Write updated JSON file

**Report:**
```
STATUS UPDATE: 000-rls-implementation
  Feature: issues (🔴) - 1 file needs regeneration
  SVGs:
    - 01-rls-architecture-overview.svg: approved (✅)
    - 02-rls-policy-patterns.svg: issues (🔴)
```
