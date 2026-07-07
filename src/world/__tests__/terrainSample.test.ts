import { describe, it, expect } from 'vitest';
import { bilinear, assertExtent } from '../terrainSample';

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
});
