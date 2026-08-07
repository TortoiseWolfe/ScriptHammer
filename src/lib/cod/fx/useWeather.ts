'use client';

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
// Reuses the vendored Claude-of-Duty GPU particle layer (MIT — src/lib/cod/fx/
// NOTICE.md), the same system footstep dust uses — one additive instanced draw.
import { ParticleLayer, resetSpawn } from './particles';
import { Rng } from '@/lib/cod/audio/rng';

export type WeatherKind = 'none' | 'rain';

/** A 64² sprite with a THIN vertical bright streak (fading top/bottom) so a
 *  billboarded particle reads as a rain streak, not a blob. */
function streakSprite(): THREE.DataTexture {
  const S = 64;
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const cx = Math.abs((x / (S - 1)) * 2 - 1); // 0 centre → 1 edge (horizontal)
      const cy = (y / (S - 1)) * 2 - 1; // −1..1 (vertical)
      const band = Math.max(0, 1 - cx * 3.5); // vertical streak band
      const vfade = Math.max(0, 1 - Math.abs(cy)); // fade the ends
      const a = band * vfade;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = a * 255;
    }
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

const RAIN_RATE = 700; // particles/second
const RAIN_RADIUS = 22; // emit-box half-extent around the camera (m)
const RAIN_TOP = 14; // spawn height above the camera (m)

interface WeatherState {
  layer: ParticleLayer;
  sprite: THREE.DataTexture;
  rng: Rng;
  now: number;
  accum: number; // fractional-particle accumulator for the emit rate
}

export interface UseWeather {
  /** Advance the sim + emit weather around the camera. Call every frame with dt. */
  tick: (dt: number) => void;
}

/**
 * Ambient weather for Walk mode, reusing the CoD GPU ParticleLayer. `kind` gates
 * it — 'none' builds nothing (no GPU cost), 'rain' streams additive rain streaks
 * in a box that FOLLOWS the camera, so it's always around the player. Driven
 * imperatively (call `tick(dt)` each frame). SSR/jsdom-safe (no GPU objects
 * without a renderer); disposed on unmount / when disabled.
 */
export function useWeather(kind: WeatherKind): UseWeather {
  const { gl, scene, camera } = useThree();
  const active = kind === 'rain';

  const state = useMemo<WeatherState | null>(() => {
    if (!gl || !active) return null; // SSR / disabled → no-op
    const sprite = streakSprite();
    const layer = new ParticleLayer({
      capacity: 1024,
      mode: 'additive',
      atlas: sprite,
      cols: 1,
      soft: false,
    });
    return { layer, sprite, rng: new Rng(0x9a1c3d), now: 0, accum: 0 };
  }, [gl, active]);

  useEffect(() => {
    if (!state || !scene) return;
    scene.add(state.layer.mesh);
    return () => {
      state.layer.mesh.parent?.remove(state.layer.mesh);
      state.layer.dispose();
      state.sprite.dispose();
    };
  }, [state, scene]);

  const tick = useCallback(
    (dt: number) => {
      if (!state) return;
      state.now += dt;
      state.accum += RAIN_RATE * Math.min(dt, 0.05);
      let n = Math.floor(state.accum);
      state.accum -= n;
      if (n > 60) n = 60; // cap a per-frame burst
      const rng = state.rng;
      const cx = camera.position.x,
        cy = camera.position.y,
        cz = camera.position.z;
      for (let k = 0; k < n; k++) {
        const s = resetSpawn();
        s.x = cx + rng.signed() * RAIN_RADIUS;
        s.y = cy + RAIN_TOP + rng.float() * 4;
        s.z = cz + rng.signed() * RAIN_RADIUS;
        s.vx = rng.signed() * 0.8; // slight wind
        s.vy = -18 - rng.float() * 6; // fast fall
        s.vz = rng.signed() * 0.8;
        s.gravity = -6;
        s.drag = 0;
        s.size0 = 0.95;
        s.size1 = 0.95;
        s.sizeCurve = 1;
        s.life = 1.1;
        s.rot = 0;
        s.spin = 0;
        s.r0 = 0.72;
        s.g0 = 0.8;
        s.b0 = 0.95;
        s.i0 = 1;
        s.r1 = 0.72;
        s.g1 = 0.8;
        s.b1 = 0.95;
        s.i1 = 1;
        s.alpha = 0.55;
        s.alphaCurve = 1;
        s.soft = 0;
        s.seed = rng.float();
        state.layer.emit(s, state.now);
      }
      state.layer.flush(state.now);
    },
    [state, camera]
  );

  return { tick };
}
