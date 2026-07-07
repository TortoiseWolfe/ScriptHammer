/**
 * Recenters a flat ENU ring (x0,z0,x1,z1,...) on its centroid.
 *
 * Building footprints are baked in world ENU coordinates. To extrude a
 * building with a THREE.Shape and place the resulting geometry with a
 * single translate(), we need the shape's local vertices centered on
 * (0,0) plus the centroid to translate back to.
 */
export function ringToShape(flatRing: number[]): {
  center: [number, number];
  localRing: [number, number][];
} {
  const pts: [number, number][] = [];
  for (let i = 0; i < flatRing.length; i += 2)
    pts.push([flatRing[i], flatRing[i + 1]]);
  let cx = 0,
    cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= pts.length;
  cz /= pts.length;
  return {
    center: [cx, cz],
    localRing: pts.map(([x, z]) => [x - cx, z - cz] as [number, number]),
  };
}
