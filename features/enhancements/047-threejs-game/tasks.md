# Tasks: Three.js Game

**Branch**: `047-threejs-game` · **Generated**: 2026-05-16
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Quickstart**: [quickstart.md](./quickstart.md) · **Wireframes**: [01-main](./wireframes/01-game-3d-main.svg), [02-fallback](./wireframes/02-game-3d-fallback.svg)

**Prerequisites**: Features 001 + 006 (foundational, long since shipped). Tier 6. Blocks no downstream features.

## Phase 1 — Setup

Dependency install + project-wiring changes that every user story builds on.

- [x] T001 Install Three.js dependency stack inside Docker: `docker compose exec scripthammer pnpm add three @react-three/fiber @react-three/drei` then `docker compose exec scripthammer pnpm add -D @types/three`. Verify the pinned versions land in `package.json` and `pnpm-lock.yaml`; expected: `three@^0.169.x`, `@react-three/fiber@^8.17.x`, `@react-three/drei@^9.114.x`. **DONE 2026-05-16**: actual installed `three@0.184.0`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `@types/three@0.184.1` (latest stable, ahead of the plan's pin estimates — which is fine since the API surfaces we use (Canvas, useFrame, OrbitControls, etc.) are stable across these versions).
- [x] T002 [P] Add `/game/3d` to `config/pa11yci.json` exclusion list with an inline comment naming canvas-not-auditable as the reason. Verify the existing `/game` route is NOT excluded (regression coverage for feature 037-game-a11y-tests). _Cross-ref: US-4 verification happens at T026 once the route exists._ **DONE 2026-05-16**: pa11yci.json uses an explicit allowlist (4 URLs: `/`, `/themes`, `/accessibility`, `/status`), not a route-scanner-with-exclusion-list. `/game/3d` is omitted by default; added "Note5" documenting the deliberate omission + canvas-not-auditable rationale + cross-ref to T027 + T049 manual a11y review. `/game` (dice game) is also not in the allowlist — its automated a11y coverage is via E2E specs per feature 037, not pa11y.
- [x] T003 [P] Verify `src/hooks/useReducedMotion.ts` exists (search via `git ls-files src/hooks/`). If absent: scaffold a new hook via the project's existing hook-pattern that wraps `matchMedia('(prefers-reduced-motion: reduce)')` and responds to runtime changes via the `change` event listener. If present: confirm its API matches the spec's requirement (returns a boolean that flips on runtime preference change without page reload). **DONE 2026-05-16**: hook did not exist; scaffolded `src/hooks/useReducedMotion.ts` + `src/hooks/useReducedMotion.test.ts` following the `useDeviceType` pattern. 4 unit tests cover: default false, matches=true initial, runtime toggle via media-query change event, addEventListener/removeEventListener lifecycle. All pass.

## Phase 2 — Foundational (blocks all user stories)

Theme-extraction helper extension. Every Three.js material color in the scene flows through this helper, so it must land before any scene work.

### Tests (RED first per Constitution II)

- [x] T004 [P] Author unit test at `src/utils/theme-utils.test.ts` (or extend existing file) with three cases for the new `getDaisyUIColorAsThree(token: string): THREE.Color` helper: (a) given a `:root` with `--p` set to a known OKLCH triplet, returns a `THREE.Color` whose RGB values match the expected sRGB conversion within 1/256 tolerance; (b) given an unknown token, throws or returns a documented fallback; (c) when `data-theme` changes on `<html>`, a subscribed `MutationObserver` fires the callback. Test MUST FAIL until T005 lands. **DONE 2026-05-16**: created `src/utils/theme-utils.test.ts` with 8 cases — 5 for the new helper (returns THREE.Color instance, reads token by name, fallback when unset, raw OKLCH triplet parsing, whitespace stripping), 2 for the existing `isDarkTheme`, 1 for the MutationObserver baseline pattern. Initial run: 5 failed as expected (RED).

### Implementation

- [x] T005 Extend `src/utils/theme-utils.ts`: add `getDaisyUIColorAsThree(token: string): THREE.Color` that reads `getComputedStyle(document.documentElement).getPropertyValue('--' + token)`, wraps the OKLCH triplet in `oklch(...)` syntax, and constructs `new THREE.Color(oklchString)`. Reuse the existing `MutationObserver`-on-`data-theme` pattern from `useMapTheme` so subscribers can listen for theme changes. Document the helper with a JSDoc block citing research.md Decision 3. **DONE 2026-05-16**: research.md Decision 3 was wrong — Three.js r184 does NOT parse `oklch()` strings (verified empirically; falls through silently to white). Implemented inline OKLCH→OKLab→linear sRGB→sRGB conversion math instead (~50 LOC, well-documented references to bottosson.github.io). Helper returns middle gray (`#808080`) on malformed/unset input — never throws. JSDoc updated to reflect the actual behavior + cite Decision 3's correction.
- [x] T006 Verify T004 passes after T005 lands. Run `docker compose exec scripthammer pnpm test src/utils/theme-utils.test.ts`. All three cases must be green. **DONE 2026-05-16**: all 8 tests green (5 new + 3 baseline).

## Phase 3 — User Story 1: Visit the 3D Game Route (P1)

**Goal**: A user navigating to `/game/3d` sees a Three.js `<canvas>` mount after a brief Suspense loader, with the camera orbit controls responsive to mouse/trackpad/touch input.

**Independent test**: Navigate to `/game/3d` in a desktop browser → Suspense loader visible briefly → `<canvas>` element renders within 2 seconds → drag the canvas → camera orbits via drei `OrbitControls`. Production build (`next build`) emits `out/game/3d/index.html` with the Three.js chunk route-split (verify via build output report).

### Tests (RED first)

- [ ] T007 [P] [US1] Author Playwright E2E spec at `tests/e2e/game-3d.spec.ts` with three scenarios: (a) navigate to `/game/3d`, wait for `canvas` element, assert it exists; (b) drag the canvas at center, assert camera orbits (verify by checking a `data-camera-position` attribute the Scene sets in dev mode); (c) Suspense loader present briefly during initial mount. Spec MUST FAIL until T010-T013 land.
- [ ] T008 [P] [US1] Author Scene unit test scaffold at `src/components/game/Scene/Scene.test.tsx`. Mock `@react-three/fiber`'s `Canvas` to a `<div data-canvas-mock="true">` to avoid jsdom-WebGL conflicts. Assert that Scene mounts with the loader as Suspense fallback when no canvas mock prop is set. Tests MUST FAIL until T012 lands.
- [ ] T009 [P] [US1] Author Scene accessibility test at `src/components/game/Scene/Scene.accessibility.test.tsx`: aria-label on the canvas, focus management, keyboard-equivalents documented.

### Implementation

- [ ] T010 [US1] Scaffold the four new components via `docker compose exec scripthammer pnpm run generate:component`: `Scene`, `Controls`, `Loader`, `FallbackPanel` — all under `src/components/game/`. Each generated as the standard 5-file pattern (`index.tsx`, `ComponentName.tsx`, `ComponentName.test.tsx`, `ComponentName.stories.tsx`, `ComponentName.accessibility.test.tsx`). Replace generator-default test/stories stubs with the T008/T009 content for Scene; the others can keep generator stubs at this step (filled in subsequent user-story phases).
- [ ] T011 [US1] Implement `src/components/game/Loader/Loader.tsx`: DaisyUI-styled Suspense fallback that displays a spinner + "Loading 3D scene..." text inside a `bg-base-200 card`. Mirror the pattern from `src/app/game/page.tsx`'s existing loader inline div. Pa11y-auditable (no canvas inside).
- [ ] T012 [US1] Implement `src/components/game/Scene/Scene.tsx` core: `'use client'`. Wrap a R3F `<Canvas>` element with `dpr={[1, 2]}` (per NFR-004) + `gl={{ preserveDrawingBuffer: false }}` defaults. Lights: one `<directionalLight>` + one `<ambientLight>`. Camera: orbital, `position={[0, 1.5, 4]}`, `fov={50}`. Children: a placeholder `<mesh>` with a `<boxGeometry args={[1, 1, 1]} />` and `<meshStandardMaterial color="orange" />` to prove the canvas mounts. The actual brand-asset sculpt lands in Phase 9 (T039+) — placeholder geometry is intentional here so the rest of the wiring proves independently first.
- [ ] T013 [US1] Implement `src/components/game/Controls/Controls.tsx` core: `'use client'`. Wraps drei's `<OrbitControls>` with constraints from FR-005 (placeholder values; tightened in US-5): `enableDamping`, `dampingFactor={0.05}`, `minDistance={2}`, `maxDistance={10}`, `maxPolarAngle={Math.PI / 2}` (prevents flipping under ground plane), full `azimuth` range (360° yaw). Auto-orbit + reduced-motion gating lands in Phase 5 (US-3).
- [ ] T014 [US1] Create the route entry at `src/app/game/3d/page.tsx`: `'use client'`. Use `dynamic(() => import('@/components/game/Scene'), { ssr: false, loading: () => <Loader /> })` per research.md Decision 1. Wrap in `<main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">` mirroring the existing dice-game page. Add page heading "3D Game (Three.js)" with `<h1>` and the breadcrumb `/game / 3d` per the wireframe.

### Story checkpoint

- [ ] T015 [US1] Run all US-1 tests inside Docker: `docker compose exec scripthammer pnpm test src/components/game/Scene/` + `docker compose exec scripthammer pnpm test src/components/game/Loader/` + `docker compose exec scripthammer pnpm exec playwright test tests/e2e/game-3d.spec.ts`. US-1 acceptance scenarios from spec.md must pass (canvas mounts, orbit works, no SSR errors). Manual browser verify at `/game/3d`. Commit as one logical chunk: `feat(scene): #48 US-1 — /game/3d route + canvas mount + orbit controls`.

## Phase 4 — User Story 2: Theme-Aware 3D Scene (P1)

**Goal**: Scene material colors update in real time when the user changes the DaisyUI theme via the existing ThemeSwitcher. No page reload required.

**Independent test**: Load `/game/3d` → confirm initial scene colors match the active DaisyUI theme → switch theme via ThemeSwitcher → scene colors update within one frame. Tested on 3+ themes (light, dark, dracula).

### Tests (RED first)

- [ ] T016 [P] [US2] Extend `tests/e2e/game-3d.spec.ts` with a theme-switch scenario: load `/game/3d` with theme="light" → capture material color via a `data-mesh-color` debug attribute → switch theme to "dark" via the ThemeSwitcher → assert the `data-mesh-color` attribute changes within 100ms. Spec MUST FAIL until T018 lands.
- [ ] T017 [P] [US2] Extend `src/components/game/Scene/Scene.test.tsx`: subscribe to a mocked `MutationObserver` callback; assert that simulating a `data-theme` attribute change on `<html>` triggers re-extraction of the scene's color tokens. Tests MUST FAIL until T018 lands.

### Implementation

- [ ] T018 [US2] Update `src/components/game/Scene/Scene.tsx` to consume the `getDaisyUIColorAsThree(...)` helper from T005. On mount: extract colors for `--p` (primary), `--s` (secondary), `--a` (accent), `--b1` (base background). Subscribe via `MutationObserver` on `document.documentElement` with `attributes: true, attributeFilter: ['data-theme']`. On callback fire: re-extract colors, update material `color` props (via R3F state-driven re-render — set a `themeTokens` state object, pass to material `color` props). Unsubscribe on unmount. Add a `data-mesh-color` attribute to the placeholder mesh for E2E assertion (dev-mode only).
- [ ] T019 [US2] Update `src/components/game/Scene/Scene.tsx` to also drive the scene's background color via `<color attach="background" args={[themeTokens.base]} />` so the canvas background tracks the theme (FR-002, FR-003). Verify dark themes produce a visibly darker canvas.

### Story checkpoint

- [ ] T020 [US2] Run US-2 tests inside Docker. Manual browser verify: load `/game/3d`, switch theme several times (light → dark → dracula → winter), confirm scene colors update without page reload. Commit: `feat(scene): #48 US-2 — theme-aware materials via MutationObserver on data-theme`.

## Phase 5 — User Story 3: Respect Reduced Motion (P2)

**Goal**: When `prefers-reduced-motion: reduce` is set (OS-level or DevTools emulation), the scene's auto-orbit and any idle animations are disabled. User-initiated camera input still works.

**Independent test**: Enable `prefers-reduced-motion: reduce` in DevTools rendering emulation → navigate to `/game/3d` → observe scene for 10 seconds → assert zero autonomous motion → drag the canvas → camera orbits via user input. Toggle the preference off → wait 3 seconds → auto-orbit resumes.

### Tests (RED first)

- [ ] T021 [P] [US3] Extend `tests/e2e/game-3d.spec.ts` with two scenarios: (a) emulate `prefers-reduced-motion: reduce` via Playwright's `page.emulateMedia({ reducedMotion: 'reduce' })`, load `/game/3d`, capture initial camera position, wait 5 seconds, assert camera position unchanged (auto-orbit disabled); (b) without the emulation, load `/game/3d`, wait 5 seconds, assert camera position changed (auto-orbit observable). Spec MUST FAIL until T023 lands.
- [ ] T022 [P] [US3] Extend `src/components/game/Controls/Controls.test.tsx`: assert `autoRotate` is `false` when `useReducedMotion()` returns `true`; assert `autoRotate` is `true` after 3 seconds of no user input when `useReducedMotion()` returns `false`. Mock the hook via `vi.mock`.

### Implementation

- [ ] T023 [US3] Update `src/components/game/Controls/Controls.tsx`: consume `useReducedMotion()`. State: `pausedFromInput` boolean, `lastInputTimestamp` ref. Use `useEffect` to attach `pointerdown`, `wheel`, `touchstart` listeners to the canvas; on event: set `pausedFromInput=true`, clear the previous `setTimeout`, set a new one for 3000ms that flips `pausedFromInput=false`. Pass `autoRotate={!reducedMotion && !pausedFromInput}` to drei's `<OrbitControls>`. `autoRotateSpeed={0.5}` (slow, per wireframe annotation).
- [ ] T024 [US3] Add a "data-autorotate-active" attribute to the canvas wrapper element (dev-mode only) so E2E spec T021 can assert on the auto-orbit state without inspecting camera position drift.

### Story checkpoint

- [ ] T025 [US3] Run US-3 tests inside Docker. Manual browser verify with DevTools "Emulate CSS media feature prefers-reduced-motion" → confirm static scene + user-driven motion still works → toggle off + wait 3s → confirm auto-orbit resumes. Commit: `feat(scene): #48 US-3 — auto-orbit gates on prefers-reduced-motion + 3s idle resume`.

## Phase 6 — User Story 4: Pa11y Exclusion Documented (P2)

**Goal**: `/game/3d` is excluded from Pa11y CI scans (canvas not auditable). `/game` retains coverage. Rationale documented inline + in the spec/issues.

**Independent test**: Run `docker compose exec scripthammer pnpm test:a11y` → output lists `/game/3d` as SKIPPED with the exclusion reason → output lists `/game` as audited and PASSING → no new failures on any other route.

### Tests / Verification

- [ ] T026 [P] [US4] Verify T002's `config/pa11yci.json` change took effect: `docker compose exec scripthammer pnpm test:a11y` exit code 0; output mentions `/game/3d` exclusion explicitly. If the Pa11y runner doesn't surface skipped routes in its log, add a wrapper script or grep the output for the exclusion reason.
- [ ] T027 [US4] Document the manual a11y review checklist in this `tasks.md` (and link from the issues files) covering the four canvas-not-auditable items from quickstart.md recipe 6: keyboard focus path, screen reader label, color contrast on DOM chrome, motion preferences. Each item is a checkbox an implementer ticks when the manual review passes.

### Story checkpoint

- [ ] (no separate checkpoint task — T002 + T026 + T027 collectively are US-4 done.) Commit alongside US-3 if both land same session: `feat(scene): #48 US-3 + US-4 — reduced-motion gating + Pa11y exclusion`.

## Phase 7 — User Story 5: Mobile-Responsive Canvas (P3)

**Goal**: The 3D scene renders at mobile viewports without horizontal overflow, accepts touch input for orbit, and caps device pixel ratio at `[1, 2]` to bound GPU cost.

**Independent test**: Load `/game/3d` on a 375×667 viewport (Playwright mobile profile) → canvas fills available width → drag-via-touch orbits the camera → DPR cap verified via `window.devicePixelRatio` clamp in dev-mode debug.

### Tests (RED first)

- [ ] T028 [P] [US5] Extend `tests/e2e/game-3d.spec.ts` with a mobile-viewport scenario: `await page.setViewportSize({ width: 375, height: 667 })`, load `/game/3d`, assert no horizontal scrollbar, assert `<canvas>` `clientWidth <= 375 - 32`. Simulate a touch-drag via `page.touchscreen.tap()` + chained moves; assert camera position changes. Spec MUST FAIL until T030 lands.

### Implementation

- [ ] T029 [US5] Update `src/components/game/Scene/Scene.tsx`: confirm the `<Canvas dpr={[1, 2]} />` cap is in place (already added in T012; this task verifies and asserts). Add responsive container styling: `className="aspect-video w-full max-w-full"` so the canvas fills the available width on mobile without overflow. Verify drei `OrbitControls` `enableTouch` defaults are correct.
- [ ] T030 [US5] Polish mobile breakpoint per wireframe 01 mobile region: ensure the HUD overlay ("Drag to orbit / Pinch to zoom") wraps gracefully on narrow viewports; auto-orbit chip stays readable.

### Story checkpoint

- [ ] T031 [US5] Run US-5 tests across all three Playwright browsers: `docker compose exec scripthammer pnpm exec playwright test tests/e2e/game-3d.spec.ts --project=chromium --project=firefox --project=webkit`. Verify on a real device via Docker port-mapped URL if available. Commit: `feat(scene): #48 US-5 — mobile responsive + touch input + DPR cap`.

## Phase 8 — FR-008: Fallback Panel (WebGL unavailable / context lost)

**Goal**: When WebGL is unavailable at mount OR the `webglcontextlost` event fires at runtime, the route renders a themed silhouette + explanatory copy + 44×44 keyboard-focusable Retry button instead of (or replacing) the canvas. No silent auto-retry.

**Independent test**: Launch chromium with `--disable-webgl` → navigate to `/game/3d` → assert no `<canvas>` element exists, assert fallback panel renders with headline + Retry button → Tab to Retry → Enter → assert re-mount attempt → assert fallback persists (WebGL still disabled). Then simulate runtime context loss via `gl.getExtension('WEBGL_lose_context').loseContext()` in DevTools console → assert fallback replaces the canvas within one frame.

### Tests (RED first)

- [ ] T032 [P] [FR008] Extend `tests/e2e/game-3d.spec.ts` with two scenarios: (a) launch a Playwright context with WebGL disabled via `args: ['--disable-webgl']`, navigate to `/game/3d`, assert no `<canvas>` element, assert `[role="alert"]` or the FallbackPanel-specific test-id renders with headline "3D Content Unavailable", assert Retry button is keyboard-focusable; (b) navigate normally, then in-page execute `document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext()`, assert fallback panel appears within one frame.
- [ ] T033 [P] [FR008] Author/extend `src/components/game/FallbackPanel/FallbackPanel.test.tsx`: assert renders headline + body copy + Retry button + themed silhouette SVG; assert Retry button has type="button" + accessible label; assert clicking Retry invokes a passed-in `onRetry` callback.
- [ ] T034 [P] [FR008] Extend `src/components/game/FallbackPanel/FallbackPanel.accessibility.test.tsx`: Retry button is focusable, has visible focus indicator, meets 44×44 touch target, color contrast on body copy passes WCAG AAA.

### Implementation

- [ ] T035 [FR008] Implement `src/components/game/FallbackPanel/FallbackPanel.tsx`: themed silhouette using DaisyUI tokens (`fill="hsl(var(--bc) / 0.4)"` or equivalent), headline "3D Content Unavailable", body copy from spec FR-008 ("3D content requires WebGL. Your browser does not support it, or the graphics context was lost."), 44×44 Retry button calling `onRetry` prop. Layout matches wireframe 02. Pa11y-auditable (no canvas).
- [ ] T036 [FR008] Update `src/components/game/Scene/Scene.tsx`: at mount, run a synchronous WebGL probe (`document.createElement('canvas').getContext('webgl') || ...experimental-webgl`). If null: render `<FallbackPanel onRetry={...}>` instead of `<Canvas>`. If non-null: mount canvas + add a `webglcontextlost` event listener via the `gl` accessor (R3F exposes the underlying GL context via `onCreated`). On event: `event.preventDefault()` to allow restoration, set a state flag that switches the rendered tree from canvas → FallbackPanel. The `onRetry` callback resets the state flag, triggering a re-mount attempt.
- [ ] T037 [FR008] Wire keyboard accessibility on the Retry button: button is in tab order, Enter activates, focus indicator visible per WCAG AAA, has `aria-label="Retry rendering 3D scene"` for screen readers.

### Story checkpoint

- [ ] T038 [FR008] Run the FR-008 E2E scenarios across all three browsers. Manual verify: launch chromium with `--disable-webgl` flag, navigate to `/game/3d`, confirm fallback panel renders correctly. In a normal session, run the `WEBGL_lose_context` simulation in DevTools console, confirm fallback swaps in. Commit: `feat(scene): #48 FR-008 — WebGL-unavailable + context-lost fallback panel`.

## Phase 9 — FR-007: Procedural Brand-Asset Sculpt

**Goal**: Replace the placeholder geometry from T012 with the v1 brand composition: silver cog ring + golden `< >` brackets + printing-mallet, built from primitive Three.js geometries, mirroring the canonical brand SVGs at `public/scripthammer-logo.svg`, `public/script-tags.svg`, `public/printing-mallet.svg`. Layered composition per `src/components/atomic/SpinningLogo/LayeredScriptHammerLogo.tsx`.

**Independent test**: Load `/game/3d` → visually verify the scene contains a recognizable composition of cog (silver, 20 teeth) + brackets (golden `< >`) + mallet (beech head, tilted handle). Composition matches the wireframe 01 main-scene reference at `wireframes/01-game-3d-main.svg`. All three elements pick up DaisyUI theme colors per US-2.

### Implementation

- [ ] T039 [P] [FR007] Scaffold a new `CogRing` 5-file component under `src/components/game/CogRing/` via `docker compose exec scripthammer pnpm run generate:component`. Implement `CogRing.tsx`: renders 20 trapezoidal gear teeth via instanced `<mesh>` + `<extrudeGeometry>` or `<shapeGeometry>` per the geometry in `public/scripthammer-logo.svg`. The ring itself: `<torusGeometry args={[outerRadius, ringThickness, 8, 64]} />` for the rim band, with smaller `<sphereGeometry>` rivets distributed every 18° between teeth. Material: `<meshStandardMaterial color={themeTokens.metalSilver} metalness={0.8} roughness={0.3} />`. Color derives from a theme token (probably `--p` or a fixed silver if theme-aware doesn't look right at first iteration). Tests + Storybook + a11y placeholders satisfy SC-008.
- [ ] T040 [P] [FR007] Scaffold a new `ScriptTags` 5-file component under `src/components/game/ScriptTags/` via the generator. Implement `ScriptTags.tsx`: renders the `< >` brackets via two `<extrudeGeometry>` shapes built from 2D paths copied from `public/script-tags.svg`. Position: centered on the cog's z-axis, slightly in front. Material: `<meshStandardMaterial color={themeTokens.gold} emissive={themeTokens.gold} emissiveIntensity={0.2} metalness={0.7} roughness={0.4} />`. The slight emissive matches the spec's "slight emissive glow" requirement (Three.js renders the metallic highlight via `metalness` + lighting; no stroke gradient).
- [ ] T041 [P] [FR007] Scaffold a new `PrintingMallet` 5-file component under `src/components/game/PrintingMallet/` via the generator. Implement `PrintingMallet.tsx`: renders the mallet from primitives matching `public/printing-mallet.svg`: head as a slightly-tapered `<boxGeometry>` (or `<extrudeGeometry>` with a trapezoidal cross-section to match the 5"→4" anatomy), thin handle as a `<cylinderGeometry>` ~1" diameter, locking wedge as a tiny `<boxGeometry>` on top. Position: BACK layer (offset down-left from cog center per the LayeredScriptHammerLogo composition rules), tilted 42° around Z-axis. Material: `<meshStandardMaterial color={themeTokens.beech} roughness={0.8} />`. Beech tone is a fixed value (#c9a876) since wood doesn't recolor naturally per theme.
- [ ] T042 [FR007] Update `src/components/game/Scene/Scene.tsx` to import and compose the three sub-components in the canonical layering order: `<PrintingMallet />` first (BACK), then `<CogRing />`, then `<ScriptTags />` (FRONT). Remove the T012 placeholder cube. Position lights to illuminate the composition properly: `<directionalLight position={[5, 8, 5]} intensity={1.5} />` (key light from upper-right), `<ambientLight intensity={0.4} />`.
- [ ] T043 [FR007] Replace the wireframe-01 hand-drawn brand-silhouette geometry with comments or use of the canonical `<symbol>`s (the canonical brand-composition lives in `wireframes/01-game-3d-main.svg` already — no SVG changes needed; this is a verification task). Run the wireframe validator: `docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py features/enhancements/047-threejs-game/wireframes/01-game-3d-main.svg` → PASS.

### Story checkpoint

- [ ] T044 [FR007] Manual visual verification: load `/game/3d` in a browser, compare against `wireframes/01-game-3d-main.svg`, confirm the 3D composition is recognizable as the ScriptHammer logo identity (cog + brackets + mallet, layered). Theme-switch and confirm all three elements pick up the new theme tokens where applicable. Commit: `feat(scene): #48 FR-007 — procedural brand-asset sculpt (cog + brackets + mallet)`.

## Phase 10 — Polish & Cross-Cutting

- [ ] T045 [P] Fill in Storybook stories for `Scene`, `Controls`, `Loader`, `FallbackPanel` (`*.stories.tsx`). Each component gets at least a "Default" story; FallbackPanel additionally gets a "DarkTheme" story to verify the silhouette recolors. Use the existing `decorators` pattern from sibling components.
- [ ] T046 [P] Verify bundle-split per research.md Decision 5: run `docker compose exec scripthammer pnpm run build`, inspect the Next.js build output, assert `/game/3d` First Load JS grew by ~600 KB AND every other route's First Load JS is unchanged. Save the build report to `features/enhancements/047-threejs-game/build-report.txt` for posterity.
- [ ] T047 [P] Production static-export verification: confirm `out/game/3d/index.html` exists after `pnpm run build`. Run `docker compose exec scripthammer pnpm run start` and verify the route loads at `http://localhost:3000/ScriptHammer/game/3d/` identical to dev mode. No console errors, no missing assets.
- [ ] T048 [P] Run full a11y suite: `docker compose exec scripthammer pnpm test:a11y` → exit code 0, `/game/3d` SKIPPED with reason, `/game` PASSED. Cross-check that no other audited route regressed.
- [ ] T049 Manual a11y review on the canvas surface per T027's checklist. Each of the four items must pass: keyboard focus, screen reader label, color contrast on DOM chrome, motion preferences. Document the review pass in `features/enhancements/047-threejs-game/checklists/manual-a11y-review.md`.
- [ ] T049a [P] Run Lighthouse mobile-profile audit against `/game/3d` to verify NFR-002 / SC-001 (initial scene paint ≤ 2 s on simulated 4G). Use `docker compose exec scripthammer npx lighthouse http://localhost:3000/ScriptHammer/game/3d --preset=mobile --throttling.cpuSlowdownMultiplier=4 --throttling.rttMs=150 --throttling.throughputKbps=1638 --only-categories=performance --output=json --output-path=features/enhancements/047-threejs-game/lighthouse-report.json`. Assert FCP ≤ 2000ms. Save the JSON report for posterity. If Lighthouse is not available via `npx`, install transiently or document the manual DevTools→Lighthouse run.
- [ ] T049b [P] Run `docker compose exec scripthammer pnpm run validate:structure` to verify SC-008 — all new components under `src/components/game/` pass the 5-file pattern check. Exit code must be 0. If a component fails, fix before continuing.
- [ ] T049c [P] Extend `tests/e2e/game-3d.spec.ts` with a multi-modality orbit check satisfying SC-004: assert mouse-drag orbits, scroll-wheel zooms, trackpad two-finger gestures work (Playwright supports `page.mouse.wheel(deltaX, deltaY)` for scroll). Run across chromium + firefox + webkit. Each modality changes a `data-camera-position` attribute on the canvas wrapper.
- [ ] T050 Re-run the wireframe validator: `docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py features/enhancements/047-threejs-game/wireframes/01-game-3d-main.svg` AND the fallback SVG. Both must still PASS — feature 047's wireframes are unchanged but a fresh validation closes the post-implement loop.
- [ ] T051 Update `features/IMPLEMENTATION_ORDER.md` to mark `047` as completed (current line 103). Update `docs/prp-docs/PRP-STATUS.md` if it tracks this feature. Update `STATUS.md` if Phase 0.5 needs the closure note.
- [ ] T052 Update the session handoff doc to reflect #48 closure; suggest Phase 1a (GrimGlow browser fork) as the next strategic step per `~/.claude/plans/gleaming-kitten-execution.md`.

## Dependencies & user-story completion order

```
T001 (deps install) ──┐
                      ▼
T002 + T003 [P, setup parallel] ──┐
                                  ▼
T004 [FOUND RED] ──► T005 ──► T006 [FOUND done]
                                  │
                                  ▼
                            T007 + T008 + T009 [US1 RED, parallel]
                                  │
                                  ▼
                            T010 ──► T011 ──► T012 ──► T013 ──► T014 ──► T015 [US1 done]
                                  │
                                  ▼
                            T016 + T017 [US2 RED, parallel]
                                  │
                                  ▼
                            T018 ──► T019 ──► T020 [US2 done]
                                  │
                                  ▼
                            T021 + T022 [US3 RED, parallel]
                                  │
                                  ▼
                            T023 ──► T024 ──► T025 [US3 done]
                                  │
                                  ▼
                            T026 + T027 [US4 done]
                                  │
                                  ▼
                            T028 [US5 RED]
                                  │
                                  ▼
                            T029 ──► T030 ──► T031 [US5 done]
                                  │
                                  ▼
                            T032 + T033 + T034 [FR-008 RED, parallel]
                                  │
                                  ▼
                            T035 ──► T036 ──► T037 ──► T038 [FR-008 done]
                                  │
                                  ▼
                            T039 + T040 + T041 [FR-007 components, parallel] ──► T042 ──► T043 ──► T044 [FR-007 done]
                                  │
                                  ▼
                            T045 + T046 + T047 + T048 [Polish, parallel] ──► T049 ──► T050 ──► T051 ──► T052 [PR ready]
```

## Parallel execution examples

- **Phase 1**: T002 + T003 run in parallel (Pa11y config + hook scaffold are independent).
- **Phase 3 (US-1)**: T007 + T008 + T009 — three test files, no overlap, authored concurrently before any implementation begins. T010 scaffolds all 4 components in one shot via the generator.
- **Phase 4 (US-2)**: T016 + T017 — E2E + unit tests run side by side.
- **Phase 5 (US-3)**: T021 + T022 — same pattern.
- **Phase 8 (FR-008)**: T032 + T033 + T034 — three test files in parallel.
- **Phase 9 (FR-007)**: T039 + T040 + T041 — three sub-components (CogRing, ScriptTags, PrintingMallet) authored in parallel; T042 composes them after.
- **Phase 10 (Polish)**: T045 + T046 + T047 + T048 — Storybook + bundle verify + static-export verify + a11y suite all independent.

## Implementation strategy (MVP-first)

**MVP**: T001-T015. Ships the `/game/3d` route with a working canvas, orbit controls, Suspense loader, and a placeholder cube — proves the technical wiring (dynamic-import-no-SSR, drei OrbitControls, route-split bundle, jsdom canvas mock pattern) without committing to the full brand sculpt yet. At this checkpoint US-1 is independently shippable.

**Incremental delivery**:

- US-2 (T016-T020) layers theme reactivity on top — still useful with a placeholder cube; demonstrates the DaisyUI-Three.js color pipeline.
- US-3 (T021-T025) layers reduced-motion gating; small, low-risk.
- US-4 (T026-T027) is Pa11y exclusion verification + manual review template; documentation/config only.
- US-5 (T028-T031) is mobile breakpoint polish; ships when the desktop path is solid.
- FR-008 (T032-T038) is the fallback surface; can land in parallel with FR-007 (they touch different files).
- FR-007 (T039-T044) replaces the placeholder geometry with the brand sculpt; the visual payoff. Lands last because everything else has been proven.

**Polish** (T045-T052) closes the PR before merge.

**Suggested PR commit pattern**: one commit per Phase 3-9 checkpoint (T015, T020, T025, T031, T038, T044), plus one polish commit. ~7 commits on the branch.

## Format validation

All tasks above follow `- [ ] T### [P?] [Story?] description with file path`. ✅

- 55 tasks total (added T049a, T049b, T049c during /speckit.analyze remediation 2026-05-16 to close NFR-002/SC-001, SC-008, SC-004 coverage gaps)
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 3 tasks
- Phase 3 (US-1, P1): 9 tasks
- Phase 4 (US-2, P1): 5 tasks
- Phase 5 (US-3, P2): 5 tasks
- Phase 6 (US-4, P2): 2 tasks
- Phase 7 (US-5, P3): 4 tasks
- Phase 8 (FR-008): 7 tasks
- Phase 9 (FR-007): 6 tasks
- Phase 10 (Polish): 11 tasks
- 22 parallel-marked [P] opportunities (3 new: T039 + T040 + T041 now [P]; T049a + T049b + T049c [P])
- Each user story has Independent test criteria defined
- MVP scope: T001-T015 (Phase 1 + Phase 2 + US-1)
- Coverage: 24/24 spec requirements (FR + NFR + SC) now have explicit verification tasks. 100%.
