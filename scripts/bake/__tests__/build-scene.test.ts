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
import { loadSiteConfig, SiteConfigSchema } from '../site-config';

const site = loadSiteConfig('chatt');
const proj = createProjection(site.box);

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

      // manifest carries the site block + basename drape path; water is a bake
      // RESULT (nothing carved here → false)
      expect(manifest.drape.path).toBe('drape.jpg');
      expect(manifest.site).toEqual({
        slug: 'tiny',
        name: 'Tiny Test Site',
        water: false,
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

// These exercise the full buildScene() derive against the raw upstream cache
// (public/twins/chatt/_raw/). That cache is gitignored (large, regenerable via
// `pnpm bake`), so it exists locally but NOT in CI or a fresh clone — skip the
// suite when it's absent rather than fail. The committed DERIVED artifacts
// (public/twins/chatt/*.json) are the runtime source of truth and are covered
// by the runtime component tests; these integration tests just validate the
// deriver.
const rawDir = join(process.cwd(), 'public/twins/chatt/_raw');
const hasRaw = existsSync(join(rawDir, 'osm.json'));

describe.skipIf(!hasRaw)(
  'build-scene hero resolution (local _raw cache; skipped in CI)',
  () => {
    const ALL_HERO_KEYS = site.heroes.map((h) => h.slug);

    // registration: false — the #233 measurement (Sobel over the full 19M-px
    // drape) costs ~10s per call and has its own unit suite + the dedicated
    // integration test below; these tests assert hero/clip/height behavior.
    it('resolves all 8 hero keys and none sit on a street', async () => {
      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        await buildScene(rawDir, outDir, site, proj, site.drapeSource, {
          registration: false,
        });

        const heroes = JSON.parse(
          readFileSync(join(outDir, 'heroes.json'), 'utf8')
        ) as { swap: string; x: number; z: number }[];
        const streets = JSON.parse(
          readFileSync(join(outDir, 'streets.json'), 'utf8')
        ) as { pts: number[] }[];

        const foundKeys = heroes.map((h) => h.swap).sort();
        expect(foundKeys).toEqual([...ALL_HERO_KEYS].sort());

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
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    });

    it('produces ~1500 buildings for the extended corridor box', async () => {
      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        const manifest = await buildScene(
          rawDir,
          outDir,
          site,
          proj,
          site.drapeSource,
          { registration: false }
        );
        const buildings = JSON.parse(
          readFileSync(join(outDir, 'buildings.json'), 'utf8')
        ) as unknown[];
        expect(buildings.length).toBeGreaterThan(1000);
        expect(manifest.groundHm).toBeGreaterThan(5000);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    });

    it('clips streets to the box — no vertex escapes the drape extent', async () => {
      // Overpass returns boundary-straddling ways in full; unclipped they trail
      // ~1km past the drape and read as misaligned. Every street vertex must be
      // within the box half-extents (small epsilon for quantization).
      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        const manifest = await buildScene(
          rawDir,
          outDir,
          site,
          proj,
          site.drapeSource,
          { registration: false }
        );
        const streets = JSON.parse(
          readFileSync(join(outDir, 'streets.json'), 'utf8')
        ) as { pts: number[] }[];
        const halfW = manifest.groundWm / 2;
        const halfH = manifest.groundHm / 2;
        let escaped = 0;
        for (const s of streets) {
          for (let i = 0; i < s.pts.length; i += 2) {
            if (
              Math.abs(s.pts[i]) > halfW + 2 ||
              Math.abs(s.pts[i + 1]) > halfH + 2
            )
              escaped++;
          }
        }
        expect(escaped).toBe(0);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    });

    // Also needs the cached drape (hasRaw alone only guarantees osm.json —
    // a partial cache would hard-fail inside runRegistration otherwise).
    it.skipIf(!existsSync(join(rawDir, 'drape.jpg')))(
      'measures footprint-vs-aerial registration into the manifest (#233)',
      { timeout: 120_000 }, // Sobel over the full flagship drape under suite load
      async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
        try {
          // The same projection the real bake uses (pinned vectorOffsetM
          // applied) — the measured RESIDUAL must be within the fine step of
          // zero, or the pinned correction has rotted vs the cached drape.
          // Diagnostics go to the temp dir, NOT the developer's real
          // _raw/registration (which describes the last real bake).
          const pinnedProj = createProjection(site.box, site.vectorOffsetM);
          const manifest = await buildScene(
            rawDir,
            outDir,
            site,
            pinnedProj,
            site.drapeSource,
            { registrationDir: join(outDir, 'registration') }
          );
          expect(manifest.registration).toBeTruthy();
          const reg = manifest.registration!;
          expect(Math.abs(reg.offsetM.x)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(reg.offsetM.z)).toBeLessThanOrEqual(0.5);
          expect(reg.score).toBeGreaterThan(0);
          expect(reg.confidence).toBeGreaterThan(0);
          expect(existsSync(join(outDir, 'registration/report.json'))).toBe(
            true
          );
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      }
    );

    it('registers each way-based hero on its true OSM footprint centroid (≤5 m)', async () => {
      // Ground-truth registration: a hero backed by a real OSM way (aquarium,
      // courthouse, republic_centre, walnut_st_bridge) MUST be emitted at that
      // way's own footprint centroid, projected through the same ENU the whole
      // scene uses. If a hero drifts from its real footprint, it renders beside
      // the landmark (e.g. the aquarium marker landing on riverbank grass).
      // This is objective — computed straight from _raw/osm.json — so it catches
      // a stale/approximate anchor that a "contained in the box" check cannot.
      const osm = JSON.parse(
        readFileSync(join(rawDir, 'osm.json'), 'utf8')
      ) as {
        elements: {
          id: number;
          geometry?: { lat: number; lon: number }[];
        }[];
      };
      const byId = new Map(osm.elements.map((e) => [e.id, e]));

      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        await buildScene(rawDir, outDir, site, proj, site.drapeSource, {
          registration: false,
        });
        const heroes = JSON.parse(
          readFileSync(join(outDir, 'heroes.json'), 'utf8')
        ) as { swap: string; x: number; z: number }[];

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
          ).toBeLessThanOrEqual(5);
        }
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    });
  }
);
