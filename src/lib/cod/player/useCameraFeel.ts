'use client';

import { useCallback, useRef } from 'react';
// Vendored, framework-agnostic Claude-of-Duty springs (MIT — see
// src/lib/cod/NOTICE.md). Pure damped-oscillator math, no THREE, no DOM.
import { Spring } from '@/lib/cod/springs';

// Feel constants (metres / radians).
const BOB_FREQ = 5.5; // bob phase per metre walked (~2 vertical bobs per ~2.2 m stride)
const BOB_AMP = 0.035; // vertical head-bob amplitude
const BOB_LAT = 0.02; // lateral sway amplitude
const LAND_SCALE = 0.018; // landing dip per m/s of impact speed
const LAND_MAX = 0.12; // max landing dip
const AMP_TAU = 0.12; // bob amplitude ease-in/out time constant (s)

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface CameraLike {
  position: { x: number; y: number; z: number };
}
interface ControllerLike {
  grounded: boolean;
  /** Downward impact speed on the frame of landing (m/s). */
  landingSpeed: number;
}

interface FeelState {
  landing: Spring;
  bobPhase: number;
  bobAmp: number;
  prevGrounded: boolean;
}

export interface CameraFeel {
  /**
   * Apply head-bob + landing punch to `camera` for this frame. Call AFTER the
   * base camera transform is set. `moved` = distance travelled this frame, `dt` =
   * frame delta (s), `yaw` = camera yaw (for the lateral-sway direction).
   */
  apply: (
    camera: CameraLike,
    cc: ControllerLike,
    moved: number,
    dt: number,
    yaw: number,
    bobScale?: number
  ) => void;
}

/**
 * First-person camera feel harvested from Claude-of-Duty's `Spring`.
 *
 * - Head-bob: a distance-keyed sinusoid (synced to the footstep cadence), eased
 *   in/out with movement so a stopped camera has no static offset.
 * - Landing punch: on the airborne→grounded frame the camera dips by an amount
 *   scaled by `cc.landingSpeed`, then a damped `Spring` snaps it back (a slight
 *   under-damped overshoot reads as weight).
 *
 * Pure math on the camera transform — no GPU, no DOM — so it is SSR-safe and
 * runs fully in jsdom (the unit test drives real behavior). Driven imperatively
 * from the movement loop, like `useFootsteps`/`useFootstepDust`.
 */
export function useCameraFeel(): CameraFeel {
  const s = useRef<FeelState>({
    landing: new Spring(13, 0.5, 0),
    bobPhase: 0,
    bobAmp: 0,
    prevGrounded: true,
  }).current;

  const apply = useCallback(
    (
      camera: CameraLike,
      cc: ControllerLike,
      moved: number,
      dt: number,
      yaw: number,
      bobScale = 1
    ) => {
      if (!camera || !cc) return;

      // Landing punch: instant dip on the airborne→grounded frame, spring back.
      if (cc.grounded && !s.prevGrounded) {
        s.landing.set(-clamp(cc.landingSpeed * LAND_SCALE, 0, LAND_MAX));
      }
      s.prevGrounded = cc.grounded;
      s.landing.step(dt); // integrates toward target 0

      // Head-bob amplitude eases in/out with movement (no static offset at rest).
      const wantAmp = cc.grounded && moved > 1e-4 ? 1 : 0;
      const k = dt > 0 ? 1 - Math.exp(-dt / AMP_TAU) : 1;
      s.bobAmp += (wantAmp - s.bobAmp) * k;
      s.bobPhase += moved * BOB_FREQ;

      const amp = s.bobAmp * bobScale;
      const bobY = Math.sin(s.bobPhase) * BOB_AMP * amp;
      const bobX = Math.cos(s.bobPhase * 0.5) * BOB_LAT * amp;

      // Lateral sway along the camera's right vector (from yaw).
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      camera.position.y += s.landing.value + bobY;
      camera.position.x += rx * bobX;
      camera.position.z += rz * bobX;
    },
    [s]
  );

  return { apply };
}
