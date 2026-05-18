# Phase 0 Research: Three.js Game

**Feature**: 047 — Three.js Game
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Date**: 2026-05-16

Six technical decisions resolved with rationale + alternatives. No `NEEDS CLARIFICATION` markers in the spec; all questions answered during `/speckit.clarify` 2026-05-15.

---

## Decision 1: WebGL framework — Three.js + React Three Fiber + drei

**Decision**: Use `three` for WebGL primitives, `@react-three/fiber` (R3F) as the React renderer, and `@react-three/drei` for helpers (OrbitControls, useFrame).

**Rationale**:

- **Three.js is the de-facto standard for WebGL in the browser**. Mature (10+ years), 100k+ GitHub stars, ubiquitous in tutorials and Stack Overflow answers. Cheap to find help; cheap to onboard new contributors.
- **R3F gives us React-flavored authoring** — `<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>` instead of imperative `new THREE.Mesh(...)`. Plays naturally with React 19 hooks (`useFrame`, `useThree`), context (theme tokens), and Suspense (loader fallback). Same mental model the rest of the codebase already uses.
- **drei provides the helpers we need without writing them**: `OrbitControls` with `enableDamping`, `minPolarAngle`/`maxPolarAngle`, `minDistance`/`maxDistance`, and `autoRotate` (see Decision 6) — exactly the camera constraints in FR-005. Saves writing 200+ lines of camera-controller code.
- **Bundle-size discipline is feasible**: Three.js + R3F + drei is ~600 KB gzipped, but it's code-split to `/game/3d` only via `dynamic(() => import(...), { ssr: false })`. Other routes are unaffected (NFR-001).

**Alternatives considered**:

| Alternative                  | Reason rejected                                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw Three.js (no R3F)        | Forces imperative authoring that doesn't compose with React state/context. Theme reactivity becomes a manual `useEffect` + `setColor()` dance. Doubles the test surface (manual lifecycle vs Suspense).                                               |
| Babylon.js                   | Larger bundle (~2 MB gzipped), heavier API. Better for game engines; overkill for a scene preview. Less common in the React ecosystem.                                                                                                                |
| PlayCanvas                   | Cloud-hosted authoring tool primarily, not a library-first solution. Off-template for a static-export PWA.                                                                                                                                            |
| WebGPU (via `@webgpu/types`) | Browser support still incomplete on Safari/iOS as of 2026-05. Three.js has experimental WebGPU support but the stable WebGL renderer is the safe choice for a template that aims for broad browser coverage. Revisit in v2 if WebGPU adoption climbs. |
| Plain CSS 3D transforms      | Insufficient for the procedural sculpt — no lighting, no proper depth ordering, no shaders. Acceptable for the fallback panel silhouette, not for the live scene.                                                                                     |

---

## Decision 2: WebGL availability detection — one-shot canvas probe at mount

**Decision**: Before mounting `<Canvas>`, probe `document.createElement('canvas').getContext('webgl')` (and fall back to `experimental-webgl`). If the returned context is null, render `<FallbackPanel>` directly without ever mounting R3F. Additionally, listen for the `webglcontextlost` event on the canvas once it IS mounted, and re-render `<FallbackPanel>` in response.

**Rationale**:

- **The probe is synchronous and cheap** (~1ms). Doing it before R3F mounts avoids the React tree mounting a broken renderer and emitting console errors.
- **`webglcontextlost` is the canonical event** for runtime context loss (memory pressure, tab backgrounded, GPU reset). The browser fires this event on the canvas element when the context becomes invalid. We listen via `canvas.addEventListener('webglcontextlost', handler, false)` and call `event.preventDefault()` to allow restoration if the user clicks Retry — though we don't auto-restore (FR-008 explicitly forbids silent auto-retry).
- **No third-party WebGL-detection libraries needed**. `webgl-detect` and `modernizr` are 10+ KB each for what is a one-line probe.

**Alternatives considered**:

| Alternative                                | Reason rejected                                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skip detection; let R3F crash gracefully   | R3F doesn't render a usable fallback — it shows a black canvas + console errors. Bad UX.                                                                                                      |
| Check via UA sniffing                      | Brittle and wrong (browsers without WebGL include broken Chromiums with WebGL flags disabled, niche enterprise builds, etc.). Direct probe is authoritative.                                  |
| Probe at module load (before React mounts) | Forces a layout calculation before hydration, which can flash a fallback panel briefly before React swaps to the live canvas. The mount-time probe runs after hydration and avoids the flash. |
| Auto-retry on `webglcontextlost`           | Spec explicitly forbids it (FR-008): "No silent auto-retry." User clicks Retry explicitly.                                                                                                    |

---

## Decision 3: DaisyUI OKLCH → Three.js Color conversion

**Decision** (REVISED 2026-05-16 during T005 implementation): Read DaisyUI tokens from CSS custom properties on `:root` (e.g., `getComputedStyle(document.documentElement).getPropertyValue('--p')` → the OKLCH triplet `"L C H"`), then convert OKLCH → OKLab → linear sRGB → sRGB **inline via small conversion math** (~50 LOC), and construct `new THREE.Color(r, g, b)`. The conversion lives in a new helper `getDaisyUIColorAsThree(token: string): THREE.Color` in `src/utils/theme-utils.ts`. Helper returns middle gray (`#808080`) on malformed/unset input — never throws.

**Why this differs from the original plan**: The original plan assumed Three.js's `THREE.Color` constructor would parse `oklch(...)` CSS color strings via its internal color parser. **It does not** — verified empirically on r184 (the actually-installed version): `new ThreeColor().setStyle('oklch(0.7 0.15 250)')` falls through silently and returns white. Three.js's color parser supports `rgb()`, `hsl()`, and hex notation but not the modern `oklch()`/`lab()`/`color()` syntaxes. Inline math is the portable fix.

**Rationale**:

- **Inline math is jsdom-safe**. Real browsers can resolve OKLCH via `getComputedStyle` on a probe DOM node, but jsdom doesn't, so unit tests need a path that works without a real CSS engine. Inline math works everywhere.
- **Reusing `src/utils/theme-utils.ts`** keeps theme-aware-component code consolidated. The existing `useMapTheme` hook in that file uses `getComputedStyle` + `MutationObserver` for Leaflet map theming — we extend the same pattern for Three.js without copying boilerplate.
- **`MutationObserver` on `<html data-theme>` is the canonical reactivity surface** (precedent: useMapTheme). The Scene component subscribes once at mount and re-extracts colors when `data-theme` changes.

**Alternatives considered**:

| Alternative                                                               | Reason rejected                                                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcode a 32-theme color table                                           | Drift hazard. Every DaisyUI update or theme tweak would require regenerating the table. The CSS custom properties are the source of truth.    |
| Convert OKLCH → RGB manually via a polyfill (`culori`, `colorjs.io`)      | Adds 10-30 KB to the bundle for what Three.js handles natively. Only useful if older Three.js versions are pinned (we use the latest stable). |
| Pass `--p` directly to Three.js as the raw OKLCH triplet                  | Doesn't work — Three.js needs the `oklch(...)` wrapper syntax to invoke its color parser. The wrapper is one template literal.                |
| Use `window.getComputedStyle` once at mount; ignore runtime theme changes | Breaks US-2 acceptance scenario 3 (theme switch must propagate within one frame). MutationObserver is non-negotiable.                         |

---

## Decision 4: jsdom canvas mocking for unit tests

**Decision**: Unit tests under Vitest do NOT test canvas rendering — that surface is covered by Playwright. Unit tests cover:

- The theme-extraction helper (`getDaisyUIColorAsThree`) — pure function, no WebGL needed.
- The `useReducedMotion` hook — `matchMedia` is mockable in jsdom via `vi.stubGlobal('matchMedia', vi.fn(...))`.
- The `MutationObserver`-on-`data-theme` wiring — observable via jsdom's MutationObserver implementation.
- The WebGL-detection probe — mock `document.createElement('canvas').getContext` to return `null` to assert FallbackPanel renders.

For tests that DO render a component containing `<Canvas>`, the test must either:

- (a) Skip the canvas portion entirely (assert only on surrounding DOM), OR
- (b) Mock `@react-three/fiber`'s `Canvas` component to a no-op `<div>` via `vi.mock`.

**Rationale**:

- **jsdom doesn't ship a WebGL implementation**. Attempting to use `<Canvas>` in jsdom throws or returns silent-failure rendering. Either of (a)/(b) avoids that hazard.
- **Coverage is preserved by moving WebGL-rendering assertions to Playwright** (Playwright has a real browser, real GPU, real WebGL). The split mirrors the existing pattern: Vitest covers logic, Playwright covers DOM-on-real-browser.

**Alternatives considered**:

| Alternative                                                  | Reason rejected                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `jest-canvas-mock` or similar                            | Mocks the 2D canvas API, not WebGL. Doesn't help.                                                                                             |
| Install `node-webgl` or `headless-gl`                        | Installs native dependencies; conflicts with the project's no-native-deps stance. Brittle in CI.                                              |
| Use Playwright Component Testing for unit-level canvas tests | Mixes test runners. Already paying the Playwright cost for E2E; doubling it for component tests bloats CI time. The (a)/(b) split is cheaper. |

---

## Decision 5: Bundle-split verification methodology

**Decision**: After implementation, run `docker compose exec scripthammer pnpm run build` and inspect the Next.js build report:

```
Route (app)                              Size  First Load JS
├ ○ /game/3d                          [SIZE]    [TOTAL]
├ ○ /game                                [...]      [...]
├ ○ /                                    [...]      [...]
└ ○ /themes                              [...]      [...]
+ First Load JS shared by all          [SHARED]
```

The expectation:

- `/game/3d` First Load JS grows by ~600 KB (Three.js + R3F + drei). This is expected and bounded.
- Every other route's First Load JS is **unchanged** before vs after this feature lands (SC-007).
- The shared chunk does NOT grow.

The verification is part of `tasks.md` and runs in the implementation PR's CI as a regression assertion. If the shared chunk grows, the `dynamic()` import path is mis-configured — the implementer fixes before merging.

**Rationale**:

- **Next.js's built-in build output is the source of truth** — no third-party tooling needed.
- **`dynamic(() => import('@/components/game/Scene'), { ssr: false })` is the established pattern** in this repo (used by the existing dice game at `src/app/game/page.tsx`). The pattern is known to produce route-split chunks. We're verifying it works for the heavier Three.js payload, not inventing a new technique.

**Alternatives considered**:

| Alternative                                                                              | Reason rejected                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webpack-bundle-analyzer` or `@next/bundle-analyzer`                                     | Useful for deep introspection but overkill for "did the shared chunk grow?" The build report answers that directly. Can be added later if a regression appears that the build report doesn't make obvious.             |
| Add Three.js to a global `_app`-level import                                             | Defeats the whole point — Three.js loads on every page. NEVER do this.                                                                                                                                                 |
| Lazy-load Three.js via `next/dynamic` at the _component_ level instead of the page level | Equivalent outcome; Next.js's chunk-splitter handles both. Page-level dynamic is the simpler/cleaner pattern; component-level becomes useful only if multiple routes share a single Three.js component (not our case). |

---

## Decision 6: Auto-orbit behavior — drei's `autoRotate` + custom-timer override

**Decision**: Use drei's `<OrbitControls autoRotate autoRotateSpeed={...} />` for the baseline auto-rotation. Wrap it in a `Controls` component that tracks last-input-timestamp via a ref, and toggles `autoRotate={false}` for 3 seconds after any user input (drag, scroll, touch). Resume auto-rotate after the idle window. Disable auto-rotate entirely when `prefers-reduced-motion: reduce` is set (per FR-004).

**Rationale**:

- **drei's `autoRotate` does 90% of the work**. It hooks into the `useFrame` render loop and rotates the camera around the orbit target at a configurable speed. No need to reinvent.
- **The 3-second idle-resume window is custom logic** but small: one ref, one `useEffect` listening on the canvas's `pointerdown`/`wheel`/`touchstart` events, a `setTimeout` that clears the pause flag.
- **The reduced-motion gate is a single boolean**: `autoRotate={!prefersReducedMotion && !pausedFromInput}`.

**Alternatives considered**:

| Alternative                                   | Reason rejected                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write a custom camera controller from scratch | More code, more bugs. drei's controller is battle-tested.                                                                                                              |
| Skip auto-orbit entirely for v1               | The wireframes show an "Auto-orbit on" chip, and US-3 acceptance scenarios call out auto-orbit specifically. Removing it would require a spec amendment.               |
| Use a CSS animation on the camera position    | drei manages the camera imperatively; CSS animations don't apply to Three.js cameras.                                                                                  |
| Continuous auto-rotate even during user input | Disorienting UX — user pans, but the camera also auto-rotates, fighting their input. Industry-standard pattern is to pause auto-rotate on input and resume after idle. |

---

## Open questions

None. Every spec FR/NFR has a clear implementation path. `/speckit.tasks` can proceed without further clarification.
