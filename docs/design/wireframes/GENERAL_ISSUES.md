# General Issues - Recurring Wireframe Mistakes

**Purpose**: Consolidated list of mistakes I keep making. Check this BEFORE generating ANY wireframe.

---

## Recurring Mistakes

| # | Mistake Pattern | Correct Approach | Skill Reference |
|---|-----------------|------------------|-----------------|
| G-001 | Using `#ffffff` for panels/modals | Use `#e8d4b8` (parchment) or `#dcc8a8` (secondary) | Light Theme Color Palette |
| G-002 | Placeholder icons (emoji, rectangles) | Copy EXACT `<path>` elements from include files | Include Files section |
| G-003 | Cramped layouts with wasted space elsewhere | Calculate space distribution BEFORE placing elements | Vertical Space Planning |
| G-004 | Arrows at wrong position vs referenced element | Align arrow Y-position with the button/element it references | Flow Arrow Routing |
| G-005 | Annotation boxes overlapping content | Place annotations in CLEAR areas, not over UI mockups | Annotation Placement Rules |
| G-006 | Ignoring include template patterns | Read and inject ACTUAL content from include SVGs | Include Files (Build-Time Injection) |
| G-007 | User story font too small (12px) | Use minimum 13px for `.us-narrative` readability | User Stories Section |
| G-008 | Mobile views missing requirement tags | Every FR/SC/US on desktop MUST appear on mobile too | Mobile Annotation Parity |
| G-009 | Requirement tags blend with UI buttons | Use distinct colors: FR=blue, SC=orange, US=cyan with HIGH contrast | Tag Color Distinction |
| G-010 | Body text classes at 13px (minimum) instead of 14px (target) | `.legend-text`, `.us-narrative` should be 14px, not 13px | Typography hierarchy (validator: FONT-001) |
| G-011 | Annotations placed at container edge bleed outside | Keep content ≥50px from container bottom; account for rounded corners | Container Boundary Validation |
| G-012 | "Key Requirements" section duplicates REQUIREMENTS KEY legend | FR/SC codes appear INLINE on UI elements only; legend provides definitions; NO separate summary section | Requirements Legend Panel |
| G-013 | Using "Acceptance Criteria" instead of "Success Criteria" | Use "Success Criteria" consistently; SC codes are Success Criteria from spec.md | Terminology Consistency |
| G-014 | Redundant wireframes with fluff/filler to pad space | Only create SVGs that show DISTINCT content; consolidate similar views; NO padding sections | Wireframe Count |
| G-015 | Inconsistent toggle/button colors (light grey, purple, transparent) | Toggles: OFF=#6b7280, ON=#22c55e. Buttons: all have visible fills | UI Element Standards |
| G-016 | No layout planning before SVG generation | Create LAYOUT PLAN table with coordinates; check for collisions BEFORE generating | Layout Planning Phase |
| G-017 | Badges placed ON TOP of UI elements | Badges must be 10px OUTSIDE elements; never overlap toggles, buttons, or text | Badge Placement Rules |
| G-018 | Annotation groups without User Story anchor | Each annotation group MUST be anchored by a US-XXX badge with narrative text | User Story Anchoring |
| G-020 | Cramped annotation callout text | Add line breaks and vertical gaps between callout groups for readability | Annotation Spacing |
| G-021 | Footer hidden behind modal overlay | Place footer `<use>` AFTER modal content in SVG order (SVG paints in order) | SVG Paint Order |
| G-022 | Missing canvas background gradient | Canvas MUST have `#c7ddf5` → `#b8d4f0` gradient, not solid parchment | Background Gradient |
| G-024 | Missing title block | MUST have centered title at y=28: "FEATURE - PAGE NAME" | Title Block |
| G-025 | Missing signature block | MUST have "NNN:NN \| Feature \| ScriptHammer" at y=1060, 18px bold | Signature Block |
| G-026 | No numbered callouts on mockups | Red circles ①②③④ MUST appear ON mockup UI elements | v4 Callout System (validator: ANN-002, G-026) |
| G-030 | Annotation groups clustered instead of distributed | Use 4-column grid: x=20, 470, 920, 1370. One group per column. | Annotation Column Distribution |
| G-031 | Callout circle placed ON TOP of UI element | Place callout 10-20px ADJACENT to element, never covering it | Callout Placement |
| G-032 | Desktop UI cramped to left, wasting right side | Center content; 2 panels=640px each, 3 states=420px each | Desktop Space Usage |
| G-033 | Callouts at random Y positions when alignment possible | Align callouts highlighting same row to shared Y coordinate | Callout Grid Alignment |
| G-034 | Mobile content y-position too high (overlaps header) | Mobile content must start at y >= 78 (after header area) | Mobile Safe Area |
| G-035 | Buttons using faded/parchment colors | Use solid button colors: primary=#8b5cf6, secondary=#f5f0e6, tertiary=#dcc8a8 | Button Color Standards |
| G-036 | Badge/pill overflows its container row | Keep badges within parent container bounds; use smaller font or abbreviate if needed | Badge Containment |
| G-037 | Annotation narrative text too light/small | Use 16px bold for titles, 14px regular for narrative, high contrast | Annotation Readability |

<!-- DEMOTED: G-019, G-023, G-027, G-028, G-029 moved to feature-specific issues (002-cookie-consent/01.issues.md)
     These have only been observed once. Promote back if seen in 2+ features. -->

---

## Pre-Generation Checklist

Before writing ANY SVG:

- [ ] Read this file (GENERAL_ISSUES.md)
- [ ] Check Light Theme palette: `#e8d4b8`, `#dcc8a8`, `#f5f0e6` - NOT `#ffffff`
- [ ] Open include files and prepare to copy EXACT paths
- [ ] Calculate vertical space distribution BEFORE placing elements
- [ ] Plan arrow positions to match the elements they reference
- [ ] Identify clear areas for annotation boxes

---

## Color Reference (Light Theme)

| Use Case | Correct Color | Wrong Color |
|----------|---------------|-------------|
| Modal/Panel background | `#e8d4b8` | `#ffffff` |
| Secondary panel | `#dcc8a8` | `#ffffff` |
| Input fields only | `#f5f0e6` | `#ffffff` |
| Desktop viewport | `#e8d4b8` | `#ffffff` |
| Mobile screen | `#e8d4b8` | `#ffffff` |

---

## Include Files Location

```
docs/design/wireframes/includes/
├── header-desktop.svg  → Desktop header with icons
├── header-mobile.svg   → Mobile status bar + header with icons
├── footer-mobile.svg   → Mobile bottom nav with icons
└── defs.svg            → Reference only
```

**CRITICAL**: Icons in includes have actual `<path>` elements. Do NOT use:
- Emoji (📶 🔋 ☰)
- Rectangles as placeholders
- Simplified shapes

---

## History

| Date | Issue Added | Source |
|------|-------------|--------|
| 2026-01-09 | G-001 to G-006 | 002:01 review feedback |
| 2026-01-09 | G-007 to G-009 | 002:01 screenshot review - font size, mobile parity, tag distinction |
| 2026-01-09 | G-010 | 001:02, 002:01 review - body text using minimum (13px) instead of target (14px) |
| 2026-01-10 | G-011 | 002:02 review - FR-014 outside viewport due to edge placement |
| 2026-01-10 | G-012 | 002:03 review - "Key Requirements" section duplicates legend |
| 2026-01-10 | G-013 | 002:03 review - "Acceptance Criteria" should be "Success Criteria" |
| 2026-01-10 | G-014 | 002 review - 3 SVGs when 2 would suffice; 02 and 03 show redundant content with filler |

---

## Tag Color Standards (G-009)

Requirement tags must be VISUALLY DISTINCT from UI mockup elements:

| Tag Type | Background | Text | Purpose |
|----------|------------|------|---------|
| FR-### | `#2563eb` (blue-600) | white | Functional Requirements |
| SC-### | `#ea580c` (orange-600) | white | Success Criteria |
| US-### | `#0891b2` (cyan-600) | white | User Stories |
| P0/P1/P2 | `#dc2626`/`#f59e0b`/`#3b82f6` | white/black | Priority badges |

**Why distinct?** Tags annotate the wireframe - they are NOT part of the UI being designed. Users must instantly distinguish "this is a requirement marker" from "this is an actual button."

---

## Mobile Annotation Parity (G-008)

**Rule**: If desktop shows FR-001, FR-002, SC-001 on a modal, mobile MUST show the same tags.

Mobile has less space, so:
- Stack tags vertically if needed
- Use smaller font (11px) but keep colored backgrounds
- Position tags near the elements they reference
- At minimum: show key FR/SC tags, can abbreviate US to just priority badge

---

## Body Text Font Sizes (G-010)

**Rule**: Body text = 14px. The 13px size is MINIMUM for edge cases, not the default.

| Class | Wrong | Correct | Purpose |
|-------|-------|---------|---------|
| `.legend-text` | 13px | **14px** | Requirements Key descriptions |
| `.us-narrative` | 13px | **14px** | User Story narrative text |
| `.us-title` | 13px | **14px** | User Story titles |

**Systemic fix required**:
1. Update `/wireframe` skill CSS templates (both Light and Dark themes)
2. Patch all existing SVGs using these classes

**Why 14px?** Per /wireframe skill typography hierarchy:
- Body Text = 14px Regular
- 13px is for `.text-muted` and edge cases only

---

## Requirements Redundancy (G-012)

**Rule**: FR/SC codes appear in exactly TWO places:
1. **INLINE** - as annotations on the UI elements they reference
2. **REQUIREMENTS KEY legend** (y=950) - provides short definitions

**NEVER create a separate "Key Requirements" summary section.** This duplicates the legend.

| Wrong | Correct |
|-------|---------|
| "Key Requirements" panel listing FR-016, FR-017, FR-018 with descriptions | FR-016, FR-017, FR-018 as inline tags on Export/Delete buttons |
| Same codes in legend AND summary section | Codes inline + legend only |

**Why this matters**: Redundant content wastes space and creates maintenance burden. If requirements change, two sections need updating instead of one.

**Systemic fix required**:
1. Update `/wireframe` skill to forbid "Key Requirements" sections
2. Remove existing "Key Requirements" sections from SVGs
3. Ensure inline FR/SC tags are positioned on relevant UI elements

---

## Terminology Consistency (G-013)

**Rule**: Use "Success Criteria" consistently. NEVER use "Acceptance Criteria" for SC codes.

| Term | Definition | Use |
|------|------------|-----|
| **Success Criteria (SC)** | Measurable outcomes from spec.md `### Success Criteria` | SC-001, SC-002, etc. |
| **Acceptance Scenarios** | BDD Given/When/Then from User Stories | Part of US cards, NOT separate section |

**Wrong**: "Acceptance Criteria" section with SC codes
**Correct**: "Success Criteria" or just show SC codes in legend

**Why this matters**: Mixing terminology confuses readers. Spec.md uses "Success Criteria" - wireframes must match.

**Affected SVGs**:
- 002:03 has "Acceptance Criteria" section (should be removed or renamed)
- Check all SVGs for this pattern

---

## Wireframe Count & Redundancy (G-014)

**Rule**: Only create wireframes that show DISTINCT content. If two wireframes show the same UI with minor variations, CONSOLIDATE them.

### Signs of Redundant Wireframes

- Same UI elements repeated across multiple SVGs
- Padding sections added to fill space ("Key Requirements", "Acceptance Criteria", "User Stories Covered" when already shown in 01)
- Separate wireframe for what could be a panel or section within another

### Questions Before Creating Multiple SVGs

1. Does this wireframe show a DIFFERENT screen/flow? → If no, consolidate
2. Would this content fit as a section in an existing wireframe? → If yes, consolidate
3. Am I adding filler sections to justify this SVG's existence? → If yes, consolidate

### Example: 002-cookie-consent

**Wrong (3 SVGs with redundancy)**:
- 01: Modal consent flow
- 02: Settings page (same toggles as modal)
- 03: Export/deletion (padded with "Key Requirements" and "Acceptance Criteria" filler)

**Correct (2 SVGs, distinct content)**:
- 01: Modal consent flow (first-time visitor experience)
- 02: Settings page WITH export/delete integrated (returning user experience)

### Filler Sections to AVOID

These sections are often used to pad wireframes that don't have enough real content:

| Filler Pattern | Why It's Wrong |
|----------------|----------------|
| "Key Requirements" summary | Duplicates REQUIREMENTS KEY legend (G-012) |
| "Acceptance Criteria" list | Wrong terminology, belongs in US cards (G-013) |
| "User Stories Covered" in non-01 SVGs | US section only belongs in wireframe 01 |
| Repeated flow diagrams | If 01 shows the flow, don't repeat in 02/03 |

**Bottom line**: If you need filler to justify a wireframe, you don't need that wireframe.

---

## UI Element Color Standards (G-015)

**Problem**: Toggles and buttons use inconsistent colors that blend with backgrounds or look like annotation badges.

### Toggle Switch Colors

| State | Track Color | Knob Color |
|-------|-------------|------------|
| OFF | `#6b7280` (gray-500) | `#ffffff` |
| ON | `#22c55e` (green-500) | `#ffffff` |

**NEVER use**:
- Light grey (`#d1d5db`) - blends with parchment background
- Purple (`#8b5cf6`) - conflicts with primary button color
- Transparent - invisible

### Button Colors

| Button Type | Background | Text | Border |
|-------------|------------|------|--------|
| Primary | `#8b5cf6` (violet) | `#ffffff` | none |
| Secondary | `#f5f0e6` (cream) | `#8b5cf6` | `#8b5cf6` 2px |
| Tertiary | `#dcc8a8` (tan) | `#374151` | `#b8a080` 1px |

**NO transparent backgrounds.** Every button must have a visible fill.

### Badge vs UI Element Distinction

| Element | Background | Purpose |
|---------|------------|---------|
| FR badge | `#2563eb` (blue) | Annotation - NOT clickable |
| SC badge | `#ea580c` (orange) | Annotation - NOT clickable |
| US badge | `#0891b2` (cyan) | Annotation - NOT clickable |
| UI button | `#8b5cf6` (violet) | Actual interactive element |

**Badges annotate. Buttons act. They must look DIFFERENT.**

---

## Layout Planning Phase (G-016)

**Problem**: Jumping straight to SVG code without planning element positions leads to cramped layouts, wasted space, and collisions.

### Required: LAYOUT PLAN Output

Before generating ANY SVG, output a layout table:

```
═══════════════════════════════════════════════════════════════
LAYOUT PLAN: [feature] wireframe [NN]
═══════════════════════════════════════════════════════════════

CANVAS: 1920×1080
DESKTOP AREA: x=40, y=60, w=1366, h=768 (ends at x=1406)
MOBILE AREA: x=1500, y=60, w=360, h=700

─────────────────────────────────────────────────────────────────
DESKTOP LAYOUT
─────────────────────────────────────────────────────────────────
State count: [N]
State width: [calculated]px each

| Element          | x    | y    | w    | h    | Collision? |
|------------------|------|------|------|------|------------|
| STATE 1 panel    | ...  | ...  | ...  | ...  | ✓ OK       |
| FR-001 badge     | ...  | ...  | 55   | 20   | ✓ OK       |
...

SPACE CHECK:
- Desktop width used: [X]px / 1366px = [Y]%
- Desktop height used: [X]px / 768px = [Y]%

═══════════════════════════════════════════════════════════════
LAYOUT APPROVED? [Wait for user]
═══════════════════════════════════════════════════════════════
```

**DO NOT generate SVG until layout is approved.**

### Space Distribution Rules

| States | Width per State | Gap |
|--------|-----------------|-----|
| 2 | 680px | 20px |
| 3 | 450px | 20px |
| 4 | 330px | 20px |

---

## Badge Placement Rules (G-017)

**Problem**: Badges placed ON TOP of UI elements (toggles, buttons, text) make the wireframe unreadable.

### Rules

1. Badges must be **10px minimum** from element edges
2. Badges go **OUTSIDE** UI elements, not on top
3. Preferred positions:
   - Top-right corner of containing panel
   - Bottom-left corner of element being annotated
   - Below element with arrow pointing up
4. **NEVER** place a badge:
   - On top of a toggle switch
   - On top of button text
   - Overlapping other badges

### Collision Detection

Two elements collide if ALL of these are true:
```
el1.x < el2.x + el2.width AND
el1.x + el1.width > el2.x AND
el1.y < el2.y + el2.height AND
el1.y + el1.height > el2.y
```

Check for collisions in the LAYOUT PLAN phase, not after generating SVG.

---

## History (continued)

| Date | Issue Added | Source |
|------|-------------|--------|
| 2026-01-11 | G-015 | 002:01 review - toggles using light grey/purple, buttons transparent |
| 2026-01-11 | G-016 | 002:01 review - cramped layout with wasted space, no pre-planning |
| 2026-01-11 | G-017 | 002:01 review - FR badges overlapping toggle switches |
| 2026-01-12 | G-020 | 002:01 review - annotation callouts cramped, no visual gaps |
| 2026-01-12 | G-021 | 002:01 review - footer rendered but hidden behind modal overlay |
| 2026-01-12 | G-022 | 002:01 review - missing blue gradient background |
| 2026-01-12 | G-024 | 002:01 review - missing centered title block |
| 2026-01-12 | G-025 | 002:01 review - missing signature block |
| 2026-01-12 | G-026 | 002:01 review - no numbered callouts on mockups |
| 2026-01-12 | DEMOTED | G-019, G-023, G-027, G-028, G-029 → feature-specific (only seen once) |
| 2026-01-12 | ESCALATED | FONT-001 → G-010, ANN-002 → G-026 (seen in 2+ features) |
| 2026-01-12 | G-030 | 003:01 review - annotation groups clustered to left, not distributed |
| 2026-01-12 | G-031 | 003:01 review - callout ③ blocking GitHub button |
| 2026-01-12 | G-032 | 003:01 review - desktop UI cramped left, wasting right side |
| 2026-01-12 | G-033 | 003:01 review - callouts at random Y positions, not aligned |
| 2026-01-12 | G-034 | 002:01, 002:02 review - mobile content overlaps header insert |
| 2026-01-12 | G-035 | 003:02, 004:02 review - buttons using faded parchment fills |
| 2026-01-12 | G-036 | 002:01 review - "Always On" badge outside cookie row container |
| 2026-01-12 | G-037 | 002:01 review - annotation text too small/light to read |

---

## Annotation Spacing (G-020)

**Problem**: Annotation callout text is cramped with no visual separation between groups.

### Rule

Each callout group (①②③④) needs:
1. **Vertical gap** of at least 20px between groups
2. **Line breaks** in narrative text for readability
3. **Clear visual boundary** - either whitespace or subtle separator

### Annotation Panel Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ ① First Visit Consent                                               │
│    As a first-time visitor, I need to make a choice                 │
│    before cookies are set.                                          │
│    [US-001] [FR-001] [FR-003] [FR-004] [SC-001]                     │
│                                                                     │
│                              ← 20px gap                             │
│                                                                     │
│ ② Granular Cookie Control                                           │
│    As a privacy-conscious user, I need to control                   │
│    each cookie category independently.                              │
│    [US-002] [FR-005] [FR-006] [FR-007] [SC-002]                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Text Wrapping

Long narrative text should wrap at ~60 characters:

| Wrong | Correct |
|-------|---------|
| `As a first-time visitor, I need to make a choice before cookies are set.` (one line, 72 chars) | `As a first-time visitor, I need to make`<br>`a choice before cookies are set.` (two lines) |

---

## SVG Paint Order (G-021)

**Problem**: Footer `<use>` placed before modal content gets painted UNDER the modal overlay.

### How SVG Rendering Works

SVG elements render in document order. Later elements paint ON TOP of earlier elements.

```xml
<!-- WRONG: Footer painted first, then covered by modal -->
<g id="desktop-nav-templates">
    <use href="includes/footer-desktop.svg#site-footer" x="40" y="700"/>
</g>
<g id="desktop">
    <rect ... modal-overlay .../>  <!-- Covers the footer! -->
</g>

<!-- CORRECT: Footer painted last, visible on top -->
<g id="desktop">
    <rect ... modal-overlay .../>
</g>
<g id="desktop-nav-templates">
    <use href="includes/footer-desktop.svg#site-footer" x="40" y="700"/>
</g>
```

### Rule

Place include `<use>` elements in this order:
1. Header (top of viewport group)
2. Page content
3. Modal overlay (if present)
4. Modal content (if present)
5. **Footer (LAST, so it's always visible)**

### For Modals Specifically

When a modal has an overlay, the footer should still be visible at the bottom of the viewport. Place the footer `<use>` AFTER the modal group closes.

---

## Annotation Column Distribution (G-030)

**Problem**: User story groups in annotation panel clustered to one side instead of evenly distributed.

### Bad Example (003:01)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ① Email Registration  ② User Sign In  ③ OAuth  ④ Security               │
│ [all badges]          [badges]        [badges] [badges]                 │
│                                                                         │
│ ← Everything crammed left, right side empty →                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Good Example (002:01)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ① First Visit       │ ② Granular Control │ ③ Persistence  │ ④ Update   │
│ [badges]            │ [badges]           │ [badges]       │ [badges]   │
│                     │                    │                │            │
│ x=20                │ x=470              │ x=920          │ x=1370     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Rule

| Groups | Distribution |
|--------|--------------|
| 4 groups | One per column (x=20, 470, 920, 1370) |
| 3 groups | Columns 1, 2, 3 (leave 4 empty or span) |
| 2 groups | Columns 1-2 and 3-4 (480px each) |
| 5+ groups | Two rows, distribute evenly |

**Column width**: 450px each with 20px gaps.

---

## Callout Must Not Block UI (G-031)

**Problem**: Callout circles placed directly ON TOP of the UI element they reference, hiding it from view.

### Bad Example (003:01)
```
┌─────────────────────────────────┐
│  Sign up with GitHub            │  ← Button hidden
│         ③                       │  ← Callout ON TOP of button
└─────────────────────────────────┘
```

### Good Example
```
┌─────────────────────────────────┐
│  Sign up with GitHub            │③ ← Callout adjacent (10px offset)
└─────────────────────────────────┘
```

### Placement Philosophy

**Callouts are SUPPORTIVE** - they follow the UI, don't lead it.

| Priority | Position | When to use |
|----------|----------|-------------|
| 1st | RIGHT of element | Default - follows reading flow |
| 2nd | BELOW element | When right side is crowded |
| NEVER | LEFT or ABOVE | Takes visual priority from UI |

### Placement Rules by Element

| Element Type | Callout Position | Offset |
|--------------|------------------|--------|
| Button | RIGHT side, vertically centered | 10px from edge |
| Input field | RIGHT side, vertically centered | 10px from edge |
| Toggle | RIGHT side | 10px from toggle |
| Panel/Card | RIGHT edge or BOTTOM-RIGHT corner | Inside panel border |

**NEVER place callout where it:**
- Leads the element (left/above)
- Obscures button text, input content, or toggle state
- Takes visual priority from UI

---

## Desktop Content Centering (G-032)

**Problem**: UI content crammed to left side of 1280px desktop mockup, leaving right side empty.

### Bad Example (003:01)
```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐                                             │
│  │ Register │ │ Sign In  │                   (empty space)             │
│  │  form    │ │  form    │                                             │
│  └──────────┘ └──────────┘                                             │
│  x=60        x=380        x=700+  ← wasted                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Good Example
```
┌────────────────────────────────────────────────────────────────────────┐
│         ┌──────────────┐              ┌──────────────┐                 │
│         │   Register   │              │   Sign In    │                 │
│         │     form     │              │     form     │                 │
│         └──────────────┘              └──────────────┘                 │
│         x=80, w=540                   x=660, w=540                     │
│              ← 20px gap →                                              │
└────────────────────────────────────────────────────────────────────────┘
```

### Width Calculations (1280px desktop)

| Panels | Width Each | Gap | Margin |
|--------|------------|-----|--------|
| 1 panel | 800px centered | - | 240px each side |
| 2 panels | 600px each | 40px | 20px each side |
| 3 panels | 400px each | 20px | 20px each side |

**Formula**: `(1280 - margins - gaps) / panels = panel_width`

---

## Callout Grid Alignment (G-033)

**Problem**: Callouts scattered at random Y positions when they highlight elements on the same row.

### Bad Example (003:01) - Y positions scattered
```
   ┌────────┐          ┌────────┐
   │ Panel  │①         │ Panel  │
   └────────┘          └────────┘②   ← ① and ② at different Y positions
```

### Good Example - Y aligned, RIGHT of elements
```
   ┌────────┐          ┌────────┐
   │ Panel  │①         │ Panel  │②   ← Both at same Y (right side of panels)
   └────────┘          └────────┘
```

### Alignment Rules

1. **Header row callouts**: All at y=header_bottom + 10px
2. **Form field callouts**: Align to field's vertical center
3. **Button callouts**: Align to button's vertical center
4. **Footer callouts**: All at y=footer_top - 10px

### Grid Positions (common Y values)

| Zone | Y Position | Purpose |
|------|------------|---------|
| Header | y=100 | Navigation, settings, user actions |
| Content top | y=200 | First row of content |
| Content mid | y=400 | Middle content area |
| Content bottom | y=600 | Last row before footer |
| Footer | y=700 | Footer elements |

**Exception**: When elements being highlighted are at different Y positions, callouts should still follow the element - but try to design UI with aligned elements first.

---

## Mobile Content Safe Area (G-034)

**Problem**: Mobile mockup content placed at y < 78 overlaps the header insert area.

### Mobile Mockup Structure

| Zone | Y Range | Purpose |
|------|---------|---------|
| Header | y=0 to y=78 | Reserved for header-mobile.svg insert |
| Content | y=78 to y=664 | Safe area for UI elements |
| Footer | y=664 to y=720 | Reserved for footer-mobile.svg insert |

### Mobile Frame Coordinates

```
Mobile mockup: x=1360, y=60, w=360, h=720
├── Header zone: y=0-78 (RESERVED - do not place content)
├── Content zone: y=78-664 (586px available)
└── Footer zone: y=664-720 (RESERVED)
```

### Rule

**First content element inside mobile group must have y >= 78.**

### Common Mistake

```xml
<!-- WRONG: Content overlaps header area -->
<g id="mobile" transform="translate(1360, 60)">
  <use href="includes/header-mobile.svg#mobile-header-group" x="0" y="0"/>
  <rect y="40" .../>  <!-- y=40 is inside header zone! -->
</g>

<!-- CORRECT: Content starts below header -->
<g id="mobile" transform="translate(1360, 60)">
  <use href="includes/header-mobile.svg#mobile-header-group" x="0" y="0"/>
  <rect y="78" .../>  <!-- y=78 is safe -->
</g>
```

### Why 78px?

The `header-mobile.svg` insert includes:
- Status bar (~22px)
- Navigation bar (~56px)
- Total header height: 78px

Content starting below y=78 ensures no visual overlap.

---

## Button Fill Colors (G-035)

**Problem**: Buttons using faded parchment colors (#e8d4b8, #dcc8a8) lack visual prominence and are hard to identify as interactive elements.

### Validator Trigger

BTN-001 fires when button `<rect>` elements use these faded fills:
- `#e8d4b8` (panel parchment)
- Transparent or near-transparent fills

### Correct Button Colors

| Button Type | Fill | Text | Border |
|-------------|------|------|--------|
| Primary | `#8b5cf6` (violet) | `#ffffff` | none |
| Secondary | `#f5f0e6` (cream) | `#8b5cf6` | `#8b5cf6` 2px |
| Tertiary | `#dcc8a8` (tan) | `#374151` | `#b8a080` 1px |

### Rule

**Every button must have a distinct, solid fill that stands out from panel backgrounds.**

### Why This Matters

- Parchment (#e8d4b8) is for panels, not buttons
- Faded buttons look disabled or non-interactive
- Users can't distinguish clickable from non-clickable elements

---

## Badge Row Containment (G-036)

**Problem**: Status badges like "Always On" positioned outside their logical container row, bleeding into adjacent areas.

### Rule

**Badges must stay within the bounds of their parent container.**

### Common Mistake (002:01 "Always On")

The "Always On" badge next to the Necessary Cookies toggle overflows the cookie row:
- Row width is fixed (~400px on desktop, ~280px on mobile)
- Badge positioned at x that puts it outside the row rect
- On mobile, even worse due to narrower container

### Fix

1. Position badge INSIDE the row, aligned right but with padding
2. Use smaller font (11px) if space is tight
3. Abbreviate to "On" or use a checkmark icon if still too wide
4. Calculate: `badge_x + badge_width < row_x + row_width - 10px`

### Visual Example

```
WRONG:                                    CORRECT:
┌─────────────────────┐                   ┌─────────────────────────────┐
│ Necessary Cookies   │ Always On         │ Necessary Cookies    Always On │
└─────────────────────┘ ← outside         └─────────────────────────────┘
                                                              ↑ inside
```

---

## Annotation Readability (G-037)

**Problem**: User Story titles and narrative text in annotation panel are hard to read - too small, too light, or insufficient contrast.

### Required Styling

| Element | Font Size | Weight | Color |
|---------|-----------|--------|-------|
| US title (e.g., "① First Visit") | 16px | **bold** | #1f2937 |
| Narrative text | 14px | regular | #374151 |
| Badge pills (FR-001, SC-001) | 11px | semibold | white on colored bg |

### Rule

**Annotation titles must be 16px bold. Narrative must be 14px regular with dark color (#374151 or darker).**

### Why This Matters

- Annotations explain the wireframe's purpose and requirements coverage
- If unreadable, the wireframe fails its documentation purpose
- 16px titles + 14px narrative creates clear visual hierarchy
- Bold titles create visual hierarchy between callout groups

### CSS Reference

```css
.us-title { font-size: 16px; font-weight: bold; fill: #1f2937; }
.us-narrative { font-size: 14px; font-weight: normal; fill: #374151; }
```
