import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ringAreaM2, polygonCentroid, buildScene } from '../build-scene';

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

// These exercise the full buildScene() derive against the raw upstream cache
// (public/chatt/_raw/). That cache is gitignored (large, regenerable via
// `pnpm bake`), so it exists locally but NOT in CI or a fresh clone — skip the
// suite when it's absent rather than fail. The committed DERIVED artifacts
// (public/chatt/*.json) are the runtime source of truth and are covered by the
// runtime component tests; these integration tests just validate the deriver.
const rawDir = join(process.cwd(), 'public/chatt/_raw');
const hasRaw = existsSync(join(rawDir, 'osm.json'));

describe.skipIf(!hasRaw)(
  'build-scene hero resolution (local _raw cache; skipped in CI)',
  () => {
    const ALL_HERO_KEYS = [
      'aquarium',
      'walnut_st_bridge',
      'tivoli',
      'dome_building',
      'courthouse',
      'hunter_museum',
      'choo_choo',
      'republic_centre',
    ];

    it('resolves all 8 hero keys and none sit on a street', async () => {
      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        await buildScene(rawDir, outDir);

        const heroes = JSON.parse(
          readFileSync(join(outDir, 'heroes.json'), 'utf8')
        ) as { swap: string; x: number; z: number }[];
        const streets = JSON.parse(
          readFileSync(join(outDir, 'streets.json'), 'utf8')
        ) as { pts: number[] }[];

        const foundKeys = heroes.map((h) => h.swap).sort();
        expect(foundKeys).toEqual([...ALL_HERO_KEYS].sort());

        // None of the hero anchor points should coincide with any street vertex
        // (a hero placed "on a street" indicates the regex matched a road name
        // instead of a building/landmark).
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

    it('produces ~1544 buildings for the extended corridor box', async () => {
      const outDir = mkdtempSync(join(tmpdir(), 'build-scene-test-'));
      try {
        const manifest = await buildScene(rawDir, outDir);
        const buildings = JSON.parse(
          readFileSync(join(outDir, 'buildings.json'), 'utf8')
        ) as unknown[];
        expect(buildings.length).toBeGreaterThan(1000);
        expect(manifest.groundHm).toBeGreaterThan(5000);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    });
  }
);
