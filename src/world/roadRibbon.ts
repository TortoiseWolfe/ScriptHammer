import type { Street } from '@/lib/manifest';

/**
 * Street centrelines → one terrain-riding quad per segment, as flat
 * position/uv arrays for a non-indexed BufferGeometry.
 *
 * Every triangle is wound counter-clockwise seen from above, so its geometric
 * normal points +Y and the ribbon lights correctly as a FrontSide mesh (#1175).
 * The previous winding, (A,B,C)+(C,B,D), faced every triangle DOWN; under
 * DoubleSide three flips the normal of a back-facing fragment, so the forced
 * +Y normals became −Y and the roads received no directional light at all.
 */
export function roadRibbon(
  streets: Street[],
  yAt: (x: number, z: number) => number,
  width: number
): { positions: number[]; uvs: number[] } {
  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const s of streets) {
    const p = s.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i],
        z0 = p[i + 1],
        x1 = p[i + 2],
        z1 = p[i + 3];
      let dx = x1 - x0,
        dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len;
      dz /= len;
      // Perpendicular offset in XZ (road half-width to each side).
      const nx = -dz * half,
        nz = dx * half;
      // Corners: A=left@start B=right@start C=left@end D=right@end.
      const aX = x0 + nx,
        aZ = z0 + nz,
        bX = x0 - nx,
        bZ = z0 - nz,
        cX = x1 + nx,
        cZ = z1 + nz,
        dX = x1 - nx,
        dZ = z1 - nz;
      const aY = yAt(aX, aZ),
        bY = yAt(bX, bZ),
        cY = yAt(cX, cZ),
        dY = yAt(dX, dZ);
      // Two triangles (A,C,B) + (C,D,B) — upward-facing for any direction.
      positions.push(aX, aY, aZ, cX, cY, cZ, bX, bY, bZ);
      positions.push(cX, cY, cZ, dX, dY, dZ, bX, bY, bZ);
      // Planar top-down UVs in metres → the asphalt tiles by `repeat`.
      uvs.push(aX, aZ, cX, cZ, bX, bZ);
      uvs.push(cX, cZ, dX, dZ, bX, bZ);
    }
  }
  return { positions, uvs };
}
