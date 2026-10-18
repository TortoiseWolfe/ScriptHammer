import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  measureTerrainAccuracy,
  type TerrainAccuracyBox,
  type TerrainAccuracyGrid,
  type TerrainReferenceSample,
} from '../terrain-accuracy';

interface TerrainAccuracyReference {
  baselineMaeM: number;
  lattice: { cols: number; rows: number };
  samples: TerrainReferenceSample[];
}

const BASELINE_MAE_M = 2.7556;
const twinDir = join(process.cwd(), 'public/twins/chatt');
const manifest = JSON.parse(
  readFileSync(join(twinDir, 'manifest.json'), 'utf8')
) as { box: TerrainAccuracyBox };
const terrain = JSON.parse(
  readFileSync(join(twinDir, 'terrain.json'), 'utf8')
) as TerrainAccuracyGrid;
const reference = JSON.parse(
  readFileSync(
    join(process.cwd(), 'scripts/bake/fixtures/chatt-srtm30m.json'),
    'utf8'
  )
) as TerrainAccuracyReference;

describe('Chattanooga terrain accuracy against independent SRTM30m', () => {
  it('does not exceed its recorded 2.7556 m MAE baseline', () => {
    const measurement = measureTerrainAccuracy(
      manifest.box,
      terrain,
      reference.samples
    );

    expect(reference.baselineMaeM).toBe(BASELINE_MAE_M);
    expect(reference.samples).toHaveLength(
      reference.lattice.cols * reference.lattice.rows
    );
    expect(measurement.sampleCount).toBe(300);
    expect(measurement.meanAbsoluteErrorM).toBeLessThanOrEqual(BASELINE_MAE_M);
  });

  it('detects a systematic vertical drift beyond the baseline', () => {
    const shiftedTerrain = {
      ...terrain,
      heights: terrain.heights.map((height) => height + 10),
    };
    const measurement = measureTerrainAccuracy(
      manifest.box,
      shiftedTerrain,
      reference.samples
    );

    expect(measurement.meanAbsoluteErrorM).toBeGreaterThan(BASELINE_MAE_M);
  });
});
