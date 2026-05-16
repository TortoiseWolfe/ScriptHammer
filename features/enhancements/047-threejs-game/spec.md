# Feature Specification: Three.js Game

**Feature Branch**: `047-threejs-game`
**Created**: 2026-05-14
**Status**: Draft
**Input**: User description: "An interactive Three.js scene at /game/3d that demonstrates ScriptHammer's capacity for WebGL/3D content as a PWA. Built with @react-three/fiber and @react-three/drei. Theme-aware via DaisyUI CSS custom properties (32 themes), respects prefers-reduced-motion, static-export-compatible (no SSR for canvas), procedural geometry only for v1. Coexists with the existing dice game at /game (must not regress feature 037-game-a11y-tests). 5 user scenarios, 7 functional + 5 non-functional requirements."

---

## Clarifications

### Session 2026-05-15

- Q: What is the canonical v1 scene content? → A: A 3D composition of the **three canonical ScriptHammer brand assets**, all mirrored from their SVG sources:
  1. **Spinning silver cog ring** (procedural ring + 20 trapezoidal gear teeth + rivets, mirroring `public/scripthammer-logo.svg`) — the steampunk-machinery motif. Rotates slowly per the auto-orbit behavior.
  2. **Glowing golden code brackets `< >`** (procedural extruded paths in a brass/bronze metallic material — note Three.js renders the metal highlight via `metalness` + lighting, not a stroke gradient as the source SVG uses; the visual is equivalent at scene scale — mirroring `public/script-tags.svg`) — the "Script" half of ScriptHammer. Centered, slight emissive glow.
  3. **Printing-mallet** (procedural primitives mirroring `public/printing-mallet.svg` — squat boxy beech head + thin handle + visible wedge) — the "Hammer" half. Rests near the brackets.

  DaisyUI theme tokens drive: cog rim color, bracket emissive glow color, mallet base material color, scene background. Procedural geometry only (no `.glb`/`.gltf` imports). _Revised 2026-05-15: dropped earlier "hammer + anvil + accent orbs" framing — anvils are blacksmith tools, not Gutenberg-press tools, and the orbs were filler. The three actual brand SVGs replace them._

- Q: WebGL-unavailable / GPU-context-lost fallback UX? → A: Static themed illustration (CSS/SVG composition of the three brand assets — cog ring + brackets + printing-mallet, all from their canonical `public/*.svg` sources, recolored via DaisyUI tokens) + explanatory message + retry button. No auto-retry on context loss; user clicks retry explicitly.
- Q: How constrained should camera orbit be? → A: Constrained polar angle (no flipping under ground plane), 360° yaw, bounded zoom (min/max distance), AND auto-orbit when idle (suspends on user input, resumes after 3s of inactivity). Auto-orbit MUST disable when `prefers-reduced-motion: reduce` is set (already covered by FR-004).
- Q: Should /game/3d emit custom analytics events? → A: Page view only (rely on GA4's default page view). No custom scene-loaded or scene-interaction events for v1. Defer richer measurement to a follow-up feature if/when needed.

## UI Mockup

Approved wireframes (signed off 2026-05-15 by `/speckit.wireframe.review` after validator PASS):

- [`wireframes/01-game-3d-main.svg`](wireframes/01-game-3d-main.svg) — desktop + mobile of `/game/3d` with canvas mounted. Anchors US-001, US-002, US-003, US-005, FR-002, FR-003, FR-004, FR-005, FR-007, NFR-004, SC-001, SC-002, SC-010.
- [`wireframes/02-game-3d-fallback.svg`](wireframes/02-game-3d-fallback.svg) — desktop + mobile of `/game/3d` fallback panel (WebGL unavailable OR `webglcontextlost` event fired). Anchors US-001, US-002, US-004, FR-008, SC-006, SC-009.

Wireframe gate per Constitution v1.0.2 Principle III is now PASSED. `/speckit.plan` is unblocked.

---

<!-- AUDIT-IMPL-STATUS-BEGIN -->

## Implementation Status

**Last audited**: 2026-05-14
**Real status**: Not Started
**Tracking**: GitHub issue #48; Phase 0.5 per `~/.claude/plans/gleaming-kitten-execution.md`

### Shipped

- (none yet) — this is a new route at `/game/3d` with no prior code.

### Gaps

- No `src/app/game/3d/` route directory.
- No 3D scene components under `src/components/game/`.
- No Pa11y exclusion for `/game/3d` in `config/pa11yci.json`.
- Three.js / R3F / drei not in `package.json` dependencies yet.

### Notes

- Existing dice game at `src/app/game/page.tsx` is unchanged and remains the target of feature `037-game-a11y-tests`. This feature creates a sibling sub-route at `src/app/game/3d/page.tsx`; the two coexist as independent Next.js route segments and must not interfere.
- This is the first feature to demand a documented Pa11y exclusion. The rationale (canvas content cannot be audited by Pa11y/axe-core; manual a11y review required) becomes precedent for future canvas/video features.

<!-- AUDIT-IMPL-STATUS-END -->

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Visit the 3D Game Route (Priority: P1)

A user navigates to `/game/3d` and sees an interactive Three.js scene render after a brief loading state. They can rotate and zoom the camera via mouse, trackpad, or touch.

**Why this priority**: This is the minimum viable demonstration of WebGL/3D capability. Without it, every other user story is moot. Ships independently as a static-only experience even if theme reactivity (US-2) and reduced motion (US-3) are deferred.

**Independent Test**: Visit `/game/3d` in a desktop browser, observe a `<canvas>` element renders 3D content within 2 seconds, and confirm the camera responds to drag gestures via orbit controls.

**Acceptance Scenarios**:

1. **Given** a user navigates to `/game/3d`, **When** the page hydrates, **Then** a loading spinner displays until the canvas mounts
2. **Given** the canvas has mounted, **When** the scene initializes, **Then** a `<canvas>` element renders the v1 scene content (procedural composition of the three brand assets — silver cog ring mirroring `public/scripthammer-logo.svg`, golden `< >` brackets mirroring `public/script-tags.svg`, printing-mallet mirroring `public/printing-mallet.svg` — no `.glb`/`.gltf` imports)
3. **Given** the scene is rendering, **When** the user drags or scrolls, **Then** the camera responds via orbit controls
4. **Given** a fresh visit, **When** the production static export is served, **Then** the page works end-to-end with no server runtime (no `/api/` routes)

---

### User Story 2 - Theme-Aware 3D Scene (Priority: P1)

The 3D scene's colors, lighting, and materials reflect the currently active DaisyUI theme, and update in real time when the user switches themes via the existing ThemeSwitcher.

**Why this priority**: The differentiator for this feature is that 3D content lives inside the same theme system as the rest of the app — not a hardcoded palette that breaks coherence with the 32-theme HTML chrome. Without theme reactivity, the 3D scene becomes a visual island; with it, the scene proves that ScriptHammer's theme system extends past the DOM.

**Independent Test**: Load `/game/3d`, change the DaisyUI theme via the existing ThemeSwitcher, and observe scene colors update immediately without a page reload.

**Acceptance Scenarios**:

1. **Given** the user changes the DaisyUI theme via the ThemeSwitcher, **When** the scene re-renders, **Then** scene background, lights, and material colors update to match the new palette within one frame
2. **Given** a dark DaisyUI theme is active (e.g., `dark`, `dracula`, `night`), **When** the scene renders, **Then** background and lighting reflect dark-mode aesthetics
3. **Given** the scene reads DaisyUI CSS custom properties (`--p`, `--s`, `--b1`, etc.), **When** the `data-theme` attribute changes on `<html>`, **Then** a `MutationObserver` triggers re-extraction (precedent: `useMapTheme` in `src/utils/theme-utils.ts`)

---

### User Story 3 - Respect Reduced Motion (Priority: P2)

Users who have set `prefers-reduced-motion: reduce` at the OS level see a static or low-motion version of the scene. User-initiated motion (manual camera orbiting) still works.

**Why this priority**: Accessibility baseline (WCAG Success Criterion 2.3.3, Animation from Interactions). Required for the template's a11y-first stance. Could ship after US-1 + US-2, but cannot ship without before any release that markets the feature publicly.

**Independent Test**: Set the OS `prefers-reduced-motion` preference to `reduce` (or use Chrome DevTools' rendering emulation), load `/game/3d`, and confirm auto-rotation and idle animations are disabled. Then drag the camera and confirm user-initiated orbiting still works.

**Acceptance Scenarios**:

1. **Given** OS-level `prefers-reduced-motion` is `reduce`, **When** the scene loads, **Then** auto-orbit (FR-005), idle animations, and any autonomous transitions are disabled
2. **Given** reduced motion is enforced, **When** the user manually orbits the camera, **Then** user-initiated motion still works (the preference scopes to autonomous animation, not user input)
3. **Given** the user toggles their OS preference at runtime, **When** the scene reads the media query, **Then** the animation state updates accordingly without requiring a page reload (precedent: commit `acb1920` — `feat(a11y): batch 6 — respect prefers-reduced-motion in game animations`)

---

### User Story 4 - Pa11y Exclusion Documented (Priority: P2)

`/game/3d` is excluded from automated Pa11y a11y scans because canvas content cannot be audited by Pa11y/axe-core. The exclusion is explicit in `config/pa11yci.json` and the rationale is recorded so future contributors don't try to re-include it.

**Why this priority**: Without the exclusion, CI fails on every PR that ships this feature (Pa11y flags canvas as inaccessible). The pre-existing dice game at `/game` must retain its coverage via feature `037-game-a11y-tests` — the exclusion must scope to `/game/3d` only, not the entire `/game/*` subtree.

**Independent Test**: Run Pa11y CI locally with the exclusion in place and confirm `/game/3d` is skipped while `/game` is still scanned and passes.

**Acceptance Scenarios**:

1. **Given** Pa11y CI runs, **When** it scans configured routes, **Then** `/game/3d` is skipped via `config/pa11yci.json` exclusion (and only `/game/3d` — `/game` is not skipped)
2. **Given** the exclusion exists, **When** a contributor reads `config/pa11yci.json`, **Then** they find a comment or sibling-doc reference recording the rationale (canvas not Pa11y-auditable; manual a11y review required)
3. **Given** the existing dice game at `/game`, **When** Pa11y runs, **Then** `/game` retains coverage via feature `037-game-a11y-tests` (no regression on existing automated scans)

---

### User Story 5 - Mobile-Responsive Canvas (Priority: P3)

The 3D scene resizes responsively, supports touch input for camera orbiting, and remains performant on a mid-tier mobile device.

**Why this priority**: Mobile coverage is a baseline expectation for the template, but the v1 demo can ship desktop-first and add mobile polish in a follow-up if needed. P3 because US-1 alone delivers value to ~50% of visitors; mobile polish unblocks the other ~50%.

**Independent Test**: Open `/game/3d` on a mobile device (or DevTools mobile emulation), confirm the canvas fills the available width without overflow, and confirm touch drag rotates the camera.

**Acceptance Scenarios**:

1. **Given** a user views on a mobile viewport (≤768px), **When** the scene renders, **Then** the canvas fills the available content width without horizontal overflow
2. **Given** the user touches and drags on a touch device, **When** orbit controls are active, **Then** the camera orbits via touch input (R3F + drei OrbitControls handle this natively)
3. **Given** device pixel ratio varies across devices, **When** the scene renders, **Then** DPR is capped (e.g., `[1, 2]`) to balance fidelity and performance

---

### Edge Cases

- **WebGL unavailable**: When the browser does not support WebGL (very old browsers, restricted enterprise environments), the canvas MUST be replaced by a fallback panel containing: a static themed illustration (CSS/SVG composition of the three brand assets — cog ring + `< >` brackets + printing-mallet — recolored via DaisyUI tokens), an explanatory message naming WebGL as the requirement, and a "Retry" button that re-attempts canvas mount. No auto-retry — user-initiated only.
- **GPU context loss**: When the browser releases the WebGL context (memory pressure, tab backgrounded for too long), the scene MUST handle the `webglcontextlost` event by swapping to the same fallback panel described above. The "Retry" button re-creates the canvas and re-mounts the scene. No silent auto-retry.
- **Reduced motion toggled at runtime**: When the user changes the `prefers-reduced-motion` OS preference while `/game/3d` is open, the scene MUST reflect the new state without requiring a page reload.
- **Theme switched during animation**: When the user changes themes mid-animation, material color updates MUST NOT interrupt user-initiated camera motion or cause a visible jump.
- **Pa11y exclusion regression**: If a future PR accidentally removes the exclusion in `config/pa11yci.json`, CI MUST fail loudly so the regression is caught before merge — not silently re-introduce the canvas-isn't-auditable error.
- **Dice game regression**: Any change to `src/app/game/` that touches the Next.js routing layer MUST be verified against `features/testing/037-game-a11y-tests/` before merge.
- **Static export at build time**: `next build` MUST succeed without invoking server-only Three.js code paths; the build MUST emit `out/game/3d/index.html` and only client-side JS chunks.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST serve the route `/game/3d` rendering a `<canvas>` element after a dynamic client-only import (no SSR for the canvas surface).
- **FR-002**: Scene MUST reflect the current DaisyUI theme on initial render by reading CSS custom properties (`--p`, `--s`, `--b1`, etc.) from `:root`.
- **FR-003**: Scene MUST re-extract DaisyUI colors and update materials/lights when the `data-theme` attribute on `<html>` changes (via `MutationObserver`, following the `useMapTheme` precedent).
- **FR-004**: Scene MUST disable all autonomous animations (auto-orbit, idle bobbing, ambient rotation of accent objects, etc.) when `prefers-reduced-motion: reduce` is set; user-initiated camera motion remains enabled.
- **FR-005**: Camera orbit controls MUST work via mouse, trackpad, and touch input (covered natively by drei's `OrbitControls`), with the following constraints:
  - **Polar angle constrained** so the user cannot flip under the ground plane (approximately `Math.PI / 2` upper bound on `maxPolarAngle`).
  - **Full 360° yaw** (azimuth unconstrained).
  - **Bounded zoom** — explicit `minDistance` and `maxDistance` set on `OrbitControls` so the user cannot zoom into the geometry or zoom out into empty space.
  - **Auto-orbit when idle** — the camera slowly rotates around the scene by default. User input (drag/scroll/touch) suspends auto-orbit immediately; auto-orbit resumes after 3 seconds of no input. Auto-orbit MUST be disabled when `prefers-reduced-motion: reduce` is set (per FR-004).
- **FR-006**: Route MUST be reachable via standard navigation (no auth required, no special headers, no payment gating).
- **FR-007**: Scene MUST use procedural geometry only for v1 — no `.glb`/`.gltf`/`.hdr` model or texture imports. The v1 scene content is a 3D composition of the three canonical ScriptHammer brand assets, each mirrored as procedural geometry from its SVG source:
  - **Silver cog ring** with 20 trapezoidal gear teeth and rivets (mirror of `public/scripthammer-logo.svg`); rotates slowly per the auto-orbit behavior.
  - **Golden `< >` code brackets** rendered as extruded bracket paths with a brass/bronze gradient material (mirror of `public/script-tags.svg`); slight emissive glow.
  - **Printing-mallet** (squat boxy beech head, thin handle, locking wedge) procedurally constructed from primitives (mirror of `public/printing-mallet.svg`).

  All geometry built from primitive Three.js shapes (`BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, `RingGeometry`, `ExtrudeGeometry`, etc.). Future asset-pipeline work for loading the SVGs directly is explicitly out of scope.

- **FR-008**: When WebGL is unavailable OR the `webglcontextlost` event fires, the route MUST display a fallback panel containing (a) a static themed illustration (CSS/SVG composition of the three brand assets — cog ring, `< >` brackets, printing-mallet — referencing or recreating their canonical `public/*.svg` sources, recolored via DaisyUI color tokens), (b) an explanatory message naming WebGL as the requirement, and (c) a user-actionable "Retry" button that re-attempts canvas mount. No silent auto-retry.

### Non-Functional Requirements

- **NFR-001**: Three.js + R3F + drei dependencies MUST be code-split to the `/game/3d` route — they MUST NOT inflate the homepage or other-route bundles. Verified via build output analysis.
- **NFR-002**: Initial scene paint MUST occur within 2 seconds on a mid-tier mobile device on a simulated 4G network (Lighthouse mobile profile).
- **NFR-003**: Static export (`next build` → `out/`) MUST succeed without runtime errors and MUST produce `out/game/3d/index.html`.
- **NFR-004**: Device pixel ratio MUST be capped (e.g., `[1, 2]`) to bound GPU cost on high-DPR mobile devices.
- **NFR-005**: `<Canvas>` MUST NOT be server-rendered (R3F is client-only). Achieved via `dynamic(() => import(...), { ssr: false })`.
- **NFR-006**: Observability scope is limited to GA4's default page view for `/game/3d`. No custom scene-loaded, scene-interaction, or theme-switched-in-scene events are emitted for v1. Privacy-friendly default per Constitution Principle VI; richer telemetry is deferred to a follow-up if engagement measurement becomes necessary.

### Key Entities

- **Scene**: The top-level R3F `<Canvas>` wrapper. Owns theme-aware color extraction, camera, lights, and the procedural geometry hierarchy. Contains the v1 brand composition: silver cog ring (mirroring `public/scripthammer-logo.svg`) + golden `< >` brackets (mirroring `public/script-tags.svg`) + printing-mallet (mirroring `public/printing-mallet.svg`). Re-renders on theme change.
- **Theme Tokens**: The DaisyUI CSS custom properties (`--p`, `--s`, `--b1`, etc.) read from `document.documentElement` at runtime. Converted to Three.js-compatible color values for materials and lights.
- **Reduced-Motion Preference**: The OS-level `prefers-reduced-motion` media query result, watched via `matchMedia`'s `change` event for runtime toggling.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user visiting `/game/3d` on a mid-tier mobile device on simulated 4G sees the scene render within 2 seconds (Lighthouse mobile profile).
- **SC-002**: Switching the DaisyUI theme via the existing ThemeSwitcher updates visible scene colors within one frame (≤16ms) on a mid-tier desktop.
- **SC-003**: With `prefers-reduced-motion: reduce` enforced, zero autonomous animations occur for 10 seconds of observation; user-initiated camera motion still works on every input modality (mouse, trackpad, touch).
- **SC-004**: Camera orbit works on every supported input modality with no input-method-specific bugs.
- **SC-005**: `next build` produces a static export containing `out/game/3d/index.html` with no SSR errors and no warnings about server-only code.
- **SC-006**: Pa11y CI completes successfully — `/game/3d` is skipped via the documented exclusion AND `/game` retains its prior coverage (no regression on feature `037-game-a11y-tests`).
- **SC-007**: Homepage and other-route bundle sizes are unchanged before vs. after this feature lands (Three.js bundle is route-split to `/game/3d` only).
- **SC-008**: Component structure validation (`pnpm run validate:structure`) passes for all new components under `src/components/game/`.
- **SC-009**: When WebGL is disabled in the browser (e.g., via Chrome flag `--disable-webgl`), the route renders the fallback panel (themed silhouette + message + retry button) within 2 seconds and the "Retry" button is keyboard-accessible.
- **SC-010**: With `prefers-reduced-motion: reduce` OFF, auto-orbit is observable within 3 seconds of idle and suspends within one frame of user input.

## Assumptions

- The user has a browser with WebGL 1.0+ support (effectively all browsers ≥ 2014; this is a hard prerequisite for Three.js).
- The user has a GPU capable of rendering basic Three.js scenes at interactive frame rates (true for all phones/tablets/laptops from the last ~5 years).
- The existing dice game at `/game` continues to be the target of `features/testing/037-game-a11y-tests/`. This feature does not modify or move the dice game.
- Pa11y / axe-core have no plausible roadmap for auditing canvas-rendered content in the v1 timeframe; the exclusion is therefore a sustained, not temporary, choice.
- The existing DaisyUI theme system (32 themes) remains stable for the v1 timeframe; if a future feature changes the CSS custom property naming (`--p`, `--s`, etc.), this scene's theme reactivity must be updated in lockstep.
- Procedural geometry alone is enough to demonstrate the WebGL/3D capability of the template; an asset pipeline for `.glb`/`.gltf` is explicitly deferred to a follow-up feature.

## Out of Scope

- Multiplayer or real-time sync (would require Supabase Realtime — separate feature).
- Leaderboards or persistent save state in Supabase (v1 has no backend persistence; localStorage may be used for ephemeral state only).
- Physics engine integration (`@react-three/rapier`, `cannon-es`).
- Audio or sound design.
- Asset pipeline for `.glb`/`.gltf`/`.hdr` model and texture imports.
- Payments, NFTs, or any Web3 integration.
- Promoting the 3D scene to the homepage hero or root route (separate IA decision).
- Replacing or moving the existing dice game at `/game`.
- Custom GA4 events beyond default page view (no scene-loaded, scene-interaction, or theme-switched-in-scene events for v1).

## Dependencies

- Constitution v1.0.2 mandatory wireframe gate between `/speckit.clarify` and `/speckit.plan` applies. Wireframes for desktop and mobile MUST be authored and reviewed before planning.
- Existing `useMapTheme` precedent in `src/utils/theme-utils.ts` for `MutationObserver`-based theme reactivity.
- Existing reduced-motion precedent: commit `acb1920` — `feat(a11y): batch 6`.
- Existing 5-file component pattern (mandatory per CLAUDE.md and constitution Principle I); enforced by `pnpm run validate:structure`.
- Pa11y CI config at `config/pa11yci.json`.

## References

### Internal

- `src/app/game/page.tsx` — existing dice game; pattern for dynamic-import-no-SSR + two-column layout.
- `src/utils/theme-utils.ts` + `useMapTheme` hook — precedent for `MutationObserver`-based theme reactivity.
- `features/enhancements/021-geolocation-map/` — similar shape (heavy-canvas-with-controls feature); good template for spec/plan/wireframe artifacts.
- `features/testing/037-game-a11y-tests/` — existing a11y test feature targeting `/game` (must not regress).
- Commit `acb1920` — `feat(a11y): batch 6 — respect prefers-reduced-motion in game animations`.
- `features/foundation/006-component-template/` — mandatory 5-file pattern enforced by `validate:structure`.
- `features/foundation/001-wcag-aa-compliance/` — WCAG baseline (with documented Pa11y exclusion caveat for canvas content).
- `features/enhancements/047-threejs-game/047_threejs-game_feature.md` — original PRP that seeded this specification.

### External

- [Three.js documentation](https://threejs.org/docs/)
- [React Three Fiber documentation](https://r3f.docs.pmnd.rs/)
- [drei (R3F helpers) documentation](https://github.com/pmndrs/drei)
- [WCAG canvas accessibility guidance](https://www.w3.org/TR/html52/semantics-scripting.html#the-canvas-element)
- [WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
