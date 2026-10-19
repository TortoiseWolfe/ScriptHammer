import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ringAreaM2, polygonCentroid, buildScene } from '../build-scene';
import { createProjection } from '../enu';
import { SiteConfigSchema } from '../site-config';

describe('build-scene geometry', () => {
  it('computes ring area via the shoelace formula', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(ringAreaM2(square)).toBeCloseTo(100, 5);
  });
  it('computes the centroid of a square', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const [cx, cz] = polygonCentroid(square);
    expect(cx).toBeCloseTo(5, 5);
    expect(cz).toBeCloseTo(5, 5);
  });
});

// --- Synthetic-fixture derive: exercises the per-site optional paths without
// the large _raw cache (runs everywhere, incl. CI). --------------------------
describe('build-scene per-site behavior (synthetic fixture)', () => {
  // A tiny site at the equator: one building way, one street, no heroes, no
  // water carve, no tour/trolley. lonLatToEnu(0.0001, 0) ≈ (11.1, 0).
  const tinySite = SiteConfigSchema.parse({
    slug: 'tiny',
    name: 'Tiny Test Site',
    box: { swLat: -0.01, swLon: -0.01, neLat: 0.01, neLon: 0.01 },
    carveWater: false,
  });
  const tinyProj = createProjection(tinySite.box);

  function writeFixture(rawDir: string) {
    const sq = (dLon: number, dLat: number) => [
      { lat: -0.0005 + dLat, lon: -0.0005 + dLon },
      { lat: -0.0005 + dLat, lon: 0.0005 + dLon },
      { lat: 0.0005 + dLat, lon: 0.0005 + dLon },
      { lat: 0.0005 + dLat, lon: -0.0005 + dLon },
    ];
    writeFileSync(
      join(rawDir, 'osm.json'),
      JSON.stringify({
        elements: [
          { type: 'way', id: 1, tags: { building: 'yes' }, geometry: sq(0, 0) },
          {
            type: 'way',
            id: 2,
            tags: { building: 'office', name: 'Test Tower' },
            geometry: sq(0.002, 0.002),
          },
          {
            type: 'way',
            id: 3,
            tags: { highway: 'residential' },
            geometry: [
              { lat: 0, lon: -0.02 }, // straddles the west edge → gets clipped
              { lat: 0, lon: 0.005 },
            ],
          },
        ],
      })
    );
    writeFileSync(
      join(rawDir, 'terrain.json'),
      JSON.stringify({ cols: 2, rows: 2, heights: [5, 6, 7, 8] })
    );
    // no drape.jpg — manifest still emits, carve skips
  }

  it('emits [] heroes, no swap fields, and an uncarved terrain for a hero-less carve-less site', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-scene-tiny-'));
    try {
      const rawDir = join(dir, '_raw');
      const outDir = join(dir, 'out');
      mkdirSync(rawDir, { recursive: true });
      writeFixture(rawDir);

      const manifest = await buildScene(rawDir, outDir, tinySite, tinyProj);

      const heroes = JSON.parse(
        readFileSync(join(outDir, 'heroes.json'), 'utf8')
      );
      expect(heroes).toEqual([]);

      const buildings = JSON.parse(
        readFileSync(join(outDir, 'buildings.json'), 'utf8')
      ) as { swap?: string; rule: string }[];
      expect(buildings).toHaveLength(2);
      expect(buildings.every((b) => b.swap === undefined)).toBe(true);

      const terrain = JSON.parse(
        readFileSync(join(outDir, 'terrain.json'), 'utf8')
      );
      expect(terrain).toEqual({ cols: 2, rows: 2, heights: [5, 6, 7, 8] });

      // manifest carries the site block + basename drape path. `water` and `hasHouse`
      // are both bake RESULTS: nothing carved here → water false, and this fixture bakes
      // no as-built capture → hasHouse false (#831, which uses the flag to skip a request
      // that would 404 and read as a real failure in the console).
      expect(manifest.drape.path).toBe('drape.jpg');
      expect(manifest.site).toEqual({
        slug: 'tiny',
        name: 'Tiny Test Site',
        water: false,
        hasHouse: false,
      });
      expect(manifest.box).toEqual(tinySite.box);
      expect(existsSync(join(outDir, 'drape.jpg'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('wires lidar heights through resolveHeight — rule + value prove which source won', async () => {
    // Findings gate (#229 PR-B review): lidarHeightM and msHeightM are
    // type-identical resolveHeight args — an argument swap would pass every
    // other test. Here the two sources carry DIFFERENT values for the same
    // building, so the baked height + rule histogram pin the wiring.
    const dir = mkdtempSync(join(tmpdir(), 'build-scene-tiny-'));
    try {
      const rawDir = join(dir, '_raw');
      const outDir = join(dir, 'out');
      mkdirSync(rawDir, { recursive: true });
      writeFixture(rawDir);
      // Building 1 gets a lidar height; building 2 has neither → fallback.
      writeFileSync(
        join(rawDir, 'lidar-heights.json'),
        JSON.stringify({ meta: {}, heights: { 1: 7.7 } })
      );
      const lidarSite = SiteConfigSchema.parse({
        slug: 'tiny',
        name: 'Tiny Test Site',
        box: { swLat: -0.01, swLon: -0.01, neLat: 0.01, neLon: 0.01 },
        carveWater: false,
        msHeights: false,
        lidar: { ept: 'https://example.com/synthetic' }, // no network: file pre-written
      });
      const manifest = await buildScene(rawDir, outDir, lidarSite, tinyProj);
      const buildings = JSON.parse(
        readFileSync(join(outDir, 'buildings.json'), 'utf8')
      ) as { id: number; height: number; rule: string }[];
      const b1 = buildings.find((b) => b.id === 1)!;
      const b2 = buildings.find((b) => b.id === 2)!;
      expect(b1.rule).toBe('lidar'); // an ms/lidar arg swap would report 'ms'
      expect(b1.height).toBe(7.7);
      expect(b2.rule).toBe('fallback');
      expect(manifest.ruleHistogram.lidar).toBe(1);
      expect(manifest.provenance).toContain('USGS 3DEP Lidar');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('clips straddling streets to the box', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-scene-tiny-'));
    try {
      const rawDir = join(dir, '_raw');
      const outDir = join(dir, 'out');
      mkdirSync(rawDir, { recursive: true });
      writeFixture(rawDir);

      const manifest = await buildScene(rawDir, outDir, tinySite, tinyProj);
      const streets = JSON.parse(
        readFileSync(join(outDir, 'streets.json'), 'utf8')
      ) as { pts: number[] }[];
      expect(streets).toHaveLength(1);
      const halfW = manifest.groundWm / 2;
      for (let i = 0; i < streets[0].pts.length; i += 2) {
        expect(Math.abs(streets[0].pts[i])).toBeLessThanOrEqual(halfW + 2);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// --- Committed-fixture derive: the full buildScene() hero / clip / registration
// paths against fixtures/hero-city, a hand-built 4-building "city" (a few KB).
// It replaces the gitignored ~90 MB real _raw cache (regenerable via
// `pnpm bake`), so these paths now run on a fresh clone and in CI.
//
// Geometry, all at the equator so 0.001 deg ~ 111 m (box: +-0.003 deg, a
// ~668 m square; mpp 2 -> a 334 px drape):
//   101  building "Alpha Hall"      centred (-0.0015, +0.0015)  -> way hero alpha_hall
//   102  building                   centred (+0.0015, +0.0015)
//   106  building                   centred (-0.0015, -0.0015)
//   107  building                   centred (+0.0015, -0.0015)
//   105  building centred (+0.0045, 0): centroid OUTSIDE the box -> dropped
//   103  highway=footway "Beta Bridge", 2 vertices at lat -0.0005
//                                   -> way hero beta_bridge via the non-building fallback
//   104  street lat 0, lon -0.02..0  -> straddles the west edge, must be clipped
//   108  street lat +0.0025, lon -0.001..+0.001, fully inside
//   anchor hero gamma_tower at lat 0.001, lon 0.002 (no OSM way at all)
// fixtures/hero-city/drape.jpg is grey (70) with a light (215) filled square
// at each of the four in-box buildings, drawn at the footprints' lon/lat, so
// the registration pass has real edges to lock onto at zero offset.
describe('build-scene hero resolution (committed hero-city fixture)', () => {
  const fixtureDir = join(
    process.cwd(),
    'scripts/bake/__tests__/fixtures/hero-city'
  );
  const site = SiteConfigSchema.parse({
    slug: 'hero-city',
    name: 'Hero City Fixture',
    box: { swLat: -0.003, swLon: -0.003, neLat: 0.003, neLon: 0.003 },
    carveWater: false,
    msHeights: false,
    heroes: [
      { slug: 'alpha_hall', wayId: 101 },
      { slug: 'beta_bridge', wayId: 103 },
      { slug: 'gamma_tower', anchor: { lat: 0.001, lon: 0.002 } },
    ],
  });
  const proj = createProjection(site.box);
  const ALL_HERO_KEYS = site.heroes.map((h) => h.slug);

  // registration: false except in the registration test — the Sobel pass has
  // its own unit suite; these tests assert hero/clip/height behavior.
  async function bake(opts: Parameters<typeof buildScene>[5]) {
    const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
    const manifest = await buildScene(
      fixtureDir,
      outDir,
      site,
      proj,
      site.drapeSource,
      opts
    );
    const read = <T>(f: string) =>
      JSON.parse(readFileSync(join(outDir, f), 'utf8')) as T;
    return { outDir, manifest, read };
  }

  it('resolves all 3 hero keys and none sit on a street', async () => {
    const { outDir, read } = await bake({ registration: false });
    try {
      const heroes =
        read<{ swap: string; x: number; z: number }[]>('heroes.json');
      const streets = read<{ pts: number[] }[]>('streets.json');

      expect(heroes.map((h) => h.swap).sort()).toEqual(
        [...ALL_HERO_KEYS].sort()
      );

      // None of the hero anchor points should coincide with any street vertex
      // (a hero placed "on a street" indicates a landmark matched a road
      // instead of a building).
      const streetPts = new Set<string>();
      for (const s of streets) {
        for (let i = 0; i < s.pts.length; i += 2) {
          streetPts.add(`${s.pts[i]},${s.pts[i + 1]}`);
        }
      }
      for (const h of heroes) {
        expect(streetPts.has(`${h.x},${h.z}`)).toBe(false);
      }

      // The coordinate-anchor hero is simply the projected lon/lat (0.1 m quantized).
      const [ax, az] = proj.lonLatToEnu(0.002, 0.001);
      const gamma = heroes.find((h) => h.swap === 'gamma_tower')!;
      expect(gamma.x).toBeCloseTo(ax, 0);
      expect(gamma.z).toBeCloseTo(az, 0);
      // east of centre, north of centre (north is -Z)
      expect(gamma.x).toBeGreaterThan(200);
      expect(gamma.z).toBeLessThan(-100);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('keeps the 4 in-box buildings, drops the out-of-box one, and sizes the ground from the box', async () => {
    const { outDir, manifest, read } = await bake({ registration: false });
    try {
      const buildings = read<{ id: number; swap?: string }[]>('buildings.json');
      expect(buildings.map((b) => b.id).sort()).toEqual([101, 102, 106, 107]);
      expect(buildings.find((b) => b.id === 101)!.swap).toBe('alpha_hall');
      // 0.006 deg of lon at the equator ~ 668 m; of lat ~ 663 m
      expect(manifest.groundWm).toBeGreaterThan(660);
      expect(manifest.groundWm).toBeLessThan(672);
      expect(manifest.groundHm).toBeGreaterThan(655);
      expect(manifest.groundHm).toBeLessThan(672);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('clips streets to the box — no vertex escapes the drape extent', async () => {
    // Overpass returns boundary-straddling ways in full; unclipped they trail
    // ~1km past the drape and read as misaligned. Every street vertex must be
    // within the box half-extents (small epsilon for quantization).
    const { outDir, manifest, read } = await bake({ registration: false });
    try {
      const streets = read<{ pts: number[] }[]>('streets.json');
      // 104 (clipped, one piece) + 108 + footway 103
      expect(streets).toHaveLength(3);
      const halfW = manifest.groundWm / 2;
      const halfH = manifest.groundHm / 2;
      let escaped = 0;
      let nearWestEdge = 0;
      for (const s of streets) {
        for (let i = 0; i < s.pts.length; i += 2) {
          if (
            Math.abs(s.pts[i]) > halfW + 2 ||
            Math.abs(s.pts[i + 1]) > halfH + 2
          )
            escaped++;
          // way 104 started at lon -0.02 (~2.2 km west): clipping must CUT it at
          // the west edge, not drop it
          if (Math.abs(s.pts[i] + halfW) < 0.5) nearWestEdge++;
        }
      }
      expect(escaped).toBe(0);
      expect(nearWestEdge).toBe(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('measures footprint-vs-aerial registration into the manifest (#233)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
    try {
      // The drape was drawn at the footprints' true lon/lat, so the measured
      // RESIDUAL must be within the fine step (0.5 m) of zero. Diagnostics go
      // to the temp dir, never the committed fixture.
      const manifest = await buildScene(
        fixtureDir,
        outDir,
        site,
        proj,
        site.drapeSource,
        { registrationDir: join(outDir, 'registration') }
      );
      expect(manifest.registration).toBeTruthy();
      const reg = manifest.registration!;
      expect(Math.abs(reg.offsetM.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(reg.offsetM.z)).toBeLessThanOrEqual(0.5);
      expect(reg.score).toBeGreaterThan(0);
      expect(reg.confidence).toBeGreaterThan(0);
      expect(existsSync(join(outDir, 'registration/report.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('registers each way-based hero on its true OSM footprint centroid (<=1 m)', async () => {
    // Ground-truth registration: a hero backed by a real OSM way MUST be
    // emitted at that way's own footprint centroid, projected through the same
    // ENU the whole scene uses. Computed straight from the raw osm.json, so it
    // catches a stale/approximate anchor that a "contained in the box" check
    // cannot. Covers both the building branch (101) and the non-building
    // fallback branch (103, a footway).
    const osm = JSON.parse(
      readFileSync(join(fixtureDir, 'osm.json'), 'utf8')
    ) as {
      elements: {
        id: number;
        geometry?: { lat: number; lon: number }[];
      }[];
    };
    const byId = new Map(osm.elements.map((e) => [e.id, e]));

    const { outDir, read } = await bake({ registration: false });
    try {
      const heroes =
        read<{ swap: string; x: number; z: number }[]>('heroes.json');
      let checked = 0;
      for (const h of site.heroes) {
        if (h.wayId == null) continue;
        const el = byId.get(h.wayId);
        expect(
          el?.geometry,
          `raw way ${h.wayId} (${h.slug}) missing`
        ).toBeTruthy();
        const ring = el!.geometry!.map((g) =>
          proj.lonLatToEnu(g.lon, g.lat)
        ) as [number, number][];
        const [tx, tz] = polygonCentroid(ring);

        const hero = heroes.find((x) => x.swap === h.slug);
        expect(hero, `hero ${h.slug} not emitted`).toBeTruthy();
        const dist = Math.hypot(hero!.x - tx, hero!.z - tz);
        expect(
          dist,
          `${h.slug} is ${dist.toFixed(1)} m from its true OSM footprint centroid`
        ).toBeLessThanOrEqual(1);
        checked++;
      }
      expect(checked).toBe(2);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
