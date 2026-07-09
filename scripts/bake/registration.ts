// Objective footprint-vs-aerial registration measurement (#233).
//
// The eyeball can't tell "the aerial is off" from "the vectors are off" from
// "the camera is lying" — this stage measures it. OSM building EDGES are
// rasterized into drape pixel space and slid over the aerial's Sobel gradient
// field; the offset that maximizes mean gradient under the edges is the
// misregistration between the vector layer and the imagery (building edges are
// exactly where an ortho photo has strong gradients). That measured offset
// feeds `vectorOffsetM` in the site config (applied at the projection
// chokepoint), and the per-building scores flag footprints that still don't
// sit on photo edges after correction.
//
// Caveat recorded in the report: the comparison is footprint edge vs
// GROUND-LEVEL photo edge. On non-true-ortho imagery, tall buildings lean —
// their roof edges displace outward from nadir — so a low per-building score
// on a tower is expected residual, not necessarily bad vectors.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export interface OffsetResult {
  /** Offset to ADD to the vector layers (ENU metres, +x east, +z south). */
  offsetM: { x: number; z: number };
  /** Mean gradient under edges at the best offset. */
  score: number;
  /** Mean gradient under edges at zero offset (the as-baked residual). */
  score0: number;
  /** Peak salience: (score − mean over search grid) / std over search grid.
   *  ≲1 means the surface is flat — don't trust the offset. */
  confidence: number;
  nEdgePx: number;
}

export interface BuildingScore {
  id: number;
  /** Footprint centroid, ENU metres. */
  x: number;
  z: number;
  /** Fraction of this building's edge pixels on strong aerial gradients. */
  score: number;
}

export interface RegistrationReport {
  global: OffsetResult;
  /** 3x3 world-space districts, row-major from NW; null = too few edge px. */
  districts: (OffsetResult | null)[];
  /** Max |district offset − global offset| across measured districts. */
  districtSpreadM: number;
  /** Weakest decile of buildings at the applied (best-global) offset. */
  flagged: BuildingScore[];
  buildingCount: number;
  medianBuildingScore: number;
  edgePxCount: number;
  params: typeof SEARCH_PARAMS;
  note: string;
}

export const SEARCH_PARAMS = {
  coarseRangeM: 8,
  coarseStepM: 2,
  fineRangeM: 2,
  fineStepM: 0.5,
  /** Edge pixels are subsampled by this stride for the offset search. */
  searchStride: 4,
  /** "Strong gradient" = above this percentile of the image's gradients. */
  strongPercentile: 0.7,
  /** A district below this many edge pixels reports null (no fit). */
  minDistrictEdgePx: 400,
} as const;

/** ENU metres → north-up drape pixel (fractional col/row). The EXACT inverse
 *  of the runtime's terrainSample/carve mapping: u=x/groundWm+0.5,
 *  v=0.5−z/groundHm (v=1 north), row=(H−1)(1−v). */
export function enuToPx(
  x: number,
  z: number,
  W: number,
  H: number,
  groundWm: number,
  groundHm: number
): [number, number] {
  const u = x / groundWm + 0.5;
  const v = 0.5 - z / groundHm;
  return [(W - 1) * u, (H - 1) * (1 - v)];
}

/** Integer Bresenham between two pixel coords, invoking cb(col,row) per pixel
 *  (endpoints included). Out-of-bounds pixels are the CALLER's concern. */
export function bresenham(
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  cb: (col: number, row: number) => void
): void {
  let x0 = Math.round(c0);
  let y0 = Math.round(r0);
  const x1 = Math.round(c1);
  const y1 = Math.round(r1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export interface EdgeRaster {
  /** Packed pixel indices (row*W+col), deduplicated, all buildings. */
  edgePx: Uint32Array;
  /** Per building: packed pixel indices of its edges. */
  perBuilding: { id: number; x: number; z: number; px: Uint32Array }[];
}

/** Rasterize every building ring's edges into drape pixel space. */
export function rasterizeEdges(
  buildings: { id: number; ring: number[] }[],
  W: number,
  H: number,
  groundWm: number,
  groundHm: number
): EdgeRaster {
  const seen = new Uint8Array(W * H);
  const all: number[] = [];
  const perBuilding: EdgeRaster['perBuilding'] = [];
  for (const b of buildings) {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < b.ring.length; i += 2) {
      pts.push(
        enuToPx(b.ring[i], b.ring[i + 1], W, H, groundWm, groundHm) as [
          number,
          number,
        ]
      );
    }
    if (pts.length < 3) continue;
    const mine: number[] = [];
    // OSM rings repeat the first vertex at the end — including it in the
    // vertex-mean would weight the first corner twice (measured ~10% of the
    // footprint size for a square), dragging district assignment and the
    // flagged-building coordinates. Edges are unaffected (the wrap below
    // closes the ring either way).
    const len = b.ring.length;
    const closed =
      len >= 4 &&
      b.ring[0] === b.ring[len - 2] &&
      b.ring[1] === b.ring[len - 1];
    const lastPair = closed ? len - 2 : len;
    let cx = 0;
    let cz = 0;
    for (let i = 0; i + 1 < lastPair; i += 2) {
      cx += b.ring[i];
      cz += b.ring[i + 1];
    }
    const n = lastPair / 2;
    for (let i = 0; i < pts.length; i++) {
      const [c0, r0] = pts[i];
      const [c1, r1] = pts[(i + 1) % pts.length];
      bresenham(c0, r0, c1, r1, (col, row) => {
        if (col < 0 || col >= W || row < 0 || row >= H) return;
        const idx = row * W + col;
        mine.push(idx);
        if (!seen[idx]) {
          seen[idx] = 1;
          all.push(idx);
        }
      });
    }
    perBuilding.push({
      id: b.id,
      x: cx / n,
      z: cz / n,
      px: Uint32Array.from(mine),
    });
  }
  return { edgePx: Uint32Array.from(all), perBuilding };
}

/** Sobel gradient magnitude over a grayscale image (border pixels 0). */
export function sobelMagnitude(
  gray: Uint8Array,
  W: number,
  H: number
): Float32Array {
  const out = new Float32Array(W * H);
  for (let r = 1; r < H - 1; r++) {
    const up = (r - 1) * W;
    const mid = r * W;
    const dn = (r + 1) * W;
    for (let c = 1; c < W - 1; c++) {
      const gx =
        -gray[up + c - 1] +
        gray[up + c + 1] -
        2 * gray[mid + c - 1] +
        2 * gray[mid + c + 1] -
        gray[dn + c - 1] +
        gray[dn + c + 1];
      const gy =
        -gray[up + c - 1] -
        2 * gray[up + c] -
        gray[up + c + 1] +
        gray[dn + c - 1] +
        2 * gray[dn + c] +
        gray[dn + c + 1];
      out[mid + c] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** Bilinear sample of a Float32 field at a fractional pixel; OOB → NaN. */
function sampleBilinear(
  f: Float32Array,
  W: number,
  H: number,
  col: number,
  row: number
): number {
  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  if (c0 < 0 || r0 < 0 || c0 + 1 >= W || r0 + 1 >= H) return NaN;
  const fc = col - c0;
  const fr = row - r0;
  const i = r0 * W + c0;
  return (
    f[i] * (1 - fc) * (1 - fr) +
    f[i + 1] * fc * (1 - fr) +
    f[i + W] * (1 - fc) * fr +
    f[i + W + 1] * fc * fr
  );
}

/** Mean gradient under edge pixels displaced by (dCol, dRow) fractional px. */
export function scoreAtShift(
  edgePx: Uint32Array,
  grad: Float32Array,
  W: number,
  H: number,
  dCol: number,
  dRow: number,
  stride = 1
): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < edgePx.length; i += stride) {
    const idx = edgePx[i];
    const v = sampleBilinear(
      grad,
      W,
      H,
      (idx % W) + dCol,
      (idx - (idx % W)) / W + dRow
    );
    if (!Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * Coarse-to-fine offset search. Offsets are in METRES (+x east, +z south);
 * pixel displacement per metre comes from the drape mapping. Returns the
 * offset to ADD to the vector layers.
 */
export function searchOffset(
  edgePx: Uint32Array,
  grad: Float32Array,
  W: number,
  H: number,
  groundWm: number,
  groundHm: number,
  params = SEARCH_PARAMS
): OffsetResult {
  const pxPerMx = (W - 1) / groundWm;
  const pxPerMz = (H - 1) / groundHm;
  const stride = params.searchStride;

  const evaluate = (dxM: number, dzM: number) =>
    scoreAtShift(edgePx, grad, W, H, dxM * pxPerMx, dzM * pxPerMz, stride);

  const pass = (cx: number, cz: number, rangeM: number, stepM: number) => {
    // Anchor `best` at the pass CENTRE with its real score: on an all-tie
    // surface (featureless drape, zero in-bounds edge pixels) a -Infinity
    // seed with strict `>` replacement would crown the first-evaluated
    // corner, cascading to a plausible-looking ±10 m offset in the report.
    // No signal must answer "no offset", not "corner of the search window".
    let best = { dxM: cx, dzM: cz, score: evaluate(cx, cz) };
    const scores: number[] = [];
    for (let dz = -rangeM; dz <= rangeM + 1e-9; dz += stepM) {
      for (let dx = -rangeM; dx <= rangeM + 1e-9; dx += stepM) {
        const s = evaluate(cx + dx, cz + dz);
        scores.push(s);
        if (s > best.score) best = { dxM: cx + dx, dzM: cz + dz, score: s };
      }
    }
    return { best, scores };
  };

  const coarse = pass(0, 0, params.coarseRangeM, params.coarseStepM);
  const fine = pass(
    coarse.best.dxM,
    coarse.best.dzM,
    params.fineRangeM,
    params.fineStepM
  );
  const all = [...coarse.scores, ...fine.scores];
  const mean = all.reduce((a, v) => a + v, 0) / all.length;
  const std = Math.sqrt(
    all.reduce((a, v) => a + (v - mean) * (v - mean), 0) / all.length
  );
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    offsetM: { x: round(fine.best.dxM), z: round(fine.best.dzM) },
    score: fine.best.score,
    score0: evaluate(0, 0),
    confidence: std > 0 ? (fine.best.score - mean) / std : 0,
    nEdgePx: Math.ceil(edgePx.length / stride),
  };
}

/** The gradient magnitude at the given percentile (sampled, not full sort). */
export function gradientPercentile(
  grad: Float32Array,
  pct: number,
  sampleStride = 97
): number {
  const sample: number[] = [];
  for (let i = 0; i < grad.length; i += sampleStride) sample.push(grad[i]);
  sample.sort((a, b) => a - b);
  return sample[Math.min(sample.length - 1, Math.floor(pct * sample.length))];
}

/** Per-building edge score at an applied offset: fraction of the footprint's
 *  edge pixels sitting on strong aerial gradients. */
export function scoreBuildings(
  perBuilding: EdgeRaster['perBuilding'],
  grad: Float32Array,
  W: number,
  H: number,
  dCol: number,
  dRow: number,
  strongThreshold: number
): BuildingScore[] {
  const q = (n: number) => Math.round(n * 10) / 10;
  return perBuilding.map((b) => {
    let strong = 0;
    let n = 0;
    for (const idx of b.px) {
      const v = sampleBilinear(
        grad,
        W,
        H,
        (idx % W) + dCol,
        (idx - (idx % W)) / W + dRow
      );
      if (Number.isNaN(v)) continue;
      n++;
      if (v >= strongThreshold) strong++;
    }
    return {
      id: b.id,
      x: q(b.x),
      z: q(b.z),
      score: n > 0 ? Math.round((strong / n) * 1000) / 1000 : 0,
    };
  });
}

/** District index (0..8, row-major from NW) for an ENU centroid. */
export function districtIndex(
  x: number,
  z: number,
  groundWm: number,
  groundHm: number
): number {
  const clamp = (v: number) => Math.max(0, Math.min(2, Math.floor(v * 3)));
  const col = clamp(x / groundWm + 0.5);
  const rowFromNorth = clamp(z / groundHm + 0.5); // z=-H/2 (north) → 0
  return rowFromNorth * 3 + col;
}

/**
 * The full measurement: global + 3x3 district offsets, per-building scores at
 * the applied global offset, weakest-decile flags.
 */
export function measureRegistration(
  buildings: { id: number; ring: number[] }[],
  gray: Uint8Array,
  W: number,
  H: number,
  groundWm: number,
  groundHm: number,
  params = SEARCH_PARAMS
): { report: RegistrationReport; raster: EdgeRaster; grad: Float32Array } {
  const raster = rasterizeEdges(buildings, W, H, groundWm, groundHm);
  const grad = sobelMagnitude(gray, W, H);
  const global = searchOffset(
    raster.edgePx,
    grad,
    W,
    H,
    groundWm,
    groundHm,
    params
  );

  // Districts: pool each district's buildings' edge pixels, search per pool.
  const pools: number[][] = Array.from({ length: 9 }, () => []);
  for (const b of raster.perBuilding) {
    const d = districtIndex(b.x, b.z, groundWm, groundHm);
    for (const idx of b.px) pools[d].push(idx);
  }
  const districts = pools.map((pool) =>
    pool.length >= params.minDistrictEdgePx
      ? searchOffset(
          Uint32Array.from(pool),
          grad,
          W,
          H,
          groundWm,
          groundHm,
          params
        )
      : null
  );
  let districtSpreadM = 0;
  for (const d of districts) {
    if (!d) continue;
    districtSpreadM = Math.max(
      districtSpreadM,
      Math.hypot(d.offsetM.x - global.offsetM.x, d.offsetM.z - global.offsetM.z)
    );
  }

  const strong = gradientPercentile(grad, params.strongPercentile);
  const pxPerMx = (W - 1) / groundWm;
  const pxPerMz = (H - 1) / groundHm;
  const scores = scoreBuildings(
    raster.perBuilding,
    grad,
    W,
    H,
    global.offsetM.x * pxPerMx,
    global.offsetM.z * pxPerMz,
    strong
  );
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const flagged = sorted.slice(0, Math.ceil(sorted.length / 10));
  const median =
    sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].score : 0;

  return {
    report: {
      global,
      districts,
      districtSpreadM: Math.round(districtSpreadM * 10) / 10,
      flagged,
      buildingCount: scores.length,
      medianBuildingScore: median,
      edgePxCount: raster.edgePx.length,
      params,
      note:
        'Offsets are metres to ADD to vector layers (+x east, +z south). ' +
        'Scores compare footprint edges to GROUND-LEVEL photo gradients; ' +
        'tall buildings lean on non-true-ortho imagery, so low tower scores ' +
        'are expected residual, not necessarily bad vectors.',
    },
    raster,
    grad,
  };
}

/** Red edge overlay on the drape at a given shift — the eyeball companion to
 *  the numbers (written to _raw/registration/, local-only by gitignore). */
export async function writeOverlay(
  drapeSrc: string,
  edgePx: Uint32Array,
  W: number,
  H: number,
  dCol: number,
  dRow: number,
  outPath: string
): Promise<void> {
  const rgba = new Uint8Array(W * H * 4); // transparent
  const dc = Math.round(dCol);
  const dr = Math.round(dRow);
  for (const idx of edgePx) {
    const col = (idx % W) + dc;
    const row = (idx - (idx % W)) / W + dr;
    if (col < 0 || col >= W || row < 0 || row >= H) continue;
    const o = (row * W + col) * 4;
    rgba[o] = 255;
    rgba[o + 3] = 255;
  }
  await sharp(drapeSrc)
    .composite([
      {
        input: Buffer.from(rgba.buffer),
        raw: { width: W, height: H, channels: 4 },
      },
    ])
    .jpeg({ quality: 85 })
    .toFile(outPath);
}

/** Bake-stage entry: measure, write report + overlays, return the summary
 *  block for the manifest. `diagnosticsDir` overrides where the report +
 *  overlays land (default _raw/registration/) — the test seam that keeps
 *  suite runs out of a developer's real _raw cache. */
export async function runRegistration(
  rawDir: string,
  drapeSrc: string,
  buildings: { id: number; ring: number[] }[],
  groundWm: number,
  groundHm: number,
  diagnosticsDir?: string
): Promise<{
  offsetM: { x: number; z: number };
  score: number;
  score0: number;
  confidence: number;
  districtSpreadM: number;
  flaggedCount: number;
}> {
  const { data, info } = await sharp(drapeSrc)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const { report, raster } = await (async () => {
    const grayArr = new Uint8Array(data.buffer, data.byteOffset, W * H);
    return measureRegistration(buildings, grayArr, W, H, groundWm, groundHm);
  })();

  const regDir = diagnosticsDir ?? join(rawDir, 'registration');
  // Fresh dir per measurement: report + overlays describe ONE bake — a crash
  // between writes must never leave this bake's report beside a previous
  // bake's overlays.
  rmSync(regDir, { recursive: true, force: true });
  mkdirSync(regDir, { recursive: true });
  writeFileSync(join(regDir, 'report.json'), JSON.stringify(report, null, 2));
  const pxPerMx = (W - 1) / groundWm;
  const pxPerMz = (H - 1) / groundHm;
  await writeOverlay(
    drapeSrc,
    raster.edgePx,
    W,
    H,
    0,
    0,
    join(regDir, 'overlay-asbaked.jpg')
  );
  await writeOverlay(
    drapeSrc,
    raster.edgePx,
    W,
    H,
    report.global.offsetM.x * pxPerMx,
    report.global.offsetM.z * pxPerMz,
    join(regDir, 'overlay-corrected.jpg')
  );
  console.log(
    `[registration] offset ${report.global.offsetM.x},${report.global.offsetM.z} m ` +
      `(score ${report.global.score.toFixed(1)} vs ${report.global.score0.toFixed(1)} at zero, ` +
      `confidence ${report.global.confidence.toFixed(1)}σ, district spread ${report.districtSpreadM} m, ` +
      `${report.flagged.length}/${report.buildingCount} buildings flagged)`
  );
  return {
    offsetM: report.global.offsetM,
    score: Math.round(report.global.score * 10) / 10,
    score0: Math.round(report.global.score0 * 10) / 10,
    confidence: Math.round(report.global.confidence * 10) / 10,
    districtSpreadM: report.districtSpreadM,
    flaggedCount: report.flagged.length,
  };
}
