# Phase 1 Quickstart: Three.js Game

**Feature**: 047 — Three.js Game
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Date**: 2026-05-16

Smoke-test recipes for human + LLM verification at each implementation milestone. Each recipe is independently runnable and self-contained.

All commands assume the dev container is running:

```bash
docker compose up -d
docker compose exec scripthammer pnpm run dev   # in another terminal if not already
```

---

## 1. Dependency install + bundle-split verification

```bash
# Install
docker compose exec scripthammer pnpm add three @react-three/fiber @react-three/drei
docker compose exec scripthammer pnpm add -D @types/three

# Verify route-split: production build emits chunks under /_next/static/chunks/
# /game/3d's chunk includes Three.js; other-route chunks do not.
docker compose exec scripthammer pnpm run build
```

**Expected** (compare against `git show HEAD~1:.next/...` if you saved the pre-add baseline, or just compare other-route bundle sizes before vs after the feature lands):

- `/game/3d` First Load JS grows by ~600 KB.
- Every other route's First Load JS is unchanged.
- Shared chunk size is unchanged.

If the shared chunk grew, search for an accidental `import { Canvas } from '@react-three/fiber'` outside `src/components/game/` or `src/app/game/3d/`. Fix by moving the import behind `dynamic()`.

---

## 2. Route + canvas-mount smoke

```bash
# In a browser (dev server URL varies by Docker port mapping; check `docker compose ps`).
# Example: http://localhost:PORT/ScriptHammer/game/3d

# Open browser devtools → Elements panel.
# Search for: <canvas>
# Expected: one <canvas> element inside the page's main content area.

# Check console: no errors mentioning Three.js, R3F, or WebGL.
```

**Expected**:

- A `<canvas>` element renders within ~2 seconds of navigation.
- The Suspense loader (Loader component) flashes briefly during dynamic import on first visit; subsequent visits within the session are instant (chunk cached).
- No SSR errors in the server logs (R3F is client-only via `dynamic(..., { ssr: false })`).

---

## 3. Theme-switch smoke

```bash
# In the browser at /game/3d, open the ThemeSwitcher (existing component).
# Switch through several themes: light → dark → dracula → cupcake → night → winter.
```

**Expected**:

- Scene background, lighting, and material colors update within one frame (~16ms) on each theme change. No page reload required.
- Switching to a dark theme produces visibly darker scene background + lighting.
- Switching to a light theme produces visibly lighter scene background + lighting.
- The DaisyUI tokens in CSS (`--p`, `--s`, `--b1`) are visibly reflected in the scene (e.g., the cog rim picks up `--p`, the brackets pick up `--a` accent).

**If theme changes don't propagate**: check the `MutationObserver` wiring in `Scene.tsx`. It should observe `document.documentElement` with `attributes: true, attributeFilter: ['data-theme']`.

---

## 4. Reduced-motion smoke

```bash
# In Chrome DevTools: Cmd-Shift-P → "Show Rendering" → "Emulate CSS media feature prefers-reduced-motion" → "reduce"
# Or at OS level: macOS System Preferences → Accessibility → Display → Reduce motion.

# Then reload /game/3d.
```

**Expected**:

- Auto-orbit does NOT happen. The scene is static until the user explicitly drags the camera.
- No idle bobbing, no autonomous rotation of accent objects (if any), no transitions.
- User-initiated camera input (drag, scroll, touch) STILL works — only autonomous motion is disabled.

```bash
# Toggle the emulation OFF (or set OS preference back to "no preference") and observe the scene WITHOUT reloading.
```

**Expected**:

- Auto-orbit resumes within 3 seconds.
- This validates SC-010 and the runtime-toggle behavior described in spec edge cases.

---

## 5. WebGL-disabled (fallback panel) smoke

```bash
# Start chromium with WebGL disabled:
chromium --disable-webgl http://localhost:PORT/ScriptHammer/game/3d

# Or via Chrome DevTools: about:gpu → disable WebGL via the GPU process flags.
# Or via Firefox: about:config → webgl.disabled = true.
```

**Expected**:

- No canvas element renders.
- A fallback panel renders instead, containing:
  - Themed CSS/SVG silhouette of the brand composition (cog + brackets + mallet, recolored via DaisyUI tokens)
  - Headline "3D Content Unavailable"
  - Body copy naming WebGL as the requirement
  - A 44×44 keyboard-focusable "Retry" button
- Clicking "Retry" re-runs the WebGL probe. With WebGL still disabled, the fallback re-renders. With WebGL re-enabled (close + relaunch browser without `--disable-webgl`), Retry mounts the canvas successfully.
- Console: no errors. The probe is silent on failure.

```bash
# Test the webglcontextlost path (runtime context loss simulation):
# In DevTools Console with /game/3d open:
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
gl.getExtension('WEBGL_lose_context').loseContext();
```

**Expected**:

- Within one frame, the canvas disappears and the fallback panel replaces it.
- No silent auto-retry. User clicks Retry to attempt recovery.

---

## 6. Pa11y CI (exclusion verification + `/game` regression coverage)

```bash
# Run the full Pa11y suite locally:
docker compose exec scripthammer pnpm test:a11y
```

**Expected**:

- The output lists every audited route. `/game/3d` is SKIPPED with the configured exclusion reason.
- `/game` (the existing dice game) IS audited. It passes (no regression from feature 037-game-a11y-tests).
- No new failures on any other route.

**Manual a11y review template** (for canvas content not auditable by Pa11y; documented in `tasks.md`):

- Keyboard: Tab to Retry button → Enter triggers retry. Tab moves to next focusable element after.
- Screen reader: `aria-label="3D scene preview"` on the `<canvas>`. Fallback panel reads: heading "3D Content Unavailable" → paragraph → button "Retry".
- Color contrast: WCAG AAA on all DOM chrome (page heading, fallback panel text). Canvas content not subject (no text content rendered inside the canvas in v1).
- Motion: prefers-reduced-motion respected (covered by recipe 4).
- Documented in `tasks.md` under US-4 with a checkbox for each item.

---

## 7. Production static-export verification

```bash
docker compose exec scripthammer pnpm run build
# Check that the static export includes the route:
docker compose exec scripthammer ls out/game/3d/
```

**Expected**:

- `out/game/3d/index.html` exists.
- The HTML contains a `<script src="/_next/static/chunks/..." defer>` that loads the Three.js chunk.
- Opening `out/game/3d/index.html` directly via `file://` (no server) loads correctly modulo the `basePath` (which is set to `/ScriptHammer` in prod). For full local verification:

```bash
docker compose exec scripthammer pnpm run start   # serves out/ at http://localhost:3000
```

**Expected**:

- The route renders identically to the dev server.
- No console errors, no missing assets.
- `next build` exit code is 0; no SSR errors.

---

## 8. Cross-browser E2E (Playwright)

```bash
# Run the new spec across all three browsers:
docker compose exec scripthammer pnpm exec playwright test tests/e2e/game-3d.spec.ts
```

**Expected**:

- All assertions pass on chromium, firefox, and webkit.
- Test list includes:
  - Route loads + canvas mounts (covers SC-001, SC-005)
  - Theme switch propagates to scene colors (covers SC-002)
  - WebGL-disabled launches fallback panel (covers SC-009)
  - Retry button is keyboard-focusable (covers SC-009 a11y assertion)
  - Auto-orbit observable when reduced-motion is OFF; absent when reduced-motion is ON (covers SC-010)
  - Mobile viewport (375×667) renders without horizontal overflow (covers US-5)

---

## Test failure debugging

- **Three.js console warnings about color spaces**: Three.js r152+ enforces color-space tagging. Apply `THREE.SRGBColorSpace` to material colors. If the warning persists, the warning text usually names the offending material.
- **Theme switch not propagating**: open DevTools → Performance tab → record a theme switch → look for the MutationObserver callback. If absent, the observer is misconfigured.
- **Fallback panel renders even with WebGL on**: the probe is too aggressive (returns null when context IS available). Check the probe function in `FallbackPanel.tsx` for a subtle null check.
- **Bundle size regression on other routes**: a top-level import of `three` or `@react-three/fiber` snuck in somewhere outside the dynamic import boundary. Search with `grep -rn "from 'three'\|from '@react-three" src/ | grep -v src/components/game/ | grep -v src/app/game/3d/` — the result should be empty.
