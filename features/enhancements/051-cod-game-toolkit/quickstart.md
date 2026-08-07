# Quickstart — building on `@/lib/cod`

The toolkit is a set of R3F-friendly primitives. Everything imports from the barrel
`@/lib/cod`. R3F components must be loaded `ssr:false` (static export). Full working
reference: `src/components/game/CodSkeleton/CodSkeleton.tsx`.

## 1. Mount a WebGL route (static-export-safe)

```tsx
// src/app/game/my-demo/page.tsx
'use client';
import dynamic from 'next/dynamic';
import Loader from '@/components/game/Loader';
const MyGame = dynamic(() => import('@/components/game/MyGame'), {
  ssr: false,
  loading: () => <Loader />,
});
export default function Page() {
  return <main className="container mx-auto"><MyGame /></main>;
}
```

## 2. Physics — a world + a capsule controller

```tsx
import { StaticWorld, CharacterController, MASK } from '@/lib/cod';
import * as THREE from 'three';

// Build once (pure CPU — no renderer needed):
const world = new StaticWorld();
const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 40));
floor.position.set(0, -1, 0);
world.addMesh(floor, 'dirt'); // surface tags: concrete/metal/wood/dirt/…
world.build();

const cc = new CharacterController(world, {
  radius: 0.32, height: 1.75, stepHeight: 0.42,
  mask: MASK.CHARACTER, position: { x: 0, y: 0.2, z: 10 },
});

// Each fixed step (in useFrame): caller owns velocity; move() clips it + returns distance.
cc.velocity.y += GRAVITY * dt;
cc.velocity.x = wishX; cc.velocity.z = wishZ;
const dist = cc.move(cc.velocity.x * dt, cc.velocity.y * dt, cc.velocity.z * dt);
camera.position.set(cc.position.x, cc.position.y + eye, cc.position.z);
// cc.grounded, cc.groundSurfaceName, cc.landingSpeed, cc.setHeight(h) (crouch) …
```

## 3. Procedural materials (needs the renderer at bake time)

```tsx
import { MaterialSystem } from '@/lib/cod';
const forge = new MaterialSystem({ renderer: gl }); // gl from useThree()
forge.init({});
const set = forge.getTextureSet('concrete'); // { albedo, normal, orm }
const mat = new THREE.MeshStandardMaterial({
  map: set.albedo, normalMap: set.normal,
  roughnessMap: set.orm, metalnessMap: set.orm, roughness: 1, metalness: 0,
});
```

## 4. The hooks (call inside `<Canvas>`; drive imperatively)

```tsx
import { useFootsteps, useFootstepDust, useCameraFeel } from '@/lib/cod';

const { resume, step } = useFootsteps();          // wire resume() onto the pointer-lock click
const { emit, tick } = useFootstepDust(512);       // capacity (e.g. from a quality tier)
const { apply } = useCameraFeel();

// in the movement useFrame, after moving:
const didStep = step(dist, cc.grounded, cc.groundSurfaceName, gait);
if (didStep) emit(cc.position.x, cc.position.y, cc.position.z, cc.groundSurfaceName);
tick(dt);
apply(camera, cc, dist, dt, yaw); // head-bob + landing punch
```

## 5. Core gems — quality tiers + event bus

```tsx
import { useQuality, bus } from '@/lib/cod';

// Quality: drive dpr / anisotropy / particle budget from the active tier.
const { tier, preset, setTier } = useQuality(); // preset.renderScale, .anisotropy, .particleBudget
// <Canvas dpr={Math.min(2, devicePixelRatio * preset.renderScale)} />

// Events without React re-renders (works across the <Canvas> boundary):
bus.emit('player:footstep', { surface, position });
useEffect(() => bus.on('player:footstep', (e) => { /* … */ }), []); // returns unsubscribe
```

## 6. Sky + IBL

Use the reference `<ProceduralSky hour={16.5} />` component
(`src/components/game/ProceduralSky/`) inside your `<Canvas>` — it bakes an
atmospheric sky dome + a PMREM env map into `scene.environment` (no HDRI), so your
`MeshStandardMaterial`s get real image-based lighting.

---

See `src/lib/cod/README.md` for the full API table and the "harvest, not embed"
paradigm; each `src/lib/cod/**/NOTICE.md` carries the MIT attribution.
