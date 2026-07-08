import { describe, it, expect } from 'vitest';
import { resolveHeight, type HeightsConfig } from '../height';

// Chatt-shaped config (the real one lives in sites/chatt.json — see
// golden-chatt.test.ts). Rules 1-2 are config-independent.
const CLAMP = 91.44; // Republic Centre, 300 ft
const CFG: HeightsConfig = {
  overrides: { 'Republic Centre': CLAMP },
  fallbackClampM: CLAMP,
};
const EMPTY: HeightsConfig = { overrides: {}, fallbackClampM: 100 };

describe('resolveHeight', () => {
  it('rule 1: uses an explicit height tag (metres)', () => {
    expect(resolveHeight({ building: 'yes', height: '52' }, 400, CFG)).toEqual({
      meters: 52,
      rule: 'height',
    });
  });
  it('rule 1: parses height with a unit suffix', () => {
    expect(resolveHeight({ height: '40 m' }, 400, CFG).meters).toBeCloseTo(
      40,
      5
    );
  });
  it('rule 2: building:levels * 3.2', () => {
    expect(resolveHeight({ 'building:levels': '5' }, 400, CFG)).toEqual({
      meters: 16,
      rule: 'levels',
    });
  });
  it('rule 3: named override wins over a missing tag', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000, CFG);
    expect(r.rule).toBe('override');
    expect(r.meters).toBeCloseTo(CLAMP, 5);
  });
  it('rule 3: with empty overrides the same name falls back', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000, EMPTY);
    expect(r.rule).toBe('fallback');
  });
  it('rule 4: fallback buckets by building tag and clamps at fallbackClampM', () => {
    const house = resolveHeight({ building: 'house' }, 120, CFG);
    expect(house.rule).toBe('fallback');
    expect(house.meters).toBeLessThan(10);
    const commercial = resolveHeight({ building: 'commercial' }, 1200, CFG);
    expect(commercial.rule).toBe('fallback');
    expect(commercial.meters).toBeGreaterThan(house.meters);
    expect(commercial.meters).toBeLessThanOrEqual(CLAMP);
  });
  it('rule 4: fallback has real range — big footprint exceeds old 19.2m cap yet still clamps', () => {
    const bigCommercial = resolveHeight({ building: 'commercial' }, 50000, CFG);
    expect(bigCommercial.rule).toBe('fallback');
    // (a) proves range: taller than the old (5+1)*3.2 = 19.2m ceiling
    expect(bigCommercial.meters).toBeGreaterThan(19.2);
    // (b) proves the clamp still holds
    expect(bigCommercial.meters).toBeLessThanOrEqual(CLAMP);
    // office bucket taller than house bucket
    const office = resolveHeight({ building: 'office' }, 400, CFG);
    const house = resolveHeight({ building: 'house' }, 400, CFG);
    expect(office.meters).toBeGreaterThan(house.meters);
    // area range works: a big office footprint is taller than a small one
    const bigOffice = resolveHeight({ building: 'office' }, 3000, CFG);
    const smallOffice = resolveHeight({ building: 'office' }, 100, CFG);
    expect(bigOffice.meters).toBeGreaterThan(smallOffice.meters);
  });
  it('rule 4: a per-site clamp binds the fallback', () => {
    const low: HeightsConfig = { overrides: {}, fallbackClampM: 10 };
    const r = resolveHeight({ building: 'office' }, 5000, low);
    expect(r.meters).toBe(10);
  });
  it('floor guard: a non-positive height tag falls through to the fallback', () => {
    const r = resolveHeight({ height: '-5' }, 400, CFG);
    expect(r.rule).not.toBe('height');
    expect(r.rule).toBe('fallback');
  });
});
