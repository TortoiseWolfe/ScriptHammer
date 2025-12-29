---
description: Generate SVG wireframes (dark theme) from a spec and add them to the interactive viewer.
---

## User Input

```text
$ARGUMENTS
```

## Outline

Generate dark-themed SVG wireframes from a feature specification and add them to the FirstFrame wireframe viewer.

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

### 3. Plan the Wireframes

Based on the spec, determine which wireframes are needed:
- List views (showing multiple items)
- Detail views (showing single item)
- Forms (create/edit)
- Special states (empty, loading, error)

Present the plan to the user for approval before generating.

### 4. Generate SVG Wireframes

Create SVG wireframes following the dark theme patterns from the component library.

**File location**: `docs/design/wireframes/[feature-folder]/`

**Side-by-Side Layout Template** (Desktop left, Mobile right):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 800" width="1400" height="800">
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
      /* Typography - use these classes, not inline sizes */
      .heading-lg { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 20px; font-weight: bold; }
      .heading { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold; }
      .text-md { fill: #cbd5e1; font-family: system-ui, sans-serif; font-size: 12px; }
      .text-sm { fill: #94a3b8; font-family: system-ui, sans-serif; font-size: 10px; }
      .text-muted { fill: #64748b; font-family: system-ui, sans-serif; font-size: 10px; }
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

  <!-- Title -->
  <text x="700" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#64748b" letter-spacing="1">WIREFRAME TITLE</text>

  <!-- DESKTOP SECTION (left) -->
  <text x="40" y="52" class="label-desktop">DESKTOP</text>
  <g id="desktop-view">
    <!-- Desktop area: x=40, y=60, width=900, height=680 -->
    <!-- 3-column layout: sidebar 200px | main 440px | detail 240px (10px gaps) -->
    <!-- Header: x=40, y=60, width=900, height=50 -->
    <!-- Sidebar: x=40, y=120, width=200 -->
    <!-- Main: x=250, y=120, width=440 -->
    <!-- Detail: x=700, y=120, width=240 -->
  </g>

  <!-- MOBILE SECTION (right) -->
  <text x="980" y="52" class="label-mobile">MOBILE</text>
  <g id="mobile-view" transform="translate(980, 60)">
    <!-- Phone frame: 360x700, rx=24 -->
    <rect x="0" y="0" width="360" height="700" rx="24" fill="#1e293b" stroke="#475569" stroke-width="2"/>
    <!-- Screen area: x=10, y=10, width=340, height=680, rx=16 -->
    <rect x="10" y="10" width="340" height="680" rx="16" fill="#0f172a"/>
    <!-- Status bar -->
    <rect x="10" y="10" width="340" height="28" rx="16" fill="#1e293b"/>
    <text x="30" y="28" class="text-sm">9:41</text>
    <!-- Mobile content starts at y=48 within this group -->
  </g>
</svg>
```

**Layout Dimensions**:
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

**Dark Theme Color Palette**:
- Background: gradient `#0f172a` → `#1e293b`
- Primary: `#8b5cf6` (violet)
- Accent: `#d946ef` (fuchsia)
- Panels: `#1e293b`, `#334155`
- Borders: `#475569`
- Text: `#fff` (headings), `#94a3b8`/`#cbd5e1` (body), `#64748b` (muted)
- Success: `#22c55e`, Warning: `#eab308`, Error: `#ef4444`

**Design Guidelines**:
- Include annotation boxes to explain UI elements
- Show realistic placeholder data (not "Lorem ipsum")
- Use the sizing standards above for consistent component dimensions

### 5. Update the Wireframe Viewer

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

### 6. Verify

After updating:
1. List the created SVG files
2. Show the updated wireframes array
3. Confirm the nav section was added
4. Remind user to view at: `docs/design/wireframes/index.html`

## Example

For a spec about "User Profile" feature:

1. Create folder: `docs/design/wireframes/user-profile/`
2. Generate:
   - `profile-view.svg` - View profile page
   - `profile-edit.svg` - Edit profile form
3. Update index.html with nav section and wireframes array entries
