import { describe, it, expect } from 'vitest';
import {
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
