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
  it('rule 4: fallback has real range — big footprint exceeds old 19.2m cap yet still clamps', () => {
    const bigCommercial = resolveHeight({ building: 'commercial' }, 50000);
    expect(bigCommercial.rule).toBe('fallback');
    // (a) proves range: taller than the old (5+1)*3.2 = 19.2m ceiling
    expect(bigCommercial.meters).toBeGreaterThan(19.2);
    // (b) proves the clamp still holds
    expect(bigCommercial.meters).toBeLessThanOrEqual(REPUBLIC_CENTRE_M);
    // office bucket taller than house bucket
    const office = resolveHeight({ building: 'office' }, 400);
    const house = resolveHeight({ building: 'house' }, 400);
    expect(office.meters).toBeGreaterThan(house.meters);
    // area range works: a big office footprint is taller than a small one
    const bigOffice = resolveHeight({ building: 'office' }, 3000);
    const smallOffice = resolveHeight({ building: 'office' }, 100);
    expect(bigOffice.meters).toBeGreaterThan(smallOffice.meters);
  });
  it('floor guard: a non-positive height tag falls through to the fallback', () => {
    const r = resolveHeight({ height: '-5' }, 400);
    expect(r.rule).not.toBe('height');
    expect(r.rule).toBe('fallback');
  });
});
