import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLOR_BY,
  groundSpanM,
  typeBucket,
  unbucketedLadderTypes,
  heightBand,
  classify,
  TYPE_COLORS,
  RULE_COLORS,
  type AtlasBuilding,
  type ColorBy,
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

describe('groundSpanM', () => {
  const D = 0.0002; // ~20 m square footprint
  const sq = (lon0: number, lat0: number, h = 10): AtlasBuilding =>
    b({
      heightM: h,
      lonLat: [lon0, lat0, lon0 + D, lat0, lon0 + D, lat0 + D, lon0, lat0 + D],
    });
  // Ground climbs 100 m per 0.001 deg lon => 20 m across this footprint. A
  // Tennessee bluff: steeper than a 10 m building is tall, which is exactly the
  // case the min-base rule buried.
  const slope = (lon: number) => 1000 + (lon - -85.3) * 100000;
  const vertices = (bld: AtlasBuilding) => {
    const out: { lon: number; lat: number }[] = [];
    for (let i = 0; i < bld.lonLat.length; i += 2)
      out.push({ lon: bld.lonLat[i], lat: bld.lonLat[i + 1] });
    return out;
  };

  // BOTH invariants, together. Every previous fix satisfied one and broke the
  // other: centroid+height floated 7966 of 8031 buildings; min+height then
  // buried them under bluffs. Asserting only one is how that happened twice.
  it('INVARIANT 1: the base is under every vertex — nothing can float', () => {
    const bld = sq(-85.3, 35.03);
    const { baseM } = groundSpanM(bld, (lon: number) => slope(lon));
    for (const v of vertices(bld)) {
      expect(baseM).toBeLessThanOrEqual(slope(v.lon) + 1e-9);
    }
  });

  it('INVARIANT 2: the top clears every vertex by heightM — nothing can bury', () => {
    const bld = sq(-85.3, 35.03, 10); // 10 m building on 20 m of climb
    const { topM } = groundSpanM(bld, (lon: number) => slope(lon));
    for (const v of vertices(bld)) {
      expect(topM).toBeGreaterThanOrEqual(slope(v.lon) + bld.heightM - 1e-9);
    }
  });

  it('the height visible above the UPHILL grade is exactly heightM', () => {
    const bld = sq(-85.3, 35.03, 10);
    const { topM } = groundSpanM(bld, (lon: number) => slope(lon));
    const maxGround = Math.max(...vertices(bld).map((v) => slope(v.lon)));
    expect(topM - maxGround).toBeCloseTo(10, 6);
  });

  it('the extra box height is exactly the ground range — a below-grade skirt', () => {
    const bld = sq(-85.3, 35.03, 10);
    const { baseM, topM } = groundSpanM(bld, (lon: number) => slope(lon));
    const gs = vertices(bld).map((v) => slope(v.lon));
    const range = Math.max(...gs) - Math.min(...gs);
    expect(topM - baseM).toBeCloseTo(range + 10, 6);
    expect(range).toBeCloseTo(20, 6); // the bluff really is 20 m across this footprint
  });

  it('on flat ground the box is exactly heightM — no penalty where slope is nil', () => {
    const { baseM, topM } = groundSpanM(sq(-85.3, 35.03, 10), () => 176);
    expect(baseM).toBe(176);
    expect(topM).toBe(186);
  });

  it('a degenerate ring sits on the ellipsoid, not Infinity', () => {
    // Extruding from Infinity vanishes the building instead of failing loudly.
    expect(groundSpanM(b({ lonLat: [], heightM: 9 }), () => 176)).toEqual({
      baseM: 0,
      topM: 9,
    });
  });
});

describe('DEFAULT_COLOR_BY', () => {
  it('colours by TYPE on arrival — the only mode that describes the city', () => {
    // `provenance` describes our pipeline (lidar vs tag vs estimate) and
    // `height` re-states what the geometry already shows. Only `type` tells a
    // visitor where the city lives, works and makes things. Flipping this back
    // is a product decision, so it should break a test, not slip through.
    expect(DEFAULT_COLOR_BY).toBe('type');
  });

  it('is a real ColorBy — a typo here would silently colour nothing', () => {
    const modes: ColorBy[] = ['provenance', 'type', 'height'];
    expect(modes).toContain(DEFAULT_COLOR_BY);
  });
});
