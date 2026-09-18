import { describe, it, expect } from 'vitest';
import { splitEdges, planTiling, planGroundTiles } from '../slice-drape';

describe('splitEdges', () => {
  it('returns n+1 edges spanning the whole raster', () => {
    expect(splitEdges(2433, 2)).toEqual([0, 1217, 2433]);
    expect(splitEdges(7938, 4)).toEqual([0, 1985, 3969, 5954, 7938]);
  });

  it('never loses or invents a pixel, at any awkward size', () => {
    for (const total of [1, 7, 100, 2433, 7938, 38100]) {
      for (const n of [1, 2, 3, 5, 8, 13]) {
        const e = splitEdges(total, n);
        expect(e[0]).toBe(0);
        expect(e[e.length - 1]).toBe(total);
        // strictly non-decreasing, so no tile has negative width
        for (let i = 1; i < e.length; i++)
          expect(e[i]).toBeGreaterThanOrEqual(e[i - 1]);
      }
    }
  });
});

describe('planTiling', () => {
  it('keeps chatt under the 2048 cap', () => {
    // The real drape. 2433 wide needs 2 columns; 7938 tall needs 4 rows.
    expect(planTiling(2433, 7938)).toEqual({ cols: 2, rows: 4 });
  });

  it('leaves a small raster alone rather than tiling it for no reason', () => {
    expect(planTiling(1024, 1024)).toEqual({ cols: 1, rows: 1 });
  });

  it('respects a lower cap, which is what a 4096-class device needs', () => {
    expect(planTiling(2433, 7938, 1024)).toEqual({ cols: 3, rows: 8 });
  });
});

describe('planGroundTiles', () => {
  const W = 2433,
    H = 7938,
    HX = 730,
    HZ = 2895.55;

  it('tiles the whole corridor with no gap and no overlap', () => {
    const p = planGroundTiles(W, H, HX, HZ);
    expect(p.tiles).toHaveLength(p.cols * p.rows);
    const area = p.tiles.reduce((a, t) => a + t.px[2] * t.px[3], 0);
    expect(area).toBe(W * H);
  });

  it('makes shared edges BIT-IDENTICAL, which is the whole point', () => {
    const p = planGroundTiles(W, H, HX, HZ);
    const at = (r: number, c: number) =>
      p.tiles.find((t) => t.row === r && t.col === c)!;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c + 1 < p.cols; c++) {
        // east edge of (r,c) === west edge of (r,c+1), exactly
        expect(at(r, c).world[2]).toBe(at(r, c + 1).world[0]);
      }
    }
    for (let r = 0; r + 1 < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        expect(at(r, c).world[3]).toBe(at(r + 1, c).world[1]);
      }
    }
  });

  it('spans exactly the twin extent, corner to corner', () => {
    const p = planGroundTiles(W, H, HX, HZ);
    const nw = p.tiles.find((t) => t.row === 0 && t.col === 0)!;
    const se = p.tiles.find(
      (t) => t.row === p.rows - 1 && t.col === p.cols - 1
    )!;
    expect(nw.world[0]).toBeCloseTo(-HX, 6);
    expect(nw.world[1]).toBeCloseTo(-HZ, 6);
    expect(se.world[2]).toBeCloseTo(HX, 6);
    expect(se.world[3]).toBeCloseTo(HZ, 6);
  });

  it('puts pixel row 0 at the NORTH edge, which is -Z', () => {
    // Getting this backwards flips the aerial end for end and nothing errors.
    const p = planGroundTiles(W, H, HX, HZ);
    const north = p.tiles.find((t) => t.row === 0 && t.col === 0)!;
    const south = p.tiles.find((t) => t.row === p.rows - 1 && t.col === 0)!;
    expect(north.world[1]).toBeLessThan(south.world[1]);
  });
});
