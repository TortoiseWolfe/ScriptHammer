# Storybook Setup Notes

## Current Status

Using Storybook 10.2.8 with Next.js 15.5 (via `@storybook/nextjs-vite`)

**Upgraded from 9.1.5 on 2026-02-15.** The v10 upgrade applied 4 automigrations:

- `upgrade-storybook-related-dependencies`
- `consolidated-imports` (all story imports → `@storybook/nextjs-vite`)
- `nextjs-to-nextjs-vite` (framework migration from Webpack to Vite)
- `renderer-to-framework`

### Addon Ecosystem (Fully Restored)

All addons are now at 10.2.8 and working:

- `@storybook/addon-docs` — Documentation generation, autodocs
- `@storybook/addon-links` — Component linking
- `@storybook/addon-themes` — Theme switcher (32 DaisyUI themes)
- `@storybook/addon-a11y` — Accessibility testing (WCAG 2.1 AA)
- `@storybook/addon-onboarding` — First-run experience
- `@chromatic-com/storybook` (5.0.1) — Visual testing
- `@storybook/test` (8.6.15) — Testing utilities with `fn()`

**Note:** `@storybook/addon-essentials` is not installed as a meta-package. The individual addons above provide equivalent coverage. Controls, Actions, Viewport, and Backgrounds are available through addon-docs and the Storybook 10 built-in toolbar.

### Migration Notes for SpokeToWork

When backporting this upgrade:

1. PostCSS config must use object-based format for Vite compatibility:
   ```js
   // postcss.config.mjs
   const config = {
     plugins: {
       '@tailwindcss/postcss': {},
     },
   };
   ```
2. All story imports change from `@storybook/nextjs` to `@storybook/nextjs-vite`
3. Preview type import: `import type { Preview } from '@storybook/nextjs-vite'`
4. `@storybook/react` package is removed (consolidated into framework)

## Story Organization (Updated February 2026)

Stories follow a consistent functional organization structure:

### Structure:

**Components/** — Design hierarchy categories

- `Components/Molecular/` — Multi-primitive compositions (TagCloud, CodeBlock, FontSwitcher, etc.)
- `Components/Organisms/` — Full interactive interfaces (DiceTray, CaptainShipCrew, etc.)

**Atomic Design/** — Single-purpose primitives

- `Atomic Design/Atomic/` — Basic UI components (Button, Card, TagBadge, etc.)

**Features/** — Functional purpose grouping

- `Features/Authentication/` — Auth components (SignInForm, SignUpForm, etc.)
- `Features/Privacy/` — GDPR compliance (CookieConsent, ConsentModal, etc.)
- `Features/Payment/` — Payment processing (PaymentButton, PaymentHistory, etc.)
- `Features/Map/` — Geolocation (MapContainer, LocationButton, etc.)
- `Features/Blog/` — Blog system (BlogPostCard, BlogContent, etc.)
- `Features/Forms/` — Form components (ContactForm)
- `Features/Calendar/` — Calendar integration (CalendarEmbed)

**Utils/** — Non-UI utilities

- `Utils/Analytics/` — Tracking (GoogleAnalytics)

**Layout/** — Layout components

### When Creating New Components:

After using the component generator, update the story `title` field to match the functional category rather than the generated atomic design category.
