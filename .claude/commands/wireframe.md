---
description: Generate or regenerate ALL SVG wireframes (patches 🟢, regenerates 🔴 and ✅ PASS - never skips files)
---

## ⛔ PRE-FLIGHT CHECK (BLOCKING)

### Theme

**Q1**: Contains `architecture`, `RLS`, `API`, `auth`, `security`, `testing`, `integration`, `pipeline`, `database`, `schema`, `flow`, `system`?
- **YES** → ⛔ DARK THEME (no exceptions)
- **NO** → Q2

**Q2**: Would end users see this screen?
- **YES** → Light (settings, profile, dashboard)
- **NO** → Dark (CI/CD, RLS, API, tests)

### Canvas

| Type | Size |
|------|------|
| UI screens | 1400×800 |
| Architecture | 1600×1000 |
| Complex flows | 1600×1200 |

⛔ Expand canvas, never shrink fonts.

### Verify

```
PRE-FLIGHT: [UI/Arch] | [Light/Dark] | [Reason] | [Size]
```

---

## User Input

```text
$ARGUMENTS
```

### Arguments Format

- `FEATURE` - Process ALL SVGs in feature (batch mode)
- `FEATURE:PAGE` - Process SINGLE SVG only (per-page mode)

**Parsing Logic**:
1. Split input by `:` delimiter
2. If no `:` → full-feature mode (process all SVGs)
3. If `:` → per-page mode, extract page filter:
   - Numeric (`:01`, `:3`) → match `01-*.svg`, `03-*.svg`
   - Text (`:responsive`) → match `*responsive*.svg`

**Examples**:
- `/wireframe 004` → All SVGs in 004-mobile-first-design
- `/wireframe 004:01` → Only `01-responsive-navigation.svg`
- `/wireframe 004:touch` → Only `03-touch-targets.svg`

## Outline

Handles full lifecycle: fresh generation, 🟢 patches, 🔴 regenerates. Never skips files.

```
/wireframe → /wireframe-review → /wireframe (repeat until clean)
```

### 1. Identify the Spec

If `$ARGUMENTS` is provided, use it as the spec file path. Otherwise:

```bash
ls specs/*.md
```

Ask the user which spec to use if multiple exist, or use the only one if there's just one.

### 1b. Page Filter (Per-Page Mode Only)

**If `:PAGE` provided:**
1. List SVGs in `docs/design/wireframes/[feature-folder]/`
2. Filter: Numeric (`:01`) → `01-*.svg` | Text (`:responsive`) → `*responsive*.svg`
3. **0 matches** → Error with available list | **2+ matches** → Ask user
4. **1 match** → Extract spec from `grep "SOURCE:" [target].svg`

Spec path comes from SVG watermark. Still read FULL spec for context.

### 2. Read the Spec

Read full spec. Extract: feature purpose, user stories, UI requirements, screens/forms/lists, error states. Wireframes must reflect spec.

### 2c. Extract Requirements for Legend

| Type | Source Section | Short Title (≤30 chars) |
|------|----------------|-------------------------|
| FR | `### Functional Requirements` | Keep MUST/SHOULD |
| SC | `### Success Criteria` | Keep metric |
| US | `### User Stories` | Inline only, no legend |

**Lookup table:**
| Type | Code | Short | Full |
|------|------|-------|------|
| FR | FR-001 | MUST enable RLS | Full statement... |
| SC | SC-001 | Auth <2sec | Full statement... |
| US | US-001 | As admin... | *(inline only)* |

---

### 2b. Check for Review Feedback & Triage (CRITICAL)

Check `features/[category]/[feature-folder]/WIREFRAME_ISSUES.md`:
- **Not found** → Fresh generation, proceed to Step 3.
- **Found** → Fix/regeneration cycle. Triage each file:

---

#### Per-Page Mode File Selection

**Per-page** (`:PAGE`): Process TARGET page only. **Full-feature**: Process all files.

---

#### Triage Logic: 🟢 Patch vs 🔴 Regenerate

**For each SVG file being processed:**

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

#### For 🟢 PATCH files:

Read SVG → find/replace hex, font-size, text, or add CSS class → write back → mark ✅ FIXED. Do NOT regenerate - patching preserves layout.

---

#### For 🔴 REGENERATE files:

## ⛔ REGENERATION ≠ PATCHING ⛔

**Create NEW wireframe from scratch. Do NOT edit existing file.**

1. **Rename**: `mv [file].svg → [file].reference.svg`
2. **Read context**: spec.md, WIREFRAME_ISSUES.md, reference.svg (what worked vs failed)
3. **Design fresh**: Start from template, apply learnings (e.g., 44px targets)
4. **Write new**: Save to original filename
5. **Cleanup**: Delete `.reference.svg` after review passes

**From feedback, extract**: Diagnosis, root cause, suggested layout, FR/SC to preserve.

**❌ WRONG**: Read → find height="40" → change to 44 → adjust y-positions → write back
**✅ RIGHT**: Rename → read spec+feedback → design fresh from template → write new

Reference informs thinking, not copy-paste material.

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

**Rules**: Every feature gets wireframe(s). Count determined by spec, not 1:1. Non-UI features use architecture/flow diagrams.

**Wireframe Types by Feature Category**:

| Feature Type | Wireframe Approach | Theme |
|--------------|-------------------|-------|
| UI screens (forms, lists, dashboards) | Desktop + Mobile side-by-side layouts | **Light** |
| Backend/infrastructure (RLS, APIs, auth) | Architecture diagrams showing components and data flow | **Dark** |
| Testing frameworks | Test flow diagrams, coverage dashboards | **Dark** |
| Integrations | System integration diagrams, API flow charts | **Dark** |
| Security features | Security architecture, threat model diagrams | **Dark** |
| Data features | Entity relationship diagrams, data flow visualizations | **Dark** |

**Count from spec**: User stories (major flows), screens, states (loading/error/empty/success), user roles → each may need wireframe.

**Common types**: List views, detail views, forms, state variations, architecture diagrams, flow diagrams.

### 4. Theme Selection Per Wireframe

Theme per wireframe, not per feature. **Mobile frame → Light (no exceptions).**

Example (`010-unified-blog-content`): `01-blog-list-post.svg` → Light | `04-migration-dashboard.svg` → Dark

**Multi-page triggers**: 3+ step flows, state variations, role-specific views.

| Naming | Pattern | Example |
|--------|---------|---------|
| Sequential | `NN-step.svg` | `01-login.svg` |
| States | `screen-state.svg` | `dashboard-error.svg` |
| Roles | `screen-role.svg` | `settings-admin.svg` |

| Canvas | viewBox | Use |
|--------|---------|-----|
| Standard | `0 0 1400 800` | Default |
| Wide | `0 0 1600 800` | Extra annotation margins |
| Tall | `0 0 1400 1000` | Complex vertical |
| Extended | `0 0 1600 1000` | Full annotation mode |

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

### 5b. Track Page Requirements

Track FR/SC/US per page → legend includes FR+SC only (US inline).

### 5c. Requirements Legend Panel

**Position:** y=690 always. Height grows UPWARD as entries increase. Bottom edge at y=750.

| Entries | Height |
|---------|--------|
| 1-4 | 60px |
| 5-8 | 80px |
| 9-12 | 100px |

**Template** (colors: dark `#1e293b/#475569`, light `#dcc8a8/#b8a080`):
```xml
<g id="requirements-legend" transform="translate(40, 690)">
  <rect width="1320" height="60" rx="6" fill="[FILL]" stroke="[STROKE]"/>
  <text x="20" y="18" class="legend-header">REQUIREMENTS KEY</text>
  <!-- 4/row, 320px each -->
  <g transform="translate(20, 38)">
    <text x="0" class="legend-code">FR-001:</text>
    <text x="55" class="legend-text">≤45 chars, keep MUST/SHOULD</text>
  </g>
</g>
```

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
      /* Requirements Legend styles (light theme) */
      .legend-header { fill: #6d28d9; font-family: monospace; font-size: 13px; font-weight: bold; }
      .legend-code { fill: #8b5cf6; font-family: monospace; font-size: 11px; font-weight: bold; }
      .legend-text { fill: #374151; font-family: system-ui, sans-serif; font-size: 11px; }
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
      /* Requirements Legend styles (dark theme) */
      .legend-header { fill: #c4b5fd; font-family: monospace; font-size: 13px; font-weight: bold; }
      .legend-code { fill: #8b5cf6; font-family: monospace; font-size: 11px; font-weight: bold; }
      .legend-text { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 11px; }
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

  <!-- Color Legend (REQUIRED if semantic colors are used) -->
  <g id="color-legend" transform="translate(40, 770)">
    <!-- Add legend items when diagram uses colors to encode meaning -->
    <!-- Example format:
    <text x="0" y="0" class="text-sm" fill="#94a3b8">Legend:</text>
    <rect x="60" y="-10" width="12" height="12" rx="2" fill="none" stroke="#22c55e" stroke-width="2"/>
    <text x="80" y="0" class="text-sm">Target met</text>
    <rect x="180" y="-10" width="12" height="12" rx="2" fill="none" stroke="#8b5cf6" stroke-width="2"/>
    <text x="200" y="0" class="text-sm">Constraint</text>
    <rect x="300" y="-10" width="12" height="12" rx="2" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <text x="320" y="0" class="text-sm">External dependency</text>
    -->
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

## ⛔ TEXT CONTRAST RULES (MANDATORY - WCAG AA)

**Text ON colored backgrounds MUST meet WCAG AA (4.5:1 minimum ratio).**

| Background Color | Text Color | Ratio | Status | Example Use |
|-----------------|------------|-------|--------|-------------|
| `#22c55e` (green) | `#052e16` (green-950) | ~12:1 | ✅ | Success badges - **DARK TEXT** |
| `#ef4444` (red) | `#450a0a` (red-950) | ~10:1 | ✅ | Deny badges - **DARK TEXT** |
| `#8b5cf6` (violet) | `#1e1b4b` (indigo-950) | ~5:1 | ✅ | OWN badges - **DARK TEXT** |
| `#64748b` (gray) | `#ffffff` | ~4.8:1 | ✅ | Anonymous role badges - white OK |
| `#eab308` (yellow) | `#1a1a2e` | ~8:1 | ✅ | Warning badges - **DARK TEXT** |

**⚠️ Green/Red/Purple ALL require dark text** - white fails AA on all three.

```xml
<!-- ❌ WRONG: White on green/red - FAILS WCAG AA -->
<rect fill="#22c55e"/><text fill="#ffffff">ALL</text>     <!-- 2.1:1 -->
<rect fill="#ef4444"/><text fill="#ffffff">DENY</text>    <!-- 3.1:1 -->

<!-- ✅ CORRECT: Dark text on green/red - PASSES AA -->
<rect fill="#22c55e"/><text fill="#052e16" font-weight="bold">ALL</text>   <!-- 12:1 -->
<rect fill="#ef4444"/><text fill="#450a0a" font-weight="bold">DENY</text>  <!-- 10:1 -->
```

**Color-specific text classes (add to `<style>` block):**
```css
/* For text on #22c55e green backgrounds */
.badge-text-on-green { fill: #052e16; font-weight: bold; }  /* green-950, ~12:1 */

/* For text on #ef4444 red backgrounds */
.badge-text-on-red { fill: #450a0a; font-weight: bold; }    /* red-950, ~10:1 */
```

---

## ⛔ FONT SIZE RULES (MANDATORY)

**Template sizes are MINIMUMS. Never shrink to fit.**

| Class | Min Size |
|-------|----------|
| `.heading-lg` | 24px |
| `.heading` / `.text-md` | 16px / 14px |
| `.text-sm` / `.text-muted` | 13px / 12px |

**Content doesn't fit?** Expand canvas or reduce content. Never shrink fonts.

```xml
<!-- ❌ WRONG: Shrinking fonts to fit more content -->
.heading-lg { font-size: 20px; }  /* Template says 24px! */
.text-md { font-size: 12px; }     /* Template says 14px! */

<!-- ✅ CORRECT: Use template sizes, expand canvas if needed -->
.heading-lg { font-size: 24px; }
.text-md { font-size: 14px; }
<!-- viewBox="0 0 1600 1000" if content needs more space -->
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

## Spacing Rules (Mandatory)

| Rule | Value | Notes |
|------|-------|-------|
| Panel padding | 20px | Inside panels |
| Line spacing | 22-25px | Larger fonts |
| Section gaps | 40px min | Between major sections |
| Card padding | 15px min | Internal |
| Content end | y≤750 | 30px gap to footer |
| Footer | y=780, x=60 | LEFT-ALIGNED, `text-anchor="start"` |

**Violations = failed review**: Text overflow, overlapping elements, wasted vertical space, inconsistent footer positions.

**Acronym rule**: Expand on first use. Compliance terms always: `GDPR (EU Data Protection)`, `SOC 2 (Security Audit)`, `WCAG (Web Accessibility)`, `RLS (Row Level Security)`.

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

---

## ⛔ NON-NEGOTIABLE LAYOUT DIMENSIONS (MANDATORY)

**These positions are FIXED across ALL wireframes in a feature. NO EXCEPTIONS.**

### Mobile Position Rule

**Mobile frame: x=980, y=60** (1400 canvas - 360 frame - 60 margin = 980). No exceptions.

```xml
<!-- ❌ WRONG --> <g transform="translate(770, 60)">
<!-- ✅ RIGHT --> <g transform="translate(980, 60)">
```

Desktop x=40, mobile x=980. Empty space between is intentional. Never move mobile closer.

**Verify before writing**: `transform="translate(980, 60)"` + `MOBILE` label at x="980".

---

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

## ⛔ INTERACTIVE ELEMENT PATTERNS (MANDATORY)

**These patterns MUST be used for all interactive elements. Do NOT improvise smaller versions.**

### Checkbox Pattern (44px tap target)

Checkboxes are visually 16x16px but MUST have a 44x44px invisible tap target:

```xml
<!-- ✅ CORRECT: Checkbox with 44px tap target -->
<g class="checkbox-field">
  <!-- Invisible 44x44 tap target (centered on checkbox) -->
  <rect x="-14" y="-14" width="44" height="44" rx="6" fill="transparent"/>
  <!-- Visual checkbox (16x16) -->
  <rect x="0" y="0" width="16" height="16" rx="3" fill="#f5f0e6" stroke="#b8a080"/>
  <!-- Label text -->
  <text x="24" y="13" class="text-sm">Remember me</text>
</g>
```

```xml
<!-- ❌ WRONG: Checkbox without tap target -->
<rect x="0" y="0" width="16" height="16" rx="3" fill="#f5f0e6" stroke="#b8a080"/>
<text x="24" y="13" class="text-sm">Remember me</text>
```

### Text Link Pattern (44px tap target)

Text links MUST have an invisible tap target rect:

```xml
<!-- ✅ CORRECT: Link with 44px tap target -->
<g class="link">
  <!-- Invisible tap target (extends around text) -->
  <rect x="0" y="-10" width="120" height="44" rx="4" fill="transparent"/>
  <!-- Link text -->
  <text x="60" y="14" text-anchor="middle" class="link-text">Forgot password?</text>
</g>
```

```xml
<!-- ❌ WRONG: Link without tap target -->
<text x="60" y="14" class="link-text">Forgot password?</text>
```

### Action Link Pattern (e.g., "Revoke", "Delete", "Edit")

Small action links in lists/panels need proper tap targets:

```xml
<!-- ✅ CORRECT: Action link with 60x44 tap target -->
<g class="action-link">
  <!-- Tap target (minimum 44px height, width fits text + padding) -->
  <rect x="0" y="-10" width="60" height="44" rx="3" fill="transparent"/>
  <!-- Action text -->
  <text x="30" y="14" text-anchor="middle" class="danger-text">Revoke</text>
</g>
```

### Radio Button Pattern (44px tap target)

```xml
<!-- ✅ CORRECT: Radio with 44px tap target -->
<g class="radio-field">
  <!-- Invisible tap target -->
  <rect x="-14" y="-14" width="44" height="44" rx="22" fill="transparent"/>
  <!-- Visual radio (16x16 circle) -->
  <circle cx="8" cy="8" r="8" fill="none" stroke="#b8a080" stroke-width="2"/>
  <!-- Selected state (inner circle) -->
  <circle cx="8" cy="8" r="4" fill="#8b5cf6"/>
  <!-- Label -->
  <text x="24" y="13" class="text-sm">Option A</text>
</g>
```

### Toggle/Switch Pattern (44px tap target)

```xml
<!-- ✅ CORRECT: Toggle with 44px tap target -->
<g class="toggle-switch">
  <!-- Invisible tap target -->
  <rect x="-6" y="-10" width="60" height="44" rx="6" fill="transparent"/>
  <!-- Toggle track (48x24) -->
  <rect x="0" y="0" width="48" height="24" rx="12" fill="#8b5cf6"/>
  <!-- Toggle thumb (20x20) -->
  <circle cx="36" cy="12" r="10" fill="#ffffff"/>
</g>
```

### Icon Button Pattern (minimum 44x44)

```xml
<!-- ✅ CORRECT: Icon button at 44x44 minimum -->
<g class="icon-button">
  <rect x="0" y="0" width="44" height="44" rx="6" fill="#f5f0e6" stroke="#b8a080"/>
  <!-- Icon centered (example: close X) -->
  <text x="22" y="28" text-anchor="middle" font-size="18">✕</text>
</g>
```

### Nav Item Pattern (full-width, 44px height)

```xml
<!-- ✅ CORRECT: Nav item with proper sizing -->
<g class="nav-item">
  <rect x="0" y="0" width="180" height="44" rx="6" fill="#8b5cf6"/>
  <text x="15" y="28" class="btn-text">Dashboard</text>
</g>

<!-- Inactive state -->
<g class="nav-item">
  <rect x="0" y="0" width="180" height="44" rx="6" fill="transparent"/>
  <text x="15" y="28" class="text-md">Settings</text>
</g>
```

### Summary: Minimum Tap Target Sizes

| Element | Minimum Size | Pattern |
|---------|--------------|---------|
| Checkbox | 44×44 invisible rect around 16×16 visual | Use checkbox pattern |
| Radio | 44×44 invisible rect around 16×16 visual | Use radio pattern |
| Text link | 44px height × text width + 20px padding | Use link pattern |
| Action link | 44×44 minimum, width fits text | Use action link pattern |
| Icon button | 44×44 visible button | Direct sizing |
| Toggle | 44px height × toggle width + 12px padding | Use toggle pattern |
| Nav item | Full width × 44px height | Direct sizing |
| List item (tappable) | Full width × 44px minimum height | Direct sizing |

**ENFORCEMENT**: When generating ANY interactive element, check this table and use the correct pattern. Never create a tappable element smaller than 44×44px total tap area.

---

## ⛔ ANNOTATION PLACEMENT RULES (MANDATORY)

Annotations must never overlap with content. Follow these rules:

### Footer Safety Zone

```
Canvas height: 800px
Page title: y=780, x=60, text-anchor="start" (LEFT-ALIGNED)
Content clearance: 30px above footer

CONTENT END: y ≤ 750 (mandatory - Rule 11)
Footer at: y = 780, x = 60 (left-aligned)
Gap: 30px clear zone between content and footer
```

**Page title format:**
```xml
<text x="60" y="780" text-anchor="start" class="text-muted">NNN:PP | Wireframe Title | ScriptHammer</text>
```

**Footer numbering convention:**
- `NNN` = 3-digit feature number (e.g., `000`, `001`, `042`)
- `PP` = 2-digit page number (e.g., `01`, `02`, `03`)
- Examples:
  - `000:01 | RLS Architecture Overview | ScriptHammer`
  - `004:03 | Touch Targets | ScriptHammer`

### Content Boundary Check

All content ≤ y=750. Footer at y=780. If content too tall: reduce height, expand canvas (1400×1000), or move annotations to margins.

---

## ⛔ ANNOTATION CLARITY RULES (MANDATORY)

**All annotations and labels MUST be self-explanatory. A reader should understand them WITHOUT reading spec.md.**

### Success Criteria Labels

**Always include context** - reader must understand without spec.md.

| ❌ Wrong | ✅ Right |
|----------|----------|
| `SC-001: <3 min` | `SC-001: Signup flow <3 min` |
| `SC-002: <2 sec` | `Login response <2 sec` |

### Color Legend Requirements

**If colors encode meaning, a legend panel is MANDATORY.**

When using different border colors for badges/pills:

| Border Color | Meaning |
|--------------|---------|
| `#22c55e` (green) | Compliance achieved / Target met |
| `#eab308` (yellow) | External dependency / Caution |
| `#8b5cf6` (purple) | Technical constraint / Architecture limitation |
| `#475569` (gray) | Informational / Not yet verified |

**Legend placement**: Footer area (y ≤ 750) or dedicated "Legend" panel.

```xml
<!-- ✅ CORRECT: Legend explaining color coding -->
<g id="legend" transform="translate(40, 720)">
  <text x="0" y="0" class="text-sm" fill="#94a3b8">Legend:</text>
  <rect x="60" y="-10" width="12" height="12" rx="2" fill="none" stroke="#22c55e" stroke-width="2"/>
  <text x="80" y="0" class="text-sm">Target met</text>
  <rect x="160" y="-10" width="12" height="12" rx="2" fill="none" stroke="#eab308" stroke-width="2"/>
  <text x="180" y="0" class="text-sm">External dependency</text>
  <rect x="300" y="-10" width="12" height="12" rx="2" fill="none" stroke="#8b5cf6" stroke-width="2"/>
  <text x="320" y="0" class="text-sm">Constraint</text>
</g>
```

### Abbreviation Rule (MANDATORY)

**Define ALL abbreviations on first use.** Never assume readers know tech jargon.

| Wrong | Correct |
|-------|---------|
| `PCI Ready` | `PCI (Payment Card Industry) Ready` |
| `GDPR Compliant` | `GDPR (Data Protection) Compliant` |
| `Guard HOC` | `Guard HOC (Higher-Order Component)` |
| `JWT Token` | `JWT (JSON Web Token)` |
| `RLS` | `RLS (Row Level Security)` |

**Space-constrained?** Use the shorter form but still define it:
- `GDPR (Data Protection)` instead of `GDPR (General Data Protection Regulation)`
- `PCI (Payment Card)` instead of `PCI (Payment Card Industry Data Security Standard)`

### Self-Documentation Checklist

**Verify**: SC codes have context, colors have legend, abbreviations defined, metrics specify what's measured. **If unclear without spec.md → rewrite.**

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

#### Requirement Annotation Format (MANDATORY)

**ALL requirement codes (FR, SC, US) MUST include short inline context:**

| Type | Wrong | Correct |
|------|-------|---------|
| FR | `FR-001` | `FR-001: RLS on users` |
| FR range | `FR-001 to FR-005` | `FR-001-005: Core table security` |
| SC | `SC-001` | `SC-001: Auth <2sec` |
| US | `US-001` | `US-001: As admin...` |

**Rules:**
- Max 30 characters for inline context
- FR + SC codes MUST appear in REQUIREMENTS KEY legend panel
- US codes are inline-only (no legend entry - too verbose)

**Example annotation with context:**
```xml
<!-- Good: Context included -->
<text class="annotation">FR-001: RLS on users table</text>

<!-- Bad: Code only, no context -->
<text class="annotation">FR-001</text>
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

**Per-page**: Skip if file registered, add single entry if new. **Full-feature**: Update all entries.

Update `docs/design/wireframes/index.html`:

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

List SVGs, show wireframes array update, confirm nav added. View at: `docs/design/wireframes/index.html`

## Alternative: `/wireframe-dark` or `/wireframe-light` to force theme.
