import { describe, it, expect } from 'vitest';
import {
  metersPerDegree,
  createProjection,
  boxFromCenter,
  type GeoBox,
} from '../enu';

// The flagship box (also pinned in sites/chatt.json — golden-chatt.test.ts
// asserts the two stay in sync).
const CHATT_BOX: GeoBox = {
  swLat: 35.0078,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
};

describe('metersPerDegree (WGS-84 truncated series)', () => {
  it('matches the true arc lengths at 35°N (not equator/spherical values)', () => {
    // The old constants (110574 equator m/deg lat; 111320·cos φ spherical lon)
    // compressed the model 0.33% N-S (~19 m over the corridor) — see #229.
    const { mPerDegLat, mPerDegLon } = metersPerDegree(35.0339);
    expect(mPerDegLat).toBeCloseTo(110941, 0);
    expect(mPerDegLon).toBeCloseTo(91250, 0);
  });
  it('gives the equator figure at 0°', () => {
    const { mPerDegLat } = metersPerDegree(0);
    expect(mPerDegLat).toBeCloseTo(110574, 0);
  });
});

describe('createProjection', () => {
  const proj = createProjection(CHATT_BOX);

  it('derives the centre from the box', () => {
    expect(proj.centerLat).toBeCloseTo(35.0339, 4);
    expect(proj.centerLon).toBeCloseTo(-85.308, 4);
  });
  it('puts the box center at the origin', () => {
    const [x, z] = proj.lonLatToEnu(proj.centerLon, proj.centerLat);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });
  it('projects north as -Z and east as +X', () => {
    const [, zN] = proj.lonLatToEnu(proj.centerLon, CHATT_BOX.neLat);
    const [xE] = proj.lonLatToEnu(CHATT_BOX.neLon, proj.centerLat);
    expect(zN).toBeLessThan(0); // north => -Z
    expect(xE).toBeGreaterThan(0); // east => +X
  });
  it('reports true ground size in metres (~1460 x 5791, Choo-Choo corridor)', () => {
    const { widthM, depthM } = proj.groundSize();
    expect(widthM).toBeCloseTo(1460, -1);
    expect(depthM).toBeCloseTo(5791, -1);
  });
  it('is a pure factory — two boxes coexist in one process', () => {
    const other = createProjection({
      swLat: -0.01,
      swLon: -0.01,
      neLat: 0.01,
      neLon: 0.01,
    });
    expect(other.mPerDegLat).toBeCloseTo(110574, 0); // equator
    expect(proj.mPerDegLat).toBeCloseTo(110941, 0); // still 35°N
  });

  it('vectorOffsetM shifts EVERY lonLatToEnu output, nothing else (#233)', () => {
    const shifted = createProjection(CHATT_BOX, { x: 3.5, z: -1.5 });
    const [x0, z0] = proj.lonLatToEnu(-85.31, 35.02);
    const [x1, z1] = shifted.lonLatToEnu(-85.31, 35.02);
    expect(x1 - x0).toBeCloseTo(3.5, 10);
    expect(z1 - z0).toBeCloseTo(-1.5, 10);
    // the origin moves WITH the vectors (it's a vector-layer correction)
    const [cx, cz] = shifted.lonLatToEnu(shifted.centerLon, shifted.centerLat);
    expect(cx).toBeCloseTo(3.5, 6);
    expect(cz).toBeCloseTo(-1.5, 6);
    // ground extents (the drape/terrain mapping) are untouched
    expect(shifted.groundSize()).toEqual(proj.groundSize());
    expect(shifted.offsetM).toEqual({ x: 3.5, z: -1.5 });
    // default = zero offset, and the default projection reports it
    expect(proj.offsetM).toEqual({ x: 0, z: 0 });
  });
});

describe('boxFromCenter', () => {
  it('round-trips: the derived box has the requested metric extents and centre', () => {
    const box = boxFromCenter(35.0563, -85.3111, 1600, 900);
    const proj = createProjection(box);
    const { widthM, depthM } = proj.groundSize();
    expect(widthM).toBeCloseTo(1600, 6);
    expect(depthM).toBeCloseTo(900, 6);
    expect(proj.centerLat).toBeCloseTo(35.0563, 10);
    expect(proj.centerLon).toBeCloseTo(-85.3111, 10);
  });
});
