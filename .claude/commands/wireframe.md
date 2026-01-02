---
description: Generate or regenerate ALL SVG wireframes (patches 🟢, regenerates 🔴 and ✅ PASS - never skips files)
---

## User Input

```text
$ARGUMENTS
```

## Outline

**Comprehensive wireframe command** that handles the full lifecycle:
- **Fresh generation**: Creates wireframes from spec (no feedback file)
- **Fix cycle**: Patches 🟢 issues in place, regenerates 🔴 AND ✅ PASS files
- **Never skips**: ALL files are processed every time - quality over efficiency

Theme selection:
- **Light theme** (Indigo palette) for UX/Frontend wireframes
- **Dark theme** (Slate/Violet palette) for Backend/Architecture wireframes

### Workflow (Simplified)

```
/wireframe [feature]            # Generate fresh wireframes from spec
    ↓
/wireframe-review [feature]     # Review by READING actual SVG files
    ↓
/wireframe [feature]            # Regenerate to fix issues (if any found)
    ↓
(repeat until review finds no issues)
```

**Philosophy**:
- Generate fresh from spec every time
- Review means READING the SVG and doing boundary math
- No tracker files - they enable false confidence
- If issues exist, regenerate completely

**Note**: `/wireframe-fix` is deprecated. Always regenerate - patching creates more problems.

### 1. Identify the Spec

If `$ARGUMENTS` is provided, use it as the spec file path. Otherwise:

```bash
ls specs/*.md
```

Ask the user which spec to use if multiple exist, or use the only one if there's just one.

### 2. Read the Spec

**Use the Read tool** to read the full spec file. Extract and note:
- Feature name and purpose
- User stories and acceptance criteria
- UI requirements and interactions
- Any mentioned screens, forms, lists, or components
- Error states or edge cases mentioned

This is critical - wireframes must accurately reflect the spec requirements.

### 2b. Check for Review Feedback & Triage (CRITICAL)

**Before generating, check if this is a fix/regeneration with feedback from a previous review.**

Look for `WIREFRAME_ISSUES.md` in the feature directory:
```
features/[category]/[feature-folder]/WIREFRAME_ISSUES.md
```

**If no WIREFRAME_ISSUES.md exists** → Fresh generation, proceed to Step 3.

**If WIREFRAME_ISSUES.md exists** → This is a fix/regeneration cycle. Triage each file:

---

#### Triage Logic: 🟢 Patch vs 🔴 Regenerate

**For each SVG file listed in the issues:**

**Step 1: Classify each issue**

🟢 **PATCHABLE** (only these 4 types):
| Issue Type | Fix Method |
|------------|------------|
| Wrong color value | Find/replace hex in fill/stroke |
| Font size too small | Update `font-size` attribute |
| Typo in text | Update text content |
| Missing CSS class | Add to `<style>` block |

🔴 **REGENERATE** (if ANY of these keywords appear):
| Category | Detection Keywords |
|----------|-------------------|
| Layout/Structure | overlap, collision, swap, move, rearrange |
| Spacing/Positioning | cramped, spacing, gap, wasted space |
| Element Position | x=, y=, transform, shift, extend |
| Canvas/Size | canvas, 1600, resize, extend |
| Missing Content | missing row, missing section, add content, new panel, add annotation |
| Touch targets | 44x44, touch target, undersized |
| Element counts | too many, add device, remove |

**Step 2: Determine file action**

| File has... | Action |
|-------------|--------|
| No issues / ✅ PASS | 🔄 REGENERATE - fresh eyes might catch something missed |
| Only 🟢 issues | 🟢 PATCH in place |
| Any 🔴 issues | 🔴 REGENERATE from scratch |

**IMPORTANT**: Never skip files just because they "passed" a previous review. A fresh regeneration might catch issues that were overlooked. Quality over efficiency.

---

#### For 🟢 PATCH files (all issues patchable):

Apply fixes directly to the existing SVG:
1. Read the SVG file
2. For color fixes: find/replace the hex value
3. For font fixes: update the font-size attribute
4. For typos: update the text content
5. For CSS class: add to the `<style>` block
6. Write the patched SVG back
7. Mark issues as ✅ FIXED in WIREFRAME_ISSUES.md

**Do NOT regenerate these files** - patching preserves the existing layout.

---

#### For 🔴 REGENERATE files:

## ⛔ CRITICAL: REGENERATION ≠ PATCHING ⛔

**DO NOT edit the existing file in place.** Regeneration means creating a NEW wireframe from scratch.

### Step 1: Rename Old File as Reference

Before generating, rename the existing SVG to preserve it as reference:
```bash
mv docs/design/wireframes/[feature]/[filename].svg \
   docs/design/wireframes/[feature]/[filename].reference.svg
```

### Step 2: Read for Context (NOT for copying)

Read these files to understand context:
1. **spec.md** - Primary source of requirements
2. **WIREFRAME_ISSUES.md** - What went wrong and why
3. **[filename].reference.svg** - Visual reference for what worked vs. didn't

When reading the reference SVG, note:
- ✅ What worked well (keep similar approach)
- ❌ What failed (avoid these patterns)
- 📐 Layout decisions that were good vs. problematic

### Step 3: Design Fresh from Spec + Template

Create a NEW wireframe by:
1. Starting with the appropriate theme template (Light/Dark)
2. Designing layout fresh based on spec requirements
3. Applying learnings from feedback (e.g., 44px touch targets)
4. Building each element from scratch - don't copy-paste from reference

### Step 4: Write New SVG

Write the new design to the original filename:
```
docs/design/wireframes/[feature]/[filename].svg
```

### Step 5: Clean Up Reference Files

After wireframe review passes, delete the `.reference.svg` files:
```bash
rm docs/design/wireframes/[feature]/*.reference.svg
```

### What to Extract from Feedback:

Read the **🔴 REGENERATION FEEDBACK section** for learnings:
- **Diagnosis**: What went wrong (avoid these mistakes)
- **Root Cause**: WHY the layout failed (understand the structural issue)
- **Suggested Layout**: Guidance for the new design approach
- **Spec Requirements to Preserve**: FR/SC items the new design must show
- **Design Standards**: e.g., "all touch targets must be 44px"

### Example: WRONG vs RIGHT

❌ **WRONG** (This is patching, not regeneration):
```
1. Read 01-login-signup.svg
2. Find height="40", change to height="44"
3. Adjust y-positions to compensate
4. Write modified file back
```

✅ **RIGHT** (True regeneration):
```
1. mv 01-login-signup.svg → 01-login-signup.reference.svg
2. Read spec.md for requirements
3. Read feedback for learnings ("need 44px touch targets")
4. Glance at reference to see what worked/didn't
5. Design fresh using template, 44px from the start
6. Write new 01-login-signup.svg
```

**Key distinction**: Reference informs your design thinking. It doesn't provide copy-paste material.

---

#### Example Triage Output

```
Analyzing WIREFRAME_ISSUES.md for 004-mobile-first-design...

Found 5 SVG files. Triaging...

  01-responsive-navigation.svg: 15 issues
    🔴 REGENERATE - contains structural issues (overlap, cramped, spacing)
  02-content-typography.svg: 3 issues
    🔴 REGENERATE - contains structural issues (spacing)
  03-touch-targets.svg: 2 issues
    🟢 PATCH - all issues patchable (color only)
  04-breakpoint-system.svg: 3 issues
    🔴 REGENERATE - contains structural issues (cramped)
  05-architecture.svg: 0 issues (✅ PASS)
    🔄 REGENERATE - fresh review (might catch something missed)

Actions:
  🟢 03-touch-targets.svg: Patching 2 color fixes...
  🔄 05-architecture.svg: Regenerating fresh (no issues but reviewing again)...
  🔴 01, 02, 04: Regenerating with feedback...

ALL 5 files processed. No files skipped.
```

---

#### After Processing

Update WIREFRAME_ISSUES.md:
- Mark patched issues with ✅ FIXED
- Mark regenerated files with 🔄 REGENERATED
- Update summary section with completion status

### 3. Plan the Wireframes

**CRITICAL RULES**:
1. **Every feature gets at least one wireframe** - no exceptions. If a feature exists, it gets visualized.
2. **The number of wireframes is determined by the spec content** - do NOT assume 1 feature = 1 SVG.
3. **Non-UI features still need wireframes** - use architecture diagrams, data flow diagrams, system diagrams, or process flows.

**Wireframe Types by Feature Category**:

| Feature Type | Wireframe Approach | Theme |
|--------------|-------------------|-------|
| UI screens (forms, lists, dashboards) | Desktop + Mobile side-by-side layouts | **Light** |
| Backend/infrastructure (RLS, APIs, auth) | Architecture diagrams showing components and data flow | **Dark** |
| Testing frameworks | Test flow diagrams, coverage dashboards | **Dark** |
| Integrations | System integration diagrams, API flow charts | **Dark** |
| Security features | Security architecture, threat model diagrams | **Dark** |
| Data features | Entity relationship diagrams, data flow visualizations | **Dark** |

**Determine how many wireframes based on spec content**:
- Count distinct user stories - each major flow may need its own wireframe
- Count distinct screens mentioned - each screen needs visualization
- Count distinct states (loading, error, empty, success) - consider separate wireframes for complex states
- Count distinct user roles - different views may need separate wireframes

**Common wireframe needs**:
- List views (showing multiple items)
- Detail views (showing single item)
- Forms (create/edit)
- Special states (empty, loading, error)
- Architecture/system diagrams (for non-UI features)
- Flow diagrams (for processes and integrations)

### 4. Theme Selection Per Wireframe

**CRITICAL**: Select theme PER WIREFRAME, not per feature. Mixed features need both themes.

#### ⛔ DISAMBIGUATION TEST (MANDATORY)

Before selecting a theme, ask this question:

> **"Would a non-technical end user view this screen?"**

| Answer | Theme | Examples |
|--------|-------|----------|
| **YES** - end users see this | **Light** | Compliance dashboard, settings page, user profile, any screen with scores/data ABOUT the user |
| **NO** - only developers/admins see this | **Dark** | CI/CD pipeline, RLS architecture, database schema, API flow, test runner output |

**Common Mistakes to Avoid:**
- "Accessibility Dashboard" showing compliance scores → **Light** (users view their scores)
- "Test Coverage Dashboard" in CI → **Dark** (developers view build results)
- "Analytics Dashboard" for site owners → **Light** (business users view metrics)
- "System Architecture" diagram → **Dark** (developers reference this)

#### Light Theme Indicators (use Parchment palette)
Use light theme when the wireframe:
- Shows screens that END USERS will see and interact with
- Contains form inputs, buttons, or interactive controls
- Displays content layouts (blog posts, lists, cards)
- Has mobile phone frame mockups
- Shows state variations (loading, empty, error, success)
- Depicts dashboards showing USER-FACING data (scores, progress, settings)

#### Dark Theme Indicators (use Slate/Violet palette)
Use dark theme when the wireframe:
- Shows diagrams that ONLY DEVELOPERS will reference
- Is an architecture or system diagram
- Shows data flow visualizations
- Depicts CI/CD pipelines or test runner output
- Contains security threat models
- Shows database schemas or RLS policies
- Depicts API integration diagrams

#### Mixed Feature Example
Feature `010-unified-blog-content` needs BOTH themes:
- `01-blog-list-post.svg` → **Light** (UX - content display)
- `02-offline-editor.svg` → **Light** (UX - form/editor)
- `03-conflict-resolution.svg` → **Light** (UX - modal/UI)
- `04-migration-dashboard.svg` → **Dark** (Backend - system architecture)

**Always apply theme per-SVG based on content, not per-feature.**

#### Determine Wireframe Strategy

Based on the spec complexity, choose the appropriate approach:

**Multi-Page** (create multiple SVG files):
- User flows with 3+ steps (auth, checkout, onboarding)
- State variations needing dedicated visualization (loading, error, empty, success)
- Different user roles with distinct views

**Naming conventions**:
| Scenario | Pattern | Example |
|----------|---------|---------|
| Sequential flow | `NN-step-name.svg` | `01-login.svg`, `02-register.svg` |
| State variations | `screen-state.svg` | `dashboard-empty.svg`, `dashboard-error.svg` |
| Role variations | `screen-role.svg` | `settings-admin.svg`, `settings-member.svg` |

**Expanded Canvas** (larger than 1400x800):
- Extensive annotations explaining complex interactions
- Flow arrows connecting multiple components
- Dense dashboards with many interconnected elements

**Canvas options**:
| Canvas | viewBox | Use case |
|--------|---------|----------|
| Standard | `0 0 1400 800` | Default for most screens |
| Wide | `0 0 1600 800` | Extra annotation margins (100px each side) |
| Tall | `0 0 1400 1000` | Complex vertical layouts |
| Extended | `0 0 1600 1000` | Full annotation mode |

Present your strategy recommendation to the user before generating.

### 5. Generate SVG Wireframes

Create SVG wireframes using the appropriate theme.

**MANDATORY WATERMARK**: Every SVG file MUST include the generation header comment immediately after the opening `<svg>` tag. Replace placeholders:
- `[SPEC_FILE_PATH]` → actual spec file path (e.g., `features/foundation/000-rls-implementation/spec.md`)
- `[YYYY-MM-DD]` → current date
- If regenerating with feedback, add `REGENERATED WITH FEEDBACK` line

**Standard watermark:**
```xml
<!-- ============================================================
     GENERATED BY: /wireframe skill
     SOURCE: [SPEC_FILE_PATH]
     DATE: [YYYY-MM-DD]
     THEME: Dark (Backend/Architecture)
     DO NOT MANUALLY EDIT - Regenerate with /wireframe command
     ============================================================ -->
```

**Regeneration watermark (when WIREFRAME_ISSUES.md feedback was used):**
```xml
<!-- ============================================================
     GENERATED BY: /wireframe skill
     SOURCE: [SPEC_FILE_PATH]
     DATE: [YYYY-MM-DD]
     THEME: Dark (Backend/Architecture)
     REGENERATED WITH FEEDBACK: features/.../WIREFRAME_ISSUES.md
     DO NOT MANUALLY EDIT - Regenerate with /wireframe command
     ============================================================ -->
```

This watermark enables verification in future sessions via:
```bash
grep -r "GENERATED BY: /wireframe skill" docs/design/wireframes/
grep -r "REGENERATED WITH FEEDBACK" docs/design/wireframes/
```

**File location**: `docs/design/wireframes/[feature-folder]/`

---

## Light Theme Template (UX/Frontend Wireframes)

Use this template for user-facing screens, forms, and interactive UI.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 800" width="1400" height="800">
  <!-- ============================================================
       GENERATED BY: /wireframe skill
       SOURCE: [SPEC_FILE_PATH]
       DATE: [YYYY-MM-DD]
       THEME: Light (UX/Frontend) - v3 True Parchment
       DO NOT MANUALLY EDIT - Regenerate with /wireframe command
       ============================================================ -->
  <defs>
    <!-- v3 True Parchment - Deeper sky blue background -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#c7ddf5"/>
      <stop offset="100%" style="stop-color:#b8d4f0"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#d946ef"/>
    </linearGradient>
    <style>
      /* Typography - v3 Bigger + Bolder, WCAG AA compliant on parchment */
      .heading-lg { fill: #1a1a2e; font-family: system-ui, sans-serif; font-size: 24px; font-weight: 800; }
      .heading { fill: #1a1a2e; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700; }
      .text-md { fill: #2d3748; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; }
      .text-sm { fill: #374151; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 500; }
      .text-muted { fill: #4b5563; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 500; }
      .annotation { fill: #6d28d9; font-family: monospace; font-size: 12px; font-weight: 600; }
      /* Layout labels */
      .label-desktop { fill: #8b5cf6; font-family: monospace; font-size: 13px; font-weight: bold; }
      .label-mobile { fill: #d946ef; font-family: monospace; font-size: 13px; font-weight: bold; }
    </style>
  </defs>

  <!-- Background - deeper sky blue -->
  <rect width="1400" height="800" fill="url(#bgGrad)"/>

  <!-- Dot grid pattern - blue-tinted -->
  <g opacity="0.35">
    <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1" fill="#6b8cba"/>
    </pattern>
    <rect width="1400" height="800" fill="url(#dots)"/>
  </g>

  <!-- Accent line top -->
  <rect x="0" y="0" width="1400" height="3" fill="url(#accentGrad)"/>

  <!-- Title -->
  <text x="700" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#4b5563" letter-spacing="1">WIREFRAME TITLE</text>

  <!-- DESKTOP SECTION (left) -->
  <text x="40" y="52" class="label-desktop">DESKTOP</text>
  <g id="desktop-view">
    <!-- Desktop area: x=40, y=60, width=900, height=680 -->
    <!-- 3-column layout: sidebar 200px | main 440px | detail 240px (10px gaps) -->
    <!-- Panels use fill="#e8d4b8" (primary parchment) or fill="#dcc8a8" (secondary) -->
    <!-- Input fields use fill="#f5f0e6" -->
    <!-- Borders use stroke="#b8a080" -->
  </g>

  <!-- MOBILE SECTION (right) -->
  <text x="980" y="52" class="label-mobile">MOBILE</text>
  <g id="mobile-view" transform="translate(980, 60)">
    <!-- Phone frame: 360x700, rx=24 - darker tan -->
    <rect x="0" y="0" width="360" height="700" rx="24" fill="#c8b898" stroke="#a08860" stroke-width="2"/>
    <!-- Screen area: x=10, y=10, width=340, height=680, rx=16 - true parchment -->
    <rect x="10" y="10" width="340" height="680" rx="16" fill="#e8d4b8"/>
    <!-- Status bar - darker parchment -->
    <rect x="10" y="10" width="340" height="28" rx="16" fill="#dcc8a8"/>
    <text x="30" y="28" class="text-sm">9:41</text>
    <!-- Mobile content starts at y=48 within this group -->
  </g>
</svg>
```

**Light Theme Color Palette (v3 True Parchment)**:
- Background: gradient `#c7ddf5` → `#b8d4f0` (deeper sky blue)
- Primary: `#8b5cf6` (violet)
- Accent: `#d946ef` (fuchsia)
- Panels: `#e8d4b8` (primary tan parchment), `#dcc8a8` (secondary darker tan)
- Input fields: `#f5f0e6` (off-white)
- Borders: `#b8a080` (dark tan for contrast)
- Mobile frame: `#c8b898` (darker tan)
- Dot grid: `#6b8cba` @ 0.35 (blue-tinted)
- Text: `#1a1a2e` (headings), `#2d3748`/`#374151` (body), `#4b5563` (muted)
- Success: `#22c55e`, Warning: `#eab308`, Error: `#ef4444`

---

## Dark Theme Template (Backend/Architecture Wireframes)

Use this template for architecture diagrams, data flows, and system visualizations.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 800" width="1400" height="800">
  <!-- ============================================================
       GENERATED BY: /wireframe skill
       SOURCE: [SPEC_FILE_PATH]
       DATE: [YYYY-MM-DD]
       THEME: Dark (Backend/Architecture)
       DO NOT MANUALLY EDIT - Regenerate with /wireframe command
       ============================================================ -->
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#d946ef"/>
    </linearGradient>
    <style>
      /* Typography - Dark Theme - AAA compliant, READABLE sizes */
      .heading-lg { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 24px; font-weight: bold; }
      .heading { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; }
      .heading-sm { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold; }
      .text-md { fill: #cbd5e1; font-family: system-ui, sans-serif; font-size: 14px; }
      .text-sm { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 13px; }
      .text-muted { fill: #b4bcc8; font-family: system-ui, sans-serif; font-size: 12px; } /* AAA: lighter for readability */
      .annotation { fill: #c4b5fd; font-family: monospace; font-size: 12px; font-weight: bold; }
      /* Layout labels */
      .label-desktop { fill: #8b5cf6; font-family: monospace; font-size: 13px; font-weight: bold; }
      .label-mobile { fill: #d946ef; font-family: monospace; font-size: 13px; font-weight: bold; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1400" height="800" fill="url(#bgGrad)"/>

  <!-- Dot grid pattern -->
  <g opacity="0.05">
    <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1" fill="#fff"/>
    </pattern>
    <rect width="1400" height="800" fill="url(#dots)"/>
  </g>

  <!-- Accent line top -->
  <rect x="0" y="0" width="1400" height="3" fill="url(#accentGrad)"/>

  <!-- Title - AAA fix: #64748b → #8494a8 -->
  <text x="700" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#8494a8" letter-spacing="1">ARCHITECTURE DIAGRAM TITLE</text>

  <!-- Architecture content -->
  <g id="diagram-content">
    <!-- Panels use fill="#1e293b" or fill="#334155" -->
    <!-- Borders use stroke="#475569" -->
    <!-- Use boxes, arrows, and labels to show system components -->
  </g>
</svg>
```

**Dark Theme Color Palette (AAA Compliant)**:
- Background: gradient `#0f172a` → `#1e293b`
- Primary: `#8b5cf6` (violet)
- Accent: `#d946ef` (fuchsia)
- Panels: `#1e293b`, `#334155`
- Borders: `#475569`
- Text: `#fff` (headings), `#94a3b8`/`#cbd5e1` (body), `#b4bcc8` (muted - AAA fix)
- Success: `#22c55e`, Warning: `#eab308`, Error: `#ef4444`

---

## ⛔ TEXT CONTRAST RULES (MANDATORY)

**Text ON colored backgrounds MUST use white (#ffffff) for readability.**

| Background Color | Text Color | Example Use |
|-----------------|------------|-------------|
| `#22c55e` (green) | `#ffffff` | Success badges, role cards |
| `#8b5cf6` (violet) | `#ffffff` | Service role badges |
| `#64748b` (gray) | `#ffffff` | Anonymous role badges |
| `#ef4444` (red) | `#ffffff` | Error badges, denied indicators |
| `#eab308` (yellow) | `#1a1a2e` | Warning badges (dark text) |

**NEVER use light gray text on colored backgrounds** - it disappears.

```xml
<!-- ❌ WRONG: Light gray on green - unreadable -->
<rect fill="#22c55e"/>
<text fill="#dcfce7">Valid JWT Token</text>

<!-- ✅ CORRECT: White on green - readable -->
<rect fill="#22c55e"/>
<text fill="#ffffff">Valid JWT Token</text>
```

---

## ⛔ CONTAINER BOUNDARY VALIDATION (MANDATORY GATE)

**You CANNOT write the SVG until you complete this section.**

### Step 1: List All Containers

Before writing ANY SVG content, list every container with its boundaries:

```
CONTAINER INVENTORY:
- Desktop panel: x=40, y=60, w=900, h=700 → RIGHT=940, BOTTOM=760
- Header bar: x=50, y=70, w=880, h=50 → RIGHT=930, BOTTOM=120
- Mobile frame: x=980, y=60, w=360, h=700 → RIGHT=1340, BOTTOM=760
- Mobile screen: x=990, y=70, w=340, h=680 → RIGHT=1330, BOTTOM=750
- [Panel 1]: x=?, y=?, w=?, h=? → RIGHT=?, BOTTOM=?
```

### Step 2: For EVERY Element, Calculate and Verify

**Before placing ANY element, write this calculation:**

```
ELEMENT: [button/text/rect name]
  Position: x=760, y=656
  Size: w=160, h=44
  RIGHT EDGE: 760 + 160 = 920
  BOTTOM EDGE: 656 + 44 = 700
  CONTAINER: Issue History panel (RIGHT=930, BOTTOM=750)
  CHECK: 920 < 930 ✓, 700 < 750 ✓
```

### Step 3: Transform-Aware Calculations (CRITICAL)

When using `<g transform="translate(x, y)">`, calculate ABSOLUTE positions:

```
TRANSFORM GROUP: translate(75, 585)
  Text at y=88 → ABSOLUTE Y = 585 + 88 = 673
  Container: Code block ends at y=690
  CHECK: 673 < 690 ✓

WRONG: "y=88 looks fine"
RIGHT: "absolute y = 585 + 88 = 673, container ends at 690, fits ✓"
```

### Step 4: Text Width Verification

**Estimate text width BEFORE placing:**

| Font | Size | Width per char | Example |
|------|------|----------------|---------|
| Monospace | 10px | ~6px | "FR-032" (6 chars) = 36px |
| System | 11px | ~6.5px | "Settings" (8 chars) = 52px |
| System | 12px | ~7px | "Export Report" (13 chars) = 91px |
| System | 14px | ~8px | "Dashboard" (9 chars) = 72px |

```
TEXT: "FR-032, FR-033, FR-034" (22 chars including spaces)
  Font: monospace 12px → 22 × 7 = 154px estimated width
  Position: x=720
  RIGHT EDGE: 720 + 154 = 874
  CONTAINER: Header bar ends at x=930
  CHECK: 874 < 930 ✓
```

### Validation Failures = STOP

If ANY calculation shows overflow:
1. **STOP** - do not write the element
2. **RECALCULATE** - adjust position or container size
3. **RE-VERIFY** - confirm the fix works

**DO NOT proceed with "it's probably fine" - do the math.**

---

## ⛔ SEMANTIC POSITIONING (MANDATORY for Data Visualizations)

**When visualizing data on a spectrum, timeline, or scale:**

1. **Origin goes at the logical zero point** - NOT at the minimum data value
2. **Scale proportionally** - 320px should be positioned at 320/max of the axis width

### Breakpoint Spectrum Example

**❌ WRONG** (treats 320px as origin):
```xml
<!-- Mobile section starts at x=0 labeled "320px" - SEMANTICALLY INCORRECT -->
<rect x="0" y="15" width="400" height="40"/>
<text x="0" y="90">320px</text>  <!-- 320px at origin??? -->
```

**✅ CORRECT** (origin at 0px, positions scaled proportionally):
```xml
<!-- Full spectrum from 0 to 1440px, mapped to 0-1320px canvas width -->
<!-- Scale factor: 1320 / 1440 = 0.917 -->
<!-- Mobile section (320-767px) → x = 320 × 0.917 = 293, width = (767-320) × 0.917 = 410 -->
<rect x="293" y="15" width="410" height="40"/>
<line x1="0" y1="60" x2="0" y2="75"/>
<text x="0" y="90">0px</text>  <!-- Origin at zero where it belongs -->
<line x1="293" y1="60" x2="293" y2="75"/>
<text x="293" y="90">320px</text>  <!-- 320px positioned proportionally -->
```

### Proportional Scale Formula

```
position_on_canvas = (data_value / max_data_value) × canvas_width
section_width = ((end_value - start_value) / max_data_value) × canvas_width
```

### Other Semantic Visualizations

| Visualization Type | Origin | Scale |
|-------------------|--------|-------|
| Viewport breakpoints | 0px | Proportional to max viewport |
| Timeline | Start date or epoch | Proportional to duration |
| Progress bar | 0% | Proportional to 100% |
| Temperature scale | Absolute zero or 0° | Proportional to max |
| File size | 0 bytes | Proportional to max size |

**CRITICAL**: Data visualizations must be semantically correct, not just visually pleasing.

---

## Spacing Rules (Mandatory - Both Themes)

To prevent overlap/clipping in generated wireframes:

1. **Minimum padding**: 20px inside panels
2. **Text line spacing**: 22-25px between lines (for larger fonts)
3. **Section gaps**: 40px minimum between major sections
4. **Bottom margin**: 20px from canvas edge
5. **Card internal padding**: 15px minimum
6. **Never overlap**: Text and elements must not overlap adjacent sections
7. **Verify fit**: Before finalizing, verify all content fits within its container
8. **Text containment**: ALL text MUST stay inside its containing box - if text would overflow, either enlarge the box or shorten the text

---

## ⛔ FLOW ARROW ROUTING (MANDATORY - Architecture Diagrams)

**Flow arrows MUST NEVER cross through text, labels, or content. This is non-negotiable.**

### The Problem
When decision diamonds or flow sources need to connect to targets, a naive path (straight line) may cross through section labels or panel content. This creates visual collisions where arrows obscure text.

### ❌ WRONG: Arrow through text
```
Decision Diamond
      |
      ↓ (arrow cuts through "SECTION LABEL" below)
  SECTION LABEL  ← arrow visually crosses this text
      |
   Target Box
```

### ✅ CORRECT: Route arrows around content
```
Decision Diamond
      |
      └───────────→ (arrow goes RIGHT, then DOWN)
                  |
   SECTION LABEL  | ← label is clear, arrow beside it
                  ↓
              Target Box
```

### Arrow Routing Rules

1. **Use orthogonal paths**: Arrows should travel horizontally OR vertically, using 90° turns to route around obstacles
2. **Route through empty space**: If there's empty canvas space, use it for arrow paths
3. **If no clear path exists**: The layout is wrong - REORGANIZE CONTENT to create clear flow channels
4. **Never route through content zones**: Arrows belong in gutters/margins, not over content

### Layout Before Arrows

**Design content layout FIRST, then add arrows that fit the layout.**

If you find yourself needing to route an arrow through content:
1. STOP - the layout is wrong
2. Reorganize content to create clear flow channels
3. Use the FULL canvas width/height - don't leave empty space while cramping content
4. THEN draw arrows through the empty channels

### Canvas Utilization Check

Before drawing arrows, verify:
- Is there >200px of unused space on any edge? → SPREAD CONTENT OUT
- Are content sections cramped together? → USE THE EMPTY SPACE
- Do arrows need to cross content? → MOVE CONTENT to create clear channels

**Wasted space + arrows through text = DESIGN FAILURE. Use the space to fix the arrows.**

---

## Layout Dimensions (Both Themes)

| Section | Position | Size | Notes |
|---------|----------|------|-------|
| Desktop area | x=40, y=60 | 900×680 | 3-column layout |
| - Sidebar | x=40 | 200px wide | Navigation |
| - Main | x=250 | 440px wide | Primary content |
| - Detail | x=700 | 240px wide | Item details |
| - Gaps | | 10px | Between columns |
| Mobile area | x=980, y=60 | 360×700 | Phone frame |
| - Content | x=990, y=70 | 340×660 | 10px padding |

**Component Sizing Standards** (WCAG AAA touch targets = 44px minimum):
| Component | Desktop | Mobile | rx | Notes |
|-----------|---------|--------|-----|-------|
| Primary button | width×44 | width×44 | 6 | **44px height mandatory** |
| Secondary button | width×44 | width×44 | 6 | **44px height mandatory** |
| Icon button | 44×44 | 44×44 | 6 | **44px minimum** |
| Text input | height=44 | height=44 | 6 | **44px height mandatory** |
| Nav item | width×44 | width×44 | 6 | **44px height mandatory** |
| List item (tappable) | height=44+ | height=44+ | 6 | **44px minimum** |
| FAB | r=28 (56px) | r=24 (48px) | circle | Already >44px |
| Card | - | - | 8 | Container, not tappable |
| Badge (pill) | height=22 | height=20 | 11 | Display only, not tappable |
| Avatar large | r=24 | r=20 | circle | Display only |
| Avatar small | r=16 | r=14 | circle | Display only |

**⚠️ CRITICAL**: Any interactive/tappable element MUST be at least 44×44px. This is non-negotiable for WCAG AAA compliance.

---

## Annotation Guidelines

#### Annotation Callout Template (Light Theme)

```xml
<!-- Annotation box (place in margin area) - use parchment fill -->
<g class="annotation-box">
  <rect x="20" y="130" width="100" height="45" rx="4" fill="#e8d4b8" stroke="#8b5cf6" stroke-width="1"/>
  <text x="70" y="148" text-anchor="middle" class="annotation">onClick</text>
  <text x="70" y="165" text-anchor="middle" class="text-muted">→ /api/submit</text>
</g>
```

#### Annotation Callout Template (Dark Theme)

```xml
<!-- Annotation box (place in margin area) -->
<g class="annotation-box">
  <rect x="20" y="130" width="100" height="45" rx="4" fill="#1e293b" stroke="#8b5cf6" stroke-width="1"/>
  <text x="70" y="148" text-anchor="middle" class="annotation">onClick</text>
  <text x="70" y="165" text-anchor="middle" class="text-muted">→ /api/submit</text>
</g>
```

#### Leader Lines Group Template

Place all leader lines in a dedicated group at the END of the SVG, just before `</svg>`:

```xml
<!-- Leader lines (drawn last to appear on top of all content) -->
<g id="leader-lines">
  <line x1="120" y1="150" x2="180" y2="200" stroke="#8b5cf6" stroke-width="1" stroke-dasharray="4,2"/>
</g>
</svg>
```

#### State Variation Indicators

| State | Visual treatment |
|-------|------------------|
| Loading | Skeleton placeholders, animated spinner, disabled buttons |
| Empty | Illustration placeholder, "No items" message, CTA |
| Error | Red accent border, error icon, retry button |
| Success | Green accent, checkmark icon, confirmation message |

---

### 6. Update the Wireframe Viewer

After creating the SVG files, update `docs/design/wireframes/index.html`:

**a. Add to the wireframes array** (in the `<script>` section):
```javascript
const wireframes = [
  // ... existing wireframes
  { path: '[feature-folder]/[filename].svg', title: '[Wireframe Title]' },
];
```

**b. Add navigation section** (in the `<nav>` element):
```html
<div class="nav-section">
  <h2>[Feature Number] - [Feature Name]</h2>
  <div class="nav-links">
    <a href="#" data-svg="[feature-folder]/[filename].svg">
      [Wireframe Title]
      <span class="path">[Brief description]</span>
    </a>
  </div>
</div>
```

### 7. Verify

After updating:
1. List the created SVG files
2. Show the updated wireframes array
3. Confirm the nav section was added
4. Remind user to view at: `docs/design/wireframes/index.html`

## Example

For a spec about "User Messaging" feature with mixed content:

1. Create folder: `docs/design/wireframes/user-messaging/`
2. Generate with appropriate themes:
   - `01-conversation-list.svg` → **Light** (UX screen)
   - `02-chat-interface.svg` → **Light** (UX screen)
   - `03-message-architecture.svg` → **Dark** (system diagram)
3. Update index.html with nav section and wireframes array entries

## Alternative Commands

- `/wireframe-dark spec.md` → Force dark theme for all wireframes
- `/wireframe-light spec.md` → Force light theme for all wireframes
