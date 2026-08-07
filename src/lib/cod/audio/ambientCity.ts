'use client';

import { useCallback, useEffect, useRef } from 'react';
// Vendored, framework-agnostic Claude-of-Duty procedural audio (MIT — see
// src/lib/cod/audio/NOTICE.md). Pure Web Audio, zero assets. `ambience` was one
// of the modules NOT vendored upstream (NOTICE.md), so this is a clean addition
// built from the same DSP layer footsteps use: looping NoiseBank beds + biquad +
// gain + slow LFOs, plus a sparse lookahead scheduler for tonal bird chirps.
import { Rng } from './rng';
import { NoiseBank, biquad, gain, osc, series, sweep, ad, semis } from './dsp';

interface AmbientState {
  actx: AudioContext | null;
  master: GainNode | null;
  bank: NoiseBank | null;
  rng: Rng | null;
  /** The looping beds are live (built + playing). */
  running: boolean;
  /** Continuous filter/gain nodes to disconnect on stop. */
  nodes: AudioNode[];
  /** Sources (bed loops + LFOs) needing an explicit .stop(). */
  sources: AudioScheduledSourceNode[];
  /** Bird lookahead scheduler. */
  birdTimer: ReturnType<typeof setInterval> | null;
  /** AudioContext time of the next scheduled bird chirp. */
  nextChirp: number;
}

export interface UseAmbientCity {
  /**
   * Create (lazily) + resume the AudioContext. MUST be called from inside a user
   * gesture — the autoplay policy leaves a fresh context 'suspended' until then.
   * Shares the SAME gesture as footsteps (the caller wires both into one kick).
   */
  resume: () => void;
  /**
   * Build + play the looping ambient beds (wind + distant traffic) and start the
   * bird scheduler. Idempotent; safe to call before `resume()` — the graph is
   * built on the (possibly still-suspended) context and sounds once resumed.
   */
  start: () => void;
  /** Fade out + stop the beds and the bird scheduler. Keeps the context alive so
   *  re-entering Walk can `start()` again. */
  stop: () => void;
}

/** One tonal bird call: 2–4 rising sine syllables through a shared high-pass, so
 *  they sit above the low rumble. Nodes are short-lived and self-terminating. */
function chirp(actx: AudioContext, rng: Rng, dest: AudioNode, t0: number): void {
  const out = gain(actx, 0.5);
  const hp = biquad(actx, 'highpass', 1500, 0.7);
  out.connect(hp);
  hp.connect(dest);
  const syllables = 2 + (rng.u32() % 3);
  const base = rng.range(2600, 4200);
  let t = t0;
  for (let i = 0; i < syllables; i++) {
    const o = osc(actx, 'sine', base);
    const g = gain(actx, 0);
    const f0 = base * semis(rng.range(-2, 3));
    const f1 = f0 * semis(rng.range(2, 7)); // upward chirp
    sweep(o.frequency, t, f0, f1, 0.06);
    ad(g.gain, t, rng.range(0.12, 0.22), 0.006, 0.07);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.14);
    t += rng.range(0.08, 0.18);
  }
}

/**
 * Procedural ambient-city bed for first-person Walk mode (Web Audio, zero
 * assets). Harvest-not-embed: no engine, the caller drives resume/start/stop
 * from the R3F composition root. Its own AudioContext + master gain (like
 * useFootsteps) so it can sit UNDER the footsteps mix; SSR/jsdom-safe (no context
 * until `resume()`/`start()` runs in a browser), and the context is closed on
 * unmount.
 */
export function useAmbientCity(): UseAmbientCity {
  const s = useRef<AmbientState>({
    actx: null,
    master: null,
    bank: null,
    rng: null,
    running: false,
    nodes: [],
    sources: [],
    birdTimer: null,
    nextChirp: 0,
  }).current;

  // Lazily construct the context/master/bank. Returns false when Web Audio is
  // unavailable (SSR / jsdom), so every public method degrades to a no-op.
  const ensure = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const AC =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return false;
    if (!s.actx) {
      const actx = new AC({ latencyHint: 'interactive' });
      const master = gain(actx, 0) as GainNode; // silent until start() fades in
      master.connect(actx.destination);
      const rng = new Rng(0x0cea9b1d);
      // A longer bed (3.2 s) makes the loop point less obvious than footsteps'.
      const bank = new NoiseBank(actx, rng.fork(), 3.2);
      s.actx = actx;
      s.master = master;
      s.rng = rng;
      s.bank = bank;
    }
    return true;
  }, [s]);

  const resume = useCallback(() => {
    if (!ensure()) return;
    if (s.actx && s.actx.state === 'suspended') void s.actx.resume();
  }, [s, ensure]);

  const start = useCallback(() => {
    if (!ensure() || s.running) return;
    const actx = s.actx!;
    const bank = s.bank!;
    const rng = s.rng!;
    const master = s.master!;
    s.running = true;
    const now = actx.currentTime;

    // Wind — looping brown noise, low-passed, with a slow gust LFO on its gain.
    const wind = bank.source('brown', rng, 0.8, true);
    const windLP = biquad(actx, 'lowpass', 520, 0.6);
    const windGain = gain(actx, 0.16);
    series(wind, windLP, windGain).connect(master);
    const gust = osc(actx, 'sine', 0.07);
    const gustDepth = gain(actx, 0.09);
    gust.connect(gustDepth);
    gustDepth.connect(windGain.gain); // modulate 0.07..0.25
    wind.start(now);
    gust.start(now);

    // Distant traffic — looping pink noise, band-limited to a low rumble, with a
    // gentler swell LFO.
    const traf = bank.source('pink', rng, 0.6, true);
    const trafHP = biquad(actx, 'highpass', 45, 0.7);
    const trafLP = biquad(actx, 'lowpass', 340, 0.7);
    const trafGain = gain(actx, 0.13);
    series(traf, trafHP, trafLP, trafGain).connect(master);
    const swell = osc(actx, 'sine', 0.043);
    const swellDepth = gain(actx, 0.05);
    swell.connect(swellDepth);
    swellDepth.connect(trafGain.gain); // modulate 0.08..0.18
    traf.start(now);
    swell.start(now);

    // Master fade-in so entering Walk doesn't pop.
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.linearRampToValueAtTime(0.85, now + 2.5);

    s.sources.push(wind, gust, traf, swell);
    s.nodes.push(windLP, windGain, gustDepth, trafHP, trafLP, trafGain, swellDepth);

    // Birds — sparse lookahead scheduler (standard Web Audio pattern): schedule
    // chirps up to 1.5 s ahead, 4–11 s apart, only while the context is running.
    s.nextChirp = now + rng.range(2, 6);
    s.birdTimer = setInterval(() => {
      const a = s.actx;
      if (!a || a.state !== 'running' || !s.rng || !s.master) return;
      const ahead = a.currentTime + 1.5;
      let guard = 0;
      while (s.nextChirp < ahead && guard++ < 8) {
        chirp(a, s.rng, s.master, s.nextChirp);
        s.nextChirp += s.rng.range(4, 11);
      }
    }, 500);
  }, [s, ensure]);

  const stop = useCallback(() => {
    if (s.birdTimer) {
      clearInterval(s.birdTimer);
      s.birdTimer = null;
    }
    const actx = s.actx;
    if (!actx || !s.running) return;
    s.running = false;
    const now = actx.currentTime;
    if (s.master) {
      try {
        s.master.gain.cancelScheduledValues(now);
        s.master.gain.setValueAtTime(Math.max(s.master.gain.value, 0.0001), now);
        s.master.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      } catch {
        /* param already detached */
      }
    }
    const nodes = s.nodes;
    const sources = s.sources;
    s.nodes = [];
    s.sources = [];
    for (const src of sources) {
      try {
        src.stop(now + 0.55);
      } catch {
        /* already stopped */
      }
    }
    // Disconnect the graph after the fade completes.
    setTimeout(() => {
      for (const src of sources) {
        try {
          src.disconnect();
        } catch {
          /* noop */
        }
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          /* noop */
        }
      }
    }, 700);
  }, [s]);

  useEffect(
    () => () => {
      if (s.birdTimer) {
        clearInterval(s.birdTimer);
        s.birdTimer = null;
      }
      for (const src of s.sources) {
        try {
          src.stop();
        } catch {
          /* noop */
        }
      }
      for (const n of s.nodes) {
        try {
          n.disconnect();
        } catch {
          /* noop */
        }
      }
      s.nodes = [];
      s.sources = [];
      s.bank?.dispose();
      if (s.actx && s.actx.state !== 'closed') void s.actx.close();
      s.actx = null;
      s.master = null;
      s.bank = null;
      s.rng = null;
      s.running = false;
    },
    [s]
  );

  return { resume, start, stop };
}
