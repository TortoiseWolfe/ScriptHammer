import { describe, it, expect } from 'vitest';
import {
  BOX,
  M_PER_DEG_LON,
  M_PER_DEG_LAT,
  lonLatToEnu,
  enuGroundSize,
} from '../enu';

describe('ENU projection', () => {
  it('locks the box constants', () => {
    expect(BOX.swLat).toBe(35.0078);
    expect(BOX.neLon).toBe(-85.3);
    expect(BOX.centerLat).toBeCloseTo(35.0339, 4);
    expect(BOX.centerLon).toBeCloseTo(-85.308, 4);
  });
  it('uses WGS-84 arc lengths at the box latitude (not equator/spherical values)', () => {
    // Truncated WGS-84 series at 35.0339°N. The old constants (110574 equator
    // m/deg lat; 111320·cos φ spherical lon) compressed the model 0.33% N-S
    // (~19 m over the corridor) — see #229.
    expect(M_PER_DEG_LAT).toBeCloseTo(110941, 0);
    expect(M_PER_DEG_LON).toBeCloseTo(91250, 0);
  });
  it('puts the box center at the origin', () => {
    const [x, z] = lonLatToEnu(BOX.centerLon, BOX.centerLat);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });
  it('projects north as -Z and east as +X', () => {
    const [, zN] = lonLatToEnu(BOX.centerLon, BOX.neLat); // north edge
    const [xE] = lonLatToEnu(BOX.neLon, BOX.centerLat); // east edge
    expect(zN).toBeLessThan(0); // north => -Z
    expect(xE).toBeGreaterThan(0); // east => +X
  });
  it('reports true ground size in metres (~1460 x 5791, Choo-Choo corridor)', () => {
    const { widthM, depthM } = enuGroundSize();
    expect(widthM).toBeCloseTo(1460, -1);
    expect(depthM).toBeCloseTo(5791, -1);
  });
});
