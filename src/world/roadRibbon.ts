import type { Street } from '@/lib/manifest';

/** A mitred corner is stretched along the bisector to keep the road width, and
 *  that stretch is capped. A hairpin would otherwise throw a spike far outside
 *  the road; past this factor the corner is left slightly notched instead. */
const MITRE_LIMIT = 2;

/**
 * Street centrelines → terrain-riding quads, as flat position/uv arrays for a
 * non-indexed BufferGeometry.
 *
 * Every triangle is wound counter-clockwise seen from above, so its geometric
 * normal points +Y and the ribbon lights correctly as a FrontSide mesh (#1175).
 * The previous winding, (A,B,C)+(C,B,D), faced every triangle DOWN; under
 * DoubleSide three flips the normal of a back-facing fragment, so the forced
 * +Y normals became −Y and the roads received no directional light at all.
 *
 * Two more defects from the same ticket are handled here:
 *
 * - Bends are mitred. Each interior vertex of a street shares one pair of edge
 *   points between the two segments that meet there, so a bend leaves neither a
 *   notch of bare ground on the outside nor a stack of overlapping quads.
 * - Long segments are cut into pieces no longer than `maxStep` metres (pass the
 *   terrain sample spacing). A quad is planar between its corners, so a 400 m
 *   segment over a hill used to cut straight through it.
 *
 * Junctions between different streets are not joined: each street is still its
 * own ribbon, so two streets that cross still overlap there.
 */
export function roadRibbon(
  streets: Street[],
  yAt: (x: number, z: number) => number,
  width: number,
  maxStep: number = Infinity
): { positions: number[]; uvs: number[] } {
  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];

  for (const s of streets) {
    // Centreline with consecutive duplicates removed, so every segment has a
    // direction and every vertex a well-defined bend.
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i + 1 < s.pts.length; i += 2) {
      const n = xs.length;
      if (
        n > 0 &&
        Math.hypot(s.pts[i] - xs[n - 1], s.pts[i + 1] - zs[n - 1]) < 1e-3
      ) {
        continue;
      }
      xs.push(s.pts[i]);
      zs.push(s.pts[i + 1]);
    }
    const count = xs.length;
    if (count < 2) continue;

    // Left-hand unit normal of each segment, in XZ.
    const segNx: number[] = [];
    const segNz: number[] = [];
    for (let i = 0; i + 1 < count; i++) {
      const dx = xs[i + 1] - xs[i],
        dz = zs[i + 1] - zs[i];
      const len = Math.hypot(dx, dz);
      segNx.push(-dz / len);
      segNz.push(dx / len);
    }

    // Offset from the centreline to the left edge at each vertex (the right edge
    // is its negation). Ends use their one segment's normal; interior vertices
    // use the mitre.
    const offX: number[] = [];
    const offZ: number[] = [];
    for (let v = 0; v < count; v++) {
      if (v === 0 || v === count - 1) {
        const k = v === 0 ? 0 : count - 2;
        offX.push(segNx[k] * half);
        offZ.push(segNz[k] * half);
        continue;
      }
      const mx = segNx[v - 1] + segNx[v];
      const mz = segNz[v - 1] + segNz[v];
      const mlen = Math.hypot(mx, mz);
      if (mlen < 1e-6) {
        // An exact reversal: no bisector exists, keep the outgoing normal.
        offX.push(segNx[v] * half);
        offZ.push(segNz[v] * half);
        continue;
      }
      const bx = mx / mlen,
        bz = mz / mlen;
      // Stretch so the edge stays `half` away from BOTH segments.
      const along = bx * segNx[v] + bz * segNz[v];
      const stretch = Math.min(1 / along, MITRE_LIMIT);
      offX.push(bx * half * stretch);
      offZ.push(bz * half * stretch);
    }

    for (let i = 0; i + 1 < count; i++) {
      const len = Math.hypot(xs[i + 1] - xs[i], zs[i + 1] - zs[i]);
      const pieces = Math.max(1, Math.ceil(len / maxStep));
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces,
          t1 = (k + 1) / pieces;
        const at = (t: number) => ({
          cx: xs[i] + (xs[i + 1] - xs[i]) * t,
          cz: zs[i] + (zs[i + 1] - zs[i]) * t,
          ox: offX[i] + (offX[i + 1] - offX[i]) * t,
          oz: offZ[i] + (offZ[i + 1] - offZ[i]) * t,
        });
        const p0 = at(t0),
          p1 = at(t1);
        // Corners: A=left@start B=right@start C=left@end D=right@end.
        const aX = p0.cx + p0.ox,
          aZ = p0.cz + p0.oz,
          bX = p0.cx - p0.ox,
          bZ = p0.cz - p0.oz,
          cX = p1.cx + p1.ox,
          cZ = p1.cz + p1.oz,
          dX = p1.cx - p1.ox,
          dZ = p1.cz - p1.oz;
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
  }
  return { positions, uvs };
}
