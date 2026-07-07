import type { TerrainGrid, Manifest } from '@/lib/manifest';

export function bilinear(grid: TerrainGrid, u: number, v: number): number {
  const { cols, rows, heights } = grid;
  const gx = Math.min(cols - 1, Math.max(0, u * (cols - 1)));
  const gz = Math.min(rows - 1, Math.max(0, v * (rows - 1)));
  const x0 = Math.floor(gx),
    z0 = Math.floor(gz);
  const x1 = Math.min(cols - 1, x0 + 1),
    z1 = Math.min(rows - 1, z0 + 1);
  const fx = gx - x0,
    fz = gz - z0;
  const h = (c: number, r: number) => heights[r * cols + c];
  const top = h(x0, z0) * (1 - fx) + h(x1, z0) * fx;
  const bot = h(x0, z1) * (1 - fx) + h(x1, z1) * fx;
  return top * (1 - fz) + bot * fz;
}

/** Minimum elevation (metres) across the whole grid — used to normalize the
 *  diorama so the lowest ground sits at Y=0 instead of ~194m. */
export function minElevation(grid: TerrainGrid): number {
  let m = Infinity;
  for (const h of grid.heights) if (h < m) m = h;
  return m;
}

/**
 * Terrain elevation (metres) at an ENU (x, z) point — the inverse of the
 * mapping `Terrain.tsx` uses to build the plane. This is the single
 * authoritative x,z→height sampler so buildings/heroes/streets sit on the
 * same surface the terrain mesh renders.
 *
 * Axis note: `Terrain.tsx` builds a PlaneGeometry (x spans −w/2..+w/2, plane-Y
 * spans −h/2..+h/2) with `u = x/w + 0.5` (W→E), `v = planeY/h + 0.5` (S→N),
 * then `rotateX(-π/2)`, which sends plane-Y → −worldZ. So a world-Z maps back
 * to `v = 0.5 − z/groundHm` (NOT `z/h + 0.5`, which would mirror N↔S).
 */
export function elevationAt(
  grid: TerrainGrid,
  manifest: Manifest,
  x: number,
  z: number
): number {
  const u = x / manifest.groundWm + 0.5;
  const v = 0.5 - z / manifest.groundHm;
  return bilinear(grid, u, v);
}

export function assertExtent(
  manifest: Manifest,
  quadWm: number,
  quadHm: number
): void {
  if (
    Math.abs(quadWm - manifest.groundWm) > 1 ||
    Math.abs(quadHm - manifest.groundHm) > 1
  ) {
    throw new Error(
      `terrain extent mismatch: quad ${quadWm}x${quadHm} vs manifest ${manifest.groundWm}x${manifest.groundHm}`
    );
  }
}
