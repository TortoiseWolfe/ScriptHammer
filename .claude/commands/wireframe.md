---
description: Generate or regenerate ALL SVG wireframes (patches 🟢, regenerates 🔴 and ✅ PASS - never skips files)
---

## ⛔ PRE-FLIGHT CHECK (BLOCKING)

### Theme

**Q1**: Contains UI/UX keyword? `dashboard`, `form`, `modal`, `screen`, `page`, `settings`, `profile`, `login`, `signup`, `checkout`, `cart`, `menu`, `navigation`
- **YES** → ⛔ LIGHT THEME (UI/UX takes priority)
- **NO** → Q2

**Q2**: Contains backend keyword? `architecture`, `RLS`, `API`, `auth`, `security`, `testing`, `integration`, `pipeline`, `database`, `schema`, `flow`, `system`
- **YES** → ⛔ DARK THEME
- **NO** → Q3

**Q3**: Would end users see this screen?
- **YES** → Light
- **NO** → Dark

### Hybrid Themes (Insets)

Some wireframes need **light insets within dark parents**:

| Parent Theme | Inset Type | Inset Theme |
|--------------|------------|-------------|
| Dark (dev tooling) | Storybook preview | Light |
| Dark (testing) | Component demo | Light |
| Dark (architecture) | UI mockup/screenshot | Light |

**Light inset styling:**
- Use existing Light Theme colors (parchment `#e8d4b8` or sky `#c7ddf5`)
- Border: 2px to visually separate from dark parent
- Text: Light theme text colors (`#1a1a2e`, `#374151`)

**Use when:** The inset shows what an END USER would see, embedded in developer context.

### Canvas Size Standard

**All SVGs: 1920×1080** (16:9 full HD)

This is the only size. If content doesn't fit, split into multiple SVGs - never change dimensions.

### ⛔ Things NOT to Ask About (STANDARDIZED)

These decisions are FINAL. Do not present options or ask the user:

| Decision | Answer | Why |
|----------|--------|-----|
| Clickable tags | **Always YES** | Required for GitHub Pages navigation |
| Canvas size | **Always 1920×1080** | Standardized for fullscreen viewing |
| Badge links | **Always include** | MANDATORY per section below |
| Theme choice | **Follow Q1-Q3 above** | Deterministic, not subjective |

If you find yourself about to ask about any of these - STOP. The answer is already decided.

### ⛔ STANDARD WEBSITE HEADER (Light Theme Only)

**The header is FIXED** - only the **active nav item** changes per wireframe.

| Nav Item | Fill (Inactive) | Fill (Active) | Text Class | Use When |
|----------|-----------------|---------------|------------|----------|
| Home | `transparent` | `#8b5cf6` | `.text-sm` / white 600 | Landing/overview wireframes |
| Features | `transparent` | `#8b5cf6` | `.text-sm` / white 600 | Feature-specific wireframes |
| Docs | `transparent` | `#8b5cf6` | `.text-sm` / white 600 | Documentation wireframes |
| Account | `transparent` | `#8b5cf6` | `.text-sm` / white 600 | User profile/settings wireframes |

**How to customize the active nav item:**
1. Copy the header template exactly from Light Theme Template
2. Change ONE nav item's rect fill from `transparent` to `#8b5cf6`
3. Change that item's text from `class="text-sm"` to inline `fill="#fff" font-family="system-ui, sans-serif" font-size="14px" font-weight="600"`
4. All other nav items remain inactive (transparent background, `.text-sm` class)

**Do NOT change**: Logo, nav item text labels, positions, header right icons, header height (50px), nav item height (44px).

**Header Right Side Icons (all 44px touch targets):**
| Icon | Symbol | Purpose | Notes |
|------|--------|---------|-------|
| Accessibility | 👁 | WCAG options | Always visible - signals a11y commitment |
| Settings | ⚙️ | Theme + Font | Opens preferences dropdown |
| Avatar | U | User account | Violet circle with initial |

**Example: "Docs" active instead of "Features":**
```xml
<!-- Features (inactive) -->
<rect x="80" width="90" height="44" rx="4" fill="transparent"/>
<text x="125" y="28" text-anchor="middle" class="text-sm">Features</text>
<!-- Docs (active) -->
<rect x="180" width="70" height="44" rx="4" fill="#8b5cf6"/>
<text x="215" y="28" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="14px" font-weight="600">Docs</text>
```

### ⛔ MOBILE NAVIGATION (Light Theme Only)

**Mobile has TWO nav components** - both must sync with desktop's active nav item.

#### Top Header (50px)
- Hamburger menu (☰) left - opens secondary nav
- Logo (SH + violet square) center
- Avatar right

#### Bottom Nav (56px, 4 tabs)
- Each tab: 85×56px (exceeds 44px touch target)
- Icons: 🏠 Home, ⚡ Features, 📄 Docs, 👤 Account
- Active tab: `fill="#8b5cf6"` + white text
- Inactive tab: `fill="transparent"` + `.text-muted`

**How to customize active mobile tab:**
1. Find the tab group in `mobile-bottom-nav` matching your active desktop nav
2. Change that tab's rect fill from `transparent` to `#8b5cf6`
3. Change that tab's text from `class="text-muted"` to inline `fill="#fff" font-weight="600"`
4. All other tabs remain inactive

**Example: "Docs" active instead of "Features":**
```xml
<!-- Features (inactive) -->
<g transform="translate(85, 0)">
  <rect width="85" height="56" fill="transparent"/>
  <text x="42" y="24" text-anchor="middle" font-size="18">⚡</text>
  <text x="42" y="44" text-anchor="middle" class="text-muted" font-size="11">Features</text>
</g>
<!-- Docs (active) -->
<g transform="translate(170, 0)">
  <rect width="85" height="56" fill="#8b5cf6" rx="0"/>
  <text x="42" y="24" text-anchor="middle" font-size="18">📄</text>
  <text x="42" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">Docs</text>
</g>
```

**Mobile Content Area**: y=88 to y=634 (546px available, down from 632px without nav)

### USER STORIES Rule

- USER STORIES section appears **only in wireframe 01** (first/overview wireframe per feature)
- Other wireframes in same feature do NOT duplicate USER STORIES
- This prevents redundancy and keeps each wireframe focused on its specific topic

### Professional Feature Documentation Standards (MANDATORY)

**Wireframes are FEATURE POSTERS, not abstract diagrams.** Someone should understand the ENTIRE feature from the wireframes.

*Based on Robin Williams' CRAP Principles, Tufte's Data Visualization, and C4 Model*

#### The CRAP Checklist (Robin Williams)

| Principle | Meaning | Application |
|-----------|---------|-------------|
| **Contrast** | Size/color/weight create hierarchy | Title 28px > Headers 20px > Body 14px > Captions 12px |
| **Repetition** | Consistent visual language | Same FR badge style, same colors, same spacing |
| **Alignment** | Everything connects visually | Grid-based layout, no random placement |
| **Proximity** | Group related items | FRs grouped by category, user stories together |

#### Required Content (from spec.md)

| Section | Must Include | Prominence |
|---------|--------------|------------|
| **User Stories** | WHO, WHY, Priority (P0/P1/P2) | Top - high visibility (wireframe 01 only) |
| **Functional Requirements** | All FRs with badges, grouped by category | Center - main content |
| **Key Entities** | Tables/objects with relationships | Supporting diagram |
| **Success Criteria** | Verification checklist (SC-###) | Bottom - completion reference |
| **Architecture/Flow** | HOW it works technically | Supporting visual |

#### Visual Hierarchy (type sizes)

| Element | Size | Weight | Use |
|---------|------|--------|-----|
| Feature Title | 28px | Bold | One per wireframe |
| Section Headers | 20px | Bold | User Stories, Requirements, etc. |
| Subsection | 16px | Semibold | Category names within Requirements |
| Body Text | 14px | Regular | Descriptions, FR text |
| Badges | 13px | Mono | FR-001, P0, SC-001 |
| Captions/Notes | 12px | Regular | Supporting text |

#### Color Semantics (colors MUST have fixed meaning)

| Color | Hex | Meaning | Use Case |
|-------|-----|---------|----------|
| Blue | #2563eb | Functional Requirement | FR-### badges |
| Green | #16a34a | Success/Allowed | Access granted, SC passed, P2 |
| Yellow | #ca8a04 | Caution/Partial | Limited access, P1 priority |
| Red | #dc2626 | Denied/Critical | Access denied, P0 priority |
| Purple | #7c3aed | Service/System | Service role, system operations |
| Gray | #64748b | Supporting info | Captions, notes, secondary text |

#### Anti-Patterns (AVOID)

- ❌ Abstract flow diagrams with no requirements content
- ❌ Decorative gradients/shadows that don't convey meaning
- ❌ Random placement (everything must align to grid)
- ❌ Missing user stories (WHO and WHY)
- ❌ Missing FR badges (WHAT must be built)
- ❌ Missing success criteria (HOW we verify)
- ❌ Sparse "minimal" layouts - Tufte says maximize DATA, not minimize everything

#### Tufte Reminder

**Data-ink ratio** means maximize ink for DATA (user stories, FRs, success criteria), minimize ink for DECORATION (gradients, shadows, unnecessary borders). It does NOT mean "remove all content".

### Clickable Badge Links (MANDATORY - NEVER ASK)

⚠️ **DO NOT ASK** the user about clickable tags. They are REQUIRED. This is non-negotiable.

All FR, US, and SC badges MUST be wrapped with `<a>` links to the source spec.md on GitHub. Every badge, every time, no exceptions.

**Base URL pattern:**
```
https://github.com/{owner}/{repo}/blob/main/features/{category}/{feature}/spec.md#{section}
```

**Section anchor mapping:**
| Badge Prefix | Anchor |
|--------------|--------|
| FR-### | `#functional-requirements` |
| US-# | `#user-story-N---title-priority-pN` |
| SC-### | `#success-criteria-mandatory` |
| P0/P1/P2 | Same as parent US |

**Example FR badge with link:**
```svg
<a href="https://github.com/TortoiseWolfe/ScriptHammer/blob/main/features/foundation/000-rls-implementation/spec.md#functional-requirements" target="_blank">
  <g transform="translate(55, 125)">
    <rect width="55" height="18" rx="3" fill="#2563eb"/>
    <text x="27" y="13" class="badge" text-anchor="middle">FR-001</text>
    <text x="65" y="13" class="fr-text">Description text</text>
  </g>
</a>
```

**Example US card with link:**
```svg
<a href="https://github.com/TortoiseWolfe/ScriptHammer/blob/main/features/foundation/000-rls-implementation/spec.md#user-story-1---user-data-isolation-priority-p0" target="_blank">
<rect x="40" y="125" width="520" height="80" rx="6" fill="#1e293b" stroke="#dc2626" stroke-width="2"/>
<rect x="50" y="135" width="40" height="20" rx="4" fill="#dc2626"/>
<text x="70" y="150" class="badge" text-anchor="middle">P0</text>
<text x="100" y="150" class="subsection">US-1: User Data Isolation</text>
<text x="50" y="172" class="body">As a user, I need...</text>
</a>
```

**Rules:**
- Always use `target="_blank"` to open in new tab
- Wrap the entire card/badge group, not just the badge rect
- Include description text inside the link for larger click target
- GitHub generates anchors from headings only (lowercase, spaces→hyphens)

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

| Tag | Source Section | Short Title (≤30 chars) |
|-----|----------------|-------------------------|
| <kbd>**FR**</kbd> | `### Functional Requirements` | Keep MUST/SHOULD |
| <kbd>**SC**</kbd> | `### Success Criteria` | Keep metric |
| <kbd>**US**</kbd> | `### User Stories` | Full narrative in dedicated section |

**Lookup table:**
| Tag | Code | Short | Full |
|-----|------|-------|------|
| <kbd>**FR**</kbd> | FR-001 | MUST enable RLS | Full statement... |
| <kbd>**SC**</kbd> | SC-001 | Auth <2sec | Full statement... |
| <kbd>**US**</kbd> | US-001 | User Data Isolation | As a user, I need... so that... |

---

## ⛔ USER STORY SECTION (MANDATORY)

**Every wireframe MUST include a dedicated USER STORIES section with full narratives.**

### US Extraction (Step 2c Continued)

From spec.md `### User Stories` section, extract for EACH user story:
1. **US code** (US-001, US-002, etc.)
2. **Priority** (P0, P1, P2)
3. **Short title** (e.g., "User Data Isolation")
4. **Full narrative** (complete "As a [role], I need [goal], so that [benefit]" text)
5. **Key acceptance criterion** (one bullet point)

### USER STORIES Section Layout

| Property | Value |
|----------|-------|
| Section header | "USER STORIES" in violet (#8b5cf6) |
| Position | Right column or bottom section (depends on wireframe type) |
| Card width | 520px minimum |
| Card height | 110px minimum (for full narrative) |
| Card spacing | 10-20px vertical gap between cards |

### User Story Card Template (MANDATORY)

```xml
<!-- USER STORY CARD - 520×110px minimum -->
<g class="user-story-card" transform="translate(X, Y)">
  <!-- Card background -->
  <rect width="520" height="110" rx="8" fill="#1e293b" stroke="#475569" stroke-width="2"/>
  <!-- Priority badge (P0=red, P1=amber, P2=blue) -->
  <rect x="8" y="8" width="50" height="20" rx="4" fill="#dc2626"/>
  <text x="33" y="22" fill="#fff" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">P0</text>
  <!-- Story ID and title (teal) -->
  <text x="70" y="22" class="us-tag">US-001: User Data Isolation</text>
  <!-- Full narrative text (word-wrapped, ~55 chars per line) -->
  <text x="12" y="44" class="us-narrative">As a user, I need assurance that my personal data is</text>
  <text x="12" y="60" class="us-narrative">isolated from other users, so that no one can view or</text>
  <text x="12" y="76" class="us-narrative">modify my information without my explicit consent.</text>
  <!-- Key acceptance criterion -->
  <text x="12" y="98" class="us-acceptance">✓ Query returns only own data; unauthorized = empty set</text>
</g>
```

### Required CSS Classes (Dark Theme)

```css
.us-tag { fill: #0891b2; font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; }
.us-narrative { fill: #cbd5e1; font-family: system-ui, sans-serif; font-size: 13px; }
.us-acceptance { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 11px; }
```

### Required CSS Classes (Light Theme)

```css
.us-tag { fill: #0891b2; font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; }
.us-narrative { fill: #374151; font-family: system-ui, sans-serif; font-size: 13px; }
.us-acceptance { fill: #4b5563; font-family: system-ui, sans-serif; font-size: 11px; }
```

### Priority Badge Colors

| Priority | Background | Text |
|----------|------------|------|
| P0 | `#dc2626` (red) | `#fff` |
| P1 | `#f59e0b` (amber) | `#000` |
| P2 | `#3b82f6` (blue) | `#fff` |

### US Coverage Validation (BLOCKING GATE)

Before completing ANY wireframe generation:

1. List all US codes from spec.md
2. For each US, verify a full narrative card exists in at least one wireframe
3. If ANY user story is missing its full narrative → DO NOT complete generation

```
US COVERAGE CHECK:
- US-001: "User Data Isolation" → 01-architecture.svg USER STORIES section ✓
  Narrative: "As a user, I need assurance that my personal data..."
- US-002: "Profile Self-Management" → 01-architecture.svg USER STORIES section ✓
  Narrative: "As a user, I need to be the only person who can..."
...
```

**⛔ Short tags like "US-001: Title" are NOT sufficient. Full narratives are MANDATORY.**

---

### 2b. Check for Review Feedback & Triage (CRITICAL)

Check for per-SVG issues files alongside each SVG:
```
docs/design/wireframes/[feature]/[svg-name].issues.md
```
- **Not found** → Fresh generation, proceed to Step 3.
- **Found** → Fix/regeneration cycle. Triage based on issues:

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
2. **Read context**: spec.md, `[file].issues.md`, reference.svg (what worked vs failed)
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
Scanning 004-mobile-first-design for per-SVG issues files...

Found 5 SVG files. Checking for .issues.md alongside each...

  01-responsive-navigation.svg + .issues.md: 15 issues
    🔴 REGENERATE - contains structural issues (overlap, cramped, spacing)
  02-content-typography.svg + .issues.md: 3 issues
    🔴 REGENERATE - contains structural issues (spacing)
  03-touch-targets.svg + .issues.md: 2 issues
    🟢 PATCH - all issues patchable (color only)
  04-breakpoint-system.svg + .issues.md: 3 issues
    🔴 REGENERATE - contains structural issues (cramped)
  05-architecture.svg (no .issues.md): Fresh file
    🔄 GENERATE - no previous review

Actions:
  🟢 03-touch-targets.svg: Patching 2 color fixes...
  🔴 01, 02, 04: Regenerating with feedback from .issues.md...
  🔄 05: Generating fresh...

ALL 5 files processed. No files skipped.
```

---

#### After Processing

Update each `[svg-name].issues.md`:
- Mark patched issues with ✅ FIXED
- Mark file status as 🔄 REGENERATED or ✅ PASS

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

**viewBox:** `0 0 1920 1080` (always)

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

**Regeneration watermark (when .issues.md feedback was used):**
```xml
<!-- ============================================================
     GENERATED BY: /wireframe skill
     SOURCE: [SPEC_FILE_PATH]
     DATE: [YYYY-MM-DD]
     THEME: Dark (Backend/Architecture)
     REGENERATED WITH FEEDBACK: [svg-name].issues.md
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

Track FR/SC/US per page:
- **FR + SC** → Add to Requirements Legend panel
- **US** → Add inline to wireframe content (see ⛔ USER STORY TAGS section above)

⛔ CRITICAL: All US codes from spec.md MUST appear as inline annotations. This is non-negotiable.

### 5c. Requirements Legend Panel

**Position:** y=690 always. Height grows UPWARD as entries increase. Bottom edge at y=750.

| Rows | Height | Row 1 y | Row 2 y |
|------|--------|---------|---------|
| 1 row (1-4 entries) | 60px | 38 | N/A |
| 2 rows (5-8 entries) | 75px | 38 | 60 |
| 3 rows (9-12 entries) | 95px | 38 | 60, 82 |

**⚠️ STANDARD INTERNAL SPACING (MANDATORY)**

| Element | Value | Notes |
|---------|-------|-------|
| Legend y | 690 | Fixed position |
| Header y | 18 | "REQUIREMENTS KEY" text |
| Row 1 translate | (20, 38) | First row of codes |
| Row 2 translate | (20, 60) | Second row (if needed) |
| Row 3 translate | (20, 82) | Third row (if needed) |
| Row spacing | 22px | Between rows |

**Template** (colors: dark `#1e293b/#475569`, light `#dcc8a8/#b8a080`):
```xml
<!-- Single row (1-4 entries) -->
<g id="requirements-legend" transform="translate(40, 690)">
  <rect width="900" height="60" rx="6" fill="[FILL]" stroke="[STROKE]"/>
  <text x="20" y="18" class="legend-header">REQUIREMENTS KEY</text>
  <g transform="translate(20, 38)">
    <text x="0" class="tag-base fr-tag">FR-001:</text>
    <text x="55" class="legend-text">≤45 chars</text>
    <!-- 4 entries per row, ~220px each -->
  </g>
</g>

<!-- Two rows (5-8 entries) -->
<g id="requirements-legend" transform="translate(40, 690)">
  <rect width="900" height="75" rx="6" fill="[FILL]" stroke="[STROKE]"/>
  <text x="20" y="18" class="legend-header">REQUIREMENTS KEY</text>
  <g transform="translate(20, 38)"><!-- Row 1 --></g>
  <g transform="translate(20, 60)"><!-- Row 2 --></g>
</g>
```

**FR codes use `.tag-base .fr-tag` (BLUE), SC codes use `.tag-base .sc-tag` (ORANGE)**
**NEVER use `.legend-code` for FR/SC codes - it's purple. Only use for US/other codes.**

---

## Include Files (Build-Time Injection)

**CRITICAL**: Read include files and inject content directly. Do NOT use `<use href="external.svg#group">` - nested icons won't render.

### Include Files Location
```
docs/design/wireframes/includes/
├── header-desktop.svg  → <g id="desktop-header">
├── header-mobile.svg   → <g id="mobile-header-group">
├── footer-mobile.svg   → <g id="mobile-bottom-nav">
└── defs.svg            → Reference only (icons embedded in includes)
```

### Injection Process (for EVERY wireframe)

1. **Read** include files at generation time
2. **Extract** content inside the `<g id="...">` group
3. **Inject** directly into SVG at correct position with transform
4. **Customize** active nav state per wireframe

### Desktop Header Injection
```xml
<!-- Read includes/header-desktop.svg, inject <g id="desktop-header"> content -->
<g transform="translate(50, 70)">
  <!-- PASTE desktop-header content here (rect, logo, nav, icons with inline paths) -->
</g>
<!-- Add active nav overlay AFTER header -->
<g transform="translate(600, 73)"><!-- Nav positions: Home=600, Features=680, Docs=780, Account=860 -->
  <rect width="70" height="44" rx="4" fill="#8b5cf6"/>
  <text x="35" y="28" text-anchor="middle" fill="#fff" font-size="14px" font-weight="600">Home</text>
</g>
```

### Mobile Header Injection
```xml
<!-- Read includes/header-mobile.svg, inject <g id="mobile-header-group"> content -->
<g transform="translate(10, 10)">
  <!-- PASTE mobile-header-group content (status bar + header with inline icon paths) -->
</g>
```

### Mobile Bottom Nav Injection
```xml
<!-- Read includes/footer-mobile.svg, inject <g id="mobile-bottom-nav"> content -->
<g transform="translate(10, 634)">
  <!-- PASTE mobile-bottom-nav content (4 tabs with inline icon paths) -->
</g>
<!-- Add active tab overlay AFTER bottom nav -->
<g transform="translate(10, 634)"><!-- Tab positions: Home=0, Features=85, Docs=170, Account=255 -->
  <rect width="85" height="56" fill="#8b5cf6"/>
  <g transform="translate(30, 6)">
    <path fill="#fff" d="..."/> <!-- Copy icon paths from footer-mobile.svg, change fill to #fff -->
  </g>
  <text x="42" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">Home</text>
</g>
```

### Why Build-Time Injection?
- External `<use href="file.svg#group">` works for content
- BUT nested `<use href="#symbol">` inside that group doesn't resolve
- Icons must be inline `<path>` elements, embedded at generation time
- Single source of truth maintained - edit include, regenerate wireframes

---

## Light Theme Template (UX/Frontend Wireframes)

Use this template for user-facing screens, forms, and interactive UI.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
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
      /* Typography - v4 LARGER for readability, WCAG AA compliant on parchment */
      .heading-lg { fill: #1a1a2e; font-family: system-ui, sans-serif; font-size: 28px; font-weight: 800; }
      .heading { fill: #1a1a2e; font-family: system-ui, sans-serif; font-size: 20px; font-weight: 700; }
      .text-md { fill: #2d3748; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 500; }
      .text-sm { fill: #374151; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; }
      .text-muted { fill: #4b5563; font-family: system-ui, sans-serif; font-size: 13px; font-weight: 500; }
      .annotation { fill: #6d28d9; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 700; }
      /* Layout labels */
      .label-desktop { fill: #8b5cf6; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      .label-mobile { fill: #d946ef; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      /* Requirements Legend styles (light theme) */
      .legend-header { fill: #6d28d9; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      .legend-code { fill: #8b5cf6; font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; }
      .legend-text { fill: #374151; font-family: system-ui, sans-serif; font-size: 13px; }
      /* Toggle styling - standardized colors */
      .toggle-on { fill: #22c55e; }      /* Green - active/enabled */
      .toggle-off { fill: #64748b; }     /* Slate - inactive */
      .toggle-disabled { fill: #9ca3af; } /* Light gray - non-interactive */
      .toggle-always-on { fill: #22c55e; } /* Green - required (same as on) */
      .toggle-thumb { fill: #ffffff; }
    </style>
  </defs>

  <!-- Background - deeper sky blue -->
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- Dot grid pattern - blue-tinted -->
  <g opacity="0.35">
    <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1" fill="#6b8cba"/>
    </pattern>
    <rect width="1920" height="1080" fill="url(#dots)"/>
  </g>

  <!-- Accent line top -->
  <rect x="0" y="0" width="1920" height="3" fill="url(#accentGrad)"/>

  <!-- Title -->
  <text x="700" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#4b5563" letter-spacing="1">WIREFRAME TITLE</text>

  <!-- DESKTOP SECTION (left) -->
  <text x="40" y="52" class="label-desktop">DESKTOP (16:9)</text>
  <g id="desktop-view">
    <!-- Desktop viewport (16:9 ratio: 1366×768 - common laptop resolution) -->
    <!-- ⛔ MANDATORY: 1366×768 for 16:9 aspect ratio, 94px gap to mobile -->
    <rect x="40" y="60" width="1366" height="768" rx="8" fill="#e8d4b8" stroke="#b8a080"/>

    <!-- WEBSITE HEADER (ScriptHammer Standard - customize active nav item per feature) -->
    <g id="site-header" transform="translate(50, 70)">
      <!-- Header background (1346px = 1366 - 20 padding) -->
      <rect width="1346" height="50" rx="0" fill="#dcc8a8" stroke="#b8a080"/>
      <!-- Logo (left) - ScriptHammer brand -->
      <rect x="15" y="10" width="30" height="30" rx="4" fill="#8b5cf6"/>
      <text x="55" y="32" class="heading-sm">ScriptHammer</text>
      <!-- Navigation items (center) - 44px touch targets -->
      <g transform="translate(550, 3)">
        <rect x="0" width="70" height="44" rx="4" fill="transparent"/>
        <text x="35" y="28" text-anchor="middle" class="text-sm">Home</text>
        <rect x="80" width="90" height="44" rx="4" fill="#8b5cf6"/>
        <text x="125" y="28" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="14px" font-weight="600">Features</text>
        <rect x="180" width="70" height="44" rx="4" fill="transparent"/>
        <text x="215" y="28" text-anchor="middle" class="text-sm">Docs</text>
        <rect x="260" width="80" height="44" rx="4" fill="transparent"/>
        <text x="300" y="28" text-anchor="middle" class="text-sm">Account</text>
      </g>
      <!-- Header right side: Accessibility + Settings + Avatar -->
      <g transform="translate(1170, 3)">
        <!-- Accessibility icon (always visible - WCAG commitment) -->
        <rect x="0" y="0" width="44" height="44" rx="4" fill="transparent"/>
        <text x="22" y="28" text-anchor="middle" font-size="18">👁</text>
        <!-- Settings gear (theme + font) - darker fill for visibility -->
        <rect x="54" y="0" width="44" height="44" rx="4" fill="transparent"/>
        <text x="76" y="28" text-anchor="middle" fill="#4b5563" font-size="18">⚙️</text>
        <!-- User avatar -->
        <circle cx="130" cy="22" r="16" fill="#8b5cf6"/>
        <text x="130" y="27" text-anchor="middle" fill="#fff" font-size="12">U</text>
      </g>
    </g>

    <!-- CONTENT AREA (below header, starts at y=130 relative to desktop) -->
    <!-- Available space: 1346×688 (header 50px + 30px padding, content area 688px) -->
    <!-- 3-column layout: sidebar 200px | main 800px | detail 320px (10px gaps) -->
    <!-- Content panels use fill="#dcc8a8" (secondary) or fill="#f5f0e6" (inputs) -->
    <!-- Borders use stroke="#b8a080" -->
  </g>

  <!-- MOBILE SECTION (right) -->
  <text x="1500" y="52" class="label-mobile">MOBILE</text>
  <g id="mobile-view" transform="translate(1500, 60)">
    <!-- Phone frame: 360x700, rx=24 - darker tan -->
    <rect x="0" y="0" width="360" height="700" rx="24" fill="#c8b898" stroke="#a08860" stroke-width="2"/>
    <!-- Screen area: x=10, y=10, width=340, height=680, rx=16 - true parchment -->
    <rect x="10" y="10" width="340" height="680" rx="16" fill="#e8d4b8"/>
    <!-- Status bar - darker parchment -->
    <rect x="10" y="10" width="340" height="28" rx="16" fill="#dcc8a8"/>
    <text x="30" y="28" class="text-sm">9:41</text>
    <text x="310" y="28" text-anchor="end" class="text-sm">📶 🔋</text>

    <!-- MOBILE HEADER (ScriptHammer Standard - customize active tab to match desktop) -->
    <g id="mobile-header" transform="translate(10, 38)">
      <!-- Header bar -->
      <rect width="340" height="50" rx="0" fill="#dcc8a8" stroke="#b8a080"/>
      <!-- Hamburger menu (left) - 44px tap target -->
      <rect x="3" y="3" width="44" height="44" rx="4" fill="transparent"/>
      <text x="25" y="32" text-anchor="middle" class="text-md">☰</text>
      <!-- Logo (left of center) -->
      <rect x="55" y="10" width="24" height="24" rx="4" fill="#8b5cf6"/>
      <text x="85" y="30" class="text-sm">SH</text>
      <!-- Header right side: Accessibility + Settings + Avatar -->
      <g transform="translate(155, 3)">
        <!-- Accessibility icon -->
        <rect x="0" y="0" width="44" height="44" rx="4" fill="transparent"/>
        <text x="22" y="28" text-anchor="middle" font-size="16">👁</text>
        <!-- Settings gear - darker fill -->
        <rect x="44" y="0" width="44" height="44" rx="4" fill="transparent"/>
        <text x="66" y="28" text-anchor="middle" fill="#4b5563" font-size="16">⚙️</text>
        <!-- Avatar -->
        <circle cx="110" cy="22" r="14" fill="#8b5cf6"/>
        <text x="110" y="27" text-anchor="middle" fill="#fff" font-size="11">U</text>
      </g>
    </g>

    <!-- CONTENT AREA (between header and bottom nav) -->
    <!-- Available space: y=88 to y=634 = 546px height -->
    <!-- Mobile content starts at y=98 within this group (88 + 10px padding) -->

    <!-- MOBILE BOTTOM NAV (ScriptHammer Standard - customize active tab) -->
    <g id="mobile-bottom-nav" transform="translate(10, 634)">
      <rect width="340" height="56" rx="0" fill="#dcc8a8" stroke="#b8a080"/>
      <!-- Home (inactive) -->
      <g transform="translate(0, 0)">
        <rect width="85" height="56" fill="transparent"/>
        <text x="42" y="24" text-anchor="middle" font-size="18">🏠</text>
        <text x="42" y="44" text-anchor="middle" class="text-muted" font-size="11">Home</text>
      </g>
      <!-- Features (active - default) -->
      <g transform="translate(85, 0)">
        <rect width="85" height="56" fill="#8b5cf6" rx="0"/>
        <text x="42" y="24" text-anchor="middle" font-size="18">⚡</text>
        <text x="42" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">Features</text>
      </g>
      <!-- Docs (inactive) -->
      <g transform="translate(170, 0)">
        <rect width="85" height="56" fill="transparent"/>
        <text x="42" y="24" text-anchor="middle" font-size="18">📄</text>
        <text x="42" y="44" text-anchor="middle" class="text-muted" font-size="11">Docs</text>
      </g>
      <!-- Account (inactive) -->
      <g transform="translate(255, 0)">
        <rect width="85" height="56" fill="transparent"/>
        <text x="42" y="24" text-anchor="middle" font-size="18">👤</text>
        <text x="42" y="44" text-anchor="middle" class="text-muted" font-size="11">Account</text>
      </g>
    </g>
  </g>

  <!-- Footer signature (lower-left corner, 30px from bottom) -->
  <text x="60" y="1050" text-anchor="start" class="text-muted">000:01 | Feature Name | ScriptHammer</text>
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
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
      /* Typography - Dark Theme v4 LARGER - AAA compliant, READABLE sizes */
      .heading-lg { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 28px; font-weight: bold; }
      .heading { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 20px; font-weight: bold; }
      .heading-sm { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; }
      .text-md { fill: #cbd5e1; font-family: system-ui, sans-serif; font-size: 16px; }
      .text-sm { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 14px; }
      .text-muted { fill: #b4bcc8; font-family: system-ui, sans-serif; font-size: 13px; } /* AAA: lighter for readability */
      .annotation { fill: #c4b5fd; font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold; }
      /* Layout labels */
      .label-desktop { fill: #8b5cf6; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      .label-mobile { fill: #d946ef; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      /* Requirements Legend styles (dark theme) */
      .legend-header { fill: #c4b5fd; font-family: system-ui, sans-serif; font-size: 15px; font-weight: bold; }
      .legend-code { fill: #8b5cf6; font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; }
      .legend-text { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 13px; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- Dot grid pattern -->
  <g opacity="0.05">
    <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1" fill="#fff"/>
    </pattern>
    <rect width="1920" height="1080" fill="url(#dots)"/>
  </g>

  <!-- Accent line top -->
  <rect x="0" y="0" width="1920" height="3" fill="url(#accentGrad)"/>

  <!-- Title - AAA fix: #64748b → #8494a8 -->
  <text x="700" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#8494a8" letter-spacing="1">ARCHITECTURE DIAGRAM TITLE</text>

  <!-- Architecture content -->
  <g id="diagram-content">
    <!-- Panels use fill="#1e293b" or fill="#334155" -->
    <!-- Borders use stroke="#475569" -->
    <!-- Use boxes, arrows, and labels to show system components -->
  </g>

  <!-- Color Legend (REQUIRED if semantic colors are used) -->
  <g id="color-legend" transform="translate(40, 730)">
    <!-- Add legend items when diagram uses colors to encode meaning -->
    <!-- Example format (colorblind-friendly with patterns):
    <text x="0" y="0" class="text-sm" fill="#94a3b8">Legend:</text>
    <rect x="60" y="-10" width="12" height="12" rx="2" fill="none" stroke="#2563eb" stroke-width="2"/>
    <text x="80" y="0" class="text-sm">Target met</text>
    <rect x="180" y="-10" width="12" height="12" rx="2" fill="none" stroke="#7c3aed" stroke-width="2"/>
    <text x="200" y="0" class="text-sm">Constraint</text>
    <rect x="300" y="-10" width="12" height="12" rx="2" fill="none" stroke="#eab308" stroke-width="2" stroke-dasharray="2,1"/>
    <text x="320" y="0" class="text-sm">External dependency</text>
    -->
  </g>

  <!-- Footer signature (MANDATORY) -->
  <text x="60" y="780" text-anchor="start" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10">NNN:PP | Wireframe Title | ScriptHammer</text>
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

### RLS Badge Contrast (Colorblind-Friendly Palette)

| Background Color | Text Color | Ratio | Status | Example Use |
|-----------------|------------|-------|--------|-------------|
| `#2563eb` (blue) | `#1e3a5f` (blue-950) | ~6:1 | ✅ | Allow badges - **DARK TEXT** |
| `#991b1b` (dark red) | `#ffffff` | ~7:1 | ✅ | Deny badges - **WHITE TEXT** |
| `#eab308` (yellow) | `#451a03` (amber-950) | ~8:1 | ✅ | Conditional badges - **DARK TEXT** |
| `#7c3aed` (purple) | `#1e1b4b` (violet-950) | ~5:1 | ✅ | Auth Role badges - **DARK TEXT** |
| `#c026d3` (magenta) | `#4a044e` (fuchsia-950) | ~6:1 | ✅ | Service Role badges - **DARK TEXT** |

**Key change**: Dark red `#991b1b` allows white text (unlike bright red `#ef4444`).

### ⛔ RLS Badge Text Consistency (MANDATORY)

**ALL badge text MUST follow these rules:**

1. **Font**: Monospace (`Consolas`, `Monaco`, `Courier New`) - looks like code/SQL
2. **Case**: ALL CAPS for all badge text
3. **Symbols**: Consistent prefix symbols based on action type
4. **Qualifiers**: Include OWN/SVC when access is scoped

| Badge Type | Symbol | Example Text | Color |
|------------|--------|--------------|-------|
| Allow (user's own data) | ✓ | `✓ SEL OWN`, `✓ UPD OWN` | Blue |
| Deny (blocked) | ✗ | `✗ UPDATE`, `✗ DELETE`, `✗ NO DEL` | Dark Red |
| Conditional (policy-dependent) | ? | `? EMPTY` | Yellow |
| Service bypass (no symbol) | — | `SVC ONLY`, `INS SVC` | Magenta |

**Abbreviations (for 90px badge width):**
- `SEL` = SELECT
- `UPD` = UPDATE
- `INS` = INSERT
- `DEL` = DELETE
- `OWN` = owner's data only
- `SVC` = service role

```xml
<!-- ✅ CORRECT: Consistent badge format -->
<text class="badge-text-on-blue">✓ SEL OWN</text>      <!-- User can SELECT own data -->
<text class="badge-text-on-blue">✓ UPD OWN</text>      <!-- User can UPDATE own data -->
<text class="badge-text-on-darkred">✗ DELETE</text>    <!-- DELETE denied -->
<text class="badge-text-on-darkred">✗ NO DEL</text>    <!-- DELETE blocked (immutable) -->
<text class="badge-text-on-magenta">SVC ONLY</text>    <!-- Service role bypass -->
<text class="badge-text-on-magenta">INS SVC</text>     <!-- INSERT via service only -->
<text class="badge-text-on-yellow">? EMPTY</text>      <!-- Conditional: returns empty set -->

<!-- ❌ WRONG: Inconsistent format -->
<text>SELECT own</text>    <!-- Mixed case -->
<text>service</text>       <!-- Lowercase -->
<text>NO DEL</text>        <!-- Missing ✗ symbol -->
<text>ALLOW</text>         <!-- Missing ✓ symbol -->
```

**Color-specific text classes (add to `<style>` block):**
```css
/* RLS badge text - monospace for SQL operations */
.badge-text-on-blue { fill: #1e3a5f; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-weight: bold; font-size: 11px; }
.badge-text-on-darkred { fill: #ffffff; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-weight: bold; font-size: 11px; }
.badge-text-on-yellow { fill: #451a03; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-weight: bold; font-size: 11px; }
.badge-text-on-purple { fill: #1e1b4b; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-weight: bold; font-size: 11px; }
.badge-text-on-magenta { fill: #4a044e; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-weight: bold; font-size: 11px; }
```

---

## ⛔ FONT SIZE RULES (MANDATORY)

**Template sizes are MINIMUMS. Never shrink to fit.**

| Class | Min Size |
|-------|----------|
| `.heading-lg` | **28px** |
| `.heading` / `.text-md` | **20px** / **16px** |
| `.text-sm` / `.text-muted` | **14px** / **13px** |

**Content doesn't fit?** Expand canvas or reduce content. Never shrink fonts.

```xml
<!-- ❌ WRONG: Shrinking fonts to fit more content -->
.heading-lg { font-size: 24px; }  /* Template says 28px! */
.text-md { font-size: 14px; }     /* Template says 16px! */

<!-- ✅ CORRECT: Use template sizes, expand canvas if needed -->
.heading-lg { font-size: 28px; }
.text-md { font-size: 16px; }
<!-- viewBox="0 0 1600 1000" if content needs more space -->
```

---

## ⛔ <kbd>**FR**</kbd> <kbd>**SC**</kbd> <kbd>**US**</kbd> TAG STYLING (MANDATORY)

**ALL requirement tags MUST use identical styling with type-specific colors.**

### Tag Color Palette (Colorblind-Friendly)

| Tag | Color | Hex | Border | Use |
|-----|-------|-----|--------|-----|
| <kbd>**FR**</kbd> | **Blue** | **`#2563eb`** | **Solid** | Functional requirements |
| <kbd>**SC**</kbd> | **Orange** | **`#ea580c`** | **Dashed** | Performance/metrics |
| <kbd>**US**</kbd> | **Teal** | **`#0891b2`** | **Dotted** | User stories (inline only) |

**Why these colors**: Maximum hue separation works for protanopia, deuteranopia, and tritanopia. Border styles provide secondary differentiation.

### Standard Tag Styling (all three types)

| Property | Value |
|----------|-------|
| Font | **`system-ui, sans-serif`** |
| Size | **`14px`** |
| Weight | **`bold (700)`** |
| Border | **`stroke-width="2"`** (if pill) |

### CSS Classes (add to `<style>` block)

```css
/* Base tag styling - shared by all */
.tag-base {
  font-family: system-ui, sans-serif;
  font-size: 14px;
  font-weight: bold;
}

/* Type-specific colors (colorblind-friendly) */
.fr-tag { fill: #2563eb; }  /* Blue - Functional Requirements */
.sc-tag { fill: #ea580c; }  /* Orange - Success Criteria */
.us-tag { fill: #0891b2; }  /* Teal - User Stories */

/* Border colors for pill variants */
.fr-border { stroke: #2563eb; }
.sc-border { stroke: #ea580c; stroke-dasharray: 4,2; }  /* Dashed */
.us-border { stroke: #0891b2; stroke-dasharray: 2,2; }  /* Dotted */
```

### Template: Text-Only Tags

```xml
<text class="tag-base fr-tag" x="100" y="200">FR-001</text>
<text class="tag-base sc-tag" x="100" y="220">SC-001</text>
<text class="tag-base us-tag" x="100" y="240">US-001</text>
```

### Template: Pill Tags (with matching borders + stroke patterns)

```xml
<!-- FR pill (blue, solid border) -->
<g transform="translate(100, 200)">
  <rect width="70" height="24" rx="12" fill="none" stroke="#2563eb" stroke-width="2"/>
  <text x="35" y="16" text-anchor="middle" class="tag-base fr-tag">FR-001</text>
</g>

<!-- SC pill (orange, dashed border) -->
<g transform="translate(100, 240)">
  <rect width="70" height="24" rx="12" fill="none" stroke="#ea580c" stroke-width="2" stroke-dasharray="4,2"/>
  <text x="35" y="16" text-anchor="middle" class="tag-base sc-tag">SC-001</text>
</g>

<!-- US pill (teal, dotted border) - rarely used, US is usually inline -->
<g transform="translate(100, 280)">
  <rect width="70" height="24" rx="12" fill="none" stroke="#0891b2" stroke-width="2" stroke-dasharray="2,2"/>
  <text x="35" y="16" text-anchor="middle" class="tag-base us-tag">US-001</text>
</g>
```

### Pill Sizing Reference

| Content | Width | Height |
|---------|-------|--------|
| <kbd>**FR-001**</kbd> / <kbd>**SC-001**</kbd> / <kbd>**US-001**</kbd> | **80px** | **28px** |
| <kbd>**FR-001-005**</kbd> / <kbd>**SC-001-005**</kbd> | **110px** | **28px** |

**Formula**: `width = (chars × 9) + 24px padding`

### ⛔ Consistency Rules

1. **Same font/size/weight** for all three tag types (**14px system-ui bold**)
2. **Color distinguishes type** - blue=<kbd>**FR**</kbd>, orange=<kbd>**SC**</kbd>, teal=<kbd>**US**</kbd>
3. **Border pattern distinguishes type** - **solid**=<kbd>**FR**</kbd>, **dashed**=<kbd>**SC**</kbd>, **dotted**=<kbd>**US**</kbd>
4. **Border matches text** - pill stroke color = text fill color
5. **No mixing styles** - if using pills, ALL tags use pills

```xml
<!-- ❌ WRONG: Inconsistent styling -->
<text fill="#2563eb" font-size="14px">FR-001</text>
<text fill="#2563eb" font-size="12px">SC-001</text>  <!-- Wrong size! Should be 14px -->
<text fill="#22c55e">US-001</text>  <!-- Wrong color! Should be #0891b2 teal -->

<!-- ✅ CORRECT: Consistent styling, type-specific colors -->
<text class="tag-base fr-tag">FR-001</text>  <!-- Blue 14px -->
<text class="tag-base sc-tag">SC-001</text>  <!-- Orange 14px -->
<text class="tag-base us-tag">US-001</text>  <!-- Teal 14px -->
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
- Mobile frame: x=1500, y=60, w=360, h=700 → RIGHT=1860, BOTTOM=760
- Mobile screen: x=1510, y=70, w=340, h=680 → RIGHT=1330, BOTTOM=750
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
| System-ui | **13px** | ~7px | "FR-032" (6 chars) = 42px |
| System | **14px** | ~8px | "Settings" (8 chars) = 64px |
| System | **16px** | ~9px | "Export Report" (13 chars) = 117px |
| System | **20px** | ~11px | "Dashboard" (9 chars) = 99px |

```
TEXT: "FR-032, FR-033, FR-034" (22 chars including spaces)
  Font: system-ui 14px → 22 × 8 = 176px estimated width
  Position: x=720
  RIGHT EDGE: 720 + 176 = 896
  CONTAINER: Header bar ends at x=930
  CHECK: 896 < 930 ✓
```

### Validation Failures = STOP

If ANY calculation shows overflow:
1. **STOP** - do not write the element
2. **RECALCULATE** - adjust position or container size
3. **RE-VERIFY** - confirm the fix works

**DO NOT proceed with "it's probably fine" - do the math.**

---

## ⛔ TEXT ALIGNMENT CONSISTENCY (Within Containers)

**All text elements within a container MUST use consistent alignment.**

| Container Type | Alignment | Property |
|----------------|-----------|----------|
| Labels left of content | `text-anchor="start"` | Left-align |
| Labels right of content | `text-anchor="end"` | Right-align |
| Centered headings | `text-anchor="middle"` | Center |

**Example: Right-aligned labels within a 340px panel**
```xml
<!-- All labels right-aligned at x=330 (10px from 340px edge) -->
<text x="330" y="20" text-anchor="end" fill="#22c55e">Label 1</text>
<text x="330" y="40" text-anchor="end" fill="#3b82f6">Label 2</text>
<text x="330" y="60" text-anchor="end" fill="#ef4444">Label 3</text>
```

**⛔ WRONG**: Mixed x positions (250, 200, 140, 150) for same-purpose labels
**✅ RIGHT**: All labels at same x with `text-anchor="end"`

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

## ⛔ SECTION SPACING (MANDATORY for Multi-Section Layouts)

**Before writing SVG, calculate vertical gaps between sections.**

### Gap Analysis Formula

For each section transition, calculate:
```
gap = next_section_Y - (current_section_Y + current_section_height)
```

**Minimum gaps:**
| Transition | Minimum Gap |
|------------|-------------|
| Section header → content | 20px |
| Content → next section header | 60px |
| Last content → legend | 40px |
| Legend → footer | 30px |

### Example Layout (1000px canvas)

```
Section A: translate(40, 100)
  Content height: ~260px
  Ends at: Y = 360

Section B: translate(40, 420)  ← Gap = 420 - 360 = 60px ✅
  Content height: ~180px
  Ends at: Y = 600

Legend: translate(40, 660)  ← Gap = 660 - 600 = 60px ✅
  Height: ~60px
  Ends at: Y = 720

Footer: Y = 780  ← Gap = 780 - 720 = 60px ✅
```

**⛔ If gap < minimum → redistribute vertical space before writing SVG.**

**Common fix**: Add +20-40px to `translate(x, Y)` for sections that are too tight.

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
| Desktop viewport | x=40, y=60 | **1366×768** | 16:9 ratio (common laptop resolution) |
| - Header bar | y=70 (relative) | 1346×50 | Standard nav, 44px touch targets |
| - Content area | y=130 (relative) | 1346×688 | Main content below header |
| - Sidebar | x=50 | 200px wide | Optional navigation |
| - Main | varies | 800px wide | Primary content |
| - Detail | varies | 320px wide | Item details |
| - Gaps | | 10px | Between columns |
| Mobile area | x=1500, y=60 | 360×700 | Phone frame (94px gap from desktop) |
| - Content | x=1510, y=70 | 340×680 | 10px padding |
| Footer | x=60, y=1050 | - | 30px from bottom, lower-left corner |

**⛔ Desktop Dimension Rules**:
- **Width**: 1366px (16:9 ratio, common laptop)
- **Height**: 768px (exact 16:9 with width)
- **Header**: 50px fixed height with 44px nav items
- **Content**: 688px available after header (+148px vs previous)

---

## ⛔ NON-NEGOTIABLE LAYOUT DIMENSIONS (MANDATORY)

**These positions are FIXED across ALL wireframes in a feature. NO EXCEPTIONS.**

### Mobile Position Rule

**Mobile frame: x=1500, y=60** (1920 canvas - 360 frame - 60 margin = 1500). No exceptions.

```xml
<!-- ❌ WRONG --> <g transform="translate(770, 60)">
<!-- ✅ RIGHT --> <g transform="translate(1500, 60)">
```

Desktop x=40, mobile x=1500. Empty space between is intentional. Never move mobile closer.

**Verify before writing**: `transform="translate(1500, 60)"` + `MOBILE` label at x="1500".

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
<text x="60" y="780" text-anchor="start" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10">NNN:PP | Wireframe Title | ScriptHammer</text>
```

**Footer rules:**
- Position: `x="60" y="780"` (left-aligned, 30px above bottom)
- Alignment: `text-anchor="start"` (NOT center)
- Color: `#94a3b8` (slate-400, bright enough to read on dark)
- Format: `NNN:PP | Title | ScriptHammer` (NO square brackets)
- Font: `system-ui, sans-serif` at `10px`

**⛔ WRONG**: `[000:01]`, `fill="#64748b"`, centered
**✅ RIGHT**: `000:01`, `fill="#94a3b8"`, left-aligned

**Footer numbering convention:**
- `NNN` = 3-digit feature number (e.g., `000`, `001`, `042`)
- `PP` = 2-digit page number (e.g., `01`, `02`, `03`)
- Examples:
  - `000:01 | RLS Architecture Overview | ScriptHammer`
  - `004:03 | Touch Targets | ScriptHammer`

### Content Boundary Check

All content ≤ y=1030. Footer at y=1060. If content too tall: reduce content or split into multiple SVGs.

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

When using different border colors for badges/pills (colorblind-friendly):

| Border Color | Meaning | Pattern |
|--------------|---------|---------|
| `#2563eb` (blue) | Compliance achieved / Target met | Solid |
| `#eab308` (yellow) | External dependency / Caution | Dashed |
| `#7c3aed` (purple) | Technical constraint / Architecture limitation | Solid |
| `#475569` (gray) | Informational / Not yet verified | Dotted |

**Legend placement**: Footer area (y ≤ 750) or dedicated "Legend" panel.

```xml
<!-- ✅ CORRECT: Legend explaining color coding (colorblind-friendly with patterns) -->
<g id="legend" transform="translate(40, 720)">
  <text x="0" y="0" class="text-sm" fill="#94a3b8">Legend:</text>
  <rect x="60" y="-10" width="12" height="12" rx="2" fill="none" stroke="#2563eb" stroke-width="2"/>
  <text x="80" y="0" class="text-sm">Target met</text>
  <rect x="160" y="-10" width="12" height="12" rx="2" fill="none" stroke="#eab308" stroke-width="2" stroke-dasharray="2,1"/>
  <text x="180" y="0" class="text-sm">External dependency</text>
  <rect x="320" y="-10" width="12" height="12" rx="2" fill="none" stroke="#7c3aed" stroke-width="2"/>
  <text x="340" y="0" class="text-sm">Constraint</text>
</g>
```

### RLS/Access Control Legend Palette (MANDATORY for RLS diagrams)

**Colorblind-friendly palette for ALL RLS, security, and access control wireframes:**

| Badge | Color | Hex | Text Color | Icon | Pattern | Use |
|-------|-------|-----|------------|------|---------|-----|
| Allow | Blue | `#2563eb` | `#1e3a5f` | ✓ | Solid | Full access granted |
| Deny | Dark Red | `#991b1b` | `#ffffff` | ✗ | Diagonal stripes | Access blocked |
| Conditional | Yellow | `#eab308` | `#451a03` | ? | Dashed border | Policy-dependent access |
| Auth Role | Purple | `#7c3aed` | `#1e1b4b` | 🔑 | Solid | Authenticated user access |
| Service Role | Magenta | `#c026d3` | `#4a044e` | ⚙ | Double border | Service/admin bypass |

**Why these colors**: Blue vs Dark Red avoids red-green confusion. Each has unique icon AND pattern as fallback.

```xml
<!-- RLS Legend Template (colorblind-friendly with icons, LARGER for readability) -->
<g id="rls-legend" transform="translate(40, 755)">
  <text x="0" y="0" class="text-md" fill="#94a3b8" font-weight="bold">Legend:</text>

  <!-- Allow: Blue + checkmark (20x20 box, 14px icon) -->
  <rect x="80" y="-12" width="20" height="20" rx="3" fill="#2563eb"/>
  <text x="90" y="4" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">✓</text>
  <text x="108" y="0" class="text-sm" fill="#94a3b8">Allow</text>

  <!-- Deny: Dark red + X + diagonal stripes -->
  <defs><pattern id="deny-stripes" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="#fff" stroke-width="1" opacity="0.3"/>
  </pattern></defs>
  <rect x="170" y="-12" width="20" height="20" rx="3" fill="#991b1b"/>
  <rect x="170" y="-12" width="20" height="20" rx="3" fill="url(#deny-stripes)"/>
  <text x="180" y="4" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">✗</text>
  <text x="198" y="0" class="text-sm" fill="#94a3b8">Deny</text>

  <!-- Conditional: Yellow + ? + dashed border -->
  <rect x="260" y="-12" width="20" height="20" rx="3" fill="#eab308" stroke="#854d0e" stroke-width="2" stroke-dasharray="3,2"/>
  <text x="270" y="4" font-size="14" fill="#451a03" text-anchor="middle" font-weight="bold">?</text>
  <text x="288" y="0" class="text-sm" fill="#94a3b8">Conditional</text>

  <!-- Auth Role: Purple + key icon -->
  <rect x="390" y="-12" width="20" height="20" rx="3" fill="#7c3aed"/>
  <text x="400" y="4" font-size="12" fill="#fff" text-anchor="middle">🔑</text>
  <text x="418" y="0" class="text-sm" fill="#94a3b8">Auth Role</text>

  <!-- Service Role: Magenta + gear + double border -->
  <rect x="520" y="-12" width="20" height="20" rx="3" fill="#c026d3" stroke="#86198f" stroke-width="3"/>
  <text x="530" y="4" font-size="12" fill="#fff" text-anchor="middle">⚙</text>
  <text x="548" y="0" class="text-sm" fill="#94a3b8">Service Role</text>
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
<!-- Good: FR tag with context (blue) -->
<text class="tag-base fr-tag">FR-001: RLS on users table</text>

<!-- Good: SC tag with context (orange) -->
<text class="tag-base sc-tag">SC-001: 100% AAA compliance</text>

<!-- Bad: Code only, no context -->
<text class="tag-base fr-tag">FR-001</text>
```

**⚠️ CRITICAL: Color Consistency**
- ALL `FR-xxx` codes: Use `.fr-tag` class (blue `#2563eb`)
- ALL `SC-xxx` codes: Use `.sc-tag` class (orange `#ea580c`)
- NEVER use `.annotation` class for FR/SC codes (purple - inconsistent)

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

## ⛔ TAG POSITIONING STANDARD (MANDATORY - Pass 12 Learning)

**All FR/SC tags in card headers MUST follow this positioning standard:**

| Property | Value | Notes |
|----------|-------|-------|
| Margin from right edge | **15px** | Container width - 15 = tag x-position |
| First tag y-position | **17px** | From top of container |
| Second tag y-position | **35px** | 18px line height below first |
| Alignment | `text-anchor="end"` | Right-align tags to corner |
| Tag order | FR first, SC second | FR tags above/left, SC tags below/right |

### Example: Card with Two Tags

```xml
<!-- Card container: width=280 -->
<rect x="0" y="0" width="280" height="90" rx="8" fill="#dcc8a8" stroke="#b8a080"/>
<text x="15" y="22" class="heading-sm">Card Title</text>
<!-- Tags positioned in top-right corner -->
<text x="265" y="17" text-anchor="end" class="tag-base fr-tag">FR-033</text>
<text x="265" y="35" text-anchor="end" class="tag-base sc-tag">SC-001</text>
```

### Example: Wide Container with Multiple Tags (side-by-side)

```xml
<!-- Container: width=880 -->
<rect x="0" y="0" width="880" height="130" rx="8" fill="#dcc8a8" stroke="#b8a080"/>
<text x="15" y="22" class="heading-sm">Section Title</text>
<!-- Tags right-aligned, spaced 70px apart -->
<text x="865" y="17" text-anchor="end" class="tag-base sc-tag">SC-010</text>
<text x="795" y="17" text-anchor="end" class="tag-base fr-tag">FR-034</text>
<text x="725" y="17" text-anchor="end" class="tag-base fr-tag">FR-032</text>
```

---

## ⛔ FOOTER STANDARD (MANDATORY - Pass 13 Learning)

**Light theme wireframes MUST use consistent footer styling:**

```xml
<!-- Light Theme Footer (CORRECT) -->
<text x="60" y="780" text-anchor="start" class="text-muted">NNN:PP | Title | ScriptHammer</text>
```

| Property | Value | Notes |
|----------|-------|-------|
| x-position | **60** | Left margin |
| y-position | **780** | 20px from bottom on 800px canvas |
| Alignment | `text-anchor="start"` | Left-aligned |
| Class | `class="text-muted"` | Uses #4b5563 (gray-600) |
| Format | `NNN:PP \| Title \| ScriptHammer` | Feature:page, title, brand |

**⛔ WRONG**: Using inline `fill="#64748b"` or `fill="#94a3b8"` - too light
**✅ RIGHT**: Using `class="text-muted"` which is defined as `#4b5563`

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

### 7b. US Coverage Report (MANDATORY)

After generating all wireframes for a feature, output this report:

```
US COVERAGE REPORT for [FEATURE]:
┌──────────┬─────────────────────────────┬──────────────────────┐
│ US Code  │ Title                       │ Wireframe            │
├──────────┼─────────────────────────────┼──────────────────────┤
│ US-001   │ [Story title]               │ 01-xxx.svg ✓         │
│ US-002   │ [Story title]               │ 01-xxx.svg ✓         │
│ US-003   │ [Story title]               │ 02-xxx.svg ✓         │
│ ...      │ ...                         │ ...                  │
└──────────┴─────────────────────────────┴──────────────────────┘

Coverage: X/Y User Stories (100% required)
```

**⛔ If coverage < 100%, identify which wireframes need US tags and add them before completing.**

### 7c. Update Status in wireframe-status.json (MANDATORY)

After generating/regenerating wireframes, update the central tracker:

**File:** `docs/design/wireframes/wireframe-status.json`

**Update logic:**
- New wireframes (no prior .issues.md) → Set to `draft`
- Regenerated wireframes (had .issues.md) → Set to `regenerating`

**JSON structure:**
```json
{
  "000-rls-implementation": {
    "status": "draft",
    "svgs": {
      "01-rls-overview.svg": "draft",
      "02-rls-requirements.svg": "draft"
    }
  }
}
```

**Update steps:**
1. Read `docs/design/wireframes/wireframe-status.json`
2. Find the feature object (e.g., `000-rls-implementation`)
3. Update `status` field to `draft` or `regenerating`
4. Update each SVG's status in `svgs` object
5. Write updated JSON file

**Report:**
```
STATUS UPDATE: 000-rls-implementation
  Feature: draft (📝)
  SVGs: 2 files marked draft
```

## Alternative: `/wireframe-dark` or `/wireframe-light` to force theme.
