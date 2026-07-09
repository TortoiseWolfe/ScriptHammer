// #233 registration measurement — pure-function coverage on fully synthetic
// fixtures (no real imagery, no real footprints, all offline).

import { describe, it, expect } from 'vitest';
import {
  enuToPx,
  bresenham,
  rasterizeEdges,
  sobelMagnitude,
  scoreAtShift,
  searchOffset,
  gradientPercentile,
  scoreBuildings,
  districtIndex,
  measureRegistration,
} from '../registration';
import { createProjection, boxFromCenter } from '../enu';

describe('enuToPx (the runtime terrainSample mapping, inverted to pixels)', () => {
  const W = 101;
  const H = 201;
  const gW = 500;
  const gH = 1000;
  it('NW corner (west, north=-z) → (0, 0)', () => {
    expect(enuToPx(-gW / 2, -gH / 2, W, H, gW, gH)).toEqual([0, 0]);
  });
  it('SE corner → (W-1, H-1)', () => {
    expect(enuToPx(gW / 2, gH / 2, W, H, gW, gH)).toEqual([100, 200]);
  });
  it('origin (box centre) → image centre', () => {
    expect(enuToPx(0, 0, W, H, gW, gH)).toEqual([50, 100]);
  });
});

describe('bresenham', () => {
  const walk = (c0: number, r0: number, c1: number, r1: number) => {
    const px: [number, number][] = [];
    bresenham(c0, r0, c1, r1, (c, r) => px.push([c, r]));
    return px;
  };
  it('horizontal line hits every column once', () => {
    expect(walk(2, 5, 6, 5)).toEqual([
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
      [6, 5],
    ]);
  });
  it('vertical and 45° diagonal', () => {
    expect(walk(3, 1, 3, 4)).toEqual([
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
    ]);
    expect(walk(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });
  it('is direction-symmetric in coverage (endpoints included)', () => {
    const a = new Set(walk(0, 0, 7, 3).map(([c, r]) => `${c},${r}`));
    expect(a.has('0,0')).toBe(true);
    expect(a.has('7,3')).toBe(true);
    expect(a.size).toBe(8); // one pixel per column on a shallow line
  });
});

// Synthetic scene: a 200x200 drape over a 199x199 m ground (1 px per metre
// exactly), with a bright square whose OUTLINE spans pixels [80..120]^2.
const W = 200;
const H = 200;
const gW = W - 1;
const gH = H - 1;

function syntheticGray(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let r = 80; r <= 120; r++)
    for (let c = 80; c <= 120; c++) g[r * W + c] = 220;
  return g;
}

/** Flat ENU ring for an axis-aligned square whose EDGES land on the given
 *  pixel bounds (inclusive), using the 1 px/m mapping above. */
function squareRing(c0: number, r0: number, c1: number, r1: number): number[] {
  const x = (c: number) => (c / (W - 1) - 0.5) * gW;
  const z = (r: number) => (r / (H - 1) - 0.5) * gH;
  return [x(c0), z(r0), x(c1), z(r0), x(c1), z(r1), x(c0), z(r1)];
}

describe('sobelMagnitude', () => {
  const grad = sobelMagnitude(syntheticGray(), W, H);
  it('responds on the square outline, silent in flat regions', () => {
    expect(grad[100 * W + 80]).toBeGreaterThan(400); // left edge mid-height
    expect(grad[100 * W + 100]).toBe(0); // interior is flat
    expect(grad[10 * W + 10]).toBe(0); // background is flat
  });
  it('borders are zero (kernel needs all 8 neighbours)', () => {
    expect(grad[0]).toBe(0);
    expect(grad[(H - 1) * W + (W - 1)]).toBe(0);
  });
});

describe('rasterizeEdges', () => {
  it('rasterizes a square outline and reports the ENU centroid', () => {
    const ring = squareRing(80, 80, 120, 120);
    const { edgePx, perBuilding } = rasterizeEdges(
      [{ id: 7, ring }],
      W,
      H,
      gW,
      gH
    );
    // 4 sides x 41 px minus 4 shared corners
    expect(edgePx.length).toBe(4 * 41 - 4);
    expect(perBuilding).toHaveLength(1);
    expect(perBuilding[0].id).toBe(7);
    // centroid of the square: pixel (100,100) ↔ ENU (0.5, 0.5) at this mapping
    const [cCol, cRow] = enuToPx(
      perBuilding[0].x,
      perBuilding[0].z,
      W,
      H,
      gW,
      gH
    );
    expect(cCol).toBeCloseTo(100, 6);
    expect(cRow).toBeCloseTo(100, 6);
  });
  it('centroid ignores the duplicated closing vertex of OSM rings', () => {
    // Every baked OSM ring repeats vertex 0 at the end; a naive vertex mean
    // would weight the first corner twice and drag the centroid ~10% of the
    // footprint size toward it (skewing district pooling + flag coordinates).
    const open = squareRing(80, 80, 120, 120);
    const closed = [...open, open[0], open[1]];
    const a = rasterizeEdges([{ id: 1, ring: open }], W, H, gW, gH)
      .perBuilding[0];
    const b = rasterizeEdges([{ id: 1, ring: closed }], W, H, gW, gH)
      .perBuilding[0];
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.z).toBeCloseTo(a.z, 9);
  });
  it('drops degenerate rings and CLIPS out-of-bounds pixels (no row wrap)', () => {
    const { edgePx, perBuilding } = rasterizeEdges(
      [
        { id: 1, ring: [0, 0, 5, 5] }, // 2 points — degenerate
        { id: 2, ring: squareRing(-10, 90, 5, 110) }, // straddles the west edge
      ],
      W,
      H,
      gW,
      gH
    );
    expect(perBuilding.map((b) => b.id)).toEqual([2]);
    // The ring spans cols -10..5: without the bounds check, a negative col
    // packs as (row-1)*W + (W+col) — a WRAPPED pixel near the EAST edge of
    // the previous row. Every emitted pixel must sit in the real col range.
    expect(edgePx.length).toBeGreaterThan(0);
    for (const idx of edgePx) {
      const col = idx % W;
      const row = (idx - col) / W;
      expect(col).toBeLessThanOrEqual(5);
      expect(row).toBeGreaterThanOrEqual(90);
      expect(row).toBeLessThanOrEqual(110);
    }
  });
});

/** A second, deliberately ASYMMETRIC photo: bright rect spanning pixel rows
 *  90..120, cols 80..130 — a transposition (x/z swap) bug cannot pass tests
 *  built on it, unlike the symmetric square. */
function rectGray(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let r = 90; r <= 120; r++)
    for (let c = 80; c <= 130; c++) g[r * W + c] = 220;
  return g;
}

describe('searchOffset recovers a known misregistration', () => {
  const grad = sobelMagnitude(rectGray(), W, H);
  it('footprint drawn 4 m west + 2 m north of the photo rect → offset {x:4, z:2} (axes distinct)', () => {
    // The photo rect outline is cols 80..130, rows 90..120; the vector ring
    // at cols 76..126, rows 88..118 needs +4 east and +2 south to land on it.
    // UNEQUAL x/z components + a non-square rect: a transposed-axes
    // implementation would report {x:2, z:4} and fail here.
    const ring = squareRing(76, 88, 126, 118);
    const { edgePx } = rasterizeEdges([{ id: 1, ring }], W, H, gW, gH);
    const res = searchOffset(edgePx, grad, W, H, gW, gH);
    expect(res.offsetM).toEqual({ x: 4, z: 2 });
    expect(res.score).toBeGreaterThan(res.score0 * 3);
    expect(res.confidence).toBeGreaterThan(1);
  });
  it('an aligned footprint reports ~zero offset', () => {
    const ring = squareRing(80, 90, 130, 120);
    const { edgePx } = rasterizeEdges([{ id: 1, ring }], W, H, gW, gH);
    const res = searchOffset(edgePx, grad, W, H, gW, gH);
    expect(Math.abs(res.offsetM.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(res.offsetM.z)).toBeLessThanOrEqual(0.5);
    expect(res.score0).toBeGreaterThan(0);
  });
  it('NO SIGNAL answers {0,0}, never the search-window corner', () => {
    // All-tie surfaces (featureless drape / zero in-bounds edge pixels) used
    // to crown the first-evaluated corner (-10,-10) — a plausible-looking
    // offset that the |v|<=15 site-config refine would accept if pinned.
    const flat = new Float32Array(W * H); // zero gradients everywhere
    const ring = squareRing(80, 90, 130, 120);
    const { edgePx } = rasterizeEdges([{ id: 1, ring }], W, H, gW, gH);
    const res = searchOffset(edgePx, flat, W, H, gW, gH);
    expect(res.offsetM).toEqual({ x: 0, z: 0 });
    expect(res.confidence).toBe(0);
    // zero in-bounds samples (empty edge set) — same contract
    const empty = searchOffset(new Uint32Array(0), flat, W, H, gW, gH);
    expect(empty.offsetM).toEqual({ x: 0, z: 0 });
  });
});

describe('closed-loop sign contract: report → vectorOffsetM → residual 0', () => {
  it('pinning the measured offset in createProjection zeroes the next measurement', () => {
    // The full chain the operator workflow depends on, offline: lon/lat ring
    // projected through createProjection lands 4 m west + 2 m north of the
    // photo rect; the report says ADD {x:4, z:2}; re-projecting the SAME
    // lon/lat through createProjection(box, thatOffset) must zero the
    // residual. A sign error anywhere in enuToPx/search/enu-injection flips
    // this loop and the corrected bake would DOUBLE the error instead.
    const box = boxFromCenter(35, -85, gW, gH);
    const proj0 = createProjection(box);
    const grad = sobelMagnitude(rectGray(), W, H);
    // lon/lat corners whose UNSHIFTED projection lands at cols 76..126,
    // rows 88..118 (4 px west, 2 px north of the photo rect).
    const enuRing = squareRing(76, 88, 126, 118);
    const lonLat: [number, number][] = [];
    for (let i = 0; i + 1 < enuRing.length; i += 2) {
      lonLat.push([
        proj0.centerLon + enuRing[i] / proj0.mPerDegLon,
        proj0.centerLat - enuRing[i + 1] / proj0.mPerDegLat,
      ]);
    }
    const projectRing = (p: ReturnType<typeof createProjection>) =>
      lonLat.flatMap(([lon, lat]) => p.lonLatToEnu(lon, lat));

    const first = searchOffset(
      rasterizeEdges([{ id: 1, ring: projectRing(proj0) }], W, H, gW, gH)
        .edgePx,
      grad,
      W,
      H,
      gW,
      gH
    );
    expect(first.offsetM).toEqual({ x: 4, z: 2 });

    const proj1 = createProjection(box, first.offsetM);
    const second = searchOffset(
      rasterizeEdges([{ id: 1, ring: projectRing(proj1) }], W, H, gW, gH)
        .edgePx,
      grad,
      W,
      H,
      gW,
      gH
    );
    expect(Math.abs(second.offsetM.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(second.offsetM.z)).toBeLessThanOrEqual(0.5);
  });
});

describe('gradientPercentile', () => {
  it('picks the value at the percentile of the sampled distribution', () => {
    const f = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) f[i] = i;
    expect(gradientPercentile(f, 0.7, 1)).toBe(700);
    expect(gradientPercentile(f, 1, 1)).toBe(999); // clamped to last
  });
});

describe('scoreBuildings', () => {
  const grad = sobelMagnitude(syntheticGray(), W, H);
  it('aligned footprint scores high, misaligned scores low', () => {
    const aligned = squareRing(80, 80, 120, 120);
    const off = squareRing(30, 30, 60, 60); // nowhere near any photo edge
    const { perBuilding } = rasterizeEdges(
      [
        { id: 1, ring: aligned },
        { id: 2, ring: off },
      ],
      W,
      H,
      gW,
      gH
    );
    const scores = scoreBuildings(perBuilding, grad, W, H, 0, 0, 100);
    const byId = new Map(scores.map((s) => [s.id, s.score]));
    expect(byId.get(1)!).toBeGreaterThan(0.9);
    expect(byId.get(2)!).toBe(0);
  });
});

describe('districtIndex (3x3, row-major from NW)', () => {
  it('maps the 9 cells', () => {
    const gW2 = 300;
    const gH2 = 300;
    expect(districtIndex(-100, -100, gW2, gH2)).toBe(0); // NW
    expect(districtIndex(0, -100, gW2, gH2)).toBe(1); // N
    expect(districtIndex(100, -100, gW2, gH2)).toBe(2); // NE
    expect(districtIndex(-100, 0, gW2, gH2)).toBe(3); // W
    expect(districtIndex(0, 0, gW2, gH2)).toBe(4); // centre
    expect(districtIndex(100, 100, gW2, gH2)).toBe(8); // SE
  });
  it('clamps out-of-box centroids to the border cells', () => {
    expect(districtIndex(-9999, -9999, 300, 300)).toBe(0);
    expect(districtIndex(9999, 9999, 300, 300)).toBe(8);
  });
});

describe('measureRegistration (end-to-end on the synthetic scene)', () => {
  it('reports the global offset, districts, and the weakest decile', () => {
    // 12 misregistered squares scattered around the photo square positions:
    // photo has ONE bright square; give 11 buildings drawn off-photo (no
    // gradients under them anywhere) and 1 drawn 4 px NW of the photo square.
    const buildings = [
      { id: 100, ring: squareRing(76, 76, 116, 116) },
      ...Array.from({ length: 11 }, (_, i) => ({
        id: i,
        ring: squareRing(10 + i * 3, 150, 20 + i * 3, 160),
      })),
    ];
    const { report } = measureRegistration(
      buildings,
      syntheticGray(),
      W,
      H,
      gW,
      gH
    );
    // Only building 100's edges see gradients, so the global peak is its +4/+4.
    expect(report.global.offsetM).toEqual({ x: 4, z: 4 });
    expect(report.districts).toHaveLength(9);
    expect(report.buildingCount).toBe(12);
    expect(report.flagged.length).toBe(2); // ceil(12/10)
    expect(report.edgePxCount).toBeGreaterThan(0);
    expect(report.note).toContain('ADD');
  });
});
