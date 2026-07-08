import { describe, it, expect } from 'vitest';
import { buildGrid, chunk } from '../fetch-terrain';

const BOX = { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 };

describe('terrain grid', () => {
  it('builds a row-major grid over the box, S->N, W->E', () => {
    const g = buildGrid(BOX, 3, 3);
    expect(g).toHaveLength(9);
    expect(g[0].lat).toBeCloseTo(BOX.swLat, 5); // first row = south
    expect(g[0].lon).toBeCloseTo(BOX.swLon, 5); // first col = west
    expect(g[8].lat).toBeCloseTo(BOX.neLat, 5); // last = north-east
    expect(g[8].lon).toBeCloseTo(BOX.neLon, 5);
  });
  it('chunks into <=100 for OpenTopoData', () => {
    const c = chunk(
      Array.from({ length: 250 }, (_, i) => i),
      100
    );
    expect(c.map((x) => x.length)).toEqual([100, 100, 50]);
  });
});
