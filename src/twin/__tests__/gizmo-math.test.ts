// #259 iteration 4 — the gizmo's yaw commit must never export accumulated
// full turns (spin the ring 3× and the JSON should still read like a human
// wrote it).

import { describe, it, expect } from 'vitest';
import { normalizeDeg } from '../WarehouseGizmo';

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
