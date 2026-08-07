/**
 * useAmbientCity — unit test.
 *
 * jsdom has no Web Audio (`window.AudioContext` is undefined), so the hook's
 * guards make `resume()`/`start()`/`stop()` safe no-ops — the same "no-op, don't
 * throw" contract useFootsteps relies on. Audible correctness (wind + distant
 * traffic + birds) is verified in a real browser (Playwright).
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAmbientCity, planVehiclePass, VEHICLE_PEAK_CEIL } from './ambientCity';
import { Rng } from './rng';

describe('planVehiclePass — passing-vehicle recipe (pure, deterministic)', () => {
  it('is deterministic for a given seed', () => {
    const a = planVehiclePass(new Rng(0x1234));
    const b = planVehiclePass(new Rng(0x1234));
    expect(a).toEqual(b);
  });

  it('stays subtle — peak is a positive gain at or under the bed ceiling', () => {
    // The audible guarantee that vehicles never mask the footsteps.
    for (let seed = 1; seed <= 200; seed++) {
      const p = planVehiclePass(new Rng(seed));
      expect(p.peak).toBeGreaterThan(0);
      expect(p.peak).toBeLessThanOrEqual(VEHICLE_PEAK_CEIL);
    }
  });

  it('sweeps fully across the stereo field (panFrom = −panTo, |pan| = 1)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = planVehiclePass(new Rng(seed));
      expect(Math.abs(p.panFrom)).toBe(1);
      expect(Math.abs(p.panTo)).toBe(1);
      expect(p.panFrom).toBe(-p.panTo);
      expect(p.panTo).toBe(p.dir);
    }
  });

  it('Doppler-shifts downward (approaching rate > receding rate), both near unity', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = planVehiclePass(new Rng(seed));
      expect(p.rateFrom).toBeGreaterThan(p.rateTo);
      // Subtle — a pass, not a race car.
      expect(p.rateFrom).toBeLessThan(1.2);
      expect(p.rateTo).toBeGreaterThan(0.85);
    }
  });

  it('has a plausible pass duration and engine-body band', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = planVehiclePass(new Rng(seed));
      expect(p.dur).toBeGreaterThanOrEqual(2.6);
      expect(p.dur).toBeLessThanOrEqual(4.0);
      expect(p.band).toBeGreaterThanOrEqual(150);
      expect(p.band).toBeLessThanOrEqual(260);
    }
  });
});

describe('useAmbientCity', () => {
  it('returns resume + start + stop callbacks', () => {
    const { result } = renderHook(() => useAmbientCity());
    expect(typeof result.current.resume).toBe('function');
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });

  it('is a silent no-op without Web Audio (jsdom) — never throws', () => {
    const { result, unmount } = renderHook(() => useAmbientCity());
    expect(() => {
      result.current.start(); // start before resume must not throw
      result.current.resume();
      result.current.stop();
      result.current.stop(); // idempotent
      unmount();
    }).not.toThrow();
  });
});
