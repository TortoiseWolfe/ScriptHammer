import { describe, it, expect } from 'vitest';
import { texelFor, lensClamp } from '../tiltShift';

describe('tiltShift helpers', () => {
  it('computes texel size from pixel dims', () => {
    const t = texelFor(1000, 500);
    expect(t.x).toBeCloseTo(0.001, 6);
    expect(t.y).toBeCloseTo(0.002, 6);
  });
  it('clamps lens focus to [0.2,0.8] and blur to [0,6]', () => {
    expect(lensClamp(1.2, 99)).toEqual({ focus: 0.8, blur: 6 });
    expect(lensClamp(-1, -1)).toEqual({ focus: 0.2, blur: 0 });
  });
});
