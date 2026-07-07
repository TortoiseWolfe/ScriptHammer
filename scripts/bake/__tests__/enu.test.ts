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
  it('applies cos(lat) to longitude metres/degree', () => {
    expect(M_PER_DEG_LON).toBeCloseTo(91150, 0); // 111320 * cos(35.0339°)
    expect(M_PER_DEG_LAT).toBe(110574);
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
  it('reports true ground size in metres (~1458 x 5772, Choo-Choo corridor)', () => {
    const { widthM, depthM } = enuGroundSize();
    expect(widthM).toBeCloseTo(1458, -1);
    expect(depthM).toBeCloseTo(5772, -1);
  });
});
