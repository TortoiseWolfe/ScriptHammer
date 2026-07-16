// #229 PR-B lidar heights — pure-function coverage, all offline/synthetic.

import { describe, it, expect } from 'vitest';
import {
  lonToMercX,
  latToMercY,
  keyBounds2d,
  boxesIntersect,
  percentile,
  dtmAtEnu,
  FootprintIndex,
  pickRoofSample,
  assertDatumSane,
} from '../fetch-lidar-heights';
import { resolveHeight } from '../height';
import { SiteConfigSchema, provenanceFor } from '../site-config';

describe('mercator helpers', () => {
  it('matches EPSG:3857 for downtown Chattanooga (live-verified anchors)', () => {
    expect(lonToMercX(-85.3094)).toBeCloseTo(-9496599.0, 0);
    expect(latToMercY(35.0456)).toBeCloseTo(4170079.7, 0);
  });
});

describe('keyBounds2d / boxesIntersect', () => {
  // A synthetic 1024 m cube anchored at (1000, 2000).
  const bounds = [1000, 2000, 0, 2024, 3024, 1024];
  it('root key spans the full cube', () => {
    const b = keyBounds2d('0-0-0-0', bounds);
    expect(b).toEqual({ d: 0, x0: 1000, y0: 2000, x1: 2024, y1: 3024 });
  });
  it('depth-2 key (2-3-1-0) is the 256 m cell at (3,1)', () => {
    const b = keyBounds2d('2-3-1-0', bounds);
    expect(b).toEqual({ d: 2, x0: 1768, y0: 2256, x1: 2024, y1: 2512 });
  });
  it('boxesIntersect is exclusive at shared edges', () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(boxesIntersect(a, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBe(false);
    expect(boxesIntersect(a, { x0: 9.9, y0: 9.9, x1: 20, y1: 20 })).toBe(true);
    expect(boxesIntersect(a, { x0: -5, y0: -5, x1: 30, y1: 30 })).toBe(true);
  });
});

describe('percentile (nearest-rank on an unsorted sample)', () => {
  it('p90 of 1..10 (shuffled) is 9, NOT the max — the outlier-rejection contract at MIN_POINTS', () => {
    // floor(p·n) would return index 9 (the maximum) at exactly n=10, giving a
    // single canopy/bird outlier full control of the height precisely at the
    // measurement floor. Nearest-rank ⌈p·n⌉ keeps one value of headroom.
    const v = [7, 1, 10, 3, 9, 2, 8, 4, 6, 5];
    expect(percentile(v, 0.9)).toBe(9);
    expect(percentile(v, 0.5)).toBe(5);
    expect(percentile(v, 1)).toBe(10);
    expect(percentile([42], 0.9)).toBe(42);
    expect(percentile([1, 2], 0.9)).toBe(2);
  });
});

describe('pickRoofSample (canopy-proof single returns first)', () => {
  it('prefers single returns when enough exist', () => {
    const singles = Array.from({ length: 12 }, (_, i) => 200 + i * 0.1);
    const firsts = [...singles, 230, 231]; // canopy spikes in the first-return set
    expect(pickRoofSample(singles, firsts, 10)).toEqual({
      zs: singles,
      usedFallback: false,
    });
  });
  it('falls back to first returns when singles are too sparse', () => {
    const singles = [200, 201];
    const firsts = Array.from({ length: 15 }, () => 205);
    expect(pickRoofSample(singles, firsts, 10)).toEqual({
      zs: firsts,
      usedFallback: true,
    });
  });
});

describe('assertDatumSane (the tripwire cannot pass vacuously)', () => {
  const good = Array.from({ length: 1000 }, (_, i) => -0.5 + (i % 10) * 0.1);
  it('returns the median for a healthy sample', () => {
    expect(Math.abs(assertDatumSane(good))).toBeLessThan(0.5);
  });
  it('FAILS below the sample floor — zero ground class must not read as a perfect 0.0', () => {
    expect(() => assertDatumSane([])).toThrow(/ground-class samples/);
    expect(() => assertDatumSane(good.slice(0, 499))).toThrow(
      /ground-class samples/
    );
  });
  it('fails on a datum-scale offset (ellipsoidal z would sit ~30 m off here)', () => {
    const ell = Array.from({ length: 1000 }, () => -30.2);
    expect(() => assertDatumSane(ell)).toThrow(/datum mismatch/);
  });
});

describe('dtmAtEnu (south-first grid, the runtime fraction mapping)', () => {
  // 3x3 grid over a 100x200 m ground; row 0 = SOUTH.
  const grid = {
    cols: 3,
    rows: 3,
    // south row: 10 11 12 / middle: 20 21 22 / north row: 30 31 32
    heights: [10, 11, 12, 20, 21, 22, 30, 31, 32],
  };
  it('corners: SW / NE', () => {
    expect(dtmAtEnu(grid, -50, 100, 100, 200)).toBe(10); // west, south(+z)
    expect(dtmAtEnu(grid, 50, -100, 100, 200)).toBe(32); // east, north(-z)
  });
  it('centre bilinear', () => {
    expect(dtmAtEnu(grid, 0, 0, 100, 200)).toBe(21);
  });
  it('clamps outside the box instead of extrapolating', () => {
    expect(dtmAtEnu(grid, -9999, 9999, 100, 200)).toBe(10);
  });
});

describe('FootprintIndex', () => {
  const mk = (id: number, x0: number, y0: number, x1: number, y1: number) => ({
    id,
    ring: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ] as [number, number][],
    bbox: { x0, y0, x1, y1 },
    cx: 0,
    cz: 0,
    zs: [],
  });
  const index = new FootprintIndex(
    [mk(1, 100, 100, 130, 130), mk(2, 500, 500, 540, 520)],
    64
  );
  it('candidates by cell', () => {
    expect(index.candidates(110, 110)).toEqual([0]);
    expect(index.candidates(510, 510)).toEqual([1]);
    expect(index.candidates(9000, 9000)).toEqual([]);
  });
  it('intersectsAny: occupied vs empty regions', () => {
    expect(index.intersectsAny({ x0: 90, y0: 90, x1: 150, y1: 150 })).toBe(
      true
    );
    expect(
      index.intersectsAny({ x0: 2000, y0: 2000, x1: 2100, y1: 2100 })
    ).toBe(false);
  });
  it('very wide nodes over the site are accepted without cell iteration', () => {
    expect(index.intersectsAny({ x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 })).toBe(
      true
    );
  });
  it('wide nodes NOWHERE NEAR the site are rejected (state-tiling datasets have thousands)', () => {
    // Caught live: without the global-bbox pre-filter, every shallow node of
    // the 27-county dataset was admitted — a 78M-point selection for a
    // 20M-point site.
    expect(index.intersectsAny({ x0: 5e5, y0: 5e5, x1: 6e5, y1: 6e5 })).toBe(
      false
    );
    expect(
      new FootprintIndex([]).intersectsAny({ x0: 0, y0: 0, x1: 10, y1: 10 })
    ).toBe(false);
  });
});

// PRECEDENCE REVISION (2026-07-15). This block previously asserted that
// `building:levels` beat lidar, under the banner "explicit tags and overrides
// still beat lidar" — human-authored data outranks a machine measurement. That
// principle is right, but it conflated two different things, and the chatt bake
// measured the difference:
//
//   * `height=30` IS a human asserting METRES about this building. It agrees
//     with lidar to a median of 0.1 m across the 92 chatt buildings carrying
//     both — mutual validation. It keeps rank 1.
//   * `building:levels=3` is a human asserting a FLOOR COUNT. The count is
//     probably right; `3 × 3.2 = 9.6 m` is OUR multiplier bolted onto their
//     fact. The human never asserted a height. Measured: 112 of the 116 chatt
//     `levels` buildings had a lidar return, and `levels × 3.2` ran a median
//     2.9 m short of it — about one floor, on 7–16 m buildings.
//
// So the old rule wasn't deferring to human data, it was deferring to our
// arithmetic on top of it. Ladder is now: height > override > lidar > levels >
// ms > fallback. If you are here because you want `levels` to win again, bring
// a measurement — the 0.1 m vs 2.9 m asymmetry above is the bar to clear.
describe('height rule precedence with lidar (#229 PR-B)', () => {
  const cfg = { overrides: { Named: 50 }, fallbackClampM: 100 };
  it('lidar beats ms and fallback', () => {
    expect(resolveHeight({}, 100, cfg, 12, 9.4)).toEqual({
      meters: 9.4,
      rule: 'lidar',
    });
    expect(resolveHeight({}, 100, cfg, undefined, 9.4).rule).toBe('lidar');
  });
  it('an explicit height tag and a named override still beat lidar', () => {
    expect(resolveHeight({ height: '30' }, 100, cfg, 12, 9.4).rule).toBe(
      'height'
    );
    expect(resolveHeight({ name: 'Named' }, 100, cfg, 12, 9.4).rule).toBe(
      'override'
    );
  });
  it('lidar beats building:levels — a measurement outranks our 3.2 m/level derivation', () => {
    expect(
      resolveHeight({ 'building:levels': '3' }, 100, cfg, 12, 9.4).rule
    ).toBe('lidar');
  });
  it('building:levels is still used when the footprint has no lidar return', () => {
    expect(
      resolveHeight({ 'building:levels': '3' }, 100, cfg, 12, undefined).rule
    ).toBe('levels');
  });
  it('absent/zero lidar falls through to ms', () => {
    expect(resolveHeight({}, 100, cfg, 12, undefined).rule).toBe('ms');
    expect(resolveHeight({}, 100, cfg, 12, 0).rule).toBe('ms');
  });
});

describe('site-config lidar block', () => {
  const MINIMAL = {
    slug: 'nowhere',
    name: 'Nowhere',
    box: { swLat: 1, swLon: 2, neLat: 1.01, neLon: 2.01 },
  };
  it('is opt-in (absent by default) and defaults maxDepth to 11', () => {
    expect(SiteConfigSchema.parse(MINIMAL).lidar).toBeUndefined();
    const cfg = SiteConfigSchema.parse({
      ...MINIMAL,
      lidar: { ept: 'https://example.com/USGS_LPC_X' },
    });
    expect(cfg.lidar).toEqual({
      ept: 'https://example.com/USGS_LPC_X',
      maxDepth: 11,
    });
  });
  it('rejects a non-URL ept and out-of-range maxDepth', () => {
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, lidar: { ept: 'not a url' } })
    ).toThrow();
    expect(() =>
      SiteConfigSchema.parse({
        ...MINIMAL,
        lidar: { ept: 'https://x.com/d', maxDepth: 30 },
      })
    ).toThrow();
  });
  it('provenance credits the lidar when used', () => {
    expect(provenanceFor('3dep1m', 'tnmap', true, true)).toBe(
      '© OpenStreetMap · USGS 3DEP 1m · TDOT Aerial Surveys · Microsoft Buildings · USGS 3DEP Lidar'
    );
  });
});
