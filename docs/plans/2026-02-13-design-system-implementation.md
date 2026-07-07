# Design System Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the component hierarchy, upgrade Storybook to v10, build a custom ScriptHammer DaisyUI theme (dark default + light variant), add theme template tooling for forks, then redesign components with the new brand identity.

**Architecture:** Custom DaisyUI theme defined in `globals.css` via `@plugin "daisyui"` block (Tailwind v4 CSS-first config). Storybook upgraded to v10 for full addon support. Components reskinned bottom-up: atoms first, then molecules/organisms, then pages.

**Tech Stack:** Next.js 15.5, React 19, Tailwind v4, DaisyUI beta, Storybook 10, pnpm, Docker Compose

**Important:** ScriptHammer runs inside Docker. All pnpm/storybook commands run via `docker compose exec scripthammer <command>` unless noted otherwise.

---

## Phase 0: Hierarchy Cleanup ✅ COMPLETE

### Task 1: Audit atomic/ directory for misplacements

**Files:**

- Read: `src/components/atomic/` (all 33 directories)

**Step 1: List all atomic component directories**

Run: `docker compose exec scripthammer ls src/components/atomic/`
Expected: ~33 directories. Compare against SpokeToWork's validated list.

**Step 2: Identify misplaced components**

Known moves (validated in SpokeToWork):

- `GoogleAnalytics` → `src/lib/analytics/` (not a UI component)
- `DiceTray` → `organisms/` (full game interface)
- `AvatarUpload` → `molecular/` (composes file input + preview + crop)
- `FontSwitcher` → `molecular/` (composes select + label + preview)
- `ColorblindToggle` → `molecular/` (composes toggle + label + mode selector)
- `TagCloud` → `molecular/` (composes TagBadge instances + layout)
- `CodeBlock` → `molecular/` (composes syntax highlighting + copy button + language selector)
- `MessageInput` → `molecular/` (composes textarea + send button + attachment)

**Step 3: Audit ScriptHammer-specific extras**

ScriptHammer has 33 atomic dirs vs SpokeToWork's 29. Check the 4+ extras for misplacement. Components that compose multiple primitives belong in molecular/. Full interactive interfaces belong in organisms/.

---

### Task 2: Move GoogleAnalytics to lib/analytics

**Files:**

- Move: `src/components/atomic/GoogleAnalytics/` → `src/lib/analytics/GoogleAnalytics/`
- Modify: `src/app/layout.tsx` (update import path)

**Step 1: Move the directory**

Run: `docker compose exec scripthammer mkdir -p src/lib/analytics && mv src/components/atomic/GoogleAnalytics src/lib/analytics/`

**Step 2: Update import in layout.tsx**

Change the import from `@/components/atomic/GoogleAnalytics` to `@/lib/analytics/GoogleAnalytics`.

**Step 3: Verify build**

Run: `docker compose exec scripthammer pnpm run type-check`
Expected: No errors

---

### Task 3: Move DiceTray to organisms

**Files:**

- Move: `src/components/atomic/DiceTray/` → `src/components/organisms/DiceTray/`
- Modify: Any files importing DiceTray

**Step 1: Move the directory**

Run: `docker compose exec scripthammer mv src/components/atomic/DiceTray src/components/organisms/`

**Step 2: Fix relative imports inside DiceTray**

DiceTray has a relative import `../DraggableDice/DraggableDice` that will break. Convert to `@/components/atomic/DraggableDice/DraggableDice`.

**Step 3: Update story title**

Change story title from `Atomic Design/Atomic/DiceTray` to `Atomic Design/Organisms/DiceTray`.

**Step 4: Update any production file imports**

Search for imports of DiceTray and update paths.

**Step 5: Verify build**

Run: `docker compose exec scripthammer pnpm run type-check`

---

### Task 4: Move 6 components from atomic to molecular

**Files:**

- Move: `atomic/AvatarUpload/` → `molecular/AvatarUpload/`
- Move: `atomic/FontSwitcher/` → `molecular/FontSwitcher/`
- Move: `atomic/ColorblindToggle/` → `molecular/ColorblindToggle/`
- Move: `atomic/TagCloud/` → `molecular/TagCloud/`
- Move: `atomic/CodeBlock/` → `molecular/CodeBlock/`
- Move: `atomic/MessageInput/` → `molecular/MessageInput/`
- Modify: Production files that import these components

**Step 1: Move all 6 directories**

```bash
docker compose exec scripthammer bash -c "
  mv src/components/atomic/AvatarUpload src/components/molecular/
  mv src/components/atomic/FontSwitcher src/components/molecular/
  mv src/components/atomic/ColorblindToggle src/components/molecular/
  mv src/components/atomic/TagCloud src/components/molecular/
  mv src/components/atomic/CodeBlock src/components/molecular/
  mv src/components/atomic/MessageInput src/components/molecular/
"
```

**Step 2: Fix relative imports**

TagCloud has `../TagBadge` which will break. Convert to `@/components/atomic/TagBadge/TagBadge`.

Check all 6 for relative imports pointing back to atomic/.

**Step 3: Update story titles**

For each moved component, update the story title from `Atomic Design/Atomic/X` to `Atomic Design/Molecular/X`.

**Step 4: Update production file imports**

Expected files to update:

- `src/components/GlobalNav.tsx` (FontSwitcher, ColorblindToggle)
- `src/app/accessibility/page.tsx` (FontSwitcher, ColorblindToggle)
- `src/components/auth/AccountSettings/AccountSettings.tsx` (AvatarUpload)
- `src/app/blog/tags/page.tsx` (TagCloud)
- `src/components/organisms/ChatWindow/ChatWindow.tsx` (MessageInput)

**Step 5: Verify build**

Run: `docker compose exec scripthammer pnpm run type-check && pnpm run build`
Expected: Clean build with no errors

**Step 6: Commit**

```bash
cd ~/repos/ScriptHammer
git add -A
git commit -m "refactor: move misplaced components to correct hierarchy levels

Move GoogleAnalytics to lib/analytics (not a UI component).
Move DiceTray to organisms (full game interface).
Move 6 components to molecular (compose multiple primitives):
AvatarUpload, FontSwitcher, ColorblindToggle, TagCloud, CodeBlock, MessageInput.
Convert relative imports to @/ absolute paths."
```

---

## Phase 1: Upgrade Storybook to v10 ✅ COMPLETE

### Task 5: Check current Storybook state

**Files:**

- Read: `package.json`
- Read: `.storybook/main.ts`
- Read: `docs/STORYBOOK_NOTES.md`

**Step 1: Verify Node version inside Docker**

Run: `docker compose exec scripthammer node --version`
Expected: v22.x (meets Storybook 10 requirement of 20.19+)

**Step 2: Verify current Storybook version**

Run: `docker compose exec scripthammer npx storybook --version`
Expected: 9.1.x

**Step 3: Check which stories currently render**

Run: `docker compose exec scripthammer npx storybook build --test 2>&1 | tail -30`
Expected: Build output showing which stories compile. Note any failures.

---

### Task 6: Upgrade Storybook to v10

**Files:**

- Modify: `package.json` (dependencies updated by upgrade command)
- Modify: `.storybook/main.ts` (automigrations may update config)
- Modify: `.storybook/preview.tsx` (automigrations may update config)

**Step 1: Run the Storybook upgrade**

Run: `docker compose exec scripthammer npx storybook@latest upgrade`
Expected: Interactive prompts for automigrations. Accept all recommended changes.

**Step 2: Verify the upgrade**

Run: `docker compose exec scripthammer npx storybook --version`
Expected: 10.x

**Step 3: Install any new dependencies**

Run: `docker compose exec scripthammer pnpm install`
Expected: Clean install with no peer dependency errors

**Step 4: Commit the upgrade**

```bash
cd ~/repos/ScriptHammer
git add package.json pnpm-lock.yaml .storybook/
git commit -m "chore: upgrade Storybook from 9.1.5 to 10.x"
```

---

### Task 7: Re-add addon-essentials

**Files:**

- Modify: `.storybook/main.ts` (add addon-essentials to addons array)
- Modify: `package.json` (if not already added by upgrade)

**Step 1: Check if addon-essentials was added by the upgrade**

Run: `docker compose exec scripthammer grep -r "addon-essentials" .storybook/main.ts`
Expected: Either found (upgrade added it) or not found (need to add manually)

**Step 2: If not present, add addon-essentials**

In `.storybook/main.ts`, replace the addons array:

```typescript
addons: [
  '@storybook/addon-essentials',
  '@storybook/addon-a11y',
  '@storybook/addon-themes',
  '@storybook/addon-links',
],
```

Remove `@storybook/addon-onboarding`, `@storybook/addon-docs`, and `@chromatic-com/storybook` since essentials includes docs and the others are optional.

**Step 3: Install addon-essentials if needed**

Run: `docker compose exec scripthammer pnpm add -D @storybook/addon-essentials`

**Step 4: Verify Storybook starts**

Run: `docker compose exec scripthammer npx storybook build --test 2>&1 | tail -30`
Expected: Clean build with no addon errors

**Step 5: Commit**

```bash
cd ~/repos/ScriptHammer
git add .storybook/ package.json pnpm-lock.yaml
git commit -m "chore: re-add addon-essentials (Controls, Actions, Viewport)"
```

---

### Task 8: Fix @storybook/test

**Files:**

- Modify: `package.json` (update @storybook/test version)

**Step 1: Check current version**

Run: `docker compose exec scripthammer pnpm list @storybook/test`
Expected: 9.0.0-alpha.2

**Step 2: Upgrade to stable**

Run: `docker compose exec scripthammer pnpm add -D @storybook/test@latest`

**Step 3: Verify stories that use `fn()` still compile**

Run: `docker compose exec scripthammer npx storybook build --test 2>&1 | tail -30`
Expected: Clean build

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade @storybook/test from alpha to stable"
```

---

### Task 9: Verify all stories render and update docs

**Files:**

- Modify: `docs/STORYBOOK_NOTES.md`
- Various: `src/**/*.stories.tsx` (fix any broken stories)

**Step 1: Run a full Storybook build**

Run: `docker compose exec scripthammer npx storybook build --test 2>&1`
Expected: All stories compile. Note any failures.

**Step 2: Fix any broken stories**

Address compilation errors one by one. Common issues after major upgrades:

- Import path changes
- Removed/renamed APIs
- Type mismatches with new Meta/StoryObj generics

**Step 3: Update STORYBOOK_NOTES.md**

Replace the "Temporarily Removed Packages" section with current status. Remove workarounds that are no longer needed. Update the version references.

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/ docs/STORYBOOK_NOTES.md
git commit -m "fix: resolve story compilation errors after Storybook v10 upgrade

Update STORYBOOK_NOTES.md to reflect v10 state."
```

---

## Phase 2: ScriptHammer Brand Theme ✅ COMPLETE

### Task 10: Research DaisyUI custom theme syntax for Tailwind v4

**Files:**

- Read: `src/app/globals.css` (current `@plugin "daisyui"` block)
- Read: DaisyUI docs for custom theme CSS syntax

**Step 1: Check DaisyUI version**

Run: `docker compose exec scripthammer pnpm list daisyui`
Expected: beta version

**Step 2: Research custom theme syntax**

Check the DaisyUI v5 docs for how to define custom themes with the `@plugin` CSS-first syntax. Custom themes use CSS custom properties under `[data-theme="theme-name"]` selectors.

**Step 3: Document findings**

Note the exact syntax needed for Task 11.

---

### Task 11: Define scripthammer-dark theme

**Files:**

- Modify: `src/app/globals.css`

**Step 1: Add custom theme CSS**

After the `@plugin "daisyui"` block, add the custom dark theme:

```css
[data-theme='scripthammer-dark'] {
  --color-base-100: #1a1a2e; /* Near-black charcoal - primary surface */
  --color-base-200: #16162a; /* Darker charcoal - secondary surface */
  --color-base-300: #25254a; /* Lighter charcoal - borders/dividers */
  --color-base-content: #e2e8f0; /* Cool light gray text */

  --color-primary: #a8b2c1; /* Silver/steel - metallic identity */
  --color-primary-content: #1a1a2e;

  --color-secondary: #e8d4b8; /* Warm amber - hammered metal */
  --color-secondary-content: #1a1a2e;

  --color-accent: #38bdf8; /* Electric blue - developer energy */
  --color-accent-content: #1a1a2e;

  --color-neutral: #2d2d4a; /* Dark purple-gray */
  --color-neutral-content: #d1d5db;

  --color-info: #3b82f6;
  --color-success: #22c55e;
  --color-warning: #fde047;
  --color-error: #ef4444;
}
```

Note: Exact DaisyUI v5 CSS custom property names may differ. Verify against docs in Task 10.

**Step 2: Update the `@plugin` block to include custom theme**

```css
@plugin "daisyui" {
  themes: scripthammer-dark, scripthammer-light, light, dark;
}
```

**Step 3: Verify the theme renders**

Run: `docker compose exec scripthammer pnpm run build`
Expected: Clean build with no CSS errors

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/app/globals.css
git commit -m "feat: add scripthammer-dark custom DaisyUI theme"
```

---

### Task 12: Define scripthammer-light theme

**Files:**

- Modify: `src/app/globals.css`

**Step 1: Add light variant**

```css
[data-theme='scripthammer-light'] {
  --color-base-100: #f5f0eb; /* Warm parchment - primary surface */
  --color-base-200: #ebe5dd; /* Slightly darker parchment */
  --color-base-300: #ddd5cb; /* Borders */
  --color-base-content: #1f2937; /* Dark text */

  --color-primary: #64748b; /* Darker silver for contrast on light bg */
  --color-primary-content: #ffffff;

  --color-secondary: #92400e; /* Dark amber for light bg contrast */
  --color-secondary-content: #ffffff;

  --color-accent: #0284c7; /* Darker blue for light bg */
  --color-accent-content: #ffffff;

  --color-neutral: #374151;
  --color-neutral-content: #f9fafb;

  --color-info: #2563eb;
  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-error: #dc2626;
}
```

**Step 2: Verify WCAG AA contrast**

Check that primary, secondary, and accent colors meet 4.5:1 contrast ratio against their respective base colors. Adjust if needed.

**Step 3: Verify build**

Run: `docker compose exec scripthammer pnpm run build`
Expected: Clean build

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/app/globals.css
git commit -m "feat: add scripthammer-light custom DaisyUI theme"
```

---

### Task 13: Set dark theme as default

**Files:**

- Modify: `src/components/ThemeScript.tsx` (change default from 'light' to 'scripthammer-dark')
- Modify: `.storybook/preview.tsx` (add custom themes to switcher, set default)

**Step 1: Update ThemeScript default**

In `src/components/ThemeScript.tsx`, change the fallback theme from `'light'` to `'scripthammer-dark'`.

**Step 2: Update Storybook theme switcher**

In `.storybook/preview.tsx`, add custom themes to the `withThemeByDataAttribute` config:

```typescript
themes: {
  'scripthammer-dark': 'scripthammer-dark',
  'scripthammer-light': 'scripthammer-light',
  light: 'light',
  dark: 'dark',
  // ... keep other themes
},
defaultTheme: 'scripthammer-dark',
```

**Step 3: Verify Storybook renders with new default**

Run: `docker compose exec scripthammer npx storybook build --test 2>&1 | tail -10`
Expected: Clean build

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/components/ThemeScript.tsx .storybook/preview.tsx
git commit -m "feat: set scripthammer-dark as default theme"
```

---

### Task 14: Update MapLibre dark theme selectors

**Files:**

- Modify: `src/app/globals.css` (update dark theme CSS selectors for map controls)

**Step 1: Add scripthammer-dark to map control selectors**

The existing CSS has selectors like `[data-theme='dark'] .maplibregl-ctrl-group`. Add `[data-theme='scripthammer-dark']` to each group of dark theme selectors for both MapLibre and Leaflet controls.

**Step 2: Verify build**

Run: `docker compose exec scripthammer pnpm run build`

**Step 3: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/app/globals.css
git commit -m "fix: add scripthammer-dark to map control dark theme selectors"
```

---

## Phase 3: Theme Template System for Forks ✅ COMPLETE

### Task 15: Create CUSTOM-THEME.md documentation

**Files:**

- Create: `docs/CUSTOM-THEME.md`

**Step 1: Write the theme creation guide**

Document how to define a custom DaisyUI theme with the `@plugin` CSS-first syntax:

- Required CSS custom properties (all color tokens)
- How to add the theme to the `@plugin "daisyui"` block
- WCAG AA contrast requirements
- Example theme block with placeholder colors
- How to update ThemeScript.tsx and Storybook preview

**Step 2: Commit**

```bash
cd ~/repos/ScriptHammer
git add docs/CUSTOM-THEME.md
git commit -m "docs: add custom theme creation guide for forks"
```

---

### Task 16: Add theme scaffolding to rebrand script

**Files:**

- Modify: `scripts/rebrand.sh` (add theme generation step)
- Modify: `docs/FORKING.md` (reference theme creation)

**Step 1: Add theme generation to rebrand.sh**

After the existing rebrand steps, add a step that generates a `[data-theme='projectname-dark']` and `[data-theme='projectname-light']` CSS block in globals.css with placeholder colors and TODO comments.

**Step 2: Update FORKING.md**

Add a section about customizing the theme after rebrand, referencing CUSTOM-THEME.md.

**Step 3: Test the rebrand script in dry-run mode**

Run: `./scripts/rebrand.sh TestProject testuser "Test description" --dry-run`
Expected: Shows theme scaffold would be generated

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add scripts/rebrand.sh docs/FORKING.md
git commit -m "feat: add theme scaffolding to rebrand script for forks"
```

---

## Phase 4: Redesign Atomic Components ✅ COMPLETE

### Task 17: Audit Button component in Storybook

**Files:**

- Read: `src/components/atomic/Button/Button.tsx`
- Read: `src/components/atomic/Button/Button.stories.tsx`

**Step 1: Start Storybook**

Run: `docker compose exec scripthammer npx storybook dev -p 6006 --no-open`

**Step 2: Review Button in both themes**

Open `http://localhost:6006` and switch between scripthammer-dark and scripthammer-light themes. Document what needs to change:

- Do variant colors look right with the new palette?
- Are hover/active/focus states visible and accessible?
- Does the loading spinner contrast work?
- Any personality touches to add (border radius, subtle transitions)?

**Step 3: Document findings for Task 18**

---

### Task 18: Update Button component

**Files:**

- Modify: `src/components/atomic/Button/Button.tsx`
- Modify: `src/components/atomic/Button/Button.stories.tsx`

**Step 1: Update the story to show all variants against both custom themes**

Add a "Theme Comparison" story that renders all button variants in a grid.

**Step 2: Apply design changes based on Task 17 audit findings**

**Step 3: Run accessibility check**

Verify WCAG AA contrast for all variant+theme combinations.

**Step 4: Commit**

```bash
cd ~/repos/ScriptHammer
git add src/components/atomic/Button/
git commit -m "style: update Button component for ScriptHammer theme"
```

---

### Task 19: Audit and update Card component

**Files:**

- Modify: `src/components/atomic/Card/Card.tsx`
- Modify: `src/components/atomic/Card/Card.stories.tsx`

Same audit-then-update pattern. Check shadow, border, background, and text contrast.

---

### Tasks 20-22: Repeat for Input, Badge, AnimatedLogo

Follow the same audit-then-update pattern for:

- **Task 20:** Input/form field components
- **Task 21:** Badge/Tag components
- **Task 22:** AnimatedLogo / SpinningLogo (ScriptHammer's mallet)

### Tasks 23-24: ScriptHammer-specific components

- **Task 23:** Dice / DiceTray (gaming elements)
- **Task 24:** CaptainShipCrew, SetupBanner

Each task: audit in Storybook, apply changes, verify a11y, commit.

---

## Phase 5: Molecular & Organism Components ✅ COMPLETE

Tasks 25+ follow the same pattern for higher-level components:

- GlobalNav, Footer
- ChatWindow, blog components
- Auth forms
- Game components (CaptainShipCrew, DiceTray)

Each audited in Storybook, updated, verified, committed.

---

## Phase 6: Page-by-Page Polish ✅ COMPLETE

Tasks 30+ iterate through pages:

1. Landing page / hero (mallet logo, developer-tool first impression)
2. Themes showcase page (/themes)
3. Blog
4. Messages / chat
5. Auth pages
6. Status dashboard
7. Schedule / calendar

Each page reviewed in browser, adjusted for layout/spacing/composition, committed.

---

## Notes

- Phases 4-6 are intentionally less detailed because each task depends on visual audit findings from the previous step. The pattern is consistent: audit, update, verify a11y, commit.
- This plan covers ~35 discrete tasks. Each is a single session of focused work.
- Phase 0 is validated by SpokeToWork's completed hierarchy cleanup. Apply the same moves with confidence.
- The Storybook upgrade (Phase 1) is a prerequisite for Phases 2+. Don't start Phase 2 until Storybook is verified working.
- DaisyUI custom theme CSS property names may need adjustment based on the exact beta version installed. Task 10 handles this research.
- Phase 3 (theme template system) is unique to ScriptHammer as a template project.
