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
| G-010 | Body text classes at 13px (minimum) instead of 14px (target) | `.legend-text`, `.us-narrative` should be 14px, not 13px | Typography hierarchy |
| G-011 | Annotations placed at container edge bleed outside | Keep content ≥50px from container bottom; account for rounded corners | Container Boundary Validation |
| G-012 | "Key Requirements" section duplicates REQUIREMENTS KEY legend | FR/SC codes appear INLINE on UI elements only; legend provides definitions; NO separate summary section | Requirements Legend Panel |
| G-013 | Using "Acceptance Criteria" instead of "Success Criteria" | Use "Success Criteria" consistently; SC codes are Success Criteria from spec.md | Terminology Consistency |
| G-014 | Redundant wireframes with fluff/filler to pad space | Only create SVGs that show DISTINCT content; consolidate similar views; NO padding sections | Wireframe Count |
| G-015 | Inconsistent toggle/button colors (light grey, purple, transparent) | Toggles: OFF=#6b7280, ON=#22c55e. Buttons: all have visible fills | UI Element Standards |
| G-016 | No layout planning before SVG generation | Create LAYOUT PLAN table with coordinates; check for collisions BEFORE generating | Layout Planning Phase |
| G-017 | Badges placed ON TOP of UI elements | Badges must be 10px OUTSIDE elements; never overlap toggles, buttons, or text | Badge Placement Rules |

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
