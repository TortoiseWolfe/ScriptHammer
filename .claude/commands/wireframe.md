---
description: Generate or regenerate ALL SVG wireframes (patches 🟢, regenerates 🔴 and ✅ PASS - never skips files)
---

## ⛔ MANDATORY PRE-FLIGHT CHECK (DO THIS FIRST)

**Before generating ANY wireframe, answer these questions. This is BLOCKING - you cannot proceed without completing this check.**

### Theme Decision (BLOCKING)

**Question 1**: Does the feature name or wireframe title contain ANY of these keywords?
- `architecture`, `RLS`, `API`, `auth`, `security`, `testing`, `integration`, `pipeline`, `database`, `schema`, `flow`, `system`

| Answer | Action |
|--------|--------|
| **YES** | ⛔ **MUST use DARK THEME** - Do not proceed with light theme |
| **NO** | Continue to Question 2 |

**Question 2**: Would a non-technical end user view this screen in the actual application?

| Answer | Theme | Examples |
|--------|-------|----------|
| **YES** - users see this | **Light theme** | Settings page, profile, dashboard with user data |
| **NO** - only developers/admins | **DARK theme** | CI/CD, RLS policies, API flow, test runner |

### ⛔ STOP CHECK

**If you answered "architecture" or "backend" keywords in Q1 AND are about to use light theme → YOU ARE WRONG.**

Architecture diagrams, auth flows, RLS diagrams, test pipelines = **ALWAYS DARK THEME**. No exceptions.

### Canvas Size Check

| Content Type | Canvas Size | viewBox |
|--------------|-------------|---------|
| Standard UI screens | 1400×800 | `0 0 1400 800` |
| Architecture with many components | 1600×1000 | `0 0 1600 1000` |
| Complex flows with arrows | 1600×1200 | `0 0 1600 1200` |

**⛔ NEVER shrink fonts to fit content. ALWAYS expand canvas instead.**

### Pre-Flight Verification Statement (MANDATORY)

Before generating, you MUST write:

```
PRE-FLIGHT CHECK COMPLETE:
- Feature type: [UI/Architecture/Backend]
- Theme selected: [Light/Dark]
- Reason: [e.g., "Architecture diagram - developers only" or "User-facing settings page"]
- Canvas size: [e.g., 1400×800 or 1600×1000]
```

**If you cannot write this statement with confidence, re-read the spec and feature name.**

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

### 1b. Page Filter (Per-Page Mode Only)

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
- Still read FULL spec for regeneration context

### 2. Read the Spec

**Use the Read tool** to read the full spec file. Extract and note:
- Feature name and purpose
- User stories and acceptance criteria
- UI requirements and interactions
- Any mentioned screens, forms, lists, or components
- Error states or edge cases mentioned

This is critical - wireframes must accurately reflect the spec requirements.

### 2c. Extract Requirements for Legend (MANDATORY)

Build lookup tables for FR, SC, and US during spec reading:

#### FR Extraction (Functional Requirements)
1. Locate `### Functional Requirements` section in spec.md
2. For each line matching `**FR-XXX**: [statement]`:
   - Extract code (FR-001, FR-002, etc.)
   - Extract full statement
   - Generate short title (<=30 chars): Remove "System", keep MUST/SHOULD

#### SC Extraction (Success Criteria)
1. Locate `### Success Criteria` section
2. For each `**SC-XXX**: [measurable outcome]`:
   - Extract code, full statement
   - Generate short title (<=30 chars): Keep metric, remove fluff

#### US Extraction (User Stories) - INLINE ONLY
1. Locate `### User Stories` section
2. For each `**US-XXX**: As a [role]...`:
   - Extract code and role
   - Generate short title: `US-XXX: As [role]...`
   - **NO legend entry** (too verbose for legend panel)

**REQUIREMENTS LOOKUP TABLE format:**
| Type | Code | Short Title | Full Statement |
|------|------|-------------|----------------|
| FR | FR-001 | MUST enable RLS on users | System MUST enable security policies on users table |
| SC | SC-001 | Auth response <2sec | Authentication response time MUST be under 2 seconds |
| US | US-001 | As admin, manage users | *(inline only, no legend)* |

---

### 2b. Check for Review Feedback & Triage (CRITICAL)

**Before generating, check if this is a fix/regeneration with feedback from a previous review.**

Look for `WIREFRAME_ISSUES.md` in the feature directory:
```
features/[category]/[feature-folder]/WIREFRAME_ISSUES.md
```

**If no WIREFRAME_ISSUES.md exists** → Fresh generation, proceed to Step 3.

**If WIREFRAME_ISSUES.md exists** → This is a fix/regeneration cycle. Triage each file:

---

#### Per-Page Mode File Selection

**If per-page mode (`:PAGE` argument provided):**
- Filter WIREFRAME_ISSUES.md entries to TARGET page only
- Process ONLY that single file
- Ignore other files in the issues list

**If full-feature mode (no `:PAGE`):**
- Process ALL files listed in issues (current batch behavior)

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

#### 🚨 MANDATORY RULE (CHECK FIRST)

**If the wireframe will include a mobile phone frame → USE LIGHT THEME. NO EXCEPTIONS.**

Mobile phone mockups are ALWAYS front-end UX elements that end users interact with. Even if the content shows developer tools (console output, IDE panels), the presence of a phone frame means it's demonstrating a mobile UX and MUST use light theme.

| Contains Mobile Frame? | Theme Decision |
|------------------------|----------------|
| **YES** | **Light theme ONLY** - Skip disambiguation test |
| **NO** | Continue to disambiguation test below |

#### ⛔ DISAMBIGUATION TEST (for wireframes WITHOUT mobile frames)

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

### 5b. Track Page-Specific Requirements

As you create each SVG, maintain separate sets for FR, SC, and US:

1. Each annotation with FR/SC/US code → add to page's requirement sets
2. Before footer, sort each set numerically
3. Generate legend panel with FR + SC entries (US excluded from legend)

**Example tracking for a page:**
```
PAGE: 01-rls-architecture-overview.svg
REFERENCED FRs: FR-001, FR-002, FR-003, FR-004, FR-005
REFERENCED SCs: SC-001, SC-002
REFERENCED USs: US-001, US-003 (inline only, no legend)
LEGEND ENTRIES: 7 (5 FR + 2 SC) → 2 rows needed
```

### 5c. Generate Requirements Legend Panel (MANDATORY)

**Every wireframe with FR or SC annotations MUST include a unified REQUIREMENTS KEY panel.**

#### Panel Sizing
| Entry Count (FR+SC) | Panel Height | Content End Y |
|---------------------|--------------|---------------|
| 1-4 entries | 60px | y=690 |
| 5-8 entries | 80px | y=670 |
| 9-12 entries | 100px | y=650 |

#### Template (Dark Theme)
```xml
<!-- REQUIREMENTS KEY (FR + SC only, US excluded) -->
<g id="requirements-legend" transform="translate(40, 700)">
  <rect width="1320" height="60" rx="6" fill="#1e293b" stroke="#475569"/>
  <text x="20" y="18" class="legend-header">REQUIREMENTS KEY</text>

  <!-- FRs first, then SCs - 4 entries per row, ~320px each -->
  <g transform="translate(20, 38)">
    <text x="0" class="legend-code">FR-001:</text>
    <text x="55" class="legend-text">MUST enable RLS on users table</text>
  </g>
  <g transform="translate(340, 38)">
    <text x="0" class="legend-code">SC-001:</text>
    <text x="55" class="legend-text">Auth response &lt;2 seconds</text>
  </g>
</g>
```

#### Template (Light Theme)
```xml
<!-- REQUIREMENTS KEY (FR + SC only, US excluded) -->
<g id="requirements-legend" transform="translate(40, 700)">
  <rect width="1320" height="60" rx="6" fill="#dcc8a8" stroke="#b8a080"/>
  <text x="20" y="18" class="legend-header">REQUIREMENTS KEY</text>

  <!-- FRs first, then SCs - 4 entries per row, ~320px each -->
  <g transform="translate(20, 38)">
    <text x="0" class="legend-code">FR-001:</text>
    <text x="55" class="legend-text">MUST enable RLS on users table</text>
  </g>
  <g transform="translate(340, 38)">
    <text x="0" class="legend-code">SC-001:</text>
    <text x="55" class="legend-text">Auth response &lt;2 seconds</text>
  </g>
</g>
```

#### Short Statement Rules
| Type | Rule | Example |
|------|------|---------|
| FR | Remove "System", keep MUST/SHOULD | "MUST enable RLS on users" |
| SC | Keep metric, remove fluff | "Auth response <2sec" |
| US | N/A (inline only) | "As admin, manage users" |

Max 45 characters per statement.

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

**⚠️ PURPLE (#8b5cf6) REQUIRES DARK TEXT:**
- `#8b5cf6` + white = ~4.2:1 (FAILS, needs 4.5:1)
- **Use dark text `#1e1b4b` (indigo-950)** for ~5:1 contrast

**⚠️ GREEN (#22c55e) and RED (#ef4444) REQUIRE DARK TEXT:**
- White on green is only ~2.1:1 (FAILS AA)
- White on red is only ~3.1:1 (FAILS AA)

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

## ⛔ FONT SIZE RULES (MANDATORY - DO NOT REDUCE)

**Font sizes in the template are MINIMUM sizes. NEVER shrink them to fit more content.**

| Class | Required Size | Common Mistake |
|-------|---------------|----------------|
| `.heading-lg` | **24px** | ❌ 20px, 18px |
| `.heading` | **16px** | ❌ 14px, 12px |
| `.heading-sm` | **14px** | ❌ 12px |
| `.text-md` | **14px** | ❌ 12px, 11px |
| `.text-sm` | **13px** | ❌ 10px, 9px |
| `.text-muted` | **12px** | ❌ 10px, 8px |

**If content doesn't fit at these sizes:**
1. **EXPAND the canvas** (1400→1600 wide, 800→1000 tall)
2. **REDUCE content** (fewer items, shorter text)
3. **NEVER shrink fonts** - readability is non-negotiable

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
9. **Footer positioning**: Page title MUST be at y=780 (canvas height - 20px), LEFT-ALIGNED at x=60 with `text-anchor="start"`. This avoids overlap with the viewer's focus mode hint which is centered at the bottom. Inconsistent footer positions across pages = failed review.
10. **Vertical content distribution**: Content should use available vertical space. If main content ends before y=600 with footer at y=780, spread content vertically to fill space. Wasted empty space = failed review.
11. **Content clearance**: ALL content (panels, text, annotations) MUST end by y=750. The zone from y=750 to y=780 is reserved for footer clearance (30px gap). If content extends past y=750, the wireframe WILL clip at the bottom.
12. **Acronym clarity**: All acronyms MUST be expanded on first use OR be universally understood (HTML, CSS, URL). Compliance terms MUST always be expanded:
    - GDPR → "GDPR (EU Data Protection)"
    - SOC 2 → "SOC 2 (Security Audit)"
    - WCAG → "WCAG (Web Accessibility)"
    - RLS → "RLS (Row Level Security)"

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

```
Mobile phone frame MUST be at x=980, y=60 for ALL wireframes.
```

**Why x=980?**
- Canvas width: 1400px
- Mobile frame width: 360px
- Mobile ends at: 980 + 360 = 1340px (60px margin from edge)
- This is the ONLY correct position

**❌ NEVER DO THIS:**
```xml
<!-- WRONG: Moving mobile closer to fill empty space -->
<g id="mobile-view" transform="translate(770, 60)">  <!-- ❌ x=770 -->
```

**✅ ALWAYS DO THIS:**
```xml
<!-- CORRECT: Mobile at standard position -->
<g id="mobile-view" transform="translate(980, 60)">  <!-- ✅ x=980 -->
```

### Desktop Content Rule

**If desktop content is narrower than 900px:**
- Keep desktop at x=40
- Keep mobile at x=980
- The empty space between is INTENTIONAL (annotations, breathing room)
- Do NOT move mobile closer to "fill the gap"

### Cross-Wireframe Consistency

**ALL wireframes in a single feature MUST have:**
- Mobile at x=980 (identical)
- MOBILE label at x=980 (identical)
- Consistent desktop width (900px recommended, smaller OK if needed)

**Before writing ANY SVG, verify:**
```
□ Mobile group: transform="translate(980, 60)"
□ MOBILE label: x="980"
□ Matches other wireframes in this feature
```

**If you deviate from x=980, you are WRONG. There is no exception.**

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

```
1. Find the lowest content element (sidebar, panel, mobile frame)
2. Verify it ends at y ≤ 750
3. Footer at y=780 → 30px gap ✓

Example:
  - Panel ends at y=720 → OK (under 750 limit)
  - Sidebar ends at y=750 → OK (at limit)
  - Content at y=760 → FAIL (extends into footer zone)
```

### If Content Is Too Tall

If content extends past y=750, you have options:
1. **Reduce content height** - compress vertical spacing
2. **Use expanded canvas** - change to 1400×1000 viewBox
3. **Move annotations to side margins** - place at x < 40 or x > 1360

**NEVER** place annotations that overlap content or crowd the footer.

---

## ⛔ ANNOTATION CLARITY RULES (MANDATORY)

**All annotations and labels MUST be self-explanatory. A reader should understand them WITHOUT reading spec.md.**

### Success Criteria Labels

**NEVER** use abbreviated SC codes without context:
- ❌ `SC-001: <3 min` (cryptic - what takes 3 min?)
- ❌ `SC-002: <2 sec` (meaningless without context)
- ❌ `SC-004: 0 breach` (zero breach of what?)
- ✅ `SC-001: Signup flow <3 min`
- ✅ `SC-002: Login response <2 sec`
- ✅ `SC-004: Zero security breaches`
- ✅ `Registration: <3 min (SC-001)`

**Format options** (be consistent per wireframe):
| Format | Example |
|--------|---------|
| **Metric first** | `Login response: <2 sec` |
| **Code + context** | `SC-002: Auth response <2 sec` |
| **Full description** | `Users complete registration in under 3 minutes` |

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

**Before writing the SVG, verify each annotation passes:**
- [ ] Can a reader understand what SC-XXX measures without reading spec.md?
- [ ] If colors vary semantically, is there a legend explaining them?
- [ ] Are ALL abbreviations defined in parentheses on first use?
- [ ] Do metric labels specify WHAT is being measured?

**If ANY annotation requires external context to understand, REWRITE IT.**

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

#### Per-Page Mode: Skip if file already registered

**If per-page mode AND file already in `index.html`:**
- Skip index.html update (file already registered, viewer works)
- Log: "Skipping index.html update - file already registered"

**If per-page mode AND NEW file:**
- Add single entry to wireframes array
- Add single nav link to existing feature section
- Log: "Added new file to index.html"

**If full-feature mode:**
- Update all entries (current batch behavior below)

---

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
