'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import FallbackPanel from '@/components/game/FallbackPanel';
import ProceduralSky from '@/components/game/ProceduralSky';
import { useFootsteps } from '@/lib/cod/audio/useFootsteps';
import { useFootstepDust } from '@/lib/cod/fx/useFootstepDust';
// Vendored, framework-agnostic Claude-of-Duty physics (MIT — see
// src/lib/cod/NOTICE.md). Imported as .js via tsconfig `allowJs`; the class
// shapes infer loosely, which is all this integration needs.
import { StaticWorld } from '@/lib/cod/bvh';
import { CharacterController } from '@/lib/cod/character';
import { MASK } from '@/lib/cod/surfaces';
import { MaterialSystem } from '@/lib/cod/materials';

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
  surface: 'dirt' | 'concrete' | 'wood';
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
  { size: [0.5, 3, 12], pos: [-6, 1.5, 0], surface: 'concrete', material: 'brick' }, // wall
  { size: [1.6, 1, 1.6], pos: [3, 0.5, 4], surface: 'wood' }, // crate
];

const SURFACE_TINT: Record<string, [number, number, number]> = {
  dirt: [120, 92, 58],
  concrete: [150, 150, 155],
  wood: [150, 110, 64],
};

// Fixed-step + feel constants.
const FIXED = 1 / 120;
const GRAVITY = -22;
const JUMP = 7;
const EYE = 1.55;
const LOOK_SENS = 0.0022;
const PITCH_LIMIT = 1.5; // ~86°

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
function FirstPersonWorld({ speed = 4.5 }: { speed?: number }): React.ReactElement {
  const { camera, gl } = useThree();

  // Build the static collision world + character controller once, from the same
  // LEVEL specs that render below. Pure CPU (geometry + BVH) — no GL needed.
  const worldRef = useRef<StaticWorld | null>(null);
  const ccRef = useRef<CharacterController | null>(null);
  if (worldRef.current === null) {
    const world = new StaticWorld();
    for (const b of LEVEL) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size));
      mesh.position.set(...b.pos);
      world.addMesh(mesh, b.surface);
    }
    world.build();
    worldRef.current = world;
    ccRef.current = new CharacterController(world, {
      radius: 0.32,
      height: 1.75,
      stepHeight: 0.42,
      mask: MASK.CHARACTER,
      position: { x: 0, y: 0.2, z: 10 },
    });
  }

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
        console.warn('[cod-skeleton] material forge bake failed; using stand-in', err);
        return standIn(b);
      }
    });
  }, [gl]);

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
  const accum = useRef(0);

  // Surface-keyed procedural footsteps (Web Audio; resumed on the pointer-lock click).
  const { resume: resumeAudio, step: stepAudio } = useFootsteps();
  // Surface-tinted footstep dust puffs (GPU particles), driven off the same cadence.
  const { emit: emitDust, tick: tickDust } = useFootstepDust();

  // Keyboard + pointer-lock. Guarded so the mocked-Canvas unit test (gl === undefined)
  // bails cleanly instead of touching a missing renderer.
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
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current));
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
    const cc = ccRef.current;
    if (!cc || !camera) return;
    // Fixed-step accumulator so physics feel is framerate-independent.
    accum.current += Math.min(delta, 0.1);
    const k = keys.current;
    let moved = 0;
    while (accum.current >= FIXED) {
      accum.current -= FIXED;
      cc.velocity.y += GRAVITY * FIXED;
      const fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
      const str = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
      const sy = Math.sin(yaw.current);
      const cy = Math.cos(yaw.current);
      // forward = (-sy,0,-cy), right = (cy,0,-sy)
      let wx = cy * str - sy * fwd;
      let wz = -sy * str - cy * fwd;
      const wl = Math.hypot(wx, wz);
      if (wl > 1e-6) {
        wx = (wx / wl) * speed;
        wz = (wz / wl) * speed;
      } else {
        wx = 0;
        wz = 0;
      }
      cc.velocity.x = wx;
      cc.velocity.z = wz;
      if (k[' '] && cc.grounded) cc.velocity.y = JUMP;
      // move() returns distance travelled — accumulate it for the footstep cadence.
      moved += cc.move(cc.velocity.x * FIXED, cc.velocity.y * FIXED, cc.velocity.z * FIXED);
    }
    camera.position.set(cc.position.x, cc.position.y + EYE, cc.position.z);
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    // One cadence drives both the footstep sound and a surface-tinted dust puff.
    const didStep = stepAudio(moved, cc.grounded, cc.groundSurfaceName);
    if (didStep) {
      emitDust(cc.position.x, cc.position.y, cc.position.z, cc.groundSurfaceName);
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
  const handleRetry = useCallback(() => setWebglOk(isWebGLAvailable()), []);

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

  return (
    <div className={wrapperClass} data-webgl-ok="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, EYE, 10], fov: 70, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: false }}
        onCreated={onCanvasCreated}
        aria-label="First-person walking skeleton — click to look, WASD to move, Space to jump"
      >
        <ProceduralSky hour={16.5} />
        <FirstPersonWorld speed={speed} />
      </Canvas>

      {/* DOM chrome over the canvas: crosshair + controls hint. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
      />
      <p className="bg-base-300/70 text-base-content absolute bottom-2 left-2 rounded px-2 py-1 text-xs">
        Click to capture the mouse · WASD move · Space jump · Esc to release
      </p>
    </div>
  );
}
