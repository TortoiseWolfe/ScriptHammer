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
});
