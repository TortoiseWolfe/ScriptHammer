# Feature: Three.js Game

**Feature ID**: 047
**Category**: enhancements
**Status**: Ready for SpecKit

## Description

An interactive Three.js scene at `/game/3d` that demonstrates ScriptHammer's capacity for WebGL/3D content as a PWA. Built with `@react-three/fiber` (R3F) and `@react-three/drei` for an ergonomic React-flavored Three.js authoring experience. The scene is theme-aware (reads DaisyUI CSS custom properties so all 32 themes stay coherent across HTML chrome and 3D content), respects `prefers-reduced-motion`, and is fully static-export-compatible (no server APIs).

The existing dice game (Captain, Ship & Crew) at `src/app/game/page.tsx` stays untouched at `/game` — feature `037-game-a11y-tests` already depends on it. This feature lives at a sibling sub-route. The two coexist as independent route segments via Next.js App Router's folder-based routing (`src/app/game/3d/page.tsx` → `/game/3d`).

## User Scenarios

### US-1: Visit 3D Game Route (P1)

A user navigates to `/game/3d` and sees an interactive Three.js scene render after a brief loading state.

**Acceptance Criteria**:

1. Given user navigates to `/game/3d`, when page hydrates, then a loading spinner displays until the canvas mounts
2. Given canvas mounted, when scene initializes, then a `<canvas>` element renders 3D content
3. Given scene rendering, when user interacts (drag/scroll), then camera responds via `OrbitControls`

### US-2: Theme-Aware 3D Scene (P1)

The 3D scene's colors, lighting, and materials reflect the currently active DaisyUI theme.

**Acceptance Criteria**:

1. Given user changes DaisyUI theme, when scene re-renders, then scene colors update to match the new palette
2. Given a dark theme is active, when scene renders, then background and lighting reflect dark-mode aesthetics
3. Given scene reads CSS custom properties (`--p`, `--s`, `--b1`, etc.), when theme switches, then a `MutationObserver` on `data-theme` triggers re-extraction (precedent: `useMapTheme` in `src/utils/theme-utils.ts`)

### US-3: Respect Reduced Motion (P2)

Users with `prefers-reduced-motion: reduce` see a static or low-motion version of the scene.

**Acceptance Criteria**:

1. Given OS-level `prefers-reduced-motion` is `reduce`, when scene loads, then auto-rotation, idle animations, and transitions are disabled
2. Given reduced motion enforced, when user manually orbits camera, then user-initiated motion still works
3. Precedent: commit `acb1920` (feat(a11y): batch 6 — respect prefers-reduced-motion in game animations) — same approach extends here

### US-4: Pa11y Exclusion Documented (P2)

`/game/3d` is excluded from automated Pa11y a11y scans because canvas content cannot be audited by Pa11y/axe-core.

**Acceptance Criteria**:

1. Given Pa11y CI runs, when scanning routes, then `/game/3d` is skipped via `config/pa11yci.json` exclusion
2. Given the exclusion exists, when documentation is generated, then exclusion rationale is recorded (canvas content not Pa11y-auditable; manual a11y review required)
3. Given the existing dice game at `/game`, when Pa11y runs, then `/game` retains coverage via feature `037-game-a11y-tests` (no regression)

### US-5: Mobile-Responsive Canvas (P3)

The 3D scene resizes responsively and supports touch input on mobile devices.

**Acceptance Criteria**:

1. Given user views on mobile viewport, when scene renders, then canvas fills the available width without overflow
2. Given user touches and drags, when on a touch device, then camera orbits via touch input (R3F + drei OrbitControls handle this natively)
3. Given device pixel ratio varies, when scene renders, then DPR is capped (e.g., `[1, 2]`) to balance fidelity and performance

## Technical Architecture

### Components

- **Scene**: Top-level `<Canvas>` wrapper with theme-aware color extraction, camera, lights
- **Loader**: DaisyUI-spinner-styled Suspense fallback while assets/components load
- **Controls**: `OrbitControls` wrapper from `@react-three/drei` with reduced-motion handling
- **HUD**: Optional 2D overlay for in-scene UI chrome (uses standard DaisyUI components)

All components follow the **mandatory 5-file atomic pattern** per `CLAUDE.md`. Use `pnpm run generate:component` to scaffold each.

### Route Structure

```
src/app/game/
├── page.tsx              # Existing dice game (unchanged)
└── 3d/
    └── page.tsx          # NEW — Three.js scene entry point
```

The 3D page follows the established dynamic-import-no-SSR pattern:

```tsx
'use client';

import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/game/Scene/Scene'), {
  loading: () => (
    <div className="bg-base-200 card flex h-96 items-center justify-center">
      <span className="loading loading-spinner loading-lg"></span>
      <p className="mt-4 text-sm">Loading 3D scene...</p>
    </div>
  ),
  ssr: false,
});

export default function ThreeDGamePage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4">
        <Scene />
      </div>
    </main>
  );
}
```

### Theme Color Extraction

Scene reads DaisyUI tokens from CSS custom properties on `:root`:

```typescript
// Precedent: src/utils/theme-utils.ts + useMapTheme hook
function getDaisyUIColor(token: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  // DaisyUI stores OKLCH triplets; convert to a Three.js Color
  return `oklch(${value})`;
}

// Subscribe to theme changes:
const observer = new MutationObserver(() => updateSceneColors());
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});
```

### Reduced Motion Handling

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

// In useFrame:
if (!prefersReducedMotion) {
  meshRef.current.rotation.y += 0.005;
}
```

## Requirements

### Functional

- FR-001: Route `/game/3d` renders a Three.js `<canvas>` after dynamic import
- FR-002: Scene reflects current DaisyUI theme on initial render
- FR-003: Scene re-extracts colors and updates when `data-theme` attribute changes
- FR-004: Scene disables auto-rotation and idle animations when `prefers-reduced-motion: reduce`
- FR-005: Camera orbit controls work via mouse and touch
- FR-006: Page is reachable via standard navigation (no auth required)
- FR-007: Scene uses procedural geometry only (no `.glb`/`.gltf` model imports for v1)

### Non-Functional

- NFR-001: Three.js + R3F + drei bundle is route-split — does NOT inflate other routes
- NFR-002: Initial scene paint < 2s on a mid-tier mobile device (4G simulated)
- NFR-003: Static export (`next build` → `out/`) succeeds without runtime errors
- NFR-004: DPR capped (e.g., `[1, 2]`) to bound GPU cost
- NFR-005: No server-side rendering of `<Canvas>` (R3F is client-only)

### Key Files

- `src/app/game/3d/page.tsx` — route entry (NEW)
- `src/components/game/Scene/Scene.tsx` — top-level R3F canvas (NEW)
- `src/components/game/Loader/Loader.tsx` — Suspense fallback (NEW)
- `src/components/game/Controls/Controls.tsx` — OrbitControls wrapper (NEW)
- `src/utils/theme-utils.ts` — extend or pattern-match `useMapTheme` for scene reactivity (MODIFY)
- `config/pa11yci.json` — exclude `/game/3d` from a11y scans (MODIFY)

### Dependencies

```bash
docker compose exec scripthammer pnpm add three @react-three/fiber @react-three/drei
docker compose exec scripthammer pnpm add -D @types/three
```

### Out of Scope

- Multiplayer / real-time sync (would require Supabase Realtime — separate feature)
- Leaderboards / persistent save state (localStorage only for v1; no backend)
- Physics engine (`@react-three/rapier`, `cannon-es`) — defer until a specific mechanic needs it
- Audio / sound design (separate feature if pursued)
- Asset pipeline for `.glb`/`.gltf`/`.hdr` model and texture imports (v1 uses procedural geometry only)
- Payments, NFTs, or any Web3 integration
- Promoting the 3D scene to the homepage hero or root route (separate IA decision)
- Replacing or moving the existing dice game at `/game`

## Success Criteria

- SC-001: `/game/3d` renders a `<canvas>` element on first visit
- SC-002: Scene colors visibly change when user switches DaisyUI theme via the existing theme switcher
- SC-003: With `prefers-reduced-motion: reduce`, no auto-rotation or idle animations occur
- SC-004: Camera orbit works on mouse, trackpad, and touch
- SC-005: `next build` produces a static export with `/game/3d/index.html` and no SSR errors
- SC-006: Pa11y CI run completes without flagging `/game/3d` (because it's excluded) and `/game` retains its prior coverage
- SC-007: Three.js bundle is route-split — homepage bundle size is unchanged
- SC-008: Component structure validation (`pnpm run validate:structure`) passes for all new game components

## Risk Mitigation

| Risk                                                     | Mitigation                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| three.js bundle size (~600kb gzipped)                    | Dynamic import + route-level code split (precedent: `src/app/game/page.tsx`). Document the bundle delta in the implementation PR.                          |
| WebGL unavailable in Vitest jsdom                        | Mock `<canvas>` and `WebGLRenderingContext` in unit tests for theme-extraction logic; move WebGL-rendering tests to Playwright (which uses real browsers). |
| Pa11y false-positives on canvas                          | Explicit exclusion in `config/pa11yci.json`. Document rationale (canvas not auditable). Manual a11y review documented in tasks.md.                         |
| Theme switching doesn't auto-propagate to Three.js scene | Use `MutationObserver` on `data-theme` (pattern from `useMapTheme`). Re-extract CSS custom properties and update materials on change.                      |
| Static export breaks because `<Canvas>` tries to SSR     | `dynamic(() => import(...), { ssr: false })` is the established pattern — verify in build output.                                                          |
| Mobile GPU performance                                   | Cap DPR (`[1, 2]`), avoid expensive shaders for v1, profile on a mid-tier device before merging.                                                           |

## References

### Internal

- `src/app/game/page.tsx` — existing dice game; pattern for dynamic-import-no-SSR + two-column layout
- `src/utils/theme-utils.ts` + `useMapTheme` hook — precedent for `MutationObserver`-based theme reactivity
- `features/enhancements/021-geolocation-map/` — similar shape (heavy-canvas-with-controls feature); good template for spec/plan/wireframe artifacts
- `features/testing/037-game-a11y-tests/` — existing a11y test feature targeting `/game` (must not regress)
- Commit `acb1920` — `feat(a11y): batch 6 — respect prefers-reduced-motion in game animations`. Same pattern extends to 3D scene animations.
- `features/foundation/006-component-template/` — mandatory 5-file pattern enforced by `validate:structure`
- `features/foundation/001-wcag-aa-compliance/` — WCAG baseline (with documented Pa11y exclusion caveat for canvas content)

### External

- [Three.js documentation](https://threejs.org/docs/)
- [React Three Fiber documentation](https://r3f.docs.pmnd.rs/)
- [drei (R3F helpers) documentation](https://github.com/pmndrs/drei)
- [WCAG canvas accessibility guidance](https://www.w3.org/TR/html52/semantics-scripting.html#the-canvas-element)
