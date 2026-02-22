# ScriptHammer Design System Redesign

**Date:** 2026-02-13
**Status:** Complete (Phases 0-6 done)
**Approach:** Design System Build-Out (Phase 0-2), then Theme-First component iteration (Phases 3-6)

## Design Direction

**Aesthetic:** Bold, industrial, developer-focused. VS Code dark meets metallic craftsmanship. The mallet/hammer theme evokes building, power tools, craftsmanship. Reference: VS Code + metallic accents.

**Theme:** Custom DaisyUI theme, dark default with light variant. Built around existing brand assets (silver logo, mallet icon, wireframe panel color).

**Brand identity:**

- "ScriptHammer" evokes craftsmanship, power tools, building software
- Logo: silver mallet icon
- Existing wireframe panel color: `#e8d4b8` (warm amber / hammered metal tone)
- As a template, the design must be bold but also easy for forks to rebrand

## Color Palette

### Dark Variant (Default)

| Role               | Color                               | Source                       |
| ------------------ | ----------------------------------- | ---------------------------- |
| Base               | Near-black / charcoal (#1a1a2e)     | Developer-tool convention    |
| Primary            | Silver / steel (#a8b2c1)            | Logo, metallic identity      |
| Secondary          | Warm amber (#e8d4b8)                | Wireframe panels             |
| Accent             | Electric blue or green              | Developer energy             |
| Neutral            | Cool grays                          | Standard dark theme neutrals |
| Info/Warning/Error | Standard semantics tuned to palette | --                           |

### Light Variant

| Role      | Color                                | Notes                                |
| --------- | ------------------------------------ | ------------------------------------ |
| Base      | Warm off-white / parchment           | Not clinical white, fits personality |
| Primary   | Silver/steel (adjusted for light bg) | Same hue family                      |
| Secondary | Warm amber (adjusted)                | Same hue family                      |
| Accent    | Electric blue/green (adjusted)       | Same hue family                      |

All colors must pass WCAG AA contrast against their respective backgrounds.

## Phases

### Phase 0: Hierarchy Cleanup

Apply validated component moves from SpokeToWork's design-system-redesign branch. The atomic/ directory was used as a catch-all rather than true single-purpose UI primitives.

**Known moves (validated in SpokeToWork):**

- `GoogleAnalytics` to `src/lib/analytics/` (not a UI component, just a `<Script>` tag)
- `DiceTray` to `organisms/` (full game interface with drag-drop, stats, multiple sub-components)
- 6 components to `molecular/`: AvatarUpload, FontSwitcher, ColorblindToggle, TagCloud, CodeBlock, MessageInput (all compose multiple primitives)

**ScriptHammer-specific:** ScriptHammer has 33 atomic directories (vs SpokeToWork's 29). Audit the extras for misplacement before moving.

**Gotchas from SpokeToWork:**

- Relative imports break on move (TagCloud had `../TagBadge`, DiceTray had `../DraggableDice/DraggableDice`). Convert to `@/` absolute imports.
- Story titles need updating for moved components.
- Blast radius is small: only 5-6 production files needed import updates. Type-check + build caught everything.

### Phase 1: Upgrade Storybook to v10

Upgrade from 9.1.5 to 10.x to restore the full addon ecosystem.

- Run `npx storybook@latest upgrade`
- Ensure ESM-only config compatibility (.storybook/main.ts)
- Verify Node 20.19+ requirement
- Re-add addon-essentials (Controls, Actions, Viewport, Backgrounds)
- Remove workarounds documented in STORYBOOK_NOTES.md
- Upgrade @storybook/test from 9.0.0-alpha.2 to stable
- Verify existing stories render
- Document any migration gotchas for SpokeToWork backport

### Phase 2: Custom DaisyUI Theme

Build ScriptHammer brand theme with dark and light variants.

- Define theme in globals.css using `[data-theme]` CSS custom properties
- Dark variant as default (charcoal base, silver primary, warm amber secondary, electric accent)
- Light variant (warm off-white base, same brand colors adjusted for contrast)
- Test against WCAG AA for existing accessibility standards
- Storybook theme switcher picks up custom themes automatically
- Update map control dark theme selectors

### Phase 3: Theme Template System for Forks

Make it easy for forks to create their own custom theme.

- Document theme creation process (CUSTOM-THEME.md)
- Add theme scaffolding to rebrand script
- Example theme file showing required color tokens and WCAG contrast requirements

### Phase 4: Redesign Atomic Components

Rebuild foundational components against the new theme.

Priority order:

1. Button - variants, sizes, hover/active states
2. Card - border radius, shadow, spacing
3. Input/Form fields - text inputs, selects, textareas
4. Badge/Tag - filters, status indicators
5. AnimatedLogo / SpinningLogo (ScriptHammer's mallet)

ScriptHammer-specific:

- Dice / DiceTray (gaming elements, unique to ScriptHammer)
- CaptainShipCrew (game component)
- SetupBanner (first-time user experience)

For each component:

- Audit in Storybook against both custom themes
- Verify WCAG AA contrast and 44px touch targets
- Update story with all variants
- Commit

Preserve: atomic design hierarchy (subatomic, atomic, molecular, organism layers unchanged).

### Phase 5: Rebuild Molecular & Organism Components

Compose redesigned atoms into polished higher-level components.

- GlobalNav, Footer
- ChatWindow, blog components
- Auth forms
- Game components (CaptainShipCrew, DiceTray)

Each reviewed in Storybook against both theme variants before touching pages.

### Phase 6: Page-by-Page Polish

With design system solid, iterate through pages for layout, spacing, composition.

Order:

1. Landing page / hero (mallet logo, developer-tool first impression)
2. Themes showcase page (already exists at /themes)
3. Blog
4. Messages / chat
5. Auth pages
6. Status dashboard
7. Schedule / calendar

## Constraints

- Preserve all existing accessibility work (WCAG touch targets, ARIA patterns, colorblind filters, skip links)
- No restructuring of the atomic design hierarchy
- Mobile-first responsive approach stays
- Steady improvement pace, no hard deadline
- Design must be bold but also easy to rebrand (template requirement)

## Current State Reference

- Framework: Next.js 15.5, React 19, TypeScript
- Styling: Tailwind v4 + DaisyUI (beta), 32 stock themes available
- Components: ~88 directories, stories in Storybook
- Storybook: 9.1.5, missing addon-essentials due to v8/v9 incompatibility
- Strong a11y foundation: WCAG touch targets, ARIA patterns, colorblind filters, skip links
- Rebrand script exists for forks (`scripts/rebrand.sh`)
