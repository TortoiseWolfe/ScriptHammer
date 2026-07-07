import { describe, it, expect } from 'vitest';
import { resolveHeight, HEIGHT_OVERRIDES, REPUBLIC_CENTRE_M } from '../height';

describe('resolveHeight', () => {
  it('rule 1: uses an explicit height tag (metres)', () => {
    expect(resolveHeight({ building: 'yes', height: '52' }, 400)).toEqual({
      meters: 52,
      rule: 'height',
    });
  });
  it('rule 1: parses height with a unit suffix', () => {
    expect(resolveHeight({ height: '40 m' }, 400).meters).toBeCloseTo(40, 5);
  });
  it('rule 2: building:levels * 3.2', () => {
    expect(resolveHeight({ 'building:levels': '5' }, 400)).toEqual({
      meters: 16,
      rule: 'levels',
    });
  });
  it('rule 3: named override wins over a missing tag', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000);
    expect(r.rule).toBe('override');
    expect(r.meters).toBeCloseTo(HEIGHT_OVERRIDES['Republic Centre'], 5);
  });
  it('rule 4: fallback buckets by building tag and clamps below Republic Centre', () => {
    const house = resolveHeight({ building: 'house' }, 120);
    expect(house.rule).toBe('fallback');
    expect(house.meters).toBeLessThan(10);
    const commercial = resolveHeight({ building: 'commercial' }, 1200);
    expect(commercial.rule).toBe('fallback');
    expect(commercial.meters).toBeGreaterThan(house.meters);
    expect(commercial.meters).toBeLessThanOrEqual(REPUBLIC_CENTRE_M);
  });
});
