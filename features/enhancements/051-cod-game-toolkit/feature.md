# Feature 051 — CoD Game Toolkit

- **ID:** 051
- **Category:** enhancements
- **Status:** Phase 2a implemented (`spike/cod-walking-skeleton`); Phase 2b (generator) designed
- **Depends on:** 047 (Three.js Game / `/game/3d` island), 037 (game a11y tests)
- **PRP:** `docs/prp-docs/cod-game-toolkit-prp.md`

## Description

A reusable, **asset-free** procedural game toolkit for the ScriptHammer R3F stack,
harvested from the MIT Claude-of-Duty engine and exposed as a clean public API at
`@/lib/cod`: swept-capsule physics, a procedural PBR material forge, an atmospheric
sky + IBL, procedural audio, a GPU particle system, camera-feel springs, a
crouch/sprint/prone locomotion layer, and two core gems (an event bus + quality
tiers). A full first-person reference demo lives at `/game/cod-skeleton`.

The toolkit is the substrate for a future gauntlet-loop **game-demo generator**
(Phase 2b, spec'd in the PRP): a spec → a scaffolded, playable demo.

## User scenarios

### US-1 — a developer builds a 3D prototype on the toolkit
Import the primitives from `@/lib/cod`, build a collision world + drive a capsule
controller, skin surfaces with the procedural forge, and get sky/IBL/audio/particles
for free — no art or audio assets.
**Acceptance:** `quickstart.md`'s samples compile and run; the public API type-checks.

### US-2 — quality tiers scale the render to the device
A `?q=low|medium|high|ultra` param (or the HUD selector) changes render resolution,
texture anisotropy, and the particle budget.
**Acceptance:** `?q=low` renders at `renderScale` 0.72 (canvas backing ratio 0.72);
`?q=ultra` at 1.0. Verified via Playwright.

### US-3 — game events cross the Canvas boundary without prop-drilling
Systems inside the `<Canvas>` emit on `bus`; UI outside subscribes.
**Acceptance:** toggling a stance updates the HUD badge via `bus.on('player:stance')`.
Verified via Playwright (`stand → C → crouch`).

### US-4 — canvas accessibility carve-out (inherited from 047)
The WebGL route keeps the `FallbackPanel` + WebGL-probe pattern; axe covers only the
DOM chrome; a Pa11y exclusion + manual-review rationale apply.
**Acceptance:** the `.accessibility.test.tsx` for the demo components pass; no axe
violations on the DOM chrome.

## Verification

- `docker compose exec -T scripthammer pnpm exec tsc --noEmit` → 0 errors (barrel +
  `.d.ts` type-check; the app conforms).
- `... pnpm exec vitest run src/lib/cod src/components/game/{CodSkeleton,ProceduralSky}`
  → all green, incl. real behavior tests for the EventBus + quality store.
- `... node scripts/validate-structure.js` → all components pass the 5-file gate.
- Playwright on `/game/cod-skeleton` → quality tiers + event bus proven live.

## Out of scope

CoD kernel; the FPS app layer; full `.d.ts` for material/particle/sky classes; the
generator skill itself (Phase 2b); the SpecKit `spec/plan/tasks` (run `/specify`).
