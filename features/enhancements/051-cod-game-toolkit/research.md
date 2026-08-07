# Research — CoD → ScriptHammer toolkit extraction map

Feasibility spike + full harvest (2026-08). Source:
[Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) (MIT), ~65k LOC, 13
subsystems, Three r180, 100% procedural. Assessed against ScriptHammer (R3F + drei +
Three r184, Next static-export PWA) by multi-agent readers.

## The decision: harvest, not embed

CoD is a genuinely modular, MIT, `three`-only, **zero-asset** mini-engine with an
OVERWATCH service-locator (`ctx.get('id')`) + event bus and no cross-subsystem
imports. But it runs its own imperative render loop + kernel, and **ScriptHammer is
R3F (React owns the loop)** — two loops can't share one canvas. So we harvest the
framework-agnostic procedural primitives (the asset-free, hard-to-build things) and
let R3F own the render/post layer.

## Extract / Adapt / Skip

| Subsystem | Verdict | Harvested as | r184 |
|---|---|---|---|
| **physics** | EXTRACT ⭐ | `StaticWorld` (BVH) + `CharacterController` (swept capsule) — copies near-verbatim | ✅ 15/15 smoke |
| **materials** | EXTRACT ⭐ | `MaterialSystem` procedural PBR forge (triplanar, no UVs); bake off-screen | ✅ renders |
| **sky** | ADAPT | `<ProceduralSky>` — atmospheric sky dome + PMREM IBL env map (no HDRI); volumetrics dropped | ✅ renders |
| **audio** | EXTRACT ⭐ | `useFootsteps()` — Web-Audio procedural foley (surface-keyed) | ✅ (three-free) |
| **fx** | ADAPT | `ParticleLayer` GPU particle system (`useFootstepDust()`); atlas not needed | ✅ renders |
| **player** | ADAPT/split | `springs.js` (`useCameraFeel()` head-bob + landing); FPS controller skipped | n/a |
| **core** | ADAPT/split | `EventBus` + `QUALITY_PRESETS` (`useQuality()`); rng vendored; **kernel skipped** | n/a |
| **render** | SKIP | R3F + drei + `@react-three/postprocessing` replace it | — |
| **weapons/ai/world/ui** | SKIP | FPS app layer — a milsim reference, not the toolkit | — |

Net harvest ≈ the "hard parts" of a browser 3D prototype, gift-wrapped.

## Integration paradigm (the one rule)

R3F owns `<Canvas>` + the rAF loop. Adapt each primitive to it: materials **bake
off-screen** (save/restore the render target); physics + particles run a **fixed-step
tick in `useFrame`** writing transforms onto the camera/meshes; springs live in
`useFrame`; audio + the event bus + the quality store are plain modules/hooks. **Do
NOT** lift `render`/`core.engine` — that's the "two loops fighting one canvas" trap.

## r180 → r184

No blocking deltas found. Physics/audio are version-agnostic; materials/sky/particles
use standalone GLSL3 `ShaderMaterial`s (no `onBeforeCompile`, no chunk patching → the
r184-safe pattern); colorspace uses modern `colorSpace` (no legacy `encoding`). Each
slice was verified live under real WebGL (Playwright).

## Backlog reconciliation

Lands on the closed #48 `/game/3d` ssr:false island. The character controller unblocks
the eye-height-WASD half of #226 (milsim FPS) independent of its geodata blocker; CoD
weapons/ai are a reference, not a lift. Answers #226's "template-capability vs separate
app?" → **the toolkit is a template capability; specific games are forks that consume
it.** Supersedes the legacy gpbp FPS-placeholder prompts.
