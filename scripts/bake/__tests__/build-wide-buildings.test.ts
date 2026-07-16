import { describe, it, expect } from 'vitest';
import { buildWideBuildings } from '../build-wide-buildings';

const box = { swLat: 35.0078, swLon: -85.345, neLat: 35.076, neLon: -85.283 };

// A minimal Overpass way: a square footprint, tagged.
const way = (
  id: number,
  lon: number,
  lat: number,
  tags: Record<string, string>
) => ({
  type: 'way' as const,
  id,
  tags,
  geometry: [
    { lat, lon },
    { lat, lon: lon + 0.0001 },
    { lat: lat + 0.0001, lon: lon + 0.0001 },
    { lat, lon },
  ],
});

describe('buildWideBuildings', () => {
  it('keeps the BAKED height inside the baked box — a lidar roof is a measurement', () => {
    const osm = { elements: [way(1, -85.31, 35.02, { building: 'yes' })] };
    const baked = [{ id: 1, ring: [], height: 42.5, rule: 'lidar' }];
    const [b] = buildWideBuildings(osm as never, baked as never, box);
    expect(b.heightM).toBe(42.5);
    expect(b.rule).toBe('lidar');
    expect(b.baked).toBe(true);
  });

  it('derives height from tags OUTSIDE the baked box, via the same ladder', () => {
    const osm = {
      elements: [way(2, -85.34, 35.07, { building: 'yes', height: '30' })],
    };
    const [b] = buildWideBuildings(osm as never, [] as never, box);
    expect(b.heightM).toBeCloseTo(30, 1);
    expect(b.baked).toBe(false);
  });

  it('emits raw lon/lat — NOT ENU. The atlas has no vectorOffsetM to unwind', () => {
    const osm = { elements: [way(3, -85.31, 35.02, { building: 'yes' })] };
    const [b] = buildWideBuildings(osm as never, [] as never, box);
    expect(b.lonLat[0]).toBeCloseTo(-85.31, 4);
    expect(b.lonLat[1]).toBeCloseTo(35.02, 4);
  });

  it('does NOT box-clip: a building outside site.box but inside the atlas box survives', () => {
    // -85.34 is outside site.box (swLon -85.316) but inside atlasBox (swLon -85.345).
    // This is the whole point of the wide bake; build-scene.ts's inBox would drop it.
    const osm = { elements: [way(4, -85.34, 35.07, { building: 'yes' })] };
    expect(buildWideBuildings(osm as never, [] as never, box)).toHaveLength(1);
  });

  it('ignores non-building ways — the query is wide, the output is not', () => {
    const osm = {
      elements: [way(5, -85.31, 35.02, { highway: 'residential' })],
    };
    expect(buildWideBuildings(osm as never, [] as never, box)).toEqual([]);
  });
});
