import { describe, it, expect } from 'vitest';
import { createProjection, metersPerDegree, type GeoBox } from '../enu';

// The forward transform + metersPerDegree series are covered by
// scripts/bake/__tests__/enu.test.ts (which imports through the pipeline
// re-export, proving the shim). This file pins the INVERSE — the transform the
// Cesium atlas layer depends on to put 1510 baked buildings back on the globe.
//
// The failure mode this guards is silent: a sign flip or a dropped offset does
// not throw, it just puts the whole city somewhere else.

const CHATT_BOX: GeoBox = {
  swLat: 35.0078,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
};
// sites/chatt.json:139 — the #233 measured vector correction, baked into every
// ring in public/twins/chatt/buildings.json.
const CHATT_OFFSET = { x: 0.5, z: 0 };

describe('enuToLonLat', () => {
  const proj = createProjection(CHATT_BOX);

  it('round-trips lonLatToEnu exactly, across the whole box', () => {
    const pts: [number, number][] = [
      [CHATT_BOX.swLon, CHATT_BOX.swLat],
      [CHATT_BOX.neLon, CHATT_BOX.neLat],
      [CHATT_BOX.swLon, CHATT_BOX.neLat],
      [CHATT_BOX.neLon, CHATT_BOX.swLat],
      [proj.centerLon, proj.centerLat],
      [-85.3097, 35.0498], // downtown
      [-85.3086, 35.0093], // Choo Choo, far south of the corridor
    ];
    for (const [lon, lat] of pts) {
      const [x, z] = proj.lonLatToEnu(lon, lat);
      const [lon2, lat2] = proj.enuToLonLat(x, z);
      expect(lon2).toBeCloseTo(lon, 9);
      expect(lat2).toBeCloseTo(lat, 9);
    }
  });

  it('round-trips with a non-zero vectorOffsetM (the offset cancels)', () => {
    const shifted = createProjection(CHATT_BOX, { x: 3.5, z: -1.5 });
    const [x, z] = shifted.lonLatToEnu(-85.31, 35.02);
    const [lon, lat] = shifted.enuToLonLat(x, z);
    expect(lon).toBeCloseTo(-85.31, 9);
    expect(lat).toBeCloseTo(35.02, 9);
  });

  it('actually subtracts the offset rather than ignoring it', () => {
    // Same ENU input, different offsets => different real-world coords. If the
    // inverse dropped offsetM these would be identical and the round-trip test
    // above would still pass (the offset cancels itself there) — hence this
    // case.
    //
    // Reading the signs: an offset of {x:10, z:-10} means the bake added that
    // vector to every projected point. So ENU (100,100) in the offset frame is
    // the same real place as ENU (90,110) in the unshifted frame — 10 m less
    // east, and 10 m more +Z, which is 10 m further SOUTH (north = -Z).
    // Therefore A sits 10 m east and 10 m north of B.
    const a = createProjection(CHATT_BOX, { x: 0, z: 0 });
    const b = createProjection(CHATT_BOX, { x: 10, z: -10 });
    const [lonA, latA] = a.enuToLonLat(100, 100);
    const [lonB, latB] = b.enuToLonLat(100, 100);
    expect((lonA - lonB) * proj.mPerDegLon).toBeCloseTo(10, 6); // A is 10 m east
    expect((latA - latB) * proj.mPerDegLat).toBeCloseTo(10, 6); // A is 10 m north
  });

  it('inverts the sign conventions: -Z is north, +X is east', () => {
    const [, latN] = proj.enuToLonLat(0, -1000); // 1 km of -Z
    const [lonE] = proj.enuToLonLat(1000, 0); // 1 km of +X
    expect(latN).toBeGreaterThan(proj.centerLat); // -Z => north
    expect(lonE).toBeGreaterThan(proj.centerLon); // +X => east
    // and the magnitudes are true metres at this latitude
    expect((latN - proj.centerLat) * proj.mPerDegLat).toBeCloseTo(1000, 6);
  });

  it('is exact at the origin', () => {
    const [lon, lat] = createProjection(CHATT_BOX).enuToLonLat(0, 0);
    expect(lon).toBeCloseTo(proj.centerLon, 12);
    expect(lat).toBeCloseTo(proj.centerLat, 12);
  });

  // ── Golden: real baked data → real OSM coordinates ────────────────────────
  // The end-to-end proof, using values lifted from the actual artifacts rather
  // than round-tripping our own arithmetic:
  //   public/twins/chatt/buildings.json  way 66951392 (Republic Centre) ring[0]
  //   public/twins/chatt/_raw/osm.json   the same way's geometry[0]
  // Hardcoded because _raw/ is gitignored (local-only), and a golden that skips
  // in CI guards nothing.
  it('golden: the baked Republic Centre ring inverts to its true OSM lon/lat', () => {
    const baked = createProjection(CHATT_BOX, CHATT_OFFSET);
    const RING0_X = -408.4; // buildings.json, ENU metres
    const RING0_Z = -1608;
    const TRUE_LON = -85.3124815; // _raw/osm.json, way 66951392 geometry[0]
    const TRUE_LAT = 35.0483945;

    const [lon, lat] = baked.enuToLonLat(RING0_X, RING0_Z);
    const errEastM = (lon - TRUE_LON) * baked.mPerDegLon;
    const errNorthM = (lat - TRUE_LAT) * baked.mPerDegLat;

    // Baked rings are quantized to 0.1 m, so ±0.05 m per axis is the FLOOR of
    // what any exact inverse can achieve here — this asserts we are at that
    // floor, not merely "close". A dropped offsetM would show as ~0.5 m east.
    expect(Math.abs(errEastM)).toBeLessThan(0.05);
    expect(Math.abs(errNorthM)).toBeLessThan(0.05);
  });

  it('golden: dropping vectorOffsetM is detectable at this precision', () => {
    // Guards the subtle half of the contract. Inverting baked geometry with a
    // zero-offset projection misplaces it by exactly the offset (0.5 m east) —
    // ten times the quantization floor above, so the golden can see it.
    const wrong = createProjection(CHATT_BOX); // offset omitted — the bug
    const [lon] = wrong.enuToLonLat(-408.4, -1608);
    const errEastM = (lon - -85.3124815) * wrong.mPerDegLon;
    expect(errEastM).toBeCloseTo(CHATT_OFFSET.x, 1);
    expect(Math.abs(errEastM)).toBeGreaterThan(0.05);
  });
});

describe('metersPerDegree is shared, not re-derived', () => {
  it('matches what the manifest recorded for the chatt box', () => {
    // manifest.groundWm = 1460 over a 0.016° span. If a consumer re-derived
    // mPerDegLon as groundWm/Δlon instead of using this series, it would agree
    // here by construction — this asserts the series itself produces it, so the
    // atlas and the bake cannot drift apart.
    const { mPerDegLon } = metersPerDegree(35.0339);
    expect(mPerDegLon * 0.016).toBeCloseTo(1460, 0);
  });
});
