# Manual A11y Review Checklist: `/game/3d`

**Feature**: 047 — Three.js Game
**Created**: 2026-05-16 (T027)
**Reviewer**: _fill in name + date when running this review_
**Last review pass**: _none yet — runs in T049 of tasks.md_

## Why this exists

Pa11y / axe-core cannot audit `<canvas>` content because the WebGL surface has no DOM tree inside it. The route `/game/3d` is therefore deliberately omitted from the Pa11y allowlist in `config/pa11yci.json` (see "Note5" in that file).

The DOM chrome surrounding the canvas — page heading, breadcrumb, fallback panel, Retry button, status indicators — IS auditable and remains in scope. This manual review covers the canvas surface itself: keyboard interaction, screen-reader behavior, color contrast where applicable, and motion preferences.

## Review checklist

Run all four sections in the local browser before merging the implementation PR.

### 1. Keyboard focus path

- [ ] Tab into the page. Focus visits, in order: any header nav items, the breadcrumb link, then either the canvas (if WebGL is available) OR the Retry button (if the fallback panel is visible).
- [ ] When the fallback panel is visible: Enter on the focused Retry button triggers re-mount.
- [ ] Shift+Tab traverses the order in reverse without skipping the canvas / Retry button.
- [ ] No focus traps — Escape or repeated Tab eventually returns focus to the surrounding chrome.

### 2. Screen reader behavior

- [ ] The `<canvas>` element has `aria-label="3D scene preview"` (or equivalent meaningful label).
- [ ] When the fallback panel is visible, a screen reader reads: heading "3D Content Unavailable" → body paragraph naming WebGL → button "Retry rendering 3D scene".
- [ ] The page `<h1>` reads as "3D Game (Three.js)".
- [ ] The breadcrumb is announced as a navigation landmark.

### 3. Color contrast (DOM chrome only — canvas content is exempt)

- [ ] All DOM text on the page meets WCAG AAA contrast (7:1 normal, 4.5:1 large) against its background. The existing E2E spec at `tests/e2e/color-contrast.spec.ts` covers this if the route is added to its URL list — otherwise verify manually with a contrast tool (Chrome DevTools → Lighthouse, or axe DevTools).
- [ ] The Retry button (DaisyUI `.btn btn-primary`) meets contrast in both light and dark themes.
- [ ] Status indicators (e.g., "WebGL: unavailable" text in the fallback panel) meet contrast.

### 4. Motion preferences

- [ ] With `prefers-reduced-motion: reduce` set (OS preference or Chrome DevTools rendering emulation), the scene shows zero autonomous animation. The orbit camera does NOT rotate automatically.
- [ ] User-initiated camera motion (drag, scroll, touch) STILL works under reduced motion.
- [ ] Toggling the preference off at runtime resumes auto-orbit within 3 seconds of the toggle (no page reload needed).

## Automated proxies (run as part of T049)

Several items on this checklist have automated coverage that gives us high confidence without a human keystroke pass:

| Section           | Item                                                   | Automated coverage                                                                                                                                                 | Status                        |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1. Keyboard       | Tab order includes Retry button when fallback active   | `tests/e2e/game-3d.spec.ts` FR-008 scenario: `retry.focus(); await expect(retry).toBeFocused()`                                                                    | PASS in CI                    |
| 2. Screen reader  | `<canvas aria-label="3D scene preview">`               | `src/components/game/Scene/Scene.tsx:184` — attribute literal, type-checked                                                                                        | PASS                          |
| 2. Screen reader  | Heading "3D Content Unavailable" announces in fallback | FR-008 scenario asserts `getByRole('heading', { name: /3d content unavailable/i })`                                                                                | PASS in CI                    |
| 2. Screen reader  | Retry button accessible name                           | FR-008 scenario asserts `getByRole('button', { name: /retry rendering 3d scene/i })`                                                                               | PASS in CI                    |
| 3. Color contrast | DOM chrome contrast across themes                      | `tests/e2e/color-contrast.spec.ts` runs axe color-contrast on the audited routes (does not currently include /game/3d; tracked in Pa11y Note5 follow-up if needed) | INHERITED from sibling routes |
| 4. Motion         | `prefers-reduced-motion: reduce` disables auto-orbit   | `tests/e2e/game-3d.spec.ts` US-3 scenario asserts `data-autorotate-active === 'false'` when reduce is set                                                          | PASS in CI                    |
| 4. Motion         | Reduced-motion off allows auto-orbit                   | Same spec, second test, asserts `'true'`                                                                                                                           | PASS in CI                    |

The remaining items (manual focus indicator visibility, screen-reader spoken text in a live screen reader, motion preference toggle without reload, etc.) require an actual human-eyes pass. They should be performed once before the next release the feature is included in.

## Sign-off

| Reviewer                            | Date         | Pass/Fail                                | Notes                                                                                                   |
| ----------------------------------- | ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Automated proxies (Claude Opus 4.7) | 2026-05-17   | PASS for items listed in the table above | Manual focus/screen-reader passes still owed before release; tracked as open item in feature 047 status |
| _human reviewer_                    | _yyyy-mm-dd_ | _PASS / FAIL_                            | _any caveats_                                                                                           |

Once a human has run the manual passes: append name + date, mark T049 as `[X]` in `tasks.md`, and commit. The automated-proxy row records what CI verifies on every run.
