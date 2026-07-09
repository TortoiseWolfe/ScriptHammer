import { describe, it, expect } from 'vitest';
import {
  SiteConfigSchema,
  loadSiteConfig,
  sitePaths,
  defaultTerrainGrid,
  provenanceFor,
  siteManifestBlock,
} from '../site-config';

const MINIMAL = {
  slug: 'nowhere',
  name: 'Nowhere',
  box: { swLat: 1, swLon: 2, neLat: 1.01, neLon: 2.01 },
};

describe('SiteConfigSchema', () => {
  it('parses a minimal config and applies defaults', () => {
    const cfg = SiteConfigSchema.parse(MINIMAL);
    expect(cfg.mpp).toBe(2);
    expect(cfg.carveWater).toBe(true);
    expect(cfg.heroes).toEqual([]);
    expect(cfg.heights).toEqual({ overrides: {}, fallbackClampM: 100 });
    expect(cfg.drapeSource).toBe('naip');
    expect(cfg.terrain).toBeUndefined();
    expect(cfg.tour).toBeUndefined();
    expect(cfg.trolley).toBeUndefined();
  });
  it('rejects an inverted box', () => {
    expect(() =>
      SiteConfigSchema.parse({
        ...MINIMAL,
        box: { swLat: 1.01, swLon: 2, neLat: 1, neLon: 2.01 },
      })
    ).toThrow();
  });
  it('accepts a measured vectorOffsetM and rejects one beyond 15 m (#233)', () => {
    const cfg = SiteConfigSchema.parse({
      ...MINIMAL,
      vectorOffsetM: { x: -3.5, z: 2 },
    });
    expect(cfg.vectorOffsetM).toEqual({ x: -3.5, z: 2 });
    expect(SiteConfigSchema.parse(MINIMAL).vectorOffsetM).toBeUndefined();
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, vectorOffsetM: { x: 12, z: 12 } })
    ).toThrow(/15 m/); // hypot(12,12) ≈ 17
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, vectorOffsetM: { x: 1 } })
    ).toThrow();
  });
  it('rejects duplicate hero slugs and duplicate wayIds', () => {
    expect(() =>
      SiteConfigSchema.parse({
        ...MINIMAL,
        heroes: [
          { slug: 'a', wayId: 1 },
          { slug: 'a', wayId: 2 },
        ],
      })
    ).toThrow(/unique/);
    expect(() =>
      SiteConfigSchema.parse({
        ...MINIMAL,
        heroes: [
          { slug: 'a', wayId: 1 },
          { slug: 'b', wayId: 1 },
        ],
      })
    ).toThrow(/unique/);
  });
  it('rejects a hero with both wayId and anchor, or neither', () => {
    expect(() =>
      SiteConfigSchema.parse({
        ...MINIMAL,
        heroes: [{ slug: 'x', wayId: 1, anchor: { lat: 1, lon: 2 } }],
      })
    ).toThrow();
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, heroes: [{ slug: 'x' }] })
    ).toThrow();
  });
  it('rejects a bad slug', () => {
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, slug: 'Bad Slug!' })
    ).toThrow();
  });
  it('rejects an odd-length or too-short trolley', () => {
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, trolley: [1, 2, 3] })
    ).toThrow();
    expect(() =>
      SiteConfigSchema.parse({ ...MINIMAL, trolley: [1, 2, 3, 4] })
    ).toThrow();
    expect(
      SiteConfigSchema.parse({ ...MINIMAL, trolley: [1, 2, 3, 4, 5, 6] })
        .trolley
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('loadSiteConfig', () => {
  it('loads the flagship config', () => {
    const cfg = loadSiteConfig('chatt');
    expect(cfg.slug).toBe('chatt');
    expect(cfg.name).toBe('Chattanooga Mini');
  });
  it('throws a scaffold hint for a missing site', () => {
    expect(() => loadSiteConfig('no-such-site')).toThrow(/scaffold/);
  });
});

describe('sitePaths', () => {
  it('places every site under public/twins/<slug>', () => {
    expect(sitePaths({ slug: 'kx' })).toEqual({
      publicBase: 'twins/kx',
      out: 'public/twins/kx',
      raw: 'public/twins/kx/_raw',
      tmp: 'public/twins/kx/_tmp',
    });
  });
});

describe('defaultTerrainGrid', () => {
  it('targets ~30 m isotropic spacing for a small box', () => {
    // 1600 x 900 m box → 54-55 cols, 31 rows.
    const { cols, rows } = defaultTerrainGrid({
      swLat: 35.017,
      swLon: -85.276,
      neLat: 35.0252,
      neLon: -85.2585,
    });
    expect(cols).toBeGreaterThan(45);
    expect(cols).toBeLessThan(65);
    expect(rows).toBeGreaterThan(25);
    expect(rows).toBeLessThan(40);
  });
  it('caps the grid near the 10k-point OpenTopoData budget', () => {
    // A huge 20 x 20 km box would want ~445k points at 30 m.
    const { cols, rows } = defaultTerrainGrid({
      swLat: 35.0,
      swLon: -85.4,
      neLat: 35.18,
      neLon: -85.18,
    });
    expect(cols * rows).toBeLessThanOrEqual(10_000);
    expect(cols).toBeGreaterThan(2);
    expect(rows).toBeGreaterThan(2);
  });
});

describe('provenanceFor', () => {
  it('reproduces the flagship attribution for ned10m + naip', () => {
    expect(provenanceFor('ned10m', 'naip')).toBe(
      '© OpenStreetMap · USGS 3DEP · USGS NAIP'
    );
  });
  it('credits Esri when the fallback imagery was used', () => {
    expect(provenanceFor('srtm30m', 'esri')).toBe(
      '© OpenStreetMap · NASA SRTM · Esri World Imagery'
    );
  });
  it('credits TDOT for the Tennessee statewide ortho', () => {
    expect(provenanceFor('3dep1m', 'tnmap', true)).toBe(
      '© OpenStreetMap · USGS 3DEP 1m · TDOT Aerial Surveys · Microsoft Buildings'
    );
  });
});

describe('siteManifestBlock', () => {
  it('omits absent optional fields entirely', () => {
    const cfg = SiteConfigSchema.parse(MINIMAL);
    expect(siteManifestBlock(cfg)).toEqual({
      slug: 'nowhere',
      name: 'Nowhere',
    });
  });
  it('passes presentation fields through verbatim', () => {
    const cfg = loadSiteConfig('chatt');
    const block = siteManifestBlock(cfg);
    expect(block.subtitle).toBe('a living tilt-shift diorama');
    expect(block.palette).toBe('toy');
    expect(block.day).toBeCloseTo(0.4, 10);
    expect(block.tour).toHaveLength(7);
    expect(block.trolley).toHaveLength(16);
    expect(block.framing).toEqual({ homeFocus: [-100, 0, -2000] });
  });
});
