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
