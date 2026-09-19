import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  splitEdges,
  planTiling,
  planGroundTiles,
  sliceDrape,
} from '../slice-drape';

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

describe('slicing a SECOND drape into the same twin (#1176)', () => {
  // WHY THIS EXISTS. sliceDrape could always slice any source — `filename` and
  // `dir` were already parameters — but the plan was written to a hardcoded
  // `drape-tiles.json`. So slicing the wide drape after the narrow one put the
  // tiles on disk correctly and then overwrote the narrow plan with the wide
  // grid. Both sets of JPEGs exist, one index describes the wrong one, and
  // nothing errors: the renderer draws real imagery at wrong world rectangles,
  // which looks like a city that is subtly wrong everywhere rather than broken.
  const tmp = mkdtempSync(join(tmpdir(), 'slice-drape-'));
  const NARROW = { w: 600, h: 900, hx: 300, hz: 450 };
  const WIDE = { w: 800, h: 700, hx: 4106, hz: 3783 };

  beforeAll(async () => {
    const solid = (w: number, h: number) =>
      sharp({
        create: {
          width: w,
          height: h,
          channels: 3,
          background: { r: 9, g: 9, b: 9 },
        },
      })
        .jpeg()
        .toBuffer();
    writeFileSync(join(tmp, 'drape.jpg'), await solid(NARROW.w, NARROW.h));
    writeFileSync(join(tmp, 'drape-wide.jpg'), await solid(WIDE.w, WIDE.h));
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('writes each plan to its own manifest, and neither clobbers the other', async () => {
    await sliceDrape(tmp, NARROW.hx, NARROW.hz, { maxPx: 256 });
    await sliceDrape(tmp, WIDE.hx, WIDE.hz, {
      filename: 'drape-wide.jpg',
      dir: 'drape-wide',
      manifestName: 'drape-wide-tiles.json',
      maxPx: 256,
    });

    const narrow = JSON.parse(
      readFileSync(join(tmp, 'drape-tiles.json'), 'utf8')
    );
    const wide = JSON.parse(
      readFileSync(join(tmp, 'drape-wide-tiles.json'), 'utf8')
    );

    // The narrow plan must still describe the NARROW raster after the wide run.
    expect(narrow.source).toEqual({ width: NARROW.w, height: NARROW.h });
    expect(narrow.dir).toBe('drape');
    expect(wide.source).toEqual({ width: WIDE.w, height: WIDE.h });
    expect(wide.dir).toBe('drape-wide');

    // And each plan's extent must be its OWN. Before the fix the second call
    // overwrote the first, so this is the assertion that actually fails.
    const nSE = narrow.tiles[narrow.tiles.length - 1];
    const wSE = wide.tiles[wide.tiles.length - 1];
    expect(nSE.world[2]).toBeCloseTo(NARROW.hx, 6);
    expect(wSE.world[2]).toBeCloseTo(WIDE.hx, 6);
  });

  it('CONTROL: the default manifest name is unchanged for existing callers', async () => {
    // Every site baked before #1176 must rebake byte-identically. If the
    // default moved, this passes nowhere and breaks every twin silently.
    const solo = mkdtempSync(join(tmpdir(), 'slice-drape-solo-'));
    writeFileSync(
      join(solo, 'drape.jpg'),
      await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r: 1, g: 2, b: 3 },
        },
      })
        .jpeg()
        .toBuffer()
    );
    await sliceDrape(solo, 200, 200, { maxPx: 256 });
    expect(existsSync(join(solo, 'drape-tiles.json'))).toBe(true);
    rmSync(solo, { recursive: true, force: true });
  });

  it('the WIDE tiles span the wide extent, not the narrow one', async () => {
    // The mistake this guards: passing manifest.groundWm/Hm (the NARROW box) to
    // the wide slice. Every tile rectangle then lands inside a 1460x5791m
    // footprint under an 8212x7566m scene — imagery squeezed into a sixth of
    // the ground, which renders as a plausible city that is wrong everywhere.
    const wide = JSON.parse(
      readFileSync(join(tmp, 'drape-wide-tiles.json'), 'utf8')
    );
    const xs = wide.tiles.flatMap((t: { world: number[] }) => [
      t.world[0],
      t.world[2],
    ]);
    expect(Math.min(...xs)).toBeCloseTo(-WIDE.hx, 6);
    expect(Math.max(...xs)).toBeCloseTo(WIDE.hx, 6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(NARROW.hx * 2);
  });
});
