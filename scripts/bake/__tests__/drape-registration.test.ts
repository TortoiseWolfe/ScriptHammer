import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Manifest } from '@/lib/manifest';

// "No buildings floating over the river" — as an automated check, not a screenshot.
//
// The historical bug (#222): the NAIP aerial drape was N-S mis-registered, so
// south-bank buildings rendered on drape pixels that are open water. This test
// decodes the COMMITTED drape.jpg, maps each building footprint centroid to its
// drape pixel via the exact runtime mapping, and asserts that riverfront
// buildings do NOT land on water. If the N-S registration ever regresses, the
// buildings drift back into the river and this test fails.
//
// All inputs (drape.jpg, buildings.json, manifest.json) are committed under
// public/chatt/, so this runs in CI without the gitignored _raw cache.

const CHATT = join(process.cwd(), 'public/chatt');

const manifest = JSON.parse(
  readFileSync(join(CHATT, 'manifest.json'), 'utf8')
) as Manifest;
const buildings = JSON.parse(
  readFileSync(join(CHATT, 'buildings.json'), 'utf8')
) as { id: number; ring: number[] }[];

// Runtime pixel mapping (Terrain.tsx UV glue + texture flipY=true): a world
// (x,z) samples drape column u=x/w+0.5 and image row=(0.5+z/h)*(H-1).
function centroidXZ(ring: number[]): [number, number] {
  let x = 0;
  let z = 0;
  const n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) {
    x += ring[i];
    z += ring[i + 1];
  }
  return [x / n, z / n];
}

// A drape pixel is "water" if it's dark and green-dominant (river surface in the
// NAIP orthophoto reads as low-brightness teal/green). Same heuristic used in the
// manual overlay verification.
function isWater(r: number, g: number, b: number): boolean {
  const bright = (r + g + b) / 3;
  return bright < 115 && g >= r && g >= b;
}

describe('drape registration — no buildings float over the river', () => {
  it('riverfront building centroids land on non-water drape pixels', async () => {
    const { width: W, height: H } = await sharp(join(CHATT, 'drape.jpg'))
      .metadata()
      .then((m) => ({ width: m.width!, height: m.height! }));
    const { data, info } = await sharp(join(CHATT, 'drape.jpg'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels;

    const w = manifest.groundWm;
    const h = manifest.groundHm;
    const col = (x: number) => Math.round((x / w + 0.5) * (W - 1));
    const row = (z: number) => Math.round((0.5 + z / h) * (H - 1));
    const pixel = (cx: number, cy: number) => {
      const i = (cy * W + cx) * ch;
      return [data[i], data[i + 1], data[i + 2]] as const;
    };

    // The river crosses the northern (downtown) end of the corridor. Restrict to
    // buildings in that band — that's where the float bug manifested and where a
    // building-on-water pixel unambiguously means misregistration. (Elsewhere a
    // waterside building could legitimately touch a pond/creek edge.)
    const RIVER_BAND_Z_MIN = -2650; // ENU metres (north is -Z)
    const RIVER_BAND_Z_MAX = -2100;
    const riverfront = buildings
      .map((b) => centroidXZ(b.ring))
      .filter(([, z]) => z >= RIVER_BAND_Z_MIN && z <= RIVER_BAND_Z_MAX);

    // Sanity: the band must actually contain buildings, or the test proves nothing.
    expect(riverfront.length).toBeGreaterThan(20);

    let onWater = 0;
    for (const [x, z] of riverfront) {
      const cx = Math.min(W - 1, Math.max(0, col(x)));
      const cy = Math.min(H - 1, Math.max(0, row(z)));
      const [r, g, b] = pixel(cx, cy);
      if (isWater(r, g, b)) onWater++;
    }

    const fraction = onWater / riverfront.length;
    // With correct registration a handful of true riverbank footprints may clip a
    // water pixel, but the mass of riverfront buildings sits on land. The N-S
    // float bug pushed a large fraction into the river (was ~30%+). Guard at 10%.
    expect(
      fraction,
      `${onWater}/${riverfront.length} riverfront building centroids landed on water pixels ` +
        `(${(fraction * 100).toFixed(1)}%) — buildings are floating over the river (N-S drape misregistration)`
    ).toBeLessThan(0.1);
  });
});
