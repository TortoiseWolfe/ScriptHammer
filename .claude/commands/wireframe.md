---
description: Generate, fix, or regenerate SVG wireframes with smart triage (patches 🟢 issues, regenerates 🔴 issues)
---

## User Input

```text
$ARGUMENTS
```

## Outline

**Smart wireframe command** that handles the full lifecycle:
- **Fresh generation**: Creates wireframes from spec (no feedback file)
- **Fix cycle**: Patches 🟢 issues in place, regenerates 🔴 files with feedback

Theme selection:
- **Light theme** (Indigo palette) for UX/Frontend wireframes
- **Dark theme** (Slate/Violet palette) for Backend/Architecture wireframes

### Workflow (Simplified)

```
/wireframe-review [feature]     # Creates WIREFRAME_ISSUES.md with feedback
    ↓
/wireframe [feature]            # Smart: patches 🟢, regenerates 🔴, skips ✅
    ↓
(repeat until all issues resolved)
```

**Note**: `/wireframe-fix` is deprecated - this command now handles both patching and regeneration.

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
| No issues | ✅ SKIP - already good |
| Only 🟢 issues | 🟢 PATCH in place |
| Any 🔴 issues | 🔴 REGENERATE from scratch |

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

Read the **🔴 REGENERATION FEEDBACK section** for that file:
- **Diagnosis**: What's visually broken (coordinates, element names, specific issues)
- **Root Cause**: WHY the layout doesn't work
- **Suggested Layout**: Concrete alternative arrangement
- **Spec Requirements to Preserve**: FR/SC items that must remain
- **CSS Fixes to Apply**: Color/font corrections to include in regeneration

**This feedback is MANDATORY guidance.** When regenerating, you MUST:
1. Apply all CSS fixes from the feedback
2. Follow the suggested layout changes
3. Address every issue in the Diagnosis
4. Preserve all spec requirements listed

---

#### Example Triage Output

```
Analyzing WIREFRAME_ISSUES.md for 004-mobile-first-design...

Found 4 SVG files with 23 total issues.

Triaging files...
  01-responsive-navigation.svg: 15 issues
    🔴 REGENERATE - contains structural issues (overlap, cramped, spacing)
  02-content-typography.svg: 3 issues
    🔴 REGENERATE - contains structural issues (spacing)
  03-touch-targets.svg: 2 issues
    🟢 PATCH - all issues patchable (color only)
  04-breakpoint-system.svg: 3 issues
    🔴 REGENERATE - contains structural issues (cramped)

Actions:
  🟢 03-touch-targets.svg: Patching 2 color fixes...
  🔴 01, 02, 04: Regenerating with feedback...
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

#### Light Theme Indicators (use Indigo palette)
Use light theme when the wireframe:
- Contains form inputs, buttons, or interactive controls
- Shows user-facing screens (login, settings, profiles)
- Displays content layouts (blog posts, lists, cards)
- Has mobile phone frame mockups
- Shows state variations (loading, empty, error, success)
- Contains user flows (checkout, onboarding)
- Depicts dashboards with user data display

#### Dark Theme Indicators (use Slate/Violet palette)
Use dark theme when the wireframe:
- Is an architecture or system diagram
- Shows data flow visualizations
- Depicts test suite structures
- Illustrates CI/CD pipelines
- Contains security threat models
- Shows database schemas or RLS policies
- Depicts API integration diagrams
- Shows service dependency graphs

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
      /* Typography - Dark Theme - AAA compliant */
      .heading-lg { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 20px; font-weight: bold; }
      .heading { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold; }
      .text-md { fill: #cbd5e1; font-family: system-ui, sans-serif; font-size: 12px; }
      .text-sm { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 10px; }
      .text-muted { fill: #8494a8; font-family: system-ui, sans-serif; font-size: 10px; } /* AAA fix: #64748b → #8494a8 */
      .annotation { fill: #8b5cf6; font-family: monospace; font-size: 10px; }
      /* Layout labels */
      .label-desktop { fill: #8b5cf6; font-family: monospace; font-size: 11px; font-weight: bold; }
      .label-mobile { fill: #d946ef; font-family: monospace; font-size: 11px; font-weight: bold; }
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
- Text: `#fff` (headings), `#94a3b8`/`#cbd5e1` (body), `#8494a8` (muted - AAA fix)
- Success: `#22c55e`, Warning: `#eab308`, Error: `#ef4444`

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

**Component Sizing Standards** (use consistently):
| Component | Desktop | Mobile | rx |
|-----------|---------|--------|-----|
| Primary button | 100×36 | 80×32 | 6 |
| Icon button | 40×40 | 36×36 | 6 |
| FAB | r=28 | r=24 | circle |
| Text input | height=36 | height=32 | 6 |
| Card | - | - | 8 |
| List item | - | - | 6 |
| Badge (pill) | height=22 | height=20 | 11 |
| Avatar large | r=24 | r=20 | circle |
| Avatar small | r=16 | r=14 | circle |

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
