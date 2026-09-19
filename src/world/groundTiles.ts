/**
 * Tiled aerial ground (#1176).
 *
 * WHY. The diorama drew its aerial as ONE texture on ONE PlaneGeometry
 * (`Terrain.tsx`, `WideCity.tsx:103`). A WebGL implementation is only required
 * to support 8192px, and chatt's wide extent at 1 m/px is already 8212px
 * across, so the drape was pinned near 1.5 m/px by the RENDERER while the
 * source service serves 0.2445. The bake's hardcoded 1.5 read as a judgement
 * about the pulled-back camera; it was a texture limit wearing a comment about
 * framing. Tiles remove the ceiling — resolution becomes a bake parameter.
 *
 * WHY THE MATH LIVES HERE AND NOT IN THE COMPONENT. Two independently-built
 * meshes have to agree on the height of every vertex along their shared edge.
 * Disagree by a float and you get a hairline crack of skybox through the
 * ground at every seam, at every frame, which reads as a rendering glitch
 * rather than as an arithmetic one. The agreement is guaranteed by both meshes
 * deriving `u,v` from WORLD position through one function, never from
 * tile-local coordinates — so that function is pure and tested.
 */

/** A tile's world rectangle, metres, twin-centred: [minX, minZ, maxX, maxZ]. */
export type TileWorld = [number, number, number, number];

export interface GroundTile {
  row: number;
  col: number;
  path: string;
  world: TileWorld;
}

export interface DrapeTiling {
  cols: number;
  rows: number;
  /** Directory holding the tiles, relative to the twin root. */
  dir: string;
  source: { width: number; height: number };
  tiles: GroundTile[];
}

/**
 * World position -> heightfield UV.
 *
 * This reproduces EXACTLY what the single-plane path computes, and that is the
 * whole contract. There, a vertex's plane-local X is its world X (the plane is
 * centred on the origin) so `u = x/W + 0.5`; and `rotateX(-PI/2)` sends local
 * +Y to world -Z, so `v = -z/H + 0.5`. A tiled mesh that derived v from its own
 * local Y would be correct in isolation and wrong at every seam.
 */
export function worldToGridUv(
  worldX: number,
  worldZ: number,
  groundWm: number,
  groundHm: number
): { u: number; v: number } {
  return { u: worldX / groundWm + 0.5, v: -worldZ / groundHm + 0.5 };
}

/**
 * Segment counts for one tile, proportional to its share of the heightfield.
 *
 * Proportional rather than fixed because tiles are not all the same size — the
 * last row and column carry the remainder. A fixed count would oversample the
 * small edge tiles and undersample nothing, which is merely wasteful; but it
 * would also put a different vertex SPACING on either side of a seam, and two
 * different spacings sampling the same continuous heightfield do not produce
 * the same polyline between shared endpoints. The crack reappears mid-edge
 * rather than at the corners, which is harder to recognise.
 *
 * Minimum 1 so a degenerate tile still produces a quad rather than an empty
 * geometry that silently draws nothing.
 */
export function tileSegments(
  world: TileWorld,
  groundWm: number,
  groundHm: number,
  gridCols: number,
  gridRows: number
): { segX: number; segY: number } {
  const [minX, minZ, maxX, maxZ] = world;
  const fracX = Math.abs(maxX - minX) / groundWm;
  const fracZ = Math.abs(maxZ - minZ) / groundHm;
  return {
    segX: Math.max(1, Math.round((gridCols - 1) * fracX)),
    segY: Math.max(1, Math.round((gridRows - 1) * fracZ)),
  };
}

/** Centre and size of a tile in world metres. */
export function tilePlacement(world: TileWorld): {
  cx: number;
  cz: number;
  width: number;
  depth: number;
} {
  const [minX, minZ, maxX, maxZ] = world;
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width: Math.abs(maxX - minX),
    depth: Math.abs(maxZ - minZ),
  };
}

/**
 * Is this tiling usable for this scene?
 *
 * REFUSES rather than draws something wrong. A tiling baked against a different
 * extent produces tiles that are individually valid and collectively a city
 * squeezed into a corner of the ground — real imagery at wrong world
 * rectangles, which looks like a plausible place that is wrong everywhere
 * rather than like a bug. The caller falls back to the single texture, which is
 * merely blurry.
 *
 * The tolerance is a metre because the plan's rectangles come from integer
 * pixel edges divided by the raster size, so the outermost edges land on the
 * extent to within rounding, not exactly.
 */
export function tilingCoversExtent(
  tiling: DrapeTiling | null | undefined,
  groundWm: number,
  groundHm: number,
  tolM = 1
): boolean {
  if (!tiling?.tiles?.length) return false;
  const xs = tiling.tiles.flatMap((t) => [t.world[0], t.world[2]]);
  const zs = tiling.tiles.flatMap((t) => [t.world[1], t.world[3]]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  return (
    Math.abs(spanX - groundWm) <= tolM && Math.abs(spanZ - groundHm) <= tolM
  );
}

/**
 * Which tiles are worth having loaded, nearest first.
 *
 * WHY THIS EXISTS. The first version of the tiled ground fetched every tile and
 * blocked the scene on `Promise.all` — 221 tiles and 55 MB before anything drew.
 * That is a dead page on mobile, and it is wasted by construction: the diorama
 * camera frames 8 x 7.5 km into ~1400px, which needs roughly 6 m/px on screen.
 * The 0.5 m/px detail only earns its bytes once the camera is close.
 *
 * So the data is used as the two-level pyramid it already forms — the small
 * downscaled `drape-wide.jpg` is the far level and draws immediately, and these
 * are the near level, streamed in behind it.
 *
 * Distance is measured to the nearest point of the tile's rectangle, not its
 * centre: a camera sitting just outside a large tile is ON it visually, and
 * centre-distance would rank it behind smaller tiles that are further away.
 */
export function tilesByPriority(
  tiling: DrapeTiling,
  camX: number,
  camZ: number,
  radiusM: number
): GroundTile[] {
  const d2 = (t: GroundTile) => {
    const [minX, minZ, maxX, maxZ] = t.world;
    const dx = Math.max(minX - camX, 0, camX - maxX);
    const dz = Math.max(minZ - camZ, 0, camZ - maxZ);
    return dx * dx + dz * dz;
  };
  return tiling.tiles
    .map((t) => ({ t, d: d2(t) }))
    .filter((x) => x.d <= radiusM * radiusM)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.t);
}
