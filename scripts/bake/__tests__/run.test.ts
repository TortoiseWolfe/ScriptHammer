import { describe, it, expect } from 'vitest';
import { bakeOrder } from '../run';

describe('bake orchestration', () => {
  it('runs fetches before build-scene', () => {
    expect(bakeOrder).toEqual([
      'fetch-osm',
      'fetch-terrain',
      'fetch-drape',
      'build-scene',
    ]);
  });
});
