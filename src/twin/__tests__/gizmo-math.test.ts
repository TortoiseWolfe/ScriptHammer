// #259 iteration 4/5 — the gizmo's drag → override conversion. Yaw must
// never export accumulated full turns (spin the ring 3× and the JSON should
// still read like a human wrote it), and the translate patch is deltas from
// the UN-overridden anchor at button-grain rounding.

import { describe, it, expect } from 'vitest';
import { computeGizmoPatch, normalizeDeg } from '../WarehouseGizmo';

describe('normalizeDeg', () => {
  it('passes already-normal angles through', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(15)).toBe(15);
    expect(normalizeDeg(-90)).toBe(-90);
  });

  it('wraps full turns', () => {
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(725)).toBe(5);
    expect(normalizeDeg(-370)).toBe(-10);
  });

  it('maps the ±180 seam to +180', () => {
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(540)).toBe(180);
  });
});

describe('computeGizmoPatch', () => {
  const base = { x: 100, z: -200 };

  it('translate: dx/dz deltas from the base anchor, 0.1m rounding', () => {
    const target = {
      position: { x: 112.64, z: -208.01 },
      rotation: { y: 0 },
    };
    expect(computeGizmoPatch(target, base, 'translate')).toEqual({
      dx: 12.6,
      dz: -8,
    });
  });

  it('rotate: absolute normalized yaw in degrees, 0.1° rounding', () => {
    const target = {
      position: { x: 100, z: -200 },
      rotation: { y: Math.PI / 2 },
    };
    expect(computeGizmoPatch(target, base, 'rotate')).toEqual({ yawDeg: 90 });
  });

  it('rotate: a full extra turn exports the same yaw', () => {
    const target = {
      position: { x: 100, z: -200 },
      rotation: { y: Math.PI / 2 + 2 * Math.PI },
    };
    expect(computeGizmoPatch(target, base, 'rotate')).toEqual({ yawDeg: 90 });
  });
});
