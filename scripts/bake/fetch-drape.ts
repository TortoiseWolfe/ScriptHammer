import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Projection } from './enu';

const NAIP =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

/** Measured live on USGSNAIPImagery: exports beyond this are silently clamped. */
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
  width: number;
  /** Pixel rows in this tile. */
  rows: number;
  /** This tile's first row within the global raster (0 = north edge). */
  rowOffset: number;
}

/**
 * Slice the GLOBAL degree-aspect raster into N-S tiles that each fit the
 * service export cap. The global dims are computed FIRST; each tile's bbox is
 * derived from its pixel-row range, so shared edges are exact (no seams) and
 * Σ tile rows === global height. Per-tile pixel aspect equals per-tile degree
 * aspect by construction, preserving the registration invariant per request.
 */
export function sliceDrapeTiles(
  proj: Projection,
  mpp: number,
  maxPx = MAX_EXPORT_PX
): { width: number; height: number; tiles: DrapeTile[] } {
  const { box } = proj;
  const { width, height } = drapePixelSize(proj, mpp);
  if (width > maxPx) {
    throw new Error(
      `drape width ${width}px exceeds the ${maxPx}px export cap — E-W tiling is not implemented; use a coarser mpp or a narrower box`
    );
  }
  const degLat = box.neLat - box.swLat;
  const n = Math.ceil(height / maxPx);
  const tiles: DrapeTile[] = [];
  let row = 0;
  for (let i = 0; i < n; i++) {
    const rows = Math.min(maxPx, height - row);
    const latTop = box.neLat - (row / height) * degLat;
    const latBottom = box.neLat - ((row + rows) / height) * degLat;
    tiles.push({
      bbox: [box.swLon, latBottom, box.neLon, latTop],
      width,
      rows,
      rowOffset: row,
    });
    row += rows;
  }
  return { width, height, tiles };
}

function exportUrl(
  bbox: [number, number, number, number],
  width: number,
  rows: number,
  source: 'naip' | 'esri'
): string {
  const base = source === 'naip' ? NAIP : ESRI;
  return `${base}?bbox=${bbox.join(',')}&bboxSR=4326&imageSR=4326&size=${width},${rows}&format=jpeg&f=image`;
}

export function drapeUrl(
  proj: Projection,
  mpp: number,
  source: 'naip' | 'esri' = 'naip'
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
  source: 'naip' | 'esri' = 'naip'
): string {
  return exportUrl(tile.bbox, tile.width, tile.rows, source);
}

async function fetchTile(
  tile: DrapeTile,
  source: 'naip' | 'esri'
): Promise<Buffer> {
  // The site config pins the imagery source as part of its reproducibility
  // contract — NEVER silently substitute the other source (Esri pixels carve a
  // different waterline than the NAIP-tuned classifier expects). Retry the
  // pinned source on transient errors, then fail loudly.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(tileUrl(tile, source));
    if (res.ok) break;
    console.warn(
      `[fetch-drape] ${source.toUpperCase()} HTTP ${res.status} (attempt ${attempt + 1}/3)`
    );
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const hint =
      source === 'naip'
        ? ' (NAIP covers the US only — set "drapeSource": "esri" in the site config for non-US sites)'
        : '';
    throw new Error(`${source.toUpperCase()} HTTP ${res?.status}${hint}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  // ArcGIS services return HTTP 200 with a JSON error body even for f=image
  // requests, and silently clamp sizes beyond maxImageWidth/Height. Validate
  // we actually got a JPEG of the requested size so a corrupt/clamped tile can
  // never ship (it would both mis-register and derail the water carve).
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error(
      `${source.toUpperCase()} returned a non-JPEG body (${buf.length} bytes): ${buf
        .subarray(0, 120)
        .toString('utf8')}`
    );
  }
  const meta = await sharp(buf).metadata();
  if (meta.width !== tile.width || meta.height !== tile.rows) {
    throw new Error(
      `${source.toUpperCase()} returned ${meta.width}x${meta.height}, requested ${tile.width}x${tile.rows} — ` +
        `the service likely clamped the request (maxImageWidth/Height); use a coarser mpp or a smaller box`
    );
  }
  return buf;
}

export async function fetchDrape(
  outDir: string,
  proj: Projection,
  mpp = 2,
  source: 'naip' | 'esri' = 'naip'
): Promise<{
  width: number;
  height: number;
  bytes: number;
  source: 'naip' | 'esri';
  tiles: number;
}> {
  mkdirSync(outDir, { recursive: true });
  const { width, height, tiles } = sliceDrapeTiles(proj, mpp);

  const buffers: Buffer[] = [];
  for (const tile of tiles) {
    if (tiles.length > 1) {
      console.log(
        `[fetch-drape] tile ${buffers.length + 1}/${tiles.length} (${tile.width}x${tile.rows}, lat ${tile.bbox[1].toFixed(5)}..${tile.bbox[3].toFixed(5)})`
      );
    }
    buffers.push(await fetchTile(tile, source));
  }

  let out: Buffer;
  if (tiles.length === 1) {
    // Byte-identical fast path: no decode/re-encode for sites under the cap.
    out = buffers[0];
  } else {
    // Stitch N-S tiles onto one canvas. Tiles are exports of the same source
    // mosaic sharing exact bbox edges, so the seam is invisible; one JPEG
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
          left: 0,
          top: tile.rowOffset,
        }))
      )
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  writeFileSync(join(outDir, 'drape.jpg'), out);
  return { width, height, bytes: out.length, source, tiles: tiles.length };
}
