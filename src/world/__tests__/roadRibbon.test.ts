import { describe, it, expect } from 'vitest';
import { roadRibbon } from '../roadRibbon';
import type { Street } from '@/lib/manifest';

/** y component of (v1 − v0) × (v2 − v0) for every triangle. */
function normalYs(positions: number[]): number[] {
  const ys: number[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const [x0, , z0, x1, , z1, x2, , z2] = positions.slice(i, i + 9);
    const ux = x1 - x0,
      uz = z1 - z0,
      vx = x2 - x0,
      vz = z2 - z0;
    ys.push(uz * vx - ux * vz);
  }
  return ys;
}

const flat = () => 0;

describe('roadRibbon (#1175)', () => {
  it('faces every triangle up, whatever direction the segment runs', () => {
    // Eight directions, including the four axes and both diagonals each way.
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];
    const streets: Street[] = dirs.map(([dx, dz]) => ({
      pts: [0, 0, dx * 20, dz * 20],
    }));
    const { positions } = roadRibbon(streets, flat, 8);
    const ys = normalYs(positions);
    expect(ys).toHaveLength(dirs.length * 2);
    for (const y of ys) expect(y).toBeGreaterThan(0);
  });

  it('keeps one uv pair per vertex, matching the positions', () => {
    const streets = [{ pts: [0, 0, 10, 0, 10, 10] }] satisfies Street[];
    const { positions, uvs } = roadRibbon(streets, flat, 8);
    expect(positions).toHaveLength(2 * 2 * 9);
    expect(uvs).toHaveLength((positions.length / 3) * 2);
    for (let v = 0; v < positions.length / 3; v++) {
      expect(uvs[v * 2]).toBe(positions[v * 3]);
      expect(uvs[v * 2 + 1]).toBe(positions[v * 3 + 2]);
    }
  });

  it('skips zero-length segments', () => {
    const streets = [{ pts: [5, 5, 5, 5] }] satisfies Street[];
    expect(roadRibbon(streets, flat, 8).positions).toHaveLength(0);
  });

  it('drops repeated points instead of making a zero-length quad', () => {
    const streets = [{ pts: [0, 0, 10, 0, 10, 0, 20, 0] }] satisfies Street[];
    expect(roadRibbon(streets, flat, 8).positions).toHaveLength(2 * 2 * 9);
  });
});

/** Distinct (x, z) vertex positions, as "x,z" strings rounded to 1 mm. */
function corners(positions: number[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < positions.length; i += 3) {
    out.add(
      `${Math.round(positions[i] * 1000) / 1000},${Math.round(positions[i + 2] * 1000) / 1000}`
    );
  }
  return out;
}

describe('roadRibbon bends are mitred (#1175)', () => {
  // East for 10 m, then north (+z) for 10 m, 8 m wide.
  const bend = [{ pts: [0, 0, 10, 0, 10, 10] }] satisfies Street[];

  it('shares one pair of edge points between the two segments at a bend', () => {
    const { positions } = roadRibbon(bend, flat, 8);
    // 2 ends x 2 edges + the 2 shared bend points = 6, not the 8 that two
    // independent quads would give.
    expect(corners(positions).size).toBe(6);
    expect(corners(positions).has('6,4')).toBe(true);
    expect(corners(positions).has('14,-4')).toBe(true);
  });

  it('keeps every bend edge point half a width from BOTH segments', () => {
    const { positions } = roadRibbon(bend, flat, 8);
    for (const c of corners(positions)) {
      const [x, z] = c.split(',').map(Number);
      // Only the two bend points are at x in {6, 14} with z in {4, -4}.
      if ((x === 6 && z === 4) || (x === 14 && z === -4)) {
        // distance to the first segment's line (z = 0) and the second's (x = 10)
        expect(Math.abs(z)).toBeCloseTo(4);
        expect(Math.abs(x - 10)).toBeCloseTo(4);
      }
    }
  });

  it('still faces every triangle up around a bend, in both turn directions', () => {
    const left = [{ pts: [0, 0, 10, 0, 10, 10] }];
    const right = [{ pts: [0, 0, 10, 0, 10, -10] }];
    const shallow = [{ pts: [0, 0, 10, 0, 20, 4] }];
    for (const streets of [left, right, shallow] satisfies Street[][]) {
      const ys = normalYs(roadRibbon(streets, flat, 8).positions);
      expect(ys.length).toBeGreaterThan(0);
      for (const y of ys) expect(y).toBeGreaterThan(0);
    }
  });

  it('caps the mitre so a hairpin does not throw a spike', () => {
    // Nearly doubles back on itself: the uncapped mitre would be enormous.
    const hairpin = [{ pts: [0, 0, 20, 0, 0, 0.5] }] satisfies Street[];
    const { positions } = roadRibbon(hairpin, flat, 8);
    // The street spans x 0..20. The cap lets the bend reach one extra width
    // (8 m) past the corner either way; uncapped it lands about 160 m out.
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i]).toBeGreaterThan(-1);
      expect(positions[i]).toBeLessThan(20 + 8 + 1e-6);
    }
  });
});

describe('roadRibbon follows the terrain step (#1175)', () => {
  const long = [{ pts: [0, 0, 100, 0] }] satisfies Street[];

  it('cuts a long segment into pieces no longer than the step', () => {
    const { positions } = roadRibbon(long, flat, 8, 8);
    // ceil(100 / 8) = 13 pieces, two triangles each.
    expect(positions).toHaveLength(13 * 2 * 9);
    for (let i = 0; i < positions.length; i += 9) {
      const xs = [positions[i], positions[i + 3], positions[i + 6]];
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(8 + 1e-9);
    }
  });

  it('samples the terrain along the segment, not only at its ends', () => {
    const hill = (x: number) => 10 - Math.abs(x - 50) / 5; // peaks mid-segment
    const seen = new Set<number>();
    roadRibbon(long, (x) => (seen.add(x), hill(x)), 8, 8);
    expect(seen.size).toBeGreaterThan(12);
    // The unsubdivided ribbon only ever sees x = 0 and x = 100.
    const ends = new Set<number>();
    roadRibbon(long, (x) => (ends.add(x), hill(x)), 8);
    expect([...ends].sort((a, b) => a - b)).toEqual([0, 100]);
  });

  it('leaves short segments whole, and keeps every triangle facing up', () => {
    const { positions } = roadRibbon(long, flat, 8, 1000);
    expect(positions).toHaveLength(2 * 9);
    const sub = roadRibbon(long, flat, 8, 8).positions;
    for (const y of normalYs(sub)) expect(y).toBeGreaterThan(0);
  });
});
