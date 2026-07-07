import { describe, it, expect } from 'vitest';
import { ringToShape } from '../geometry';

describe('ringToShape', () => {
  it('recenters a flat ENU ring on its centroid', () => {
    // square from (10,10) to (20,20)
    const { center, localRing } = ringToShape([10, 10, 20, 10, 20, 20, 10, 20]);
    expect(center[0]).toBeCloseTo(15, 5);
    expect(center[1]).toBeCloseTo(15, 5);
    expect(localRing[0]).toEqual([-5, -5]);
    expect(localRing[2]).toEqual([5, 5]);
  });
});
