// The flagship regression gate (#232). sites/chatt.json must keep producing
// byte-identical artifacts to the pre-parameterization bake (modulo upstream
// service drift) — this locks every input that feeds the deriver: the box, the
// projection outputs, the drape request, the terrain grid, hero identities and
// ANCHOR ORDER (anchors emit in config order), and the height overrides.

import { describe, it, expect } from 'vitest';
import { createProjection } from '../enu';
import { loadSiteConfig, sitePaths } from '../site-config';
import { drapePixelSize, sliceDrapeTiles, tileUrl } from '../fetch-drape';
import { buildOsmQL } from '../fetch-osm';
import { resolveHeight } from '../height';

const site = loadSiteConfig('chatt');
const proj = createProjection(site.box);

describe('golden: sites/chatt.json', () => {
  it('pins the locked corridor box', () => {
    expect(site.box).toEqual({
      swLat: 35.0078,
      swLon: -85.316,
      neLat: 35.06,
      neLon: -85.3,
    });
  });

  it('pins the 3DEP 1m degree-square terrain grid 198x644 (#229 accuracy v2)', () => {
    expect(site.terrain).toEqual({ cols: 198, rows: 644, dataset: '3dep1m' });
  });

  it('sizes the drape 2433x7938 at native-res mpp=0.6 in two N-S tiles (#223 invariant per tile)', () => {
    expect(site.mpp).toBe(0.6);
    const { width, height } = drapePixelSize(proj, site.mpp);
    expect(width).toBe(2433);
    expect(height).toBe(7938);
    const { tiles } = sliceDrapeTiles(proj, site.mpp);
    expect(tiles.map((t) => t.rows)).toEqual([4000, 3938]);
    expect(tiles[0].bbox[1]).toBe(tiles[1].bbox[3]); // exact shared edge
  });

  it('requests the exact box bbox from the TDOT ortho (the pinned drape source), tile by tile', () => {
    // Accuracy v3 (#233): the flagship moved NAIP → TDOT statewide ortho.
    // Same dims/tiling at mpp 0.6; what changed is georeferencing quality —
    // measured residual dropped 1.5 m → 0.5 m (pinned in vectorOffsetM below).
    expect(site.drapeSource).toBe('tnmap');
    const { tiles } = sliceDrapeTiles(proj, site.mpp);
    const t0 = tileUrl(tiles[0], site.drapeSource);
    expect(t0).toContain('tnmap.tn.gov');
    expect(t0).toContain('MapServer/export');
    expect(t0).toContain(`bbox=-85.316,${tiles[0].bbox[1]},-85.3,35.06`);
    expect(t0).toContain('size=2433,4000');
    const t1 = tileUrl(tiles[1], site.drapeSource);
    expect(t1).toContain(`bbox=-85.316,35.0078,-85.3,${tiles[1].bbox[3]}`);
    expect(t1).toContain('size=2433,3938');
  });

  it('pins the measured vector correction (#233 registration report, 2026-07-09)', () => {
    expect(site.vectorOffsetM).toEqual({ x: 0.5, z: 0 });
  });

  it('pins the lidar height source (#229 PR-B): blk4 covers downtown, blk3 does NOT', () => {
    expect(site.lidar).toEqual({
      ept: 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/USGS_LPC_TN_27County_blk4_2015_LAS_2018',
      maxDepth: 10,
    });
  });

  it('fills fallback heights from Microsoft Buildings (msHeights on)', () => {
    expect(site.msHeights).toBe(true);
  });

  it('queries Overpass over the exact box', () => {
    expect(buildOsmQL(site.box)).toContain(
      'way["building"](35.0078,-85.316,35.06,-85.3)'
    );
  });

  it('carries the 4 way-heroes and the 4 anchor-heroes in emission order', () => {
    const wayHeroes = site.heroes.filter((h) => h.wayId != null);
    const anchorHeroes = site.heroes.filter((h) => h.anchor != null);
    expect(new Map(wayHeroes.map((h) => [h.wayId, h.slug]))).toEqual(
      new Map([
        [173782782, 'aquarium'],
        [164158074, 'walnut_st_bridge'],
        [79292898, 'courthouse'],
        [66951392, 'republic_centre'],
      ])
    );
    // Anchors emit into heroes.json in CONFIG ORDER with these exact
    // coordinates — reordering or nudging any changes the committed bytes.
    expect(anchorHeroes.map((h) => ({ slug: h.slug, ...h.anchor }))).toEqual([
      { slug: 'hunter_museum', lat: 35.0558416, lon: -85.3062145 },
      { slug: 'tivoli', lat: 35.0455, lon: -85.3078 },
      { slug: 'dome_building', lat: 35.0466, lon: -85.3086 },
      { slug: 'choo_choo', lat: 35.0093, lon: -85.3086 },
    ]);
  });

  it('keeps the character-exact height overrides (ft x 0.3048) — every key and value pinned', () => {
    const FT = 0.3048;
    // ft*0.3048 differs from the JSON decimal literal in the last ulp for two
    // entries (both quantize identically at 0.1 m), so compare per-key closely
    // rather than with exact toEqual.
    const expected: Record<string, number> = {
      'Republic Centre': 300 * FT,
      'First Tennessee Bank Building': 204 * FT,
      'James Building': 187 * FT,
      'Volunteer Life Building': 165 * FT,
      'Maclellan Building': 158 * FT,
      'Medical Arts Building': 146 * FT,
      'Chattanooga Bank Building': 132 * FT,
      'Patten Towers': 130 * FT,
      'The Read House Historic Inn And Suites': 130 * FT,
    };
    expect(Object.keys(site.heights.overrides).sort()).toEqual(
      Object.keys(expected).sort()
    );
    for (const [name, metres] of Object.entries(expected)) {
      expect(site.heights.overrides[name], name).toBeCloseTo(metres, 10);
    }
    expect(site.heights.fallbackClampM).toBeCloseTo(91.44, 10);
    const r = resolveHeight({ name: 'Republic Centre' }, 2000, site.heights);
    expect(r).toEqual({ meters: 91.44, rule: 'override' });
  });

  it('carries the presentation block the runtime needs', () => {
    expect(site.name).toBe('Chattanooga Mini');
    expect(site.subtitle).toBe('a living tilt-shift diorama');
    expect(site.palette).toBe('toy');
    expect(site.day).toBeCloseTo(0.4, 10);
    expect(site.tour?.map((w) => w.name)).toEqual([
      "Ross's Landing",
      'Tennessee Aquarium',
      'Walnut Street Bridge',
      'Coolidge Park',
      'Republic Centre',
      'Downtown Core',
      'Chattanooga Choo Choo',
    ]);
    expect(site.trolley).toHaveLength(16);
    expect(site.framing?.homeFocus).toEqual([-100, 0, -2000]);
    expect(site.carveWater).toBe(true);
  });

  it('tour traverses the downtown corridor, top to bottom (#216, #302)', () => {
    const zs = site.tour!.map((w) => w.look[2]);
    // The interesting corridor runs from the north riverfront (Coolidge Park,
    // z ~ -2960) down to the Chattanooga Choo Choo (z ~ -371) — a ~2.6 km span.
    // The stops must cover it, not bunch in one block.
    expect(Math.min(...zs)).toBeLessThan(-2000); // reaches the north riverfront
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(2000); // wide span
    // The old assertion here required a stop with look.z > 2000 (a "south"
    // stop). That stop was the Chattanooga Choo Choo MISPLACED ~3 km south in
    // Alton Park (#302). The real station geocodes to lat 35.0372 — NORTH of
    // the box center (35.0339), i.e. z ~ -371 — and the box's southern half has
    // no tour-worthy landmark, so requiring a z>2000 stop was asserting the bug.
    for (const w of site.tour!) expect(w.blurb.length).toBeGreaterThan(0);
  });

  it('bakes into public/twins/chatt', () => {
    expect(sitePaths(site)).toEqual({
      publicBase: 'twins/chatt',
      out: 'public/twins/chatt',
      raw: 'public/twins/chatt/_raw',
      tmp: 'public/twins/chatt/_tmp',
    });
  });
});
