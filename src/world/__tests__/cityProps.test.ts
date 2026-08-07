import { describe, it, expect } from 'vitest';
import { scatterCityProps } from '../CityProps';
import type { Street, TerrainGrid, Manifest } from '@/lib/manifest';

// Flat terrain + minimal manifest so elevationAt returns a stable ground height.
const grid: TerrainGrid = { cols: 2, rows: 2, heights: [0, 0, 0, 0] };
const manifest = { groundWm: 1000, groundHm: 1000 } as unknown as Manifest;

describe('scatterCityProps', () => {
  it('populates a long street built from MANY short segments (cumulative placement)', () => {
    // 300 m street sampled every 5 m — exactly the densely-sampled short-segment
    // case where per-segment stepping placed almost nothing. Cumulative distance
    // along the whole polyline must still scatter trees + cars.
    const pts: number[] = [];
    for (let d = 0; d <= 300; d += 5) pts.push(d, 0);
    const streets: Street[] = [{ pts }];

    const { trees, cars } = scatterCityProps(streets, grid, manifest);
    expect(trees.length).toBeGreaterThan(10);
    expect(cars.length).toBeGreaterThan(3);

    // Deterministic (seeded) — same layout every call.
    const again = scatterCityProps(streets, grid, manifest);
    expect(again.trees.length).toBe(trees.length);
    expect(again.cars.length).toBe(cars.length);
  });

  it('scatters nothing when there are no streets', () => {
    const { trees, cars } = scatterCityProps([], grid, manifest);
    expect(trees.length).toBe(0);
    expect(cars.length).toBe(0);
  });
});
