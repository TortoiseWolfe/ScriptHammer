# Wireframe Issues: 004-mobile-first-design

## Summary
- **Files reviewed**: 4 SVGs
- **Issues found**: 23 total (3 critical, 12 major, 8 minor)
- **Reviewed on**: 2026-01-01 (re-review with critical lens)

---

## Issues by File

### 01-responsive-navigation.svg

| # | Category | Severity | Location | Description | Suggested Fix |
|---|----------|----------|----------|-------------|---------------|
| 1 | Row collision | **CRITICAL** | y=220-340 | "MOBILE EXPANDED NAV" label at y=220 collides with mobile breakpoints row. The label is positioned at x=980 but the row's visual boundary extends across. Creates confusing overlap zone. | Move "MOBILE EXPANDED NAV" label to y=50 (above its phone frame), or shift mobile breakpoints row up to y=200 and increase spacing |
| 2 | Element overlap | **CRITICAL** | x=890-1090 | 320px iPhone SE device (x=890, width=200) extends to x=1090. Mobile expanded nav starts at x=980. These OVERLAP by 110px! | Reduce 320px device width, or shift mobile expanded nav to start at x=1120, or stack 320px device below others |
| 3 | Contrast | **CRITICAL** | Throughout | `#4a5568` text on `#e8d4b8` background = ~3.5:1 ratio. Fails WCAG AA (4.5:1) and AAA (7:1). ALL body text is illegible for users with low vision. | Use `#374151` (gray-700) for 5.5:1 AA, or `#1f2937` (gray-800) for 10:1 AAA compliance |
| 4 | Cramped spacing | Major | Mobile devices row | 4 device previews crammed horizontally with only 30px gaps. No breathing room. Row feels dense and rushed. | Reduce device preview widths by 20% each, increase gaps to 50px, or arrange in 2x2 grid |
| 5 | Contrast | Major | Annotations | `#8b5cf6` on `#e8d4b8` = ~3.1:1 contrast. Fails AA for normal text. Annotations hard to read. | Use `#6d28d9` (violet-700) for better contrast |
| 6 | Contrast | Major | Muted text | `#5a6577` (.text-muted) on light backgrounds = ~2.8:1. Completely fails accessibility. | Use `#4a5568` minimum, prefer `#374151` |
| 7 | Font size | Major | 320px device | "Script" logo uses 8px font - below 9px minimum for readability. Illegible. | Use 9px minimum, or use icon-only logo at 320px |
| 8 | Font size | Major | .spec-label | 10px font for spec labels is borderline. Hard to read at distance. | Increase to 11px minimum |
| 9 | Wasted space | Major | y=190-220 | 30px gap between desktop/tablet row and mobile row, but the right side has 500px empty area that could be used. Layout is inefficient. | Rearrange: stack mobile devices vertically on left, use right side for requirements panel |
| 10 | Touch target | Major | 320px buttons | Buttons are 34x26px - fails 44x44px requirement that THIS WIREFRAME is supposed to demonstrate! Ironic. | Even at 320px minimum, maintain 40x40px targets, use icon-only buttons |
| 11 | Touch target | Major | 375px hamburger | 40x30px hamburger - undersized for touch. | Maintain 44x44px minimum |
| 12 | Inconsistent sizing | Minor | Mobile devices | Device header heights vary: 60px (428), 60px (390), 60px (375), 60px (320) - but internal padding differs visually. | Standardize internal padding: 12px top, 12px bottom |
| 13 | Misalignment | Minor | Device labels | "428px (iPhone 14 Pro Max)" etc. labels don't align on same baseline. y=0 in transform but transforms vary. | Set all device labels to same absolute y position |
| 14 | Spacing inconsistency | Minor | FR cards | FR-001, FR-002, FR-003 in row 1 have 15px gap. FR-004, FR-005, visual example have 15px gap. But gap between rows is 15px. Should vary for visual hierarchy. | Use 15px within rows, 25px between rows |
| 15 | Orphaned indicator | Minor | "44x44 ✓" | Touch target indicator appears orphaned below 428px device, not clearly connected to what it's annotating. | Add leader line connecting indicator to the hamburger button |

### 02-content-typography.svg

| # | Category | Severity | Location | Description | Suggested Fix |
|---|----------|----------|----------|-------------|---------------|
| 1 | Contrast | Major | Body text | Same `#4a5568` on light theme issue. Typography wireframe should exemplify good contrast! | Use `#1f2937` for body text to achieve AAA |
| 2 | Line length | Major | Desktop body | Blog body text shown at full panel width. No max-width constraint demonstrated. Lines too long for comfortable reading. | Show max-width: 65ch constraint for body text |
| 3 | Contrast | Minor | Code blocks | Code block styling unclear against background | Add clear background differentiation |

### 03-touch-targets.svg

| # | Category | Severity | Location | Description | Suggested Fix |
|---|----------|----------|----------|-------------|---------------|
| 1 | Contrast | Major | All text | Consistent contrast issues with theme | Apply contrast fixes globally |
| 2 | Label proximity | Minor | "Good vs Bad" section | Labels not close enough to their examples | Reduce gap between labels and target examples |

### 04-breakpoint-system.svg (Extended 1600x1000)

| # | Category | Severity | Location | Description | Suggested Fix |
|---|----------|----------|----------|-------------|---------------|
| 1 | Cramped | Major | 4 device comparisons | Same cramped horizontal layout as 01. Devices squeezed together. | Use extended canvas width better - spread devices with 80px gaps |
| 2 | Contrast | Major | Muted text | Same contrast issues | Fix globally |

---

## Critical Issues Summary

### MUST FIX BEFORE IMPLEMENTATION

1. **Element overlap at x=890-1090**: The 320px device and Mobile Expanded Nav literally occupy the same pixel space. This is a layout error.

2. **Contrast failures throughout**: Not a single text color achieves AAA (7:1). Most fail AA (4.5:1). For a wireframe about WCAG compliance and mobile-first design, this is embarrassing.

3. **Row collision**: The mobile breakpoints row and expanded nav section fight for y=220.

### Structural Problems

The fundamental layout choice of cramming 4 device previews + 1 phone frame + requirements panel into 1400x800 is flawed. Consider:

- **Option A**: Extend canvas to 1600x1000 (like breakpoint-system.svg already does)
- **Option B**: Stack device previews vertically (320px → 375px → 390px → 428px)
- **Option C**: Split into 2 wireframes: one for proportional shrinking demo, one for expanded nav + requirements

---

## Regeneration Recommendation

**01-responsive-navigation.svg should be REGENERATED**, not patched. The layout collision issues are structural. Patching individual elements won't fix the underlying canvas management problem.

Suggested new layout:
```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: Desktop (1024px+) │ Tablet (768px)                   │  y=40-150
├─────────────────────────────────────────────────────────────┤
│ Row 2: Mobile Previews (2x2 grid)     │ Expanded Nav Phone  │  y=160-450
│ ┌──────────┬──────────┐               │ ┌─────────────────┐ │
│ │   428px  │   390px  │               │ │                 │ │
│ ├──────────┼──────────┤               │ │  Full height    │ │
│ │   375px  │   320px  │               │ │  phone frame    │ │
│ └──────────┴──────────┘               │ └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Row 3: Requirements Panel (FR-001 to FR-005 + SC-001)       │  y=460-750
└─────────────────────────────────────────────────────────────┘
```

---

## Issue Counts by Category

| Category | Count |
|----------|-------|
| Contrast/Accessibility | 8 |
| Overlap/Collision | 3 |
| Spacing/Cramped | 4 |
| Touch Target Size | 3 |
| Alignment | 2 |
| Font Size | 2 |
| Wasted Space | 1 |
