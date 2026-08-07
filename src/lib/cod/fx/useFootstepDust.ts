'use client';

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
// Vendored, framework-agnostic Claude-of-Duty GPU particle system (MIT — see
// src/lib/cod/fx/NOTICE.md). Standalone GLSL3 ShaderMaterial, r184-safe.
import { ParticleLayer, resetSpawn } from './particles';
import { Rng } from '@/lib/cod/audio/rng';

/** Per-surface dust tint (the 12 physics SURFACE_NAMES → linear RGB). */
const TINT: Record<string, [number, number, number]> = {
  concrete: [0.55, 0.55, 0.57],
  metal: [0.5, 0.52, 0.55],
  wood: [0.5, 0.37, 0.22],
  dirt: [0.46, 0.35, 0.22],
  sand: [0.74, 0.63, 0.42],
  glass: [0.62, 0.64, 0.66],
  water: [0.4, 0.46, 0.52],
  foliage: [0.34, 0.4, 0.18],
  fabric: [0.52, 0.47, 0.4],
  flesh: [0.6, 0.42, 0.38],
  rubber: [0.3, 0.3, 0.32],
  plaster: [0.74, 0.71, 0.66],
};
const DEFAULT_TINT: [number, number, number] = [0.46, 0.35, 0.22]; // dirt

/** Particles kicked up per footstep. */
const PUFF = 8;

/** One 64² round-alpha sprite so the puff reads soft — no atlas.js needed. */
function roundSprite(): THREE.DataTexture {
  const S = 64;
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const r = Math.hypot((x / (S - 1)) * 2 - 1, (y / (S - 1)) * 2 - 1);
      const a = Math.max(0, 1 - r);
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = a * a * 255; // soft round falloff
    }
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

interface DustState {
  layer: ParticleLayer;
  sprite: THREE.DataTexture;
  rng: Rng;
  /** Monotonic seconds clock for the GPU sim (accumulated in tick). */
  now: number;
}

export interface UseFootstepDust {
  /**
   * Emit a surface-tinted dust puff at world (x,y,z). Call on a footstep.
   * `intensity` scales the particle count (e.g. more when sprinting).
   */
  emit: (
    x: number,
    y: number,
    z: number,
    surface: string,
    intensity?: number
  ) => void;
  /** Advance + upload the particle sim. Call once per frame with the frame dt. */
  tick: (dt: number) => void;
}

/**
 * Surface-keyed footstep dust harvested from Claude-of-Duty's GPU particle layer.
 *
 * Must be used inside an R3F `<Canvas>` (reads `useThree().scene`). Driven
 * imperatively (like `useFootsteps`): the caller's move loop calls `tick(dt)`
 * every frame and `emit(...)` on each footstep. The particle sim runs entirely
 * on the GPU (one instanced draw). SSR/jsdom-safe — no GPU objects are built
 * without a renderer — and everything is disposed on unmount.
 */
export function useFootstepDust(capacity = 512): UseFootstepDust {
  const { gl, scene } = useThree();

  const state = useMemo<DustState | null>(() => {
    if (!gl) return null; // SSR / mocked-Canvas → no-op
    const sprite = roundSprite();
    const layer = new ParticleLayer({
      capacity: Math.max(64, capacity), // e.g. from the quality tier's particleBudget
      mode: 'lit',
      atlas: sprite,
      cols: 1,
      soft: false, // drops the depth-texture dependency
    });
    return { layer, sprite, rng: new Rng(0xf007), now: 0 };
  }, [gl, capacity]);

  useEffect(() => {
    if (!state || !scene) return;
    scene.add(state.layer.mesh);
    return () => {
      state.layer.mesh.parent?.remove(state.layer.mesh);
      state.layer.dispose();
      state.sprite.dispose();
    };
  }, [state, scene]);

  const emit = useCallback(
    (x: number, y: number, z: number, surface: string, intensity = 1) => {
      if (!state) return;
      const [r, g, b] = TINT[surface] ?? DEFAULT_TINT;
      const rng = state.rng;
      const count = Math.max(1, Math.round(PUFF * intensity));
      // Radial cone rising from the feet — mirrors impacts.js concrete dust.
      for (let i = 0; i < count; i++) {
        const s = resetSpawn();
        const ang = rng.float() * Math.PI * 2;
        const sp = rng.range(0.2, 0.9);
        s.x = x + rng.signed() * 0.05;
        s.y = y + 0.04;
        s.z = z + rng.signed() * 0.05;
        s.vx = Math.cos(ang) * sp;
        s.vy = rng.range(0.15, 0.5);
        s.vz = Math.sin(ang) * sp;
        s.size0 = 0.05;
        s.size1 = rng.range(0.22, 0.42);
        s.sizeCurve = 0.6;
        s.life = rng.range(0.4, 0.85);
        s.drag = rng.range(2.5, 4);
        s.gravity = -0.7;
        s.rot = ang;
        s.spin = rng.signed() * 1.2;
        s.r0 = r;
        s.g0 = g;
        s.b0 = b;
        s.i0 = 1;
        s.r1 = r * 0.8;
        s.g1 = g * 0.8;
        s.b1 = b * 0.8;
        s.i1 = 1;
        s.alpha = rng.range(0.35, 0.6);
        s.alphaCurve = 1.5;
        s.soft = 0.1;
        s.seed = rng.float();
        state.layer.emit(s, state.now);
      }
    },
    [state]
  );

  const tick = useCallback(
    (dt: number) => {
      if (!state) return;
      state.now += dt;
      state.layer.flush(state.now);
    },
    [state]
  );

  return { emit, tick };
}
