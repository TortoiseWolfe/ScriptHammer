// Baked 3DEP terrain -> a Cesium terrain provider.
//
// Beats the Build Plan's Phase 1 (a free ion token buys Cesium World Terrain):
// this is USGS 3DEP at ~9 m posting over the site, already on disk, and needs
// no token or account. chatt carries 55.5 m of real relief that the ellipsoid
// renders dead flat.
//
// TWO WAYS THIS SILENTLY GOES WRONG, both handled here:
//
//  1. DATUM. 3DEP heights are ORTHOMETRIC (NAVD88); Cesium wants heights above
//     the WGS84 ELLIPSOID. h = H + N, and N ≈ -29.657 m at Chattanooga (NGS
//     GEOID12B). Skip it and the entire site sits ~30 m too high — the Build
//     Plan's self-declared "#1 gotcha", which its own Phase 0 viewer then ships
//     (it extrudes at height:0 and loads World Terrain anyway, so its buildings
//     sink the moment a token is added; its traffic layer hardcodes
//     `hasTerrain ? 210 : 3` to dodge the same thing).
//
//  2. ROW ORDER. scripts/bake/fetch-terrain.ts's buildGrid walks
//     `lat = swLat + span*(j/(rows-1))`, so grid row 0 is the SOUTH edge.
//     Cesium heightmaps are row-major NORTH->south. Feed one to the other
//     unflipped and the terrain is mirrored about the centre latitude — which
//     looks like plausible hills, not like a bug.

import * as Cesium from 'cesium';
import type { Manifest, TerrainGrid } from '@/lib/manifest';

/** Samples per heightmap tile edge. */
const TILE_SAMPLES = 64;

/**
 * Deepest level we claim data for.
 *
 * A GeographicTilingScheme tile spans 180/2^level degrees. The baked grid is
 * ~9 m posting (198x644 over the box), so 64 samples of real detail is a tile
 * of ~64*9 m = 576 m = 0.0052 deg => 180/2^L = 0.0052 => L ~= 15. Beyond that
 * we would be interpolating our own bilinear output and claiming resolution we
 * do not have.
 */
const MAX_LEVEL = 15;

/**
 * Bilinear sample of the baked grid, in ORTHOMETRIC metres, clamped at the
 * edges. Clamping (rather than a nodata value) means tiles that overhang the
 * box extend the boundary elevation instead of falling off a cliff to zero.
 */
export function sampleOrthometricM(
  manifest: Manifest,
  grid: TerrainGrid,
  lon: number,
  lat: number
): number {
  const { swLat, swLon, neLat, neLon } = manifest.box;
  const { cols, rows, heights } = grid;

  // Fractional grid coords. Row 0 = south (buildGrid's convention), col 0 = west.
  const fx = ((lon - swLon) / (neLon - swLon)) * (cols - 1);
  const fy = ((lat - swLat) / (neLat - swLat)) * (rows - 1);

  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);
  const x0 = clamp(Math.floor(fx), cols - 1);
  const y0 = clamp(Math.floor(fy), rows - 1);
  const x1 = clamp(x0 + 1, cols - 1);
  const y1 = clamp(y0 + 1, rows - 1);
  const tx = clamp(fx, cols - 1) - x0;
  const ty = clamp(fy, rows - 1) - y0;

  const at = (x: number, y: number) => heights[y * cols + x];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bot = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bot * ty;
}

/** Ellipsoidal height at lon/lat — what Cesium and every georeferenced
 *  consumer actually wants. This is the ONE place the geoid separation is
 *  applied. */
export function sampleEllipsoidalM(
  manifest: Manifest,
  grid: TerrainGrid,
  lon: number,
  lat: number
): number {
  return (
    sampleOrthometricM(manifest, grid, lon, lat) + (manifest.geoidOffsetM ?? 0)
  );
}

/**
 * A terrain provider that serves baked 3DEP inside the site box and the
 * ellipsoid everywhere else.
 *
 * TWO THINGS HERE ARE LOAD-BEARING AND BOTH WERE LEARNED BY BREAKING THEM:
 *
 * 1. The tiling scheme MUST be the default global one. Restricting it to the
 *    site rectangle is tempting — that is the only place we have data — but the
 *    globe derives its tiling from the TERRAIN provider while imagery carries
 *    its own (Esri is global Web Mercator). Mismatch them and the imagery
 *    reprojects into a smear with nothing rendering outside the box.
 *
 * 2. AVAILABILITY IS MANDATORY. CustomHeightmapTerrainProvider ships no
 *    availability, so Cesium assumes terrain exists everywhere at every level
 *    and refines the whole globe. Measured: 800+ tiles pinned in the load queue
 *    permanently — draining ~6/s (RequestScheduler's per-server cap) while
 *    re-refining faster than it drained, so `globe.tilesLoaded` never went true
 *    and the Esri imagery starved into a level-2 olive smear behind correct
 *    terrain. Declaring availability — box only, to MAX_LEVEL — is what stops
 *    the refinement and lets the imagery through.
 *
 * Delegates geometry to an inner CustomHeightmapTerrainProvider (it already
 * does heightmap encoding correctly); this wrapper exists purely to answer
 * "where is there data?".
 */
export class BakedTerrainProvider {
  readonly tilingScheme: Cesium.GeographicTilingScheme;
  readonly availability: Cesium.TileAvailability;
  readonly errorEvent = new Cesium.Event();
  readonly credit = new Cesium.Credit('USGS 3DEP');
  readonly hasWaterMask = false;
  readonly hasVertexNormals = false;
  private readonly inner: Cesium.CustomHeightmapTerrainProvider;
  private readonly box: Cesium.Rectangle;

  constructor(manifest: Manifest, grid: TerrainGrid) {
    const { swLat, swLon, neLat, neLon } = manifest.box;
    this.tilingScheme = new Cesium.GeographicTilingScheme();
    this.box = Cesium.Rectangle.fromDegrees(swLon, swLat, neLon, neLat);
    this.inner = createInnerHeightmapProvider(
      manifest,
      grid,
      this.tilingScheme
    );

    // Data exists over the box at every level up to MAX_LEVEL. Levels above it
    // are simply not offered, so Cesium stops subdividing there instead of
    // asking us to invent detail.
    this.availability = new Cesium.TileAvailability(
      this.tilingScheme,
      MAX_LEVEL
    );
    for (let level = 0; level <= MAX_LEVEL; level++) {
      const sw = this.tilingScheme.positionToTileXY(
        Cesium.Rectangle.southwest(this.box),
        level
      );
      const ne = this.tilingScheme.positionToTileXY(
        Cesium.Rectangle.northeast(this.box),
        level
      );
      if (!sw || !ne) continue;
      // positionToTileXY y grows southward, so NE is the low y.
      this.availability.addAvailableTileRange(level, sw.x, ne.y, ne.x, sw.y);
    }
  }

  get ready(): boolean {
    return true;
  }
  get readyPromise(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getLevelMaximumGeometricError(level: number): number {
    return this.inner.getLevelMaximumGeometricError(level);
  }

  requestTileGeometry(
    x: number,
    y: number,
    level: number,
    request?: Cesium.Request
  ): Promise<Cesium.TerrainData> | undefined {
    return this.inner.requestTileGeometry(x, y, level, request);
  }

  /** The whole point of this class. `false` here is what stops Cesium
   *  refining the planet to serve a 1.5 x 5.8 km box. */
  getTileDataAvailable(x: number, y: number, level: number): boolean {
    if (level > MAX_LEVEL) return false;
    const rect = this.tilingScheme.tileXYToRectangle(x, y, level);
    return (
      Cesium.Rectangle.intersection(rect, this.box, new Cesium.Rectangle()) !==
      undefined
    );
  }

  loadTileDataAvailability(): undefined {
    return undefined;
  }
}

export function createBakedTerrainProvider(
  manifest: Manifest,
  grid: TerrainGrid
): Cesium.TerrainProvider {
  return new BakedTerrainProvider(
    manifest,
    grid
  ) as unknown as Cesium.TerrainProvider;
}

function createInnerHeightmapProvider(
  manifest: Manifest,
  grid: TerrainGrid,
  tilingScheme: Cesium.GeographicTilingScheme
): Cesium.CustomHeightmapTerrainProvider {
  const { swLat, swLon, neLat, neLon } = manifest.box;

  return new Cesium.CustomHeightmapTerrainProvider({
    width: TILE_SAMPLES,
    height: TILE_SAMPLES,
    tilingScheme,
    callback: (x: number, y: number, level: number) => {
      const rect = tilingScheme.tileXYToRectangle(x, y, level);
      // Cheap reject: a tile that cannot touch the box is flat ellipsoid. Most
      // of the planet takes this path.
      const box = Cesium.Rectangle.fromDegrees(swLon, swLat, neLon, neLat);
      if (!Cesium.Rectangle.intersection(rect, box, new Cesium.Rectangle())) {
        return new Float64Array(TILE_SAMPLES * TILE_SAMPLES);
      }
      const out = new Float64Array(TILE_SAMPLES * TILE_SAMPLES);
      for (let r = 0; r < TILE_SAMPLES; r++) {
        // Cesium heightmap rows run NORTH -> south; the baked grid runs south
        // -> north. This is the flip. Without it the terrain mirrors about the
        // centre latitude and still looks like hills.
        const lat = Cesium.Math.toDegrees(
          Cesium.Math.lerp(rect.north, rect.south, r / (TILE_SAMPLES - 1))
        );
        const inLat = lat >= swLat && lat <= neLat;
        for (let c = 0; c < TILE_SAMPLES; c++) {
          const lon = Cesium.Math.toDegrees(
            Cesium.Math.lerp(rect.west, rect.east, c / (TILE_SAMPLES - 1))
          );
          // Outside the baked box we have no data. 0 = the ellipsoid, which is
          // what Cesium would render there anyway without this provider — NOT
          // the edge-clamped value, which would smear Chattanooga's elevation
          // across the surrounding county.
          out[r * TILE_SAMPLES + c] =
            inLat && lon >= swLon && lon <= neLon
              ? sampleEllipsoidalM(manifest, grid, lon, lat)
              : 0;
        }
      }
      return out;
    },
  });
}
