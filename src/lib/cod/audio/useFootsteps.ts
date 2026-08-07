'use client';

import { useCallback, useEffect, useRef } from 'react';
// Vendored, framework-agnostic Claude-of-Duty procedural audio (MIT — see
// src/lib/cod/audio/NOTICE.md). Pure Web Audio, zero assets, no ctx.
import { Rng } from './rng';
import { NoiseBank, gain } from './dsp';
import { footstep } from './foley';

/** Metres travelled per footstep, by gait. */
const STRIDE_BY_GAIT: Record<string, number> = {
  sprint: 2.6,
  run: 2.4,
  walk: 2.2,
  crouch: 1.6,
  prone: 1.4,
};

interface Voice {
  node: AudioNode;
  /** Absolute AudioContext time the tail finishes. */
  end: number;
}

interface FootstepState {
  actx: AudioContext | null;
  master: GainNode | null;
  bank: NoiseBank | null;
  rng: Rng | null;
  /** Accumulated grounded distance since the last step. */
  acc: number;
  live: Voice[];
}

export interface UseFootsteps {
  /**
   * Create (lazily) + resume the AudioContext. MUST be called from inside a
   * user gesture (e.g. the canvas click that captures pointer-lock) — the
   * browser autoplay policy leaves a fresh context 'suspended' until then.
   */
  resume: () => void;
  /**
   * Feed one movement tick. Call every frame from the controller's move loop
   * with the distance travelled this frame, the grounded flag, and the surface
   * underfoot. Fires a surface-keyed footstep every STRIDE metres; also prunes
   * finished voices. Allocates only when a step actually fires (never per frame).
   * Returns `true` on the frame a footstep fires — so the same cadence can drive
   * other effects (e.g. dust).
   */
  step: (
    distance: number,
    grounded: boolean,
    surface: string,
    gait?: string
  ) => boolean;
}

/**
 * Surface-keyed procedural footsteps harvested from Claude-of-Duty (Web Audio).
 *
 * Harvest-not-embed: no engine, no event bus, no SpatialField — the caller
 * drives it imperatively from the R3F movement loop. First-person is head-locked,
 * so voices play "dry" into a single master gain. SSR/jsdom-safe (no AudioContext
 * is constructed until `resume()` runs inside a browser gesture), and the context
 * is closed on unmount.
 */
export function useFootsteps(): UseFootsteps {
  const s = useRef<FootstepState>({
    actx: null,
    master: null,
    bank: null,
    rng: null,
    acc: 0,
    live: [],
  }).current;

  const resume = useCallback(() => {
    if (typeof window === 'undefined') return; // SSR
    const AC =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return; // jsdom / no Web Audio
    if (!s.actx) {
      const actx = new AC({ latencyHint: 'interactive' });
      const master = gain(actx, 0.9) as GainNode;
      master.connect(actx.destination);
      const rng = new Rng(0x1234abcd);
      const bank = new NoiseBank(actx, rng.fork(), 2.4); // shared buffers, built once
      s.actx = actx;
      s.master = master;
      s.rng = rng;
      s.bank = bank;
    }
    if (s.actx && s.actx.state === 'suspended') void s.actx.resume();
  }, [s]);

  const step = useCallback(
    (
      distance: number,
      grounded: boolean,
      surface: string,
      gait = 'walk'
    ): boolean => {
      const actx = s.actx;
      if (!actx || actx.state !== 'running') return false;

      // Prune finished voices in-frame (no timers).
      const now = actx.currentTime;
      for (let i = s.live.length - 1; i >= 0; i--) {
        if (s.live[i].end < now) {
          try {
            s.live[i].node.disconnect();
          } catch {
            /* already disconnected / context closing */
          }
          s.live.splice(i, 1);
        }
      }

      if (!grounded) {
        s.acc = 0; // airtime must not bank a step
        return false;
      }
      const stride = STRIDE_BY_GAIT[gait] ?? 2.2;
      s.acc += Math.abs(distance);
      if (s.acc < stride) return false;
      s.acc -= stride;

      const v = footstep(s.actx, s.bank, s.rng, {
        when: actx.currentTime,
        surface: surface || 'concrete', // identity: foley keys == the 12 physics names
        gait,
      });
      if (s.master) v.node.connect(s.master);
      s.live.push({ node: v.node, end: v.end });
      return true; // a footstep fired this call
    },
    [s]
  );

  useEffect(
    () => () => {
      for (const v of s.live) {
        try {
          v.node.disconnect();
        } catch {
          /* noop */
        }
      }
      s.live = [];
      if (s.actx && s.actx.state !== 'closed') void s.actx.close();
      s.actx = null;
      s.master = null;
      s.bank = null;
      s.rng = null;
    },
    [s]
  );

  return { resume, step };
}
