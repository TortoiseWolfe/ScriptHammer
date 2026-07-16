import { describe, it, expect } from 'vitest';
import { buildWideBuildings } from '../build-wide-buildings';

// The scalar a caller must pass — manifest.cosLat for chatt (narrow
// site.box, centerLat 35.0339): proj.mPerDegLon(35.0339) / 111320. Fixed to
// a real value rather than derived in-line here, so these tests pin the same
// contract callers must honor (Finding 1, #292 review) instead of silently
// re-deriving their own.
const cosLat = 0.8197131890928896;

// A minimal Overpass way: a square footprint, tagged.
const way = (
  id: number,
  lon: number,
  lat: number,
  tags: Record<string, string>,
  sizeDeg = 0.0001
) => ({
  type: 'way' as const,
  id,
  tags,
  geometry: [
    { lat, lon },
    { lat, lon: lon + sizeDeg },
    { lat: lat + sizeDeg, lon: lon + sizeDeg },
    { lat, lon },
  ],
});

describe('buildWideBuildings', () => {
  it('keeps the BAKED height inside the baked box — a lidar roof is a measurement', () => {
    const osm = { elements: [way(1, -85.31, 35.02, { building: 'yes' })] };
    const baked = [{ id: 1, ring: [], height: 42.5, rule: 'lidar' }];
    const [b] = buildWideBuildings(osm as never, baked as never, cosLat);
    expect(b.heightM).toBe(42.5);
    expect(b.rule).toBe('lidar');
    expect(b.baked).toBe(true);
  });

  it('derives height from tags OUTSIDE the baked box, via the same ladder', () => {
    const osm = {
      elements: [way(2, -85.34, 35.07, { building: 'yes', height: '30' })],
    };
    const [b] = buildWideBuildings(osm as never, [] as never, cosLat);
    expect(b.heightM).toBeCloseTo(30, 1);
    expect(b.baked).toBe(false);
  });

  it('emits raw lon/lat — NOT ENU. The atlas has no vectorOffsetM to unwind', () => {
    const osm = { elements: [way(3, -85.31, 35.02, { building: 'yes' })] };
    const [b] = buildWideBuildings(osm as never, [] as never, cosLat);
    expect(b.lonLat[0]).toBeCloseTo(-85.31, 4);
    expect(b.lonLat[1]).toBeCloseTo(35.02, 4);
  });

  it('does NOT box-clip: a building outside site.box but inside the atlas box survives', () => {
    // -85.34 is outside site.box (swLon -85.316) but inside atlasBox (swLon -85.345).
    // This is the whole point of the wide bake; build-scene.ts's inBox would drop it.
    const osm = { elements: [way(4, -85.34, 35.07, { building: 'yes' })] };
    expect(buildWideBuildings(osm as never, [] as never, cosLat)).toHaveLength(
      1
    );
  });

  it('ignores non-building ways — the query is wide, the output is not', () => {
    const osm = {
      elements: [way(5, -85.31, 35.02, { highway: 'residential' })],
    };
    expect(buildWideBuildings(osm as never, [] as never, cosLat)).toEqual([]);
  });

  it("un-baked, untagged (no height/levels) building hits resolveHeight's rule-6 area bonus", () => {
    // A ~0.001deg right-triangle footprint (the `way` helper's ring is 3
    // unique vertices) is ~5079 m2 at this cosLat -- comfortably over the
    // 3000 m2 top tier, so the fallback ladder's area bonus (+6 levels) must
    // fire. No height/levels/name tag: only `resolveHeight`'s rule 6 can
    // produce a height here, and only the area bonus can push it above the
    // bare `building: yes` prior (3 levels * 3.2m = 9.6m).
    const osm = {
      elements: [way(6, -85.31, 35.02, { building: 'yes' }, 0.001)],
    };
    const [b] = buildWideBuildings(osm as never, [] as never, cosLat);
    expect(b.rule).toBe('fallback');
    expect(b.baked).toBe(false);
    // (3 prior + 6 area-bonus levels) * 3.2m/level = 28.8m, well above the
    // no-bonus prior of 9.6m -- proves the area bonus actually fired.
    expect(b.heightM).toBeCloseTo(28.8, 1);
  });

  it('threading cosLat through changes the resolved area-bonus tier', () => {
    // Same footprint (~5079 m2 at the real cosLat, tier +6), a halved cosLat
    // must land in a DIFFERENT tier (~2540 m2, tier +4) -- otherwise
    // buildWideBuildings is silently ignoring its cosLat argument, which is
    // exactly Finding 1's regression (recomputing cosLat from the wide
    // atlasBox instead of using the caller-supplied runtime scalar).
    const osm = {
      elements: [way(7, -85.31, 35.02, { building: 'yes' }, 0.001)],
    };
    const atRealCosLat = buildWideBuildings(
      osm as never,
      [] as never,
      cosLat
    )[0];
    const atHalvedCosLat = buildWideBuildings(
      osm as never,
      [] as never,
      cosLat / 2
    )[0];
    expect(atRealCosLat.heightM).toBeCloseTo(28.8, 1);
    expect(atHalvedCosLat.heightM).toBeCloseTo(22.4, 1);
    expect(atHalvedCosLat.heightM).not.toBe(atRealCosLat.heightM);
  });
});
