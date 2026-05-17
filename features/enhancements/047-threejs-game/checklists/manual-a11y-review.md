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

## Sign-off

| Reviewer | Date         | Pass/Fail     | Notes         |
| -------- | ------------ | ------------- | ------------- |
| _name_   | _yyyy-mm-dd_ | _PASS / FAIL_ | _any caveats_ |

Once all 4 sections pass: mark T049 in `tasks.md` as `[X]`, append the reviewer name + date here, and commit.
