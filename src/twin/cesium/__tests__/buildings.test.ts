import { describe, it, expect } from 'vitest';
import {
  groundEllipsoidHeightM,
  typeBucket,
  unbucketedLadderTypes,
  heightBand,
  classify,
  TYPE_COLORS,
  RULE_COLORS,
  type AtlasBuilding,
} from '../buildings';

const b = (over: Partial<AtlasBuilding> = {}): AtlasBuilding => ({
  id: 1,
  lonLat: [0, 0, 1, 0, 1, 1, 0, 1],
  heightM: 10,
  rule: 'lidar',
  ...over,
});

describe('typeBucket', () => {
  // The real distribution in the baked box (_raw/osm.json, ~1547 buildings).
  // 1316 of them — 85% — are `building=yes`. That is why 'untyped' is a
  // first-class bucket with its own drab colour and why `type` is not the
  // default colour mode: it would paint most of the city one colour.
  it('treats building=yes as untyped — it asserts existence, not a type', () => {
    expect(typeBucket({ building: 'yes' })).toBe('untyped');
    expect(typeBucket({})).toBe('untyped');
    expect(typeBucket(undefined)).toBe('untyped');
  });

  it('buckets every building=* value actually present in the box', () => {
    // Lifted verbatim from the tag census, most common first.
    const census: [string, string][] = [
      ['house', 'residential'],
      ['retail', 'commercial'],
      ['apartments', 'residential'],
      ['detached', 'residential'],
      ['office', 'commercial'],
      ['parking', 'ancillary'],
      ['church', 'civic'],
      ['garage', 'ancillary'],
      ['dormitory', 'residential'],
      ['roof', 'ancillary'],
      ['terrace', 'residential'],
      ['grandstand', 'civic'],
      ['commercial', 'commercial'],
      ['university', 'civic'],
      ['government', 'civic'],
      ['greenhouse', 'industrial'],
      ['warehouse', 'industrial'],
      ['school', 'civic'],
      ['pavilion', 'ancillary'],
      ['public', 'civic'],
      ['industrial', 'industrial'],
      ['residential', 'residential'],
      ['hospital', 'civic'],
      ['hotel', 'residential'],
    ];
    for (const [tag, bucket] of census) {
      expect(typeBucket({ building: tag }), `building=${tag}`).toBe(bucket);
    }
  });

  it('an unknown building=* value degrades to untyped, never crashes', () => {
    expect(typeBucket({ building: 'ship' })).toBe('untyped'); // real: 1 in the box
    expect(typeBucket({ building: 'wat' })).toBe('untyped');
  });

  it('every type the HEIGHT LADDER knows is bucketed by the LEGEND', () => {
    // The drift guard. src/lib/height.ts's LEVEL_PRIORS decides how tall an
    // untagged building of type X is; TYPE_BUCKETS decides what colour it is.
    // A key in one and not the other means the two are describing different
    // cities — which is exactly why LEVEL_PRIORS is exported rather than copied.
    expect(unbucketedLadderTypes()).toEqual([]);
  });

  it('every bucket has a colour and they are distinct', () => {
    const keys = Object.keys(TYPE_COLORS);
    expect(new Set(Object.values(TYPE_COLORS)).size).toBe(keys.length);
    for (const k of keys) expect(TYPE_COLORS[k]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('heightBand', () => {
  it('bands cover the range with no gap, including the tallest tower', () => {
    expect(heightBand(0).key).toBe('0-8 m');
    expect(heightBand(7.9).key).toBe('0-8 m');
    expect(heightBand(8).key).toBe('8-18 m'); // boundary is exclusive-below
    expect(heightBand(34.9).key).toBe('18-35 m');
    expect(heightBand(91.4).key).toBe('60 m+'); // Republic Centre
    expect(heightBand(1e6).key).toBe('60 m+'); // never undefined
  });
});

describe('classify', () => {
  it('provenance mode keys on the height rule', () => {
    const c = classify(b({ rule: 'lidar' }), 'provenance');
    expect(c.key).toBe('lidar');
    expect(c.color).toBe(RULE_COLORS.lidar);
    expect(c.label).toMatch(/measured/i);
  });

  it('type mode keys on the OSM tag, independent of the height rule', () => {
    // A lidar-measured house is still residential: the two axes are orthogonal,
    // which is the whole point of having both modes.
    const c = classify(
      b({ rule: 'lidar', tags: { building: 'house' } }),
      'type'
    );
    expect(c.key).toBe('residential');
    expect(c.color).toBe(TYPE_COLORS.residential);
  });

  it('height mode keys on metres, independent of tags and rule', () => {
    const c = classify(b({ heightM: 91.4, rule: 'height' }), 'height');
    expect(c.key).toBe('60 m+');
  });

  it('a baked building with no tags still classifies in every mode', () => {
    // buildings.json carries no tags by design; the baked-only pass (and the
    // Overpass-unreachable path) must not throw or render a blank legend.
    for (const mode of ['provenance', 'type', 'height'] as const) {
      const c = classify(b({ tags: undefined }), mode);
      expect(c.key).toBeTruthy();
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.label).toBeTruthy();
    }
  });
});

describe('groundEllipsoidHeightM', () => {
  // A 20 m square footprint. lonLat is flat [lon, lat, ...].
  const D = 0.0002; // ~20 m
  const sq = (lon0: number, lat0: number): AtlasBuilding =>
    b({
      lonLat: [lon0, lat0, lon0 + D, lat0, lon0 + D, lat0 + D, lon0, lat0 + D],
    });
  // Ground rises 100 m per 0.001 deg of longitude — a steep hillside.
  const slope = (lon: number) => 1000 + (lon - -85.3) * 100000;

  it('THE INVARIANT: the base never sits above the ground under any vertex', () => {
    // This is the whole bug. A base above any of its own vertices means that
    // corner of the building is hanging in the air.
    const bld = sq(-85.3, 35.03);
    const base = groundEllipsoidHeightM(bld, (lon) => slope(lon));
    for (let i = 0; i < bld.lonLat.length; i += 2) {
      expect(base).toBeLessThanOrEqual(slope(bld.lonLat[i]) + 1e-9);
    }
  });

  it('returns the ring MIN on a slope, not the centroid mean', () => {
    const bld = sq(-85.3, 35.03);
    const base = groundEllipsoidHeightM(bld, (lon) => slope(lon));
    const min = slope(-85.3);
    const mean = slope(-85.3 + D / 2); // what the old centroid version returned
    expect(base).toBeCloseTo(min, 6);
    expect(base).toBeLessThan(mean);
    // and the gap is exactly what used to float: 10 m over a 20 m footprint here
    expect(mean - base).toBeCloseTo(10, 6);
  });

  it('equals the centroid on flat ground (no penalty where it does not matter)', () => {
    const base = groundEllipsoidHeightM(sq(-85.3, 35.03), () => 176);
    expect(base).toBe(176);
  });

  it('samples every vertex — a min hiding in one corner still wins', () => {
    const bld = sq(-85.3, 35.03);
    const seen: number[] = [];
    groundEllipsoidHeightM(bld, (lon, lat) => {
      seen.push(lon);
      // dip under exactly one corner, the last one visited
      return lon === -85.3 && lat === 35.03 + D ? 1 : 500;
    });
    expect(seen.length).toBe(4);
    expect(
      groundEllipsoidHeightM(bld, (lon, lat) =>
        lon === -85.3 && lat === 35.03 + D ? 1 : 500
      )
    ).toBe(1);
  });

  it('a degenerate ring falls back to the ellipsoid, not Infinity', () => {
    // Extruding from Infinity vanishes the building instead of failing loudly.
    expect(groundEllipsoidHeightM(b({ lonLat: [] }), () => 176)).toBe(0);
  });
});
