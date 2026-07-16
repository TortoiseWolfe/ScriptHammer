import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fromArrayBuffer } from 'geotiff';
import type { GeoBox } from './enu';

const MAX_PER_REQ = 100;
const THROTTLE_MS = 1100; // OpenTopoData: 1 req/s public cap

// USGS 3DEP seamless DEM (1 m lidar where available, incl. Hamilton County TN).
const THREEDEP =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage';

export function buildGrid(
  box: GeoBox,
  cols: number,
  rows: number
): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = box.swLat + (box.neLat - box.swLat) * (j / (rows - 1));
    for (let i = 0; i < cols; i++) {
      const lon = box.swLon + (box.neLon - box.swLon) * (i / (cols - 1));
      pts.push({ lat, lon });
    }
  }
  return pts;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchBatch(
  dataset: string,
  batch: { lat: number; lon: number }[]
): Promise<{ heights: number[]; nulls: number }> {
  const locs = batch
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
    .join('|');
  const url = `https://api.opentopodata.org/v1/${dataset}?locations=${locs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as {
        results?: { elevation: number | null }[];
      };
      if (!j.results) throw new Error('elevation service unavailable');
      let nulls = 0;
      const heights = j.results.map((r) => {
        if (r.elevation == null) {
          nulls++;
          return 0;
        }
        return r.elevation;
      });
      return { heights, nulls };
    }
    if (res.status === 429)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    else throw new Error(`OpenTopoData HTTP ${res.status}`);
  }
  throw new Error('OpenTopoData 429 backoff exhausted');
}

/**
 * 3DEP raster path: ONE server-resampled float32 GeoTIFF export at grid size.
 * The mosaic pyramid does the 1 m→grid reduction (bilinear); point queries
 * would need ~85k requests for the same grid.
 *
 * Registration discipline (the same lesson as the drape, but STRICTER): this
 * service also expands the extent when the pixel aspect mismatches the bbox
 * aspect — and terrain registration via groundWm/Hm fractions is NOT
 * self-correcting, so the returned extent must be exact. Grids for this
 * dataset are therefore degree-square: (cols-1)/(rows-1) === degLon/degLat
 * (see terrainGridFor3Dep in site-config.ts), and the request bbox expands
 * half a cell per side so PIXEL CENTERS land exactly on the grid nodes.
 */
export async function fetch3DepTerrain(
  outDir: string,
  box: GeoBox,
  opts: { cols: number; rows: number; filename?: string }
) {
  const { cols, rows } = opts;
  const filename = opts.filename ?? 'terrain.json';
  mkdirSync(outDir, { recursive: true });
  if (cols > 8000 || rows > 8000) {
    throw new Error(
      `3dep1m grid ${cols}x${rows} exceeds the 8000px export cap — no sane PlaneGeometry needs this; reduce the grid`
    );
  }
  const degLon = box.neLon - box.swLon;
  const degLat = box.neLat - box.swLat;
  const sLon = degLon / (cols - 1);
  const sLat = degLat / (rows - 1);
  const bbox = [
    box.swLon - sLon / 2,
    box.swLat - sLat / 2,
    box.neLon + sLon / 2,
    box.neLat + sLat / 2,
  ];
  // adjustAspectRatio=false is LOAD-BEARING: with the default (true), the
  // service symmetrically expands whichever axis makes pixels non-square in
  // degrees — integer grid rounding always leaves a residual, so every bake
  // would drift a fraction of a cell (verified live: 0.144 cells/side for the
  // chatt grid) and elongated grids would trip the extent guard outright.
  // With it false the returned extent is bit-exact and the degree-square grid
  // + extent guard become belt-and-suspenders tripwires.
  const url =
    `${THREEDEP}?bbox=${bbox.join(',')}&bboxSR=4326&imageSR=4326` +
    `&size=${cols},${rows}&format=tiff&pixelType=F32` +
    `&interpolation=RSP_BilinearInterpolation&adjustAspectRatio=false&f=image`;

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url);
    if (res.ok) break;
    console.warn(
      `[fetch-terrain] 3DEP HTTP ${res.status} (attempt ${attempt + 1}/3)`
    );
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res || !res.ok) throw new Error(`3DEP HTTP ${res?.status}`);
  const buf = await res.arrayBuffer();

  const { heights, nulls } = await parseDemTiff(buf, cols, rows, bbox, {
    sLon,
    sLat,
  });
  if (nulls > 0) {
    const pct = (100 * nulls) / heights.length;
    const msg = `[fetch-terrain] ${nulls}/${heights.length} samples (${pct.toFixed(1)}%) have no 3DEP coverage`;
    if (pct > 1) {
      throw new Error(
        `${msg} — 1 m 3DEP does not cover this site; use "ned10m" or "srtm30m" in the config`
      );
    }
    console.warn(`${msg}; coerced to 0 m`);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  console.log(
    `[fetch-terrain] 3dep1m ${cols}x${rows}, elevation ${min.toFixed(1)}..${max.toFixed(1)} m ASL (NAVD88 orthometric — ellipsoid tripwire: compare vs the previous dataset's range)`
  );

  const out = { cols, rows, heights };
  writeFileSync(join(outDir, filename), JSON.stringify(out));
  return out;
}

/**
 * Parse a float32 DEM GeoTIFF into the terrain.json height layout:
 * dimension + extent guards, north-first→south-first row flip, 0.1 m
 * quantization, defensive NoData coercion. Pure (buffer in, heights out).
 */
export async function parseDemTiff(
  buf: ArrayBuffer,
  cols: number,
  rows: number,
  bbox: number[],
  cell: { sLon: number; sLat: number }
): Promise<{ heights: number[]; nulls: number }> {
  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();
  if (image.getWidth() !== cols || image.getHeight() !== rows) {
    throw new Error(
      `3DEP returned ${image.getWidth()}x${image.getHeight()}, requested ${cols}x${rows} — service clamped the request`
    );
  }
  // Extent guard: unlike the drape (whose height we derive), the grid here is
  // fixed — if the service adjusted the extent, every sample is misplaced.
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const tol = 0.6;
  if (
    Math.abs(minX - bbox[0]) > cell.sLon * tol ||
    Math.abs(minY - bbox[1]) > cell.sLat * tol ||
    Math.abs(maxX - bbox[2]) > cell.sLon * tol ||
    Math.abs(maxY - bbox[3]) > cell.sLat * tol
  ) {
    throw new Error(
      `3DEP adjusted the extent (returned ${[minX, minY, maxX, maxY].map((v) => v.toFixed(6)).join(',')}, ` +
        `requested ${bbox.map((v) => v.toFixed(6)).join(',')}) — degree-aspect invariant violated`
    );
  }

  const rasters = await image.readRasters();
  const raster = rasters[0] as Float32Array;
  let nulls = 0;
  const q = (n: number) => Math.round(n * 10) / 10;
  const heights = new Array<number>(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // TIFF row 0 = north; terrain.json row 0 = south (buildGrid convention
      // that the runtime and the water carve both depend on) — flip rows.
      const v = raster[(rows - 1 - r) * cols + c];
      if (!Number.isFinite(v) || Math.abs(v) > 1e10 || v < -1000) {
        nulls++;
        heights[r * cols + c] = 0;
      } else {
        heights[r * cols + c] = q(v);
      }
    }
  }
  return { heights, nulls };
}

// ~30 m isotropic grids resolve riverbanks; coarser grids smear the bank across
// a cell and misplace the 3D water edge ~100 m from where buildings stop, so
// riverfront buildings render sitting in the water (#225). Grid dims come from
// the site config (or defaultTerrainGrid), pinned per site for reproducibility.
export async function fetchTerrain(
  outDir: string,
  box: GeoBox,
  opts: { cols: number; rows: number; dataset?: string; filename?: string }
) {
  const { cols, rows } = opts;
  const dataset = opts.dataset ?? 'ned10m';
  const filename = opts.filename ?? 'terrain.json';
  if (dataset === '3dep1m') {
    return fetch3DepTerrain(outDir, box, { cols, rows, filename });
  }
  mkdirSync(outDir, { recursive: true });
  const grid = buildGrid(box, cols, rows);
  const heights: number[] = [];
  let nulls = 0;
  const batches = chunk(grid, MAX_PER_REQ);
  for (let b = 0; b < batches.length; b++) {
    const batch = await fetchBatch(dataset, batches[b]);
    heights.push(...batch.heights);
    nulls += batch.nulls;
    if (b < batches.length - 1)
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  // Out-of-coverage points come back null (e.g. the US-only ned10m outside the
  // US) and would otherwise silently bake flat 0 m terrain. Warn on any, fail
  // when the grid is meaningfully affected.
  if (nulls > 0) {
    const pct = (100 * nulls) / heights.length;
    const msg = `[fetch-terrain] ${nulls}/${heights.length} samples (${pct.toFixed(1)}%) have no "${dataset}" coverage`;
    if (pct > 1) {
      throw new Error(
        `${msg} — pick a dataset that covers this site in the config (e.g. "srtm30m" or "mapzen")`
      );
    }
    console.warn(`${msg}; coerced to 0 m`);
  }
  const out = { cols, rows, heights };
  writeFileSync(join(outDir, filename), JSON.stringify(out));
  return out;
}
