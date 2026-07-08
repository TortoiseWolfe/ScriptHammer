// The flagship regression gate (#232). sites/chatt.json must keep producing
// byte-identical artifacts to the pre-parameterization bake (modulo upstream
// service drift) — this locks every input that feeds the deriver: the box, the
// projection outputs, the drape request, the terrain grid, hero identities and
// ANCHOR ORDER (anchors emit in config order), and the height overrides.

import { describe, it, expect } from 'vitest';
import { createProjection } from '../enu';
import { loadSiteConfig, sitePaths } from '../site-config';
import { drapePixelSize, drapeUrl } from '../fetch-drape';
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

  it('pins the terrain grid 49x195 (derivation would give a different row count)', () => {
    expect(site.terrain).toEqual({ cols: 49, rows: 195, dataset: 'ned10m' });
  });

  it('sizes the drape 730x2382 at mpp=2 (the #223 degree-aspect invariant)', () => {
    expect(site.mpp).toBe(2);
    const { width, height } = drapePixelSize(proj, site.mpp);
    expect(width).toBe(730);
    expect(height).toBe(2382);
  });

  it('requests the exact box bbox from NAIP (the pinned drape source)', () => {
    expect(site.drapeSource).toBe('naip');
    const url = drapeUrl(proj, site.mpp, site.drapeSource);
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('bbox=-85.316,35.0078,-85.3,35.06');
    expect(url).toContain('size=730,2382');
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

  it('tour traverses the whole corridor: both north (z<0) and south (z>0) stops (#216)', () => {
    expect(site.tour!.some((w) => w.look[2] < -2000)).toBe(true); // north
    expect(site.tour!.some((w) => w.look[2] > 2000)).toBe(true); // south
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
