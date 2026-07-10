// #259 iteration 2 — applyOverrides is the durable-tuning merge point:
// the emit script runs every entry through it, so hand-tuned placement
// survives pipeline re-runs.

import { describe, it, expect } from 'vitest';
import { applyOverrides } from '../lib';

const entry = { slug: 'walnut-street-bridge', x: 36.7, z: -2451.4, yawDeg: 0 };

describe('applyOverrides', () => {
  it('passes entries through untouched with no override', () => {
    expect(applyOverrides(entry, undefined)).toEqual(entry);
  });

  it('replaces yaw/scale/yOffset outright', () => {
    const out = applyOverrides(entry, {
      yawDeg: 15,
      scale: 1.05,
      yOffset: -0.5,
    });
    expect(out).toMatchObject({ yawDeg: 15, scale: 1.05, yOffset: -0.5 });
    expect(out?.x).toBe(36.7);
  });

  it('adds dx/dz nudges to the projected anchor', () => {
    const out = applyOverrides(entry, { dx: 2.5, dz: -1 });
    expect(out?.x).toBe(39.2);
    expect(out?.z).toBe(-2452.4);
    expect(out?.yawDeg).toBe(0); // untouched
  });

  it('excludes a model entirely', () => {
    expect(applyOverrides(entry, { exclude: true })).toBeNull();
  });

  it('does not mutate the input entry', () => {
    applyOverrides(entry, { dx: 100, yawDeg: 90 });
    expect(entry.x).toBe(36.7);
    expect(entry.yawDeg).toBe(0);
  });
});
