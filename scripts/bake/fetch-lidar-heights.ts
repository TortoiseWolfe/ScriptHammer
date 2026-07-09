// Per-building heights measured from the USGS 3DEP lidar point cloud (#229
// PR-B). EPT datasets on s3://usgs-lidar-public stream as an octree of LAZ
// nodes over HTTP range-less GETs; we walk the hierarchy pages, download the
// nodes that intersect the site's building footprints, and take each
// footprint's first-return p90 minus the DTM as its height (rule 'lidar',
// above 'ms' in height.ts — a direct measurement beats an ML estimate).
//
// Recon facts this design rests on (verified live, 2026-07-09):
//   - EPT SRS is EPSG:3857; z is METRES ORTHOMETRIC (NAVD88): ground-class
//     median at a known downtown block read 206.2 m vs DTM ~205 m. The stage
//     re-measures this delta every bake as a datum tripwire.
//   - Classification is unreliable per node (many carry only classes 1/2 —
//     no building class), so heights use FIRST RETURNS, not class 6.
//   - Blocks tile the state: TN_27County_blk3's populated octree starts EAST
//     of lon −85.2745 (it does NOT cover downtown Chattanooga); blk4 covers
//     both current sites. The dataset URL is pinned per site in the config —
//     never guessed at bake time.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Las } from 'copc';
import { createProjection, type GeoBox } from './enu';
import { pointInRing } from './fetch-ms-heights';
import type { TerrainGrid } from './carve-water';

const DEG = Math.PI / 180;
const R_MERC = 6378137;

export const lonToMercX = (lon: number) => lon * DEG * R_MERC;
export const latToMercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)) * R_MERC;

export interface LidarConfig {
  /** EPT root URL (…/<dataset>, no trailing slash), pinned per site. */
  ept: string;
  /** Octree depth cutoff. Deeper = denser + heavier downloads. */
  maxDepth: number;
}

/** Noise classes excluded from all measurement (ASPRS 7 = low, 18 = high). */
const NOISE_CLASSES = new Set([7, 18]);
/** A footprint needs at least this many roof-candidate returns to measure. */
const MIN_POINTS = 10;
/** Roofs below this height are indistinguishable from ground/DTM error. */
const MIN_HEIGHT_M = 2;
/** Hard sanity ceiling — beyond this is birds/noise, not a building. */
const MAX_HEIGHT_M = 320;
/** Total-point budget guard across selected nodes. */
const MAX_POINTS = 40_000_000;

export interface Box2 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 2D bounds of an EPT octree key ("D-X-Y-Z") within the dataset cube. */
export function keyBounds2d(
  key: string,
  eptBounds: number[]
): Box2 & { d: number } {
  const [d, kx, ky] = key.split('-').map(Number);
  const size = eptBounds[3] - eptBounds[0];
  const s = size / (1 << d);
  const x0 = eptBounds[0] + kx * s;
  const y0 = eptBounds[1] + ky * s;
  return { d, x0, y0, x1: x0 + s, y1: y0 + s };
}

export function boxesIntersect(a: Box2, b: Box2): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** Percentile of an UNSORTED sample (sorts a copy; NEAREST-RANK: the value at
 *  rank ⌈p·n⌉). `floor(p·n)` looks similar but is exclusive-rank — at exactly
 *  n=10 it returns the MAXIMUM for p90, defeating outlier rejection precisely
 *  at the MIN_POINTS floor where sparse samples need it most. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

/**
 * Bilinear DTM sample at ENU metres from the south-first terrain grid — the
 * same fraction mapping the runtime uses (row 0 = south).
 */
export function dtmAtEnu(
  grid: TerrainGrid,
  x: number,
  z: number,
  groundWm: number,
  groundHm: number
): number {
  const colF = Math.min(
    grid.cols - 1,
    Math.max(0, (x / groundWm + 0.5) * (grid.cols - 1))
  );
  const rowF = Math.min(
    grid.rows - 1,
    Math.max(0, (0.5 - z / groundHm) * (grid.rows - 1))
  );
  const c0 = Math.floor(colF);
  const r0 = Math.floor(rowF);
  const c1 = Math.min(grid.cols - 1, c0 + 1);
  const r1 = Math.min(grid.rows - 1, r0 + 1);
  const fc = colF - c0;
  const fr = rowF - r0;
  const h = grid.heights;
  return (
    h[r0 * grid.cols + c0] * (1 - fc) * (1 - fr) +
    h[r0 * grid.cols + c1] * fc * (1 - fr) +
    h[r1 * grid.cols + c0] * (1 - fc) * fr +
    h[r1 * grid.cols + c1] * fc * fr
  );
}

interface FootprintTarget {
  id: number;
  /** Ring in EPSG:3857 (same plane as the point cloud). */
  ring: [number, number][];
  bbox: Box2;
  /** Vertex-mean anchor in ENU metres (closing vertex deduplicated). */
  cx: number;
  cz: number;
  /** SINGLE returns (ReturnNumber===1 && NumberOfReturns===1): solid-surface
   *  echoes — canopy splits the pulse into multiple returns, so roofs under
   *  overhanging trees keep a clean sample here. */
  zsSingle: number[];
  /** All first returns — the fallback when a footprint has too few singles
   *  (dense canopy or sparse coverage). */
  zsFirst: number[];
}

/** Pick the roof sample for a footprint: prefer single returns (canopy-proof),
 *  fall back to first returns when singles are too sparse to measure. */
export function pickRoofSample(
  zsSingle: number[],
  zsFirst: number[],
  minPoints: number
): { zs: number[]; usedFallback: boolean } {
  if (zsSingle.length >= minPoints)
    return { zs: zsSingle, usedFallback: false };
  return { zs: zsFirst, usedFallback: true };
}

/** Datum tripwire evaluation, pure: median ground-class-vs-DTM delta with a
 *  SAMPLE FLOOR — an unclassified dataset (zero class-2 points) must fail,
 *  not vacuously report a perfect 0.0 (ellipsoidal or survey-feet z would
 *  sail through unverified otherwise). Throws >5 m or under the floor;
 *  warns >1.5 m. */
export function assertDatumSane(
  groundDeltas: number[],
  minSamples = 500
): number {
  if (groundDeltas.length < minSamples) {
    throw new Error(
      `[fetch-lidar] only ${groundDeltas.length} ground-class samples (< ${minSamples}) — ` +
        `the dataset's classification is too sparse to verify the vertical datum; ` +
        `heights cannot be trusted (an ellipsoidal-z cloud would pass unverified)`
    );
  }
  const sorted = [...groundDeltas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (Math.abs(median) > 5) {
    throw new Error(
      `[fetch-lidar] ground-class z sits ${median.toFixed(1)} m off the DTM — vertical datum mismatch; do not use these heights`
    );
  }
  if (Math.abs(median) > 1.5) {
    console.warn(
      `[fetch-lidar] ground-vs-DTM median delta ${median.toFixed(2)} m — usable but investigate`
    );
  }
  return median;
}

/** Spatial hash of footprint bboxes → candidate indices per cell. */
export class FootprintIndex {
  readonly cell: number;
  /** Bounding box of ALL footprints — the coarse rejection filter. */
  readonly globalBbox: Box2;
  private readonly cells = new Map<string, number[]>();
  constructor(
    readonly targets: FootprintTarget[],
    cellM = 64
  ) {
    this.cell = cellM;
    const g = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    targets.forEach((t, i) => {
      g.x0 = Math.min(g.x0, t.bbox.x0);
      g.y0 = Math.min(g.y0, t.bbox.y0);
      g.x1 = Math.max(g.x1, t.bbox.x1);
      g.y1 = Math.max(g.y1, t.bbox.y1);
      for (const key of this.cellRange(t.bbox)) {
        const arr = this.cells.get(key);
        if (arr) arr.push(i);
        else this.cells.set(key, [i]);
      }
    });
    this.globalBbox = g;
  }
  private cellRange(b: Box2): string[] {
    const out: string[] = [];
    for (
      let cy = Math.floor(b.y0 / this.cell);
      cy <= Math.floor(b.y1 / this.cell);
      cy++
    )
      for (
        let cx = Math.floor(b.x0 / this.cell);
        cx <= Math.floor(b.x1 / this.cell);
        cx++
      )
        out.push(`${cx},${cy}`);
    return out;
  }
  /** Candidate footprints for a point (bbox pre-filter, then exact ring). */
  candidates(x: number, y: number): number[] {
    return (
      this.cells.get(
        `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`
      ) ?? []
    );
  }
  /** Does a node's 2D bounds overlap ANY occupied cell? */
  intersectsAny(b: Box2): boolean {
    // Coarse rejection FIRST: a state-tiling EPT dataset has thousands of
    // shallow nodes nowhere near the site — without this test the wide-node
    // shortcut below would admit every one of them (caught live: 78M-point
    // selection for a 20M-point site).
    if (this.targets.length === 0 || !boxesIntersect(b, this.globalBbox))
      return false;
    // Wide nodes overlapping the site — iterating their cell range would be
    // O(huge); a node spanning ~4 km over a populated site trivially overlaps
    // some footprint, so accept it (few such nodes, cheap false positives).
    if (b.x1 - b.x0 > this.cell * 64) return true;
    for (const key of this.cellRange(b)) {
      if (this.cells.has(key)) return true;
    }
    return false;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      console.warn(
        `[fetch-lidar] HTTP ${res.status} for ${url} (attempt ${attempt + 1}/3)`
      );
    } catch (e) {
      console.warn(
        `[fetch-lidar] ${(e as Error).message} (attempt ${attempt + 1}/3)`
      );
    }
    if (attempt < 2)
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`EPT fetch failed: ${url}`);
}

async function fetchBuffer(url: string): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      console.warn(
        `[fetch-lidar] HTTP ${res.status} for ${url} (attempt ${attempt + 1}/3)`
      );
    } catch (e) {
      console.warn(
        `[fetch-lidar] ${(e as Error).message} (attempt ${attempt + 1}/3)`
      );
    }
    if (attempt < 2)
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`EPT fetch failed: ${url}`);
}

type LazPerfModule = Awaited<ReturnType<typeof Las.PointData.createLazPerf>>;

/**
 * LAZ-file decompress with CORRECT WASM cleanup. copc's decompressFile
 * mallocs blob + point buffers on the (shared, module-cached) LazPerf heap
 * and frees NEITHER in its finally block — across the ~500 nodes of a site
 * bake that leaks hundreds of MB of WASM heap. Same algorithm, plus the two
 * _free calls its decompressChunk sibling already does. Fully synchronous
 * after the instance exists, so pool() concurrency can't interleave heap use.
 */
export function decompressLazFile(
  lazPerf: LazPerfModule,
  file: Uint8Array,
  header: { pointCount: number; pointDataRecordLength: number }
): Uint8Array {
  const { pointCount, pointDataRecordLength } = header;
  const out = new Uint8Array(pointCount * pointDataRecordLength);
  const blobPointer = lazPerf._malloc(file.byteLength);
  const dataPointer = lazPerf._malloc(pointDataRecordLength);
  const reader = new lazPerf.LASZip();
  try {
    lazPerf.HEAPU8.set(
      new Uint8Array(file.buffer, file.byteOffset, file.byteLength),
      blobPointer
    );
    reader.open(blobPointer, file.byteLength);
    for (let i = 0; i < pointCount; i++) {
      reader.getPoint(dataPointer);
      out.set(
        new Uint8Array(
          lazPerf.HEAPU8.buffer,
          dataPointer,
          pointDataRecordLength
        ),
        i * pointDataRecordLength
      );
    }
  } finally {
    reader.delete();
    lazPerf._free(blobPointer);
    lazPerf._free(dataPointer);
  }
  return out;
}

/** Simple bounded-concurrency runner (order not preserved). */
async function pool<T>(
  jobs: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const out: T[] = [];
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, jobs.length) },
    async () => {
      while (next < jobs.length) {
        const i = next++;
        out.push(await jobs[i]());
      }
    }
  );
  await Promise.all(workers);
  return out;
}

export async function fetchLidarHeights(
  rawDir: string,
  box: GeoBox,
  cfg: LidarConfig,
  vectorOffsetM: { x: number; z: number } = { x: 0, z: 0 }
): Promise<{
  buildings: number;
  measured: number;
  points: number;
  datumDeltaM: number;
}> {
  mkdirSync(rawDir, { recursive: true });
  // Two frames, deliberately distinct (#233):
  // - rawProj (no offset): converts LIDAR points to ENU for the datum
  //   tripwire — the cloud shares USGS georeferencing with the DTM, so no
  //   vector correction applies to it.
  // - offsetProj (pinned vectorOffsetM): the DTM anchor for each footprint
  //   centroid — matching where the runtime actually RENDERS the building.
  //   The binning rings get the same correction in Mercator (below), since
  //   the roofs physically sit where the imagery/lidar frame says, not where
  //   the raw OSM trace says.
  const rawProj = createProjection(box);
  const offsetProj = createProjection(box, vectorOffsetM);
  const { widthM: groundWm, depthM: groundHm } = rawProj.groundSize();
  // ENU metres → Web-Mercator metres are inflated by 1/cos(lat); +z is south
  // (Mercator y decreases).
  const cosLat = Math.cos(rawProj.centerLat * DEG);
  const mercOffX = vectorOffsetM.x / cosLat;
  const mercOffY = -vectorOffsetM.z / cosLat;
  const grid = JSON.parse(
    readFileSync(join(rawDir, 'terrain.json'), 'utf8')
  ) as TerrainGrid;
  const osm = JSON.parse(readFileSync(join(rawDir, 'osm.json'), 'utf8')) as {
    elements: {
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
    }[];
  };

  // Footprints in the point cloud's plane (3857) + ENU anchor for the DTM.
  const targets: FootprintTarget[] = [];
  for (const el of osm.elements) {
    if (
      el.type !== 'way' ||
      !el.tags?.building ||
      !el.geometry ||
      el.geometry.length < 3
    )
      continue;
    const g = el.geometry;
    const closed =
      g.length >= 4 &&
      g[0].lat === g[g.length - 1].lat &&
      g[0].lon === g[g.length - 1].lon;
    const verts = closed ? g.slice(0, -1) : g;
    const ring = g.map(
      (p) =>
        [lonToMercX(p.lon) + mercOffX, latToMercY(p.lat) + mercOffY] as [
          number,
          number,
        ]
    );
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of ring) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    let cx = 0,
      cz = 0;
    for (const p of verts) {
      const [ex, ez] = offsetProj.lonLatToEnu(p.lon, p.lat);
      cx += ex;
      cz += ez;
    }
    targets.push({
      id: el.id,
      ring,
      bbox: { x0, y0, x1, y1 },
      cx: cx / verts.length,
      cz: cz / verts.length,
      zsSingle: [],
      zsFirst: [],
    });
  }
  const index = new FootprintIndex(targets);

  const ept = await fetchJson<{
    bounds: number[];
    srs?: { authority?: string; horizontal?: string };
    dataType: string;
  }>(`${cfg.ept}/ept.json`);
  if (ept.srs?.horizontal !== '3857') {
    throw new Error(
      `EPT SRS is ${ept.srs?.authority}:${ept.srs?.horizontal} — this stage assumes EPSG:3857 (usgs-lidar-public convention)`
    );
  }
  if (ept.dataType !== 'laszip') {
    throw new Error(
      `EPT dataType "${ept.dataType}" unsupported (expected laszip)`
    );
  }

  // Hierarchy walk: select populated nodes at d<=maxDepth intersecting any
  // footprint; recurse into -1 page nodes.
  const selected: { key: string; count: number }[] = [];
  const pages = ['0-0-0-0'];
  const seenPages = new Set<string>();
  while (pages.length) {
    const page = pages.pop()!;
    if (seenPages.has(page)) continue;
    seenPages.add(page);
    const hier = await fetchJson<Record<string, number>>(
      `${cfg.ept}/ept-hierarchy/${page}.json`
    );
    for (const [key, count] of Object.entries(hier)) {
      const kb = keyBounds2d(key, ept.bounds);
      if (kb.d > cfg.maxDepth) continue;
      if (!index.intersectsAny(kb)) continue;
      if (count === -1) pages.push(key);
      else if (count > 0) selected.push({ key, count });
    }
  }
  const totalPts = selected.reduce((a, n) => a + n.count, 0);
  console.log(
    `[fetch-lidar] ${selected.length} nodes (${totalPts} pts) at d<=${cfg.maxDepth} over ${targets.length} footprints`
  );
  if (totalPts > MAX_POINTS) {
    throw new Error(
      `[fetch-lidar] ${totalPts} points exceeds the ${MAX_POINTS} budget — lower "lidar.maxDepth" in the site config`
    );
  }

  // Download + decode + bin. Ground-class deltas double as the datum tripwire.
  // ONE LazPerf instance for the whole run — see decompressLazFile.
  const lazPerf = await Las.PointData.createLazPerf();
  const groundDeltas: number[] = [];
  let processed = 0;
  await pool(
    selected.map((node) => async () => {
      const laz = await fetchBuffer(`${cfg.ept}/ept-data/${node.key}.laz`);
      const header = Las.Header.parse(laz);
      const data = decompressLazFile(lazPerf, laz, header);
      const view = Las.View.create(data, header);
      const gX = view.getter('X');
      const gY = view.getter('Y');
      const gZ = view.getter('Z');
      const gC = view.getter('Classification');
      const gR = view.getter('ReturnNumber');
      const gN = view.getter('NumberOfReturns');
      for (let i = 0; i < view.pointCount; i++) {
        const cls = gC(i);
        if (NOISE_CLASSES.has(cls)) continue;
        const x = gX(i);
        const y = gY(i);
        const cand = index.candidates(x, y);
        if (cls === 2 && groundDeltas.length < 50_000 && i % 7 === 0) {
          // ENU of this point for the DTM comparison (Mercator → lon/lat →
          // ENU through the RAW frame — no vector correction on lidar data).
          const lon = x / (DEG * R_MERC);
          const lat = (2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2) / DEG;
          const [ex, ez] = rawProj.lonLatToEnu(lon, lat);
          if (Math.abs(ex) < groundWm / 2 && Math.abs(ez) < groundHm / 2) {
            groundDeltas.push(
              gZ(i) - dtmAtEnu(grid, ex, ez, groundWm, groundHm)
            );
          }
        }
        if (cand.length === 0 || gR(i) !== 1) continue;
        for (const ti of cand) {
          const t = targets[ti];
          if (
            x >= t.bbox.x0 &&
            x <= t.bbox.x1 &&
            y >= t.bbox.y0 &&
            y <= t.bbox.y1 &&
            pointInRing(x, y, t.ring)
          ) {
            const z = gZ(i);
            t.zsFirst.push(z);
            // Single returns = the pulse hit ONE solid surface. Canopy over a
            // roof splits the pulse (NumberOfReturns > 1), so preferring
            // singles keeps overhanging trees out of the roof sample.
            if (gN(i) === 1) t.zsSingle.push(z);
            break;
          }
        }
      }
      processed++;
      if (processed % 50 === 0)
        console.log(`[fetch-lidar] ${processed}/${selected.length} nodes`);
    }),
    6
  );

  // Datum tripwire: the cloud's ground class vs our DTM must agree to within
  // a couple of metres or the vertical datums differ (ellipsoidal heights
  // would read ~30 m off here) and every height below would be wrong. The
  // sample floor makes "no ground class at all" a FAILURE, not a free pass.
  const datumDeltaM = assertDatumSane(groundDeltas);

  const q = (n: number) => Math.round(n * 10) / 10;
  const heights: Record<number, number> = {};
  let measured = 0;
  let canopyFallbacks = 0;
  for (const t of targets) {
    const { zs, usedFallback } = pickRoofSample(
      t.zsSingle,
      t.zsFirst,
      MIN_POINTS
    );
    if (zs.length < MIN_POINTS) continue;
    const dtm = dtmAtEnu(grid, t.cx, t.cz, groundWm, groundHm);
    const h = percentile(zs, 0.9) - dtm;
    if (h < MIN_HEIGHT_M || h > MAX_HEIGHT_M) continue;
    if (usedFallback) canopyFallbacks++;
    heights[t.id] = q(h);
    measured++;
  }

  const out = {
    meta: {
      ept: cfg.ept,
      maxDepth: cfg.maxDepth,
      nodes: selected.length,
      points: totalPts,
      datumDeltaM: q(datumDeltaM),
      groundSamples: groundDeltas.length,
      canopyFallbacks,
      vectorOffsetM,
    },
    heights,
  };
  writeFileSync(join(rawDir, 'lidar-heights.json'), JSON.stringify(out));
  console.log(
    `[fetch-lidar] measured ${measured}/${targets.length} footprints (p90 single-return − DTM; ` +
      `${canopyFallbacks} fell back to first returns); ground-vs-DTM median ${datumDeltaM.toFixed(2)} m`
  );
  return {
    buildings: targets.length,
    measured,
    points: totalPts,
    datumDeltaM: q(datumDeltaM),
  };
}
