// Microsoft Global ML Building Footprints — ML-measured building heights
// (#229 fidelity ladder). The dataset ships as z9-quadkey-partitioned
// gzip'd GeoJSONL tiles indexed by a dataset-links CSV (tile URLs are
// date-partitioned and CHURN — always resolve through the CSV, never
// construct tile URLs). Heights are meters; -1 = unknown.
//
// This stage filters the tiles covering the site box down to a small
// _raw/ms-buildings.json (mirroring the osm.json pattern, so build-scene
// stays derivable from _raw offline).

import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import type { GeoBox } from './enu';

const DATASET_LINKS =
  'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv';

/** Bing/slippy tile x,y at a zoom level -> quadkey string. */
export function tileXYToQuadkey(x: number, y: number, zoom: number): string {
  let quadkey = '';
  for (let i = zoom; i > 0; i--) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += digit;
  }
  return quadkey;
}

function lonLatToTileXY(
  lon: number,
  lat: number,
  zoom: number
): { x: number; y: number } {
  const n = 1 << zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

/** All zoom-9 quadkeys whose tiles intersect the box (SW..NE inclusive). */
export function quadkeysForBox(box: GeoBox, zoom = 9): string[] {
  const sw = lonLatToTileXY(box.swLon, box.swLat, zoom);
  const ne = lonLatToTileXY(box.neLon, box.neLat, zoom);
  const keys: string[] = [];
  // tile y grows southward, so ne.y <= sw.y
  for (let x = sw.x; x <= ne.x; x++) {
    for (let y = ne.y; y <= sw.y; y++) {
      keys.push(tileXYToQuadkey(x, y, zoom));
    }
  }
  return keys;
}

export interface MsBuilding {
  /** Outer ring as [lon, lat] pairs. */
  ring: [number, number][];
  /** ML-measured height in meters (already filtered > 0). */
  height: number;
}

async function resolveTileUrls(quadkeys: Set<string>): Promise<string[]> {
  const res = await fetch(DATASET_LINKS);
  if (!res.ok) throw new Error(`MS dataset-links.csv HTTP ${res.status}`);
  const csv = await res.text();
  const urls = new Set<string>();
  // CSV columns: Location,QuadKey,Url,Size,UploadDate — border tiles can
  // appear under two countries, so filter by quadkey only + dedupe by URL.
  for (const line of csv.split('\n')) {
    const cols = line.split(',');
    if (cols.length < 3) continue;
    if (quadkeys.has(cols[1]?.trim())) {
      urls.add(cols[2].trim());
      const uploaded = cols[4]?.trim();
      console.log(
        `[fetch-ms-heights] tile ${cols[1].trim()} (${cols[0].trim()}${uploaded ? `, uploaded ${uploaded}` : ''})`
      );
    }
  }
  return [...urls];
}

/**
 * Stream one gzip'd GeoJSONL tile (decompressed tiles run ~100-150 MB — never
 * buffer), keeping only features with a real height whose first outer-ring
 * vertex lands near the box.
 */
async function filterTile(
  url: string,
  box: GeoBox,
  out: MsBuilding[]
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`MS tile HTTP ${res.status} (${url})`);
  }
  const pad = 0.001; // ~100 m slack so edge buildings still match
  const gunzip = createGunzip();
  // pipe() does NOT forward source-stream errors — a mid-download network
  // reset would escape as an uncaughtException and kill the process outside
  // the bake's error path. Destroying gunzip propagates the error into the
  // readline async iterator as a normal rejection instead.
  Readable.fromWeb(res.body as import('stream/web').ReadableStream)
    .on('error', (e) => gunzip.destroy(e))
    .pipe(gunzip);
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    let feature: {
      geometry?: { type?: string; coordinates?: [number, number][][] };
      properties?: { height?: number };
    };
    try {
      feature = JSON.parse(line);
    } catch {
      continue;
    }
    const height = feature.properties?.height;
    if (!(typeof height === 'number' && height > 0)) continue;
    const ring = feature.geometry?.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const [lon, lat] = ring[0];
    if (
      lon < box.swLon - pad ||
      lon > box.neLon + pad ||
      lat < box.swLat - pad ||
      lat > box.neLat + pad
    )
      continue;
    out.push({ ring: ring as [number, number][], height });
  }
}

export async function fetchMsHeights(
  outDir: string,
  box: GeoBox
): Promise<{ tiles: number; buildings: number }> {
  mkdirSync(outDir, { recursive: true });
  const quadkeys = new Set(quadkeysForBox(box));
  const urls = await resolveTileUrls(quadkeys);
  if (urls.length === 0) {
    throw new Error(
      `no Microsoft Buildings tiles found for quadkeys [${[...quadkeys].join(', ')}] — ` +
        `dataset repartitioned? set "msHeights": false to bake without them`
    );
  }
  const buildings: MsBuilding[] = [];
  for (const url of urls) {
    await filterTile(url, box, buildings);
  }
  writeFileSync(join(outDir, 'ms-buildings.json'), JSON.stringify(buildings));
  console.log(
    `[fetch-ms-heights] ${buildings.length} in-box buildings with heights from ${urls.length} tile(s)`
  );
  return { tiles: urls.length, buildings: buildings.length };
}

// --- Matching (pure; used by build-scene) ------------------------------------

/** Even-odd ray-cast point-in-ring test in lon/lat space. */
export function pointInRing(
  lon: number,
  lat: number,
  ring: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function ringAreaDeg(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/**
 * Match OSM building centroids to MS detections: containment (which MS
 * polygon covers this centroid) beats nearest-centroid because the two
 * datasets segment the same buildings differently — nearest grabs the
 * neighbor on large/L-shaped footprints. Smallest-area containing polygon
 * wins on overlap (most specific detection). Glitch guard 2..400 m.
 */
export function matchMsHeights(
  centroids: { id: number; lon: number; lat: number }[],
  ms: MsBuilding[]
): Map<number, number> {
  // Uniform grid hash over MS bboxes for O(1) candidate lookup.
  const CELLS = 64;
  if (ms.length === 0 || centroids.length === 0) return new Map();
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  const bboxes = ms.map((b) => {
    let lo = Infinity,
      hi = -Infinity,
      la = Infinity,
      ha = -Infinity;
    for (const [x, y] of b.ring) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
      if (y < la) la = y;
      if (y > ha) ha = y;
    }
    if (lo < minLon) minLon = lo;
    if (hi > maxLon) maxLon = hi;
    if (la < minLat) minLat = la;
    if (ha > maxLat) maxLat = ha;
    return { lo, hi, la, ha };
  });
  const spanLon = Math.max(maxLon - minLon, 1e-9);
  const spanLat = Math.max(maxLat - minLat, 1e-9);
  const cellOf = (lon: number, lat: number) => {
    const cx = Math.min(
      CELLS - 1,
      Math.max(0, Math.floor(((lon - minLon) / spanLon) * CELLS))
    );
    const cy = Math.min(
      CELLS - 1,
      Math.max(0, Math.floor(((lat - minLat) / spanLat) * CELLS))
    );
    return cy * CELLS + cx;
  };
  const grid = new Map<number, number[]>();
  bboxes.forEach((bb, i) => {
    const c0 = cellOf(bb.lo, bb.la);
    const c1 = cellOf(bb.hi, bb.ha);
    const x0 = c0 % CELLS,
      y0 = Math.floor(c0 / CELLS),
      x1 = c1 % CELLS,
      y1 = Math.floor(c1 / CELLS);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = y * CELLS + x;
        const arr = grid.get(key);
        if (arr) arr.push(i);
        else grid.set(key, [i]);
      }
    }
  });

  const result = new Map<number, number>();
  for (const c of centroids) {
    const candidates = grid.get(cellOf(c.lon, c.lat)) ?? [];
    let best = -1;
    let bestArea = Infinity;
    for (const i of candidates) {
      const bb = bboxes[i];
      if (c.lon < bb.lo || c.lon > bb.hi || c.lat < bb.la || c.lat > bb.ha)
        continue;
      const b = ms[i];
      if (b.height <= 2 || b.height >= 400) continue; // glitch guard
      if (!pointInRing(c.lon, c.lat, b.ring)) continue;
      const area = ringAreaDeg(b.ring);
      if (area < bestArea) {
        bestArea = area;
        best = i;
      }
    }
    if (best >= 0) result.set(c.id, ms[best].height);
  }
  return result;
}
