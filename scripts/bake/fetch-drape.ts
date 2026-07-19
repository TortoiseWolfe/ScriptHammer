import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Projection } from './enu';

const NAIP =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';
// Tennessee statewide orthos (TDOT Aerial Surveys): 6-inch (0.15 m) for 2022+
// flights, engineering-grade georeferencing — far tighter than NAIP's ±4-6 m
// spec. MapServer /export (not exportImage); imageSR=4326 makes the server
// reproject its Web-Mercator cache to geographic, so rows stay uniform-in-lat
// and the degree-aspect discipline below applies unchanged.
const TNMAP =
  'https://tnmap.tn.gov/arcgis/rest/services/BASEMAPS/IMAGERY_WEB_MERCATOR/MapServer/export';

export type DrapeSource = 'naip' | 'esri' | 'tnmap';

/** Measured live: USGSNAIPImagery clamps beyond ~4000; tnmap caps at 4096. */
export const MAX_EXPORT_PX = 4000;

/**
 * Drape pixel size for a plate-carrée (SR 4326) request.
 *
 * REGISTRATION INVARIANT: ArcGIS `exportImage` returns the requested bbox
 * EXACTLY only when the requested pixel aspect equals the bbox aspect *in the
 * request SR*. In 4326 the bbox aspect is measured in DEGREES, so the pixel
 * aspect must be the degree aspect — NOT the cos(lat)-corrected metre aspect.
 * Requesting metre-proportional pixels against a degree bbox made ArcGIS expand
 * the latitude extent by ~616 m each end (returned 35.00223..35.06557 for a
 * 35.0078..35.06 request), which shifted every N-S feature and floated the
 * south-bank buildings out over the water. See fetch-drape.test.ts.
 *
 * The runtime maps world-Z→row linearly via `manifest.groundHm` (true ground
 * metres), independent of pixel count, so the image only has to *span exactly
 * the box lat/lon*. We fix E-W resolution at `groundWm/mpp` and derive height
 * from the DEGREE aspect so the request self-registers (no extent expansion).
 * The image is a touch taller in pixels; it still maps linearly and correctly.
 *
 * MapServer (/export) sources honor SIZE unconditionally and adjust the
 * EXTENT on aspect mismatch instead (verified live on tnmap: ±1.5 m lon
 * widening for a probe with 0.2% aspect error) — dims checks can't catch it,
 * so the tnmap path validates the RETURNED EXTENT via f=json per tile.
 */
export function drapePixelSize(proj: Projection, mpp: number) {
  const { box } = proj;
  const groundWm = (box.neLon - box.swLon) * proj.mPerDegLon;
  const groundHm = (box.neLat - box.swLat) * proj.mPerDegLat;
  const degLon = box.neLon - box.swLon;
  const degLat = box.neLat - box.swLat;
  const width = Math.round(groundWm / mpp);
  // height so that width/height === degLon/degLat → ArcGIS returns the exact bbox.
  const height = Math.round(width * (degLat / degLon));
  return { width, height, groundWm, groundHm };
}

export interface DrapeTile {
  /** minLon, minLat, maxLon, maxLat — this tile's exact bbox slice. */
  bbox: [number, number, number, number];
  /** Pixel columns in this tile. */
  cols: number;
  /** Pixel rows in this tile. */
  rows: number;
  /** This tile's first column within the global raster (0 = west edge). */
  colOffset: number;
  /** This tile's first row within the global raster (0 = north edge). */
  rowOffset: number;
}

/**
 * Slice the GLOBAL degree-aspect raster into a row×col grid of tiles that
 * each fit the service export cap. The global dims are computed FIRST; each
 * tile's bbox is derived from its pixel row/col range, so shared edges are
 * exact (no seams) and Σ tile dims === global dims. Per-tile pixel aspect
 * equals per-tile degree aspect by construction, preserving the registration
 * invariant per request.
 */
export function sliceDrapeTiles(
  proj: Projection,
  mpp: number,
  maxPx = MAX_EXPORT_PX
): { width: number; height: number; tiles: DrapeTile[] } {
  const { box } = proj;
  const { width, height } = drapePixelSize(proj, mpp);
  const degLat = box.neLat - box.swLat;
  const degLon = box.neLon - box.swLon;

  const slice = (total: number) => {
    const n = Math.ceil(total / maxPx);
    const out: { offset: number; size: number }[] = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
      const size = Math.min(maxPx, total - at);
      out.push({ offset: at, size });
      at += size;
    }
    return out;
  };

  const rowSlices = slice(height);
  const colSlices = slice(width);
  const tiles: DrapeTile[] = [];
  for (const r of rowSlices) {
    const latTop = box.neLat - (r.offset / height) * degLat;
    const latBottom = box.neLat - ((r.offset + r.size) / height) * degLat;
    for (const c of colSlices) {
      const lonLeft = box.swLon + (c.offset / width) * degLon;
      const lonRight = box.swLon + ((c.offset + c.size) / width) * degLon;
      tiles.push({
        bbox: [lonLeft, latBottom, lonRight, latTop],
        cols: c.size,
        rows: r.size,
        colOffset: c.offset,
        rowOffset: r.offset,
      });
    }
  }
  return { width, height, tiles };
}

function baseFor(source: DrapeSource): string {
  return source === 'naip' ? NAIP : source === 'esri' ? ESRI : TNMAP;
}

function exportUrl(
  bbox: [number, number, number, number],
  cols: number,
  rows: number,
  source: DrapeSource,
  f: 'image' | 'json' = 'image'
): string {
  return `${baseFor(source)}?bbox=${bbox.join(',')}&bboxSR=4326&imageSR=4326&size=${cols},${rows}&format=jpeg&f=${f}`;
}

export function drapeUrl(
  proj: Projection,
  mpp: number,
  source: DrapeSource = 'naip'
): string {
  const { box } = proj;
  const { width, height } = drapePixelSize(proj, mpp);
  return exportUrl(
    [box.swLon, box.swLat, box.neLon, box.neLat],
    width,
    height,
    source
  );
}

/** Per-tile export URL — the tiled sibling of drapeUrl. */
export function tileUrl(
  tile: DrapeTile,
  source: DrapeSource = 'naip',
  f: 'image' | 'json' = 'image'
): string {
  return exportUrl(tile.bbox, tile.cols, tile.rows, source, f);
}

async function fetchWithRetry(
  url: string,
  source: DrapeSource,
  opts: { coverageHint?: boolean } = { coverageHint: true }
): Promise<Response> {
  const ATTEMPTS = 3;
  let lastFailure = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      // fetch() rejects without an HTTP status on ECONNRESET/DNS/TLS-level
      // failures — transient network errors deserve the same retries as a 5xx.
      const res = await fetch(url);
      if (res.ok) return res;
      lastFailure = `HTTP ${res.status}`;
    } catch (e) {
      lastFailure = `network error: ${(e as Error).message}`;
    }
    console.warn(
      `[fetch-drape] ${source.toUpperCase()} ${lastFailure} (attempt ${attempt + 1}/${ATTEMPTS})`
    );
    if (attempt < ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  // The coverage hint only fits the primary export request — a failed
  // follow-up (e.g. a MapServer-rendered href) is a transient service
  // problem, not an out-of-coverage site.
  const hint = !opts.coverageHint
    ? ''
    : source === 'naip'
      ? ' (NAIP covers the US only — set "drapeSource": "esri" in the site config for non-US sites)'
      : source === 'tnmap'
        ? ' (TDOT orthos cover Tennessee only)'
        : '';
  throw new Error(`${source.toUpperCase()} ${lastFailure}${hint}`);
}

async function validateImage(
  buf: Buffer,
  tile: DrapeTile,
  source: DrapeSource
): Promise<void> {
  // ArcGIS services return HTTP 200 with a JSON error body even for image
  // requests, and silently clamp sizes beyond maxImageWidth/Height. Accept
  // JPEG or PNG (MapServer render hrefs can be either) and validate dims.
  const isJpeg = buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8;
  const isPng =
    buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
  if (!isJpeg && !isPng) {
    throw new Error(
      `${source.toUpperCase()} returned a non-image body (${buf.length} bytes): ${buf
        .subarray(0, 120)
        .toString('utf8')}`
    );
  }
  const meta = await sharp(buf).metadata();
  if (meta.width !== tile.cols || meta.height !== tile.rows) {
    throw new Error(
      `${source.toUpperCase()} returned ${meta.width}x${meta.height}, requested ${tile.cols}x${tile.rows} — ` +
        `the service likely clamped the request (maxImageWidth/Height); use a coarser mpp or a smaller box`
    );
  }
}

/**
 * ImageServer path (naip/esri): fetch the image directly; dims mismatch is
 * the clamp signal (these services keep the extent and clamp size).
 */
async function fetchTileImage(
  tile: DrapeTile,
  source: DrapeSource
): Promise<Buffer> {
  const res = await fetchWithRetry(tileUrl(tile, source), source);
  const buf = Buffer.from(await res.arrayBuffer());
  await validateImage(buf, tile, source);
  return buf;
}

export interface RenderInfo {
  href?: string;
  width?: number;
  height?: number;
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

/**
 * The MapServer extent guard, pure and testable: validate an f=json render
 * response against the requested tile — presence, exact dims, and a returned
 * extent within `tolPx` of the request on every edge (per-axis pixel sizes).
 * Throws with a diagnostic message on any violation; returns the href.
 */
export function assertRenderMatchesTile(
  tile: DrapeTile,
  info: RenderInfo,
  source: DrapeSource,
  tolPx = 0.75
): string {
  if (!info.href || !info.extent) {
    throw new Error(
      `${source.toUpperCase()} f=json response missing href/extent: ${JSON.stringify(info).slice(0, 200)}`
    );
  }
  if (info.width !== tile.cols || info.height !== tile.rows) {
    throw new Error(
      `${source.toUpperCase()} rendered ${info.width}x${info.height}, requested ${tile.cols}x${tile.rows}`
    );
  }
  const pxLon = (tile.bbox[2] - tile.bbox[0]) / tile.cols;
  const pxLat = (tile.bbox[3] - tile.bbox[1]) / tile.rows;
  const drift = [
    Math.abs(info.extent.xmin - tile.bbox[0]) / pxLon,
    Math.abs(info.extent.ymin - tile.bbox[1]) / pxLat,
    Math.abs(info.extent.xmax - tile.bbox[2]) / pxLon,
    Math.abs(info.extent.ymax - tile.bbox[3]) / pxLat,
  ];
  if (drift.some((d) => d > tolPx)) {
    throw new Error(
      `${source.toUpperCase()} adjusted the extent (drift ${drift.map((d) => d.toFixed(2)).join('/')} px, ` +
        `returned ${[
          info.extent.xmin,
          info.extent.ymin,
          info.extent.xmax,
          info.extent.ymax,
        ]
          .map((v) => v.toFixed(7))
          .join(',')}) — aspect mismatch; registration invariant violated`
    );
  }
  return info.href;
}

/**
 * MapServer path (tnmap): dims are honored unconditionally and the EXTENT
 * silently adjusts on aspect mismatch — the one failure mode a dims check
 * cannot see. Ask for f=json first (returns the ACTUAL rendered extent + an
 * href to the rendered image), hard-fail if any edge drifted more than
 * ~3/4 px, then fetch the href.
 */
async function fetchTileViaJson(
  tile: DrapeTile,
  source: DrapeSource
): Promise<Buffer> {
  const res = await fetchWithRetry(tileUrl(tile, source, 'json'), source);
  let info: RenderInfo;
  try {
    info = (await res.json()) as RenderInfo;
  } catch {
    throw new Error(
      `${source.toUpperCase()} f=json returned a non-JSON body — service error page?`
    );
  }
  const href = assertRenderMatchesTile(tile, info, source);
  const img = await fetchWithRetry(href, source, { coverageHint: false });
  const buf = Buffer.from(await img.arrayBuffer());
  await validateImage(buf, tile, source);
  return buf;
}

async function fetchTile(
  tile: DrapeTile,
  source: DrapeSource
): Promise<Buffer> {
  // The site config pins the imagery source as part of its reproducibility
  // contract — NEVER silently substitute another source. Retry the pinned
  // source on transient errors, then fail loudly.
  return source === 'tnmap'
    ? fetchTileViaJson(tile, source)
    : fetchTileImage(tile, source);
}

export async function fetchDrape(
  outDir: string,
  proj: Projection,
  mpp = 2,
  source: DrapeSource = 'naip',
  // Output basename. Defaults to the narrow-box drape; the wide atlasBox drape
  // reuses this same fetch with 'drape-wide.jpg' over a wider projection.
  filename = 'drape.jpg'
): Promise<{
  width: number;
  height: number;
  bytes: number;
  source: DrapeSource;
  tiles: number;
}> {
  mkdirSync(outDir, { recursive: true });
  const { width, height, tiles } = sliceDrapeTiles(proj, mpp);

  const buffers: Buffer[] = [];
  for (const tile of tiles) {
    if (tiles.length > 1) {
      console.log(
        `[fetch-drape] tile ${buffers.length + 1}/${tiles.length} (${tile.cols}x${tile.rows} at col ${tile.colOffset}, row ${tile.rowOffset})`
      );
    }
    buffers.push(await fetchTile(tile, source));
  }

  let out: Buffer;
  if (tiles.length === 1 && buffers[0][0] === 0xff) {
    // Byte-identical fast path for a single JPEG tile (sites under the cap).
    out = buffers[0];
  } else {
    // Stitch grid tiles onto one canvas. Tiles are exports of the same source
    // mosaic sharing exact bbox edges, so seams are invisible; one JPEG
    // re-encode generation at q90 is imperceptible on aerial imagery.
    out = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(
        tiles.map((tile, i) => ({
          input: buffers[i],
          left: tile.colOffset,
          top: tile.rowOffset,
        }))
      )
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  writeFileSync(join(outDir, filename), out);
  return { width, height, bytes: out.length, source, tiles: tiles.length };
}
