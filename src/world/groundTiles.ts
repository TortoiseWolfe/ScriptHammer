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

/* ----------------------------------------------------- live imagery ---- */

/**
 * Live imagery services a tile can be streamed from, instead of baked.
 *
 * WHY STREAM AT ALL. Baking caps the resolution, and not by a little. The bake
 * goes through one full raster, and sharp's default limitInputPixels is
 * 268.4 MP — which puts chatt's 8212 x 7566 m atlas extent at 0.5 m/px and no
 * finer. The sharpest source over Chattanooga is Hamilton County's 2024 orthos
 * at 0.1588 m/px; that extent at native resolution is ~3 billion pixels and
 * ~800 MB. It cannot be baked, at all, by any tuning of the existing pipeline.
 *
 * Streaming removes the question. The camera asks for the tiles it is near,
 * at the resolution it needs, and nothing is stored — which is exactly how the
 * Cesium atlas beside this renderer has always worked with Esri imagery. The
 * difference in sharpness between the two views was never the imagery or the
 * texture limit; it was that one streams and one baked.
 *
 * VERIFIED BEFORE BUILDING ON IT: the county service answers a cross-origin
 * request (`access-control-allow-origin` echoes the caller) and `f=image`
 * returns the JPEG directly, so no `f=json` round trip is needed at render
 * time. The bake still uses the f=json path, because there it is validating the
 * returned EXTENT — a different job from fetching pixels.
 */
export const IMAGERY_SERVICES = {
  hamco:
    'https://mapsdev.hamiltontn.gov/hcwa/rest/services/Base_Imagery_2024/MapServer/export',
  tnmap:
    'https://tnmap.tn.gov/arcgis/rest/services/BASEMAPS/IMAGERY_WEB_MERCATOR/MapServer/export',
} as const;

export type ImageryService = keyof typeof IMAGERY_SERVICES;

/**
 * Build the export URL for one tile, at a resolution capped by what the tile
 * can usefully carry.
 *
 * `maxPx` is a TEXTURE budget, not a quality setting: every tile is a separate
 * GPU texture, so asking for more than the renderer can hold wastes bandwidth
 * to produce something a driver will downsample anyway. 1024 is the floor every
 * GL implementation in service must clear, and a device that cannot take a
 * texture draws a BLACK ground reporting nothing — which is why this stays
 * conservative rather than tracking MAX_TEXTURE_SIZE.
 */
export function tileImageryUrl(
  // Only the world rectangle is needed. Taking the narrow shape rather than a
  // full GroundTile keeps Terrain able to pass whatever it holds.
  tile: { world: TileWorld },
  toLonLat: (x: number, z: number) => [number, number],
  service: ImageryService = 'hamco',
  maxPx = 1024,
  /** Finest ground resolution the service actually serves. hamco 0.1588 m/px
   *  (SR 2274, 0.5208333 ft/px); tnmap 0.2445 (LOD 19 after cos(lat)). */
  nativeMpp = 0.1588
): string {
  const [minX, minZ, maxX, maxZ] = tile.world;
  // -Z is north, so the tile's minZ edge is its NORTHERN one and becomes the
  // bbox's MAXIMUM latitude. Swapping these silently returns a mirrored strip.
  const [west, north] = toLonLat(minX, minZ);
  const [east, south] = toLonLat(maxX, maxZ);
  // Pixels the tile SHOULD carry at the source's native resolution, capped by
  // the texture budget. The first version of this asked for `metres` pixels,
  // which silently pins every request to 1 m/px no matter how fine the service
  // is — it returned real county imagery and looked like it worked.
  const wPx = Math.min(maxPx, Math.ceil((maxX - minX) / nativeMpp));
  const hPx = Math.min(maxPx, Math.ceil((maxZ - minZ) / nativeMpp));
  const q = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${Math.max(1, wPx)},${Math.max(1, hPx)}`,
    format: 'jpg',
    f: 'image',
  });
  return `${IMAGERY_SERVICES[service]}?${q}`;
}

/**
 * A streaming tile grid, derived from the scene extent rather than from a baked
 * raster.
 *
 * WHY NOT REUSE THE BAKED PLAN. Because tile SIZE is the resolution knob once
 * imagery is streamed, and the baked plan's size is an artifact of how a raster
 * was cut, not a choice. Measured: the baked 17x13 grid gives 483 m tiles, and
 * 483 m in the 1024px texture every GL implementation must support is
 * 0.472 m/px — indistinguishable from what the bake already ships. Streaming
 * through that grid would add a network dependency and buy nothing.
 *
 * To actually reach the county's native 0.1588 m/px a tile must cover at most
 * 1024 x 0.1588 = 163 m. So the grid is generated from `tileM`, and `tileM` is
 * chosen from the resolution you want, not inherited.
 *
 * The whole extent at 161 m is ~1,989 tiles, which sounds alarming and is not:
 * nothing fetches the whole extent. At a 600 m radius that is roughly 55 tiles,
 * about 5 MB, none of it stored.
 *
 * Edges are integer-divided the same way `splitEdges` does in the bake, so
 * adjacent tiles AGREE on their shared edge rather than each rounding
 * independently — the seam discipline is identical, it just applies to metres
 * here instead of pixels.
 */
export function planStreamingTiles(
  groundWm: number,
  groundHm: number,
  tileM: number,
  dir = 'live'
): DrapeTiling {
  const cols = Math.max(1, Math.ceil(groundWm / tileM));
  const rows = Math.max(1, Math.ceil(groundHm / tileM));
  const edge = (i: number, n: number, total: number) =>
    -total / 2 + (i / n) * total;
  const tiles: GroundTile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        row: r,
        col: c,
        // No file on disk — the path is an identity for the texture cache and
        // for the priority queue's dedupe, nothing more.
        path: `r${r}c${c}`,
        world: [
          edge(c, cols, groundWm),
          edge(r, rows, groundHm),
          edge(c + 1, cols, groundWm),
          edge(r + 1, rows, groundHm),
        ],
      });
    }
  }
  return {
    cols,
    rows,
    dir,
    source: { width: cols * 1024, height: rows * 1024 },
    tiles,
  };
}
