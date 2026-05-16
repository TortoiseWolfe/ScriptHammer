# Implementation Plan: Three.js Game

**Branch**: `047-threejs-game` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `features/enhancements/047-threejs-game/spec.md`

**Note**: Phase 0.5 of the ScriptHammer-family strategy plan (`~/.claude/plans/gleaming-kitten-execution.md`) — the R&D stepping stone before GrimGlow Phase 1a (browser fork). Wireframe gate PASSED 2026-05-15 (regenerated with canonical brand-SVG symbols 2026-05-16). This file is the cascade's `/speckit.plan` step.

## Summary

A new `/game/3d` route that mounts a Three.js scene composing the three canonical ScriptHammer brand assets (silver cog ring, golden `< >` code-tag brackets, printing-mallet) in 3D, all built from procedural primitives. The scene is theme-aware (re-extracts DaisyUI CSS custom properties on `data-theme` change, mirroring the existing `useMapTheme` precedent), respects `prefers-reduced-motion` (disables auto-orbit + idle animations), and degrades gracefully when WebGL is unavailable or the context is lost (themed CSS/SVG silhouette + user-actionable Retry button).

The technical approach is pure-additive: a new client-only route under `src/app/game/3d/` using the existing `dynamic(() => import(...), { ssr: false })` pattern from `src/app/game/page.tsx`; four new components under `src/components/game/` following the mandatory 5-file pattern (Scene, Controls, Loader, FallbackPanel); a small theme-utils extension mirroring `useMapTheme`; a Pa11y exclusion scoped to `/game/3d` only. No backend changes, no schema changes, no shared-state changes elsewhere.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 15.5 (App Router, static export)
**Primary Dependencies**:

- `three` (~0.169.x) — WebGL rendering primitives
- `@react-three/fiber` (~8.17.x) — React renderer for Three.js
- `@react-three/drei` (~9.114.x) — R3F helpers (OrbitControls, useFrame, etc.)
- `@types/three` (devDependency) — TypeScript types

(Versions pinned by `pnpm add` at install time; exact pinned versions land in `package.json` and become part of `tasks.md` step 1.)

**Storage**: N/A. The v1 scene has no persistence. If a future iteration adds save state, it lives in localStorage with explicit user consent (per spec Out of Scope and Constitution Principle VI).

**Testing**:

- Vitest + jsdom for unit tests (theme-extraction logic, reduced-motion gating). jsdom does NOT provide a real WebGL context, so canvas-rendering tests are explicitly excluded from unit; that surface is covered by Playwright instead.
- Playwright (chromium + firefox + webkit) for E2E: route loads, canvas mounts, theme switch updates colors, fallback renders when `--disable-webgl` flag is set.
- Manual a11y review (documented in `tasks.md`) covers the canvas surface, since Pa11y/axe-core cannot audit canvas content. The fallback panel IS Pa11y-auditable and is part of the automated scan via standard DOM rules.

**Target Platform**: GitHub Pages static export; modern browsers with WebGL 1.0+ (effectively all browsers since 2014).

**Project Type**: web (existing single Next.js app).

**Performance Goals** (from spec Success Criteria):

- SC-001: Initial scene paint < 2s on simulated 4G (mid-tier mobile, Lighthouse mobile profile)
- SC-002: Theme switch propagates to scene materials within one frame (≤16ms)
- SC-007: Homepage + other-route bundle sizes unchanged before vs after this feature (Three.js bundle route-split to `/game/3d` only)

**Constraints**:

- Static export — no server API routes, no SSR for the `<Canvas>` (R3F is client-only).
- DPR capped `[1, 2]` per NFR-004 to bound GPU cost on high-DPR mobile devices.
- Canvas content not auditable by Pa11y — exclusion documented + manual review required.
- WCAG AAA contrast baseline from Phase 0 closure still applies to the fallback panel + any DOM chrome.
- 44px minimum touch targets on Retry button + any mobile HUD elements.

**Scale/Scope**:

- 1 new route (`src/app/game/3d/page.tsx`)
- 4 new components (Scene, Controls, Loader, FallbackPanel) × 5-file pattern = 20 new files
- 1 modified utility (extend `src/utils/theme-utils.ts` with a Three.js color-conversion helper)
- 1 modified config (`config/pa11yci.json` exclusion for `/game/3d`)
- 1 new E2E spec at `tests/e2e/game-3d.spec.ts`
- 0 new database tables, 0 new API contracts, 0 new auth surfaces

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                        | Compliance | Notes                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Component Structure Compliance                | ✅         | Four new components (Scene, Controls, Loader, FallbackPanel) each scaffolded via `pnpm run generate:component` to enforce the 5-file pattern. Validated by `pnpm run validate:structure` (SC-008).                                                                                                                                 |
| II. Test-First Development                       | ✅         | RED tests authored first per `tasks.md` ordering: theme-extraction unit test asserts re-extraction on `data-theme` change before the hook ships; FallbackPanel a11y test asserts Retry-button focusability before the WebGL-detection path is wired; E2E spec for /game/3d asserts canvas mounts before the route page is written. |
| III. PRP Methodology w/ Mandatory Wireframe Gate | ✅         | Wireframes 01 + 02 PASSED 2026-05-15 (validator v5.0, 0 errors). `## UI Mockup` section in spec.md links both. This file is the cascade's `/speckit.plan` step.                                                                                                                                                                    |
| IV. Docker-First Development                     | ✅         | All commands via `docker compose exec scripthammer ...`. `pnpm add three @react-three/fiber @react-three/drei` runs inside the container per CLAUDE.md. Tests, builds, validation all containerized.                                                                                                                               |
| V. Progressive Enhancement                       | ✅         | The route degrades gracefully: WebGL unavailable → themed fallback panel (FR-008). prefers-reduced-motion → auto-orbit disabled (FR-004). Touch input → drei OrbitControls handles natively. Mobile breakpoint validated against wireframe 01.                                                                                     |
| VI. Privacy & Compliance First                   | ✅         | NFR-006: GA4 default page view only — no custom scene-loaded, scene-interaction, or theme-switched-in-scene events. No localStorage writes for v1. No third-party calls (Three.js bundles locally; CDNs explicitly avoided). No PII surfaces.                                                                                      |

**No violations to justify.** No `Complexity Tracking` section needed.

## Project Structure

### Documentation (this feature)

```
features/enhancements/047-threejs-game/
├── 047_threejs-game_feature.md          # Original PRP (preserved)
├── spec.md                              # Spec — clarifications encoded 2026-05-15, wireframe sign-off 2026-05-15
├── plan.md                              # This file
├── research.md                          # Phase 0 — decisions on Three.js, R3F, WebGL detection, theme extraction
├── quickstart.md                        # Phase 1 — smoke-test recipes for human + LLM verification
├── tasks.md                             # /speckit.tasks output (NEXT)
├── checklists/
│   └── requirements.md                  # Spec quality checklist (PASSED 2026-05-15)
└── wireframes/
    ├── 01-game-3d-main.svg              # Main scene (PASSED 2026-05-15)
    ├── 02-game-3d-fallback.svg          # Fallback panel (PASSED 2026-05-15)
    ├── 01-game-3d-main.issues.md        # PASS history with regen log
    ├── 02-game-3d-fallback.issues.md    # PASS history with regen log
    └── includes/                        # Shared chrome (header/footer)
```

### Source code (repository root)

```
src/
├── app/
│   └── game/
│       ├── page.tsx                     # NO CHANGE — existing dice game preserved
│       └── 3d/
│           └── page.tsx                 # NEW — dynamic(() => import('@/components/game/Scene'), { ssr: false })
├── components/
│   └── game/
│       ├── Scene/                       # NEW — top-level <Canvas> wrapper, owns theme extraction
│       │   ├── index.tsx                # Barrel
│       │   ├── Scene.tsx                # Main component
│       │   ├── Scene.test.tsx           # Unit tests (theme-extraction, reduced-motion gating)
│       │   ├── Scene.stories.tsx        # Storybook
│       │   └── Scene.accessibility.test.tsx
│       ├── Controls/                    # NEW — drei OrbitControls wrapper + auto-orbit timer
│       │   └── (5 files, same pattern)
│       ├── Loader/                      # NEW — Suspense fallback while canvas mounts
│       │   └── (5 files, same pattern)
│       └── FallbackPanel/               # NEW — WebGL-unavailable/context-lost UI
│           └── (5 files, same pattern)
├── utils/
│   └── theme-utils.ts                   # MODIFY — add `getDaisyUIColorAsThree(token)` helper that returns a THREE.Color from OKLCH custom prop
└── hooks/
    └── useReducedMotion.ts              # NEW or MODIFY (verify if it already exists; if so, reuse; if not, add a small wrapper around `matchMedia('(prefers-reduced-motion: reduce)')` that responds to runtime changes)

tests/
└── e2e/
    └── game-3d.spec.ts                  # NEW — visit route, assert canvas mounts; theme-switch assertion; --disable-webgl fallback assertion

config/
└── pa11yci.json                         # MODIFY — add `/game/3d` to the exclusion list with a comment explaining canvas is not auditable
```

**Structure Decision**: Single Next.js app, existing layout. New components live under `src/components/game/` (matching the existing `src/app/game/` route prefix) so directory paths telegraph ownership. The `Scene` component is the root R3F `<Canvas>`; `Controls`, `Loader`, and `FallbackPanel` are children. Theme extraction lives in `src/utils/theme-utils.ts` next to the existing `useMapTheme` precedent, not inside `Scene` — keeps the conversion logic reusable if a future feature also needs DaisyUI→Three.js color translation.

## Phase 0 — Research

See [`research.md`](./research.md). Decisions recorded with rationale + alternatives considered for:

1. Three.js + R3F + drei (vs raw Three.js, vs Babylon.js, vs PlayCanvas)
2. WebGL availability detection strategy
3. DaisyUI OKLCH → Three.js Color conversion approach
4. jsdom canvas mocking for unit tests
5. Bundle-split verification methodology
6. drei OrbitControls auto-orbit behavior (built-in `autoRotate` vs custom timer)

## Phase 1 — Design

### Data model

**No schema changes. No persistent state in v1.** The runtime state is entirely component-local:

- **Scene state** (in `Scene.tsx`): theme tokens (re-extracted on `data-theme` change), reduced-motion preference (re-evaluated on media-query change), camera position (drei OrbitControls manages this internally).
- **Auto-orbit state** (in `Controls.tsx`): last-input-timestamp (ref), auto-orbit-paused boolean (state).
- **Fallback state** (in `Scene.tsx`): WebGL availability (one-shot probe at mount), context-lost flag (listener-driven).

No `data-model.md` artifact needed — this section captures everything.

### Contracts

**No new API contracts.** The feature is pure-frontend. No backend surfaces, no Edge Functions, no Supabase calls. Three.js renders client-side; the static export emits `out/game/3d/index.html` with the chunk-split bundle.

No `contracts/` directory needed.

### Quickstart

See [`quickstart.md`](./quickstart.md). Smoke-test recipes for:

1. Dependency install + bundle-split verification
2. Route + canvas-mount smoke
3. Theme-switch smoke
4. Reduced-motion smoke
5. WebGL-disabled (fallback panel) smoke
6. Pa11y CI run (exclusion verification + `/game` regression coverage)
7. Production static-export verification (`next build` → `out/game/3d/index.html`)

### Update agent context

```bash
.specify/scripts/bash/update-agent-context.sh claude
# Expected: stderr "[update-agent-context] No-op for ScriptHammer..."
# (CLAUDE.md is hand-curated; this is intentional)
```

## Phase 2 — `/speckit.tasks` (next)

`tasks.md` will sequence work to satisfy user stories independently:

1. **Foundation first**: dependency install (Three.js + R3F + drei + @types/three), Pa11y exclusion config, theme-utils helper extension, useReducedMotion hook. These are prerequisites for any scene work and have no inter-dependency.
2. **US-1 (P1)**: scaffold Scene + Controls + Loader components; create the `/game/3d` route page with `dynamic` no-SSR import; render an initial placeholder geometry to prove the canvas mounts. Largest single deliverable, earliest value.
3. **US-2 (P1)**: wire theme extraction (`getDaisyUIColorAsThree`) into Scene materials; add MutationObserver on `data-theme`. Independent of US-3+.
4. **US-3 (P2)**: gate auto-orbit + any idle animations on `useReducedMotion`. Tests assert no autonomous motion under reduce-motion.
5. **US-4 (P2)**: confirm Pa11y exclusion config; document the manual a11y review template in `tasks.md`. The `/game` regression check is part of the existing Pa11y CI scan and requires no new work — verify only.
6. **US-5 (P3)**: mobile breakpoint polish; DPR cap; touch input verified across the three Playwright browsers.
7. **FR-008 fallback path**: detect WebGL absence at mount + listen for `webglcontextlost`; render `FallbackPanel` with themed silhouette + 44×44 Retry button. Separable from US-1 because it's a distinct rendering path; can ship in parallel.
8. **Procedural sculpt (FR-007)**: replace the US-1 placeholder geometry with the v1 brand composition (cog ring via `RingGeometry` + 20 trapezoidal teeth via `ExtrudeGeometry`; `< >` brackets via `ExtrudeGeometry` from 2D paths; printing-mallet via `BoxGeometry` + `CylinderGeometry`). Last because the placeholder proves all the wiring works first; the sculpt is the visual payoff.

Each user story (or independent technical concern) gets its own commit so the PR history reflects the cascade.

## Constitution re-check (post-Phase 1)

All six principles still ✅. The Phase 1 design didn't introduce anything new beyond the items already evaluated in the Phase 0 gate.

Design is intentionally conservative: extend existing patterns (dynamic-import-no-SSR from the dice game, MutationObserver-on-data-theme from useMapTheme, 5-file component pattern from every other component), no new architectural patterns, no new dependencies beyond the three Three.js packages that are core to the feature. The DaisyUI→Three.js color helper is small and lives next to the existing useMapTheme pattern, ready for reuse if Phase 1a (GrimGlow browser fork) needs the same conversion.
