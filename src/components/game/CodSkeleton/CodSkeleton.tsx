'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import FallbackPanel from '@/components/game/FallbackPanel';
import ProceduralSky from '@/components/game/ProceduralSky';
// The harvested Claude-of-Duty game toolkit (MIT) — consumed via its public
// barrel (@/lib/cod). Physics classes are typed via hand-written .d.ts; the
// materials forge stays loose-typed via allowJs.
import {
  EmbodiedController,
  MaterialSystem,
  useFootsteps,
  useFootstepDust,
  useCameraFeel,
  useQuality,
  QUALITY_TIERS,
  bus,
} from '@/lib/cod';
import type { QualityTier, Stance, StanceCfg } from '@/lib/cod';

/**
 * CodSkeleton — first-person "walking skeleton" for the CoD extraction spike.
 *
 * Proves, in one slice, that the vendored Claude-of-Duty procedural physics
 * (BVH `StaticWorld` + swept-capsule `CharacterController`) drives a real R3F
 * scene under Three r184 + Next static export:
 *   - R3F owns the `<Canvas>` render loop; physics runs a fixed 120 Hz tick
 *     inside `useFrame` and writes the result onto the camera (harvest, not
 *     embed — CoD's own imperative loop is never lifted).
 *   - WASD + pointer-lock mouselook at eye height, collide-and-slide against a
 *     small procedural level (floor, a 0.40 m step-up platform, a wall, a crate).
 *   - Surfaces are skinned with a zero-asset procedural `DataTexture` (a
 *     stand-in for the full CoD materials forge, which is the next slice).
 *   - WebGL fallback: probe at mount, render `<FallbackPanel>` if unavailable,
 *     and swap to it if the context is lost at runtime (mirrors Scene / FR-008).
 *
 * Canvas correctness is a Playwright concern (real GL); the unit test asserts
 * the DOM contract + the fallback path, exactly like Scene.
 *
 * @category game
 */

export interface CodSkeletonProps {
  /** Additional CSS classes on the wrapper. */
  className?: string;
  /** Walk speed in m/s (default 4.5). */
  speed?: number;
}

/** A level box, authored once and used for BOTH the mesh and the collider. */
interface BoxSpec {
  size: [number, number, number];
  pos: [number, number, number];
  /** Physics surface tag (drives collision/footing). */
  surface: 'dirt' | 'concrete' | 'wood' | 'metal';
  /**
   * CoD materials-forge surface id (defaults to `surface`). Kept DISTINCT per
   * box so each mesh gets its own cached texture set — the forge caches by id,
   * and same-id boxes would share (and clobber) each other's tiling `repeat`.
   */
  material?: string;
}

const LEVEL: readonly BoxSpec[] = [
  { size: [40, 2, 40], pos: [0, -1, 0], surface: 'dirt' }, // floor, top at y=0
  { size: [8, 0.4, 8], pos: [6, 0.2, -4], surface: 'concrete' }, // step-up, top y=0.40
  {
    size: [0.5, 3, 12],
    pos: [-6, 1.5, 0],
    surface: 'concrete',
    material: 'brick',
  }, // wall
  { size: [1.6, 1, 1.6], pos: [3, 0.5, 4], surface: 'wood' }, // crate
  // Low overhang across the forward path: underside at 1.05 m — crouch/prone to pass.
  {
    size: [6, 0.3, 0.6],
    pos: [0, 1.2, 3],
    surface: 'metal',
    material: 'steel',
  },
];

const SURFACE_TINT: Record<string, [number, number, number]> = {
  dirt: [120, 92, 58],
  concrete: [150, 150, 155],
  wood: [150, 110, 64],
  metal: [150, 152, 160],
};

// Look/eye constants. Physics tunables (fixed-step, gravity, jump) now live in
// the EmbodiedController config below.
const EYE = 1.55;
const LOOK_SENS = 0.0022;
const PITCH_LIMIT = 1.5; // ~86°

// Stance + sprint tuning passed to the controller — the spike's exact values, so
// the extraction leaves the demo's feel unchanged. `Stance`/`StanceCfg` are the
// toolkit's types now.
const STANCE: Record<Stance, StanceCfg> = {
  stand: {
    height: 1.75,
    eye: 1.55,
    speedRatio: 1,
    gait: 'walk',
    bobScale: 1,
    dustScale: 1,
  },
  crouch: {
    height: 1.0,
    eye: 0.85,
    speedRatio: 0.49,
    gait: 'crouch',
    bobScale: 0.5,
    dustScale: 0.4,
  },
  prone: {
    height: 0.5,
    eye: 0.35,
    speedRatio: 0.24,
    gait: 'crouch',
    bobScale: 0.2,
    dustScale: 0.25,
  },
};
/** Sprint = a modifier on the standing stance (Shift + moving forward). */
const SPRINT = {
  speedRatio: 1.55,
  gait: 'sprint',
  bobScale: 1.4,
  dustScale: 1.6,
};

/** Zero-asset procedural surface texture: per-surface tint + hash noise + grid. */
function makeSurfaceTexture(
  surface: string,
  repeatX: number,
  repeatY: number
): THREE.DataTexture {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  const tint = SURFACE_TINT[surface] ?? [140, 140, 140];
  const hash = (x: number, y: number): number => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const grid = x % 16 === 0 || y % 16 === 0 ? 0.7 : 1;
      const v = (0.82 + hash(x, y) * 0.18) * grid;
      data[i] = Math.min(255, tint[0] * v);
      data[i + 1] = Math.min(255, tint[1] * v);
      data[i + 2] = Math.min(255, tint[2] * v);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  tex.needsUpdate = true;
  return tex;
}

/** Tiling repeat from a box's two largest dims (~2 m tiles), clamped to >= 1. */
function tileRepeat(size: [number, number, number]): [number, number] {
  const s = [...size].sort((a, b) => b - a);
  return [Math.max(1, Math.round(s[0] / 2)), Math.max(1, Math.round(s[1] / 2))];
}

/**
 * Inner scene: lives inside `<Canvas>`, so it may use useThree/useFrame.
 * Builds the collision world from LEVEL, renders LEVEL as meshes, and runs the
 * fixed-step character controller each frame.
 */
function FirstPersonWorld({
  speed = 4.5,
}: {
  speed?: number;
}): React.ReactElement {
  const { camera, gl } = useThree();
  const { preset } = useQuality(); // quality tier → anisotropy + particle budget

  // Build the embodied controller once, from the same LEVEL specs that render
  // below (the collider bakes those meshes). Pure CPU — no GL needed. Config is
  // the spike's exact numbers so the extraction preserves the demo's feel.
  const ctrlRef = useRef<EmbodiedController | null>(null);
  if (ctrlRef.current === null) {
    ctrlRef.current = EmbodiedController.fromMeshes(
      LEVEL.map((b) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size));
        mesh.position.set(...b.pos);
        return { mesh, surface: b.surface };
      }),
      {
        radius: 0.32,
        height: 1.75,
        stepHeight: 0.42,
        gravity: -22,
        jump: 7,
        walkSpeed: speed,
        fixedStep: 1 / 120,
        stances: STANCE,
        sprint: SPRINT,
        spawn: { x: 0, y: 0.2, z: 10 },
        onStanceChange: (s) => bus.emit('player:stance', { stance: s }),
      }
    );
  }
  useEffect(
    () => () => {
      ctrlRef.current?.dispose();
      ctrlRef.current = null;
    },
    []
  );

  // Materials: the FLOOR gets a real Claude-of-Duty procedural-PBR bake (the ⭐
  // extract — albedo/normal/ORM rendered on the GPU at load, zero assets); the
  // smaller boxes keep the zero-asset DataTexture stand-in for now. The forge
  // needs a live WebGLRenderer, so it only runs when `gl` exists (the
  // mocked-Canvas unit test has no gl and falls back to the stand-in).
  const forgeRef = useRef<MaterialSystem | null>(null);
  const materials = useMemo(() => {
    const standIn = (b: BoxSpec): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({
        map: makeSurfaceTexture(b.surface, b.size[0] / 2, b.size[2] / 2),
        roughness: 0.92,
        metalness: 0,
      });

    return LEVEL.map((b) => {
      if (!gl) return standIn(b); // forge needs a renderer (mocked test → stand-in)
      try {
        if (!forgeRef.current) {
          const forge = new MaterialSystem({ renderer: gl });
          void forge.init({}); // body is synchronous → full 1K bake, anisotropy 8
          forgeRef.current = forge;
        }
        // Bake off-screen: save + restore the renderer's target/autoClear so an
        // in-flight R3F frame can't be corrupted (the forge's standalone path).
        const prevRT = gl.getRenderTarget();
        const prevAutoClear = gl.autoClear;
        const set = forgeRef.current.getTextureSet(b.material ?? b.surface);
        gl.setRenderTarget(prevRT);
        gl.autoClear = prevAutoClear;
        if (!set || !set.albedo) return standIn(b);
        const [rx, ry] = tileRepeat(b.size);
        for (const tex of [set.albedo, set.normal, set.orm]) {
          if (!tex) continue;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(rx, ry);
          tex.anisotropy = preset.anisotropy; // quality tier → texture sharpness
        }
        return new THREE.MeshStandardMaterial({
          map: set.albedo,
          normalMap: set.normal,
          roughnessMap: set.orm, // ORM: roughness in .g
          metalnessMap: set.orm, // ORM: metalness in .b
          roughness: 1,
          metalness: 0,
        });
      } catch (err) {
        console.warn(
          '[cod-skeleton] material forge bake failed; using stand-in',
          err
        );
        return standIn(b);
      }
    });
  }, [gl, preset.anisotropy]);

  // The forge owns the baked render targets — free it (and the materials) on unmount.
  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose());
      forgeRef.current?.dispose();
      forgeRef.current = null;
    };
  }, [materials]);

  // Input state (mutable refs — never triggers React re-render).
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  // Reused scratch for the per-frame eye position (no allocation in useFrame).
  const eyeScratch = useRef({ x: 0, y: 0, z: 0 });

  // Surface-keyed procedural footsteps (Web Audio; resumed on the pointer-lock click).
  const { resume: resumeAudio, step: stepAudio } = useFootsteps();
  // Surface-tinted footstep dust puffs (GPU particles). Pool size scales with the
  // quality tier's particle budget.
  const { emit: emitDust, tick: tickDust } = useFootstepDust(
    Math.round(preset.particleBudget / 16)
  );
  // First-person camera weight: head-bob + landing punch (vendored springs).
  const { apply: applyCameraFeel } = useCameraFeel();

  // Keyboard + pointer-lock. Guarded so the mocked-Canvas unit test (gl === undefined)
  // bails cleanly instead of touching a missing renderer. Stance toggles (C/X)
  // are edge-detected inside the controller from the held key state — no
  // in-handler edge logic needed here.
  useEffect(() => {
    if (!gl || typeof window === 'undefined') return;
    const dom = gl.domElement;

    const down = (e: KeyboardEvent): void => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      keys.current[e.key.toLowerCase()] = false;
    };
    const click = (): void => {
      resumeAudio(); // ride the gesture — browser autoplay leaves the context suspended
      if (document.pointerLockElement !== dom) dom.requestPointerLock();
    };
    const move = (e: MouseEvent): void => {
      if (document.pointerLockElement !== dom) return;
      yaw.current -= e.movementX * LOOK_SENS;
      pitch.current -= e.movementY * LOOK_SENS;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current)
      );
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    dom.addEventListener('click', click);
    document.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      dom.removeEventListener('click', click);
      document.removeEventListener('mousemove', move);
    };
  }, [gl, resumeAudio]);

  useFrame((_state, delta) => {
    const ctrl = ctrlRef.current;
    if (!ctrl || !camera) return;

    // Feed the controller this frame's normalized input (it owns the fixed-step
    // gravity/move loop, stances, and eye glide).
    const k = keys.current;
    ctrl.setInput({
      forward: (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0),
      right: (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0),
      jump: !!k[' '],
      sprint: !!k['shift'],
      crouch: !!k['c'],
      prone: !!k['x'],
      mount: !!k['b'],
      yaw: yaw.current,
    });
    ctrl.step(delta);

    const eye = ctrl.eyePosition(eyeScratch.current);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    // Head-bob (scaled by stance) + landing punch.
    applyCameraFeel(
      camera,
      ctrl,
      ctrl.movedThisFrame,
      delta,
      yaw.current,
      ctrl.bobScale
    );
    // One cadence drives the footstep sound + surface-tinted dust (both stance-scaled).
    const didStep = stepAudio(
      ctrl.movedThisFrame,
      ctrl.grounded,
      ctrl.groundSurfaceName,
      ctrl.gait
    );
    if (didStep) {
      const p = ctrl.position;
      emitDust(p.x, p.y, p.z, ctrl.groundSurfaceName, ctrl.dustScale);
    }
    tickDust(delta);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={[0xbfd4ff, 0x35281c, 0.6]} />
      <directionalLight position={[8, 14, 6]} intensity={1.4} castShadow />
      {LEVEL.map((b, i) => (
        <mesh key={i} position={b.pos} material={materials[i]}>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Probe WebGL availability synchronously (mirrors Scene). Cheap (~1 ms).
 */
function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const ctx =
      probe.getContext('webgl') ||
      probe.getContext('experimental-webgl' as 'webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

export default function CodSkeleton({
  className = '',
  speed = 4.5,
}: CodSkeletonProps = {}): React.ReactElement {
  const [webglOk, setWebglOk] = useState<boolean>(() => isWebGLAvailable());
  const [started, setStarted] = useState<boolean>(false);
  const [stance, setStance] = useState<Stance>('stand');
  const { tier, preset, setTier } = useQuality();
  const handleRetry = useCallback(() => setWebglOk(isWebGLAvailable()), []);

  // The stance HUD is driven by the toolkit event bus: the source of truth lives
  // inside the <Canvas> (FirstPersonWorld), and the bus carries the event across
  // that boundary to this outer HUD — no prop-drill. (bus.on returns unsubscribe.)
  useEffect(
    () => bus.on('player:stance', (e) => setStance(e.stance as Stance)),
    []
  );

  const onCanvasCreated = useCallback(
    (state: { gl: { domElement: HTMLCanvasElement } }) => {
      const domEl = state.gl.domElement;
      const handler = (event: Event): void => {
        event.preventDefault();
        setWebglOk(false);
      };
      domEl.addEventListener('webglcontextlost', handler, false);
    },
    []
  );

  const wrapperClass = `relative aspect-video w-full max-w-full${className ? ` ${className}` : ''}`;

  if (!webglOk) {
    return (
      <div className={wrapperClass} data-webgl-ok="false">
        <FallbackPanel onRetry={handleRetry} />
      </div>
    );
  }

  // THE SCENE DOES NOT MOUNT UNTIL THE VISITOR ASKS FOR IT (#757).
  //
  // Mounting <Canvas> during page load builds a MaterialSystem and bakes its 1K
  // texture sets synchronously before the page is usable. On a GPU-less runner that
  // measured 22.6-30.2s on chromium and 12.7-41.7s on webkit, against the 30s
  // per-test budget — so `mobile-horizontal-scroll` timed out on this route three
  // times and blocked two merges. Firefox, which has no WebGL and never mounts the
  // canvas, finished the identical layout measurement in 2.8-3.3s: the whole gap is
  // this mount.
  //
  // That is a property of the PAGE, not of the test. A software rasteriser stands in
  // for a low-end visitor, and they pay the same cost on a route that has not yet
  // been asked to do anything. Games gate their scene behind a start for exactly this
  // reason, and this one already tells you to click.
  //
  // The placeholder lives inside the SAME wrapper, so `aspect-video w-full` gives it
  // the identical box and the layout sweep measures the geometry it always measured.
  // `CodSkeleton.test.tsx` asserts that; do not move the sizing onto either branch.
  if (!started) {
    return (
      <div
        className={wrapperClass}
        data-webgl-ok="true"
        data-scene-started="false"
      >
        <div className="bg-base-200 border-base-300 absolute inset-0 flex flex-col items-center justify-center gap-3 rounded border p-4 text-center">
          <p className="text-base-content max-w-md text-sm">
            The 3D scene is not running yet. Starting it compiles shaders and
            bakes textures, so it waits until you ask.
          </p>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="btn btn-primary min-h-11 min-w-11"
          >
            Start the scene
          </button>
          <p className="text-base-content text-xs">
            Then: click to capture · WASD move · Shift sprint · C crouch · X
            prone · Space jump
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={wrapperClass}
      data-webgl-ok="true"
      data-scene-started="true"
    >
      <Canvas
        dpr={Math.max(
          0.5,
          Math.min(
            2,
            ((typeof window !== 'undefined' && window.devicePixelRatio) || 1) *
              preset.renderScale
          )
        )}
        camera={{ position: [0, EYE, 10], fov: 70, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: false }}
        onCreated={onCanvasCreated}
        aria-label="First-person walking skeleton — click to look, WASD to move, Space to jump"
      >
        <ProceduralSky hour={16.5} />
        <FirstPersonWorld speed={speed} />
      </Canvas>

      {/* DOM chrome over the canvas: stance badge + crosshair + controls hint.
          Surfaces are `bg-base-300/90`, raised from `/70` (#715). These chips float over an
          UNCONSTRAINED WebGL scene, so contrast must hold against any backdrop the renderer
          can produce. Measured through a canvas composite, bracketing the scene between
          black and white — the worst of the two endpoints:

            /70   light 5.00:1   dark 4.51:1    <- both FAIL the 7:1 AAA gate
            /85   light 7.24:1   dark 7.43:1    <- passes by 1.03x
            /90   light 8.14:1   dark 8.78:1    <- shipped

          /85 was rejected for the same reason globals.css:1716 rejected it for the twin
          nav: a margin that thin is erased by one theme tweak. Pinned by
          tests/e2e/cod-skeleton-hud-contrast.spec.ts, because this route is excluded from
          the sweeping contrast spec (it cannot settle on a GPU-less runner, #719). */}
      <div
        data-stance={stance}
        className="bg-base-300/90 text-base-content absolute top-2 left-2 rounded px-2 py-1 text-xs font-semibold tracking-wider"
      >
        {stance.toUpperCase()}
      </div>
      {/* Quality tier selector — drives dpr, texture anisotropy, particle pool. */}
      <select
        aria-label="Quality tier"
        value={tier}
        onChange={(e) => setTier(e.target.value as QualityTier)}
        data-quality={tier}
        className="bg-base-300/90 text-base-content absolute top-2 right-2 rounded px-2 py-1 text-xs capitalize"
      >
        {QUALITY_TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
      />
      <p className="bg-base-300/90 text-base-content absolute bottom-2 left-2 rounded px-2 py-1 text-xs">
        Click to capture · WASD move · Shift sprint · C crouch · X prone · Space
        jump
      </p>
    </div>
  );
}
