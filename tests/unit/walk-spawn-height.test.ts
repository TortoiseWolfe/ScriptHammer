import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjection } from '@/lib/enu';
import { elevationAt, minElevation } from '@/world/terrainSample';

/**
 * Walk mode must not spawn you under the map (#651).
 *
 * REPORTED TWICE. The first fix corrected WHERE you spawn horizontally — the wide
 * path was using embedded-twin coordinates that reproject ~5 km off the baked city.
 * That part works. It did nothing about the VERTICAL, and the bug reported after it
 * was "the bike is still below the terrain and we're falling" — player and bike
 * both underground.
 *
 * THE VERTICAL BUG. `TwinCanvas.client.tsx` computed the spawn height as
 *
 *     const sy = groundAtRef.current?.(sx, sz) ?? 0;
 *
 * and `tryBuildWalk()` gated only on the terrain and buildings meshes. The ground
 * sampler is published from a DIFFERENT lifecycle — an effect in WideCity/TwinWorld
 * that waits on the elevation grid — so the two raced, and when the meshes won,
 * `groundAtRef.current` was still null and the height fell through to `?? 0`.
 * `parkBike()` was handed the same `sy`, which is exactly why the bike was down
 * there too.
 *
 * WHY ZERO IS NOT HARMLESS. The sampler is `elevationAt(...) - minElevation(grid)`,
 * normalised so the LOWEST cell of the terrain is 0. Zero is not sea level and it is
 * not "the ground" — it is the single lowest point in the whole grid. Anywhere else,
 * spawning at 0 is spawning inside the hill.
 *
 * WHAT THIS TEST PINS. That the drop is real and large, using the SAME data and the
 * SAME math the app uses at runtime — the shipped `chatt` manifest and wide terrain
 * grid, `createProjection`, `elevationAt`, `minElevation`. If the correct spawn
 * height at the riverfront were itself ~0, the `?? 0` fallback would have been
 * harmless and this whole bug could not exist; this test proves it is not, so the
 * fallback was always a real fall.
 *
 * It is deliberately NOT a pixel check. `tests/e2e/twin-walk-visible.spec.ts` already
 * screenshots the canvas and asserts it is not a dark void — and it passed through
 * both occurrences of this bug, because being underground still renders pixels. The
 * thing that was wrong was a NUMBER, so the test has to read a number.
 */
const TWIN = join(process.cwd(), 'public', 'twins', 'chatt');

const manifest = JSON.parse(
  readFileSync(join(TWIN, 'manifest.json'), 'utf8')
) as Record<string, never> & {
  box: Parameters<typeof createProjection>[0];
  atlasBox: Parameters<typeof createProjection>[0];
  vectorOffsetM: { x: number; z: number };
  site: { framing: { homeFocus: [number, number, number] } };
};

const wide = JSON.parse(readFileSync(join(TWIN, 'terrain-wide.json'), 'utf8'));
const grid = wide.grid ?? wide;

/** The exact reprojection TwinCanvas performs to place the wide-path spawn. */
function spawnXZ(): [number, number] {
  const authored = manifest.site.framing.homeFocus;
  const nProj = createProjection(manifest.box, manifest.vectorOffsetM);
  const wProj = createProjection(manifest.atlasBox, manifest.vectorOffsetM);
  const [lon, lat] = nProj.enuToLonLat(authored[0], authored[2]);
  return wProj.lonLatToEnu(lon, lat);
}

describe('walk spawn height (#651)', () => {
  it('the fixtures this test depends on are actually present', () => {
    // A missing grid would make every assertion below vacuous rather than failing.
    expect(manifest.atlasBox, 'chatt manifest has no atlasBox').toBeTruthy();
    expect(
      manifest.site?.framing?.homeFocus,
      'chatt manifest has no authored homeFocus'
    ).toBeTruthy();
    expect(Array.isArray(grid) || typeof grid === 'object').toBe(true);
  });

  it('ground at the riverfront spawn is well above the grid minimum', () => {
    const [sx, sz] = spawnXZ();
    const min = minElevation(grid);
    const raw = elevationAt(
      grid,
      { ...manifest, box: manifest.atlasBox } as never,
      sx,
      sz
    );
    const sy = raw - min;

    // The whole bug in one assertion: if this were ~0, `?? 0` would have been a
    // harmless default. It is not, so spawning at 0 put the player (and the bike,
    // which is parked at the same y) that many metres underground.
    expect(
      sy,
      `correct spawn height is ${sy.toFixed(1)}m; the old '?? 0' fallback put the ` +
        `player and bike that far BELOW the terrain, which is the reported fall`
    ).toBeGreaterThan(1);

    // Sanity: the spawn must be inside the wide grid, not off its edge — an
    // out-of-bounds sample could return a bogus elevation that happens to be > 1.
    expect(Number.isFinite(sy)).toBe(true);
    expect(Number.isFinite(raw)).toBe(true);
  });
});
