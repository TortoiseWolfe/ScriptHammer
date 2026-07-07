import { describe, it, expect } from 'vitest';
import {
  bilinear,
  assertExtent,
  elevationAt,
  minElevation,
} from '../terrainSample';

const grid = { cols: 2, rows: 2, heights: [0, 10, 20, 30] }; // SW,SE,NW,NE row-major (S->N)

describe('terrain sampling', () => {
  it('bilinear samples the corners', () => {
    expect(bilinear(grid, 0, 0)).toBeCloseTo(0, 5); // SW
    expect(bilinear(grid, 1, 0)).toBeCloseTo(10, 5); // SE
    expect(bilinear(grid, 0, 1)).toBeCloseTo(20, 5); // NW
    expect(bilinear(grid, 1, 1)).toBeCloseTo(30, 5); // NE
  });
  it('bilinear interpolates the center', () => {
    expect(bilinear(grid, 0.5, 0.5)).toBeCloseTo(15, 5);
  });
  it('assertExtent throws when the quad mismatches the manifest', () => {
    const m = { groundWm: 1458, groundHm: 2875 } as never;
    expect(() => assertExtent(m, 1458, 2875)).not.toThrow();
    expect(() => assertExtent(m, 1800, 2875)).toThrow(/extent/i);
  });

  it('minElevation returns the grid minimum', () => {
    expect(minElevation(grid)).toBe(0);
    expect(minElevation({ cols: 2, rows: 1, heights: [7, 3] })).toBe(3);
  });

  it('elevationAt maps ENU (x,z) with the correct N-S sign (v = 0.5 - z/h)', () => {
    // manifest ground 1000 x 1000 → x in [-500,500] (W->E), z in [-500,500].
    // NORTH is -Z. The grid's NORTH edge (v=1) is heights 20/30 (higher);
    // SOUTH edge (v=0) is 0/10. So a north (negative-z) point must sample HIGH,
    // a south (positive-z) point must sample LOW — proving the sign isn't mirrored.
    const m = { groundWm: 1000, groundHm: 1000 } as never;
    const north = elevationAt(grid, m, 0, -500); // v = 0.5 - (-500/1000) = 1.0 → NW/NE avg = 25
    const south = elevationAt(grid, m, 0, 500); // v = 0.5 - (500/1000)  = 0.0 → SW/SE avg = 5
    expect(north).toBeCloseTo(25, 5);
    expect(south).toBeCloseTo(5, 5);
    expect(north).toBeGreaterThan(south); // the anti-mirror guard
    // center of the box → v=0.5, u=0.5 → grid center = 15
    expect(elevationAt(grid, m, 0, 0)).toBeCloseTo(15, 5);
  });
});
