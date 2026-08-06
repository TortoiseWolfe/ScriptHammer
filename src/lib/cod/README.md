# CoD Game Toolkit

A procedural, **asset-free** game toolkit for React-Three-Fiber (Three.js r184,
Next static export), harvested from Matt Shumer's MIT
[Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty). Everything is
generated on the GPU/CPU at load — zero textures, models, or audio files.

Import the public API from **`@/lib/cod`** (this dir's `index.ts`).

## Paradigm — harvest, not embed

CoD ships an imperative render loop + service-locator kernel. **R3F owns the
`<Canvas>` renderer and loop**, so we do not lift the kernel — we harvest the
framework-agnostic primitives and adapt each to R3F (bake off-screen, tick in
`useFrame`, subscribe in `useEffect`). The OVERWATCH `ctx` service-locator is
replaced by plain modules (an event bus, a quality store, injected renderers).

## What's inside

| Primitive | Public API | Notes |
|---|---|---|
| **Physics** | `StaticWorld`, `CharacterController` | Binned-SAH BVH + swept-capsule collide-and-slide (no tunnelling). Typed (`.d.ts`). |
| **Materials** | `MaterialSystem` | Procedural PBR forge → `THREE` textures; triplanar, no UVs. Needs a renderer at bake time. |
| **Sky + IBL** | `SkyDome` (+ `useProceduralSky` via `ProceduralSky` component) | Atmospheric sky + PMREM env map, no HDRI. |
| **Audio** | `useFootsteps()` | Surface-keyed procedural footsteps (Web Audio). Resume on a user gesture. |
| **Particles** | `ParticleLayer`, `resetSpawn`, `useFootstepDust()` | Deterministic GPU particle system, one instanced draw. |
| **Camera feel** | `useCameraFeel()`, `Spring`, `RecoilAxis` | Head-bob + landing punch; damped-oscillator springs. |
| **Core gems** | `EventBus`, `bus`, `useQuality()`, `QUALITY_PRESETS` | Game events without React re-renders; low/medium/high/ultra tiers. |
| **Surfaces** | `MASK`, `SURFACE`, `LAYER`, `SURFACE_NAMES`, `guessSurface` | Shared 12-surface vocabulary (physics ↔ audio ↔ dust all key off it). |

## Quick shape

```tsx
import { StaticWorld, CharacterController, MASK, useFootsteps, useQuality, bus } from '@/lib/cod';

// physics (once): build a world from meshes, drive a capsule controller
const world = new StaticWorld();
world.addMesh(floorMesh, 'dirt');
world.build();
const cc = new CharacterController(world, { radius: 0.32, height: 1.75, mask: MASK.CHARACTER });

// each fixed step: caller owns velocity; move() clips it and returns distance
const dist = cc.move(vx * dt, vy * dt, vz * dt);

// events + quality
bus.emit('player:footstep', { surface: cc.groundSurfaceName, position: cc.position });
const { preset } = useQuality(); // preset.particleBudget, preset.renderScale, …
```

See `src/components/game/CodSkeleton/` + `src/app/game/cod-skeleton/page.tsx` for a
full first-person reference demo (physics + materials + sky + audio + dust +
camera-feel + a crouch/sprint/prone locomotion layer).

## Licensing

All vendored code is MIT (Matt Shumer). Each subdir carries a `NOTICE.md`; the
root `LICENSE` is the MIT text. Keep them with any repackage.
