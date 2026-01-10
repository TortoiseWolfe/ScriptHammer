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
