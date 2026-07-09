import { describe, it, expect } from 'vitest';
import { bakeOrder } from '../run';

describe('bake orchestration', () => {
  it('runs fetches before build-scene (lidar after terrain: it needs the DTM)', () => {
    expect(bakeOrder).toEqual([
      'fetch-osm',
      'fetch-ms-heights',
      'fetch-terrain',
      'fetch-lidar-heights',
      'fetch-drape',
      'build-scene',
    ]);
  });
});
