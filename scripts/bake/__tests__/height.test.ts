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
  it('rule 2: named override wins over a missing tag', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000, CFG);
    expect(r.rule).toBe('override');
    expect(r.meters).toBeCloseTo(CLAMP, 5);
  });
  it('rule 2: with empty overrides the same name falls back', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000, EMPTY);
    expect(r.rule).toBe('fallback');
  });
  it('rule 4: building:levels * 3.2 (when no lidar return exists)', () => {
    expect(resolveHeight({ 'building:levels': '5' }, 400, CFG)).toEqual({
      meters: 16,
      rule: 'levels',
    });
  });
  it('rule 6: fallback buckets by building tag and clamps at fallbackClampM', () => {
    const house = resolveHeight({ building: 'house' }, 120, CFG);
    expect(house.rule).toBe('fallback');
    expect(house.meters).toBeLessThan(10);
    const commercial = resolveHeight({ building: 'commercial' }, 1200, CFG);
    expect(commercial.rule).toBe('fallback');
    expect(commercial.meters).toBeGreaterThan(house.meters);
    expect(commercial.meters).toBeLessThanOrEqual(CLAMP);
  });
  it('rule 6: fallback has real range — big footprint exceeds old 19.2m cap yet still clamps', () => {
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
  it('rule 6: a per-site clamp binds the fallback', () => {
    const low: HeightsConfig = { overrides: {}, fallbackClampM: 10 };
    const r = resolveHeight({ building: 'office' }, 5000, low);
    expect(r.meters).toBe(10);
  });
  it('floor guard: a non-positive height tag falls through to the fallback', () => {
    const r = resolveHeight({ height: '-5' }, 400, CFG);
    expect(r.rule).not.toBe('height');
    expect(r.rule).toBe('fallback');
  });

  // ── Ordering (#229 / 2026-07-15) ──────────────────────────────────────────
  // The whole ladder is an ordering contract, and until now NOTHING pinned it:
  // the pre-existing cases above each exercise one rule in isolation, so lidar
  // could sit below `levels` — a floor-count GUESS outranking a direct
  // measurement of the same roof — for 1216 buildings without a red test.
  // Measured on chatt: 112 of the 116 `levels` buildings had a lidar height
  // available and `levels × 3.2` ran a median 2.9 m short of it.
  describe('rule ordering', () => {
    it('lidar BEATS building:levels — a measurement outranks a derivation', () => {
      const r = resolveHeight(
        { 'building:levels': '5' }, // would derive 16.0m
        400,
        CFG,
        undefined,
        18.9 // measured
      );
      expect(r.rule).toBe('lidar');
      expect(r.meters).toBeCloseTo(18.9, 5);
    });

    it('lidar BEATS ms — a measurement outranks an ML estimate', () => {
      const r = resolveHeight({ building: 'yes' }, 400, CFG, 12.0, 18.9);
      expect(r.rule).toBe('lidar');
      expect(r.meters).toBeCloseTo(18.9, 5);
    });

    it('ms BEATS the fallback but loses to lidar', () => {
      expect(resolveHeight({ building: 'yes' }, 400, CFG, 12.0).rule).toBe(
        'ms'
      );
    });

    it('an explicit height tag still outranks lidar (cross-validated to ~0.1m)', () => {
      const r = resolveHeight({ height: '52' }, 400, CFG, undefined, 18.9);
      expect(r.rule).toBe('height');
      expect(r.meters).toBe(52);
    });

    it('a named override outranks every derived height', () => {
      const r = resolveHeight(
        { name: 'Republic Centre', 'building:levels': '5' },
        2000,
        CFG,
        12.0,
        18.9
      );
      expect(r.rule).toBe('override');
      expect(r.meters).toBeCloseTo(CLAMP, 5);
    });

    it('levels is still reached when lidar has no return for the footprint', () => {
      const r = resolveHeight({ 'building:levels': '5' }, 400, CFG, 12.0);
      expect(r.rule).toBe('levels');
      expect(r.meters).toBe(16);
    });

    it('a non-positive lidar height falls through rather than zeroing a building', () => {
      expect(
        resolveHeight({ 'building:levels': '5' }, 400, CFG, undefined, 0).rule
      ).toBe('levels');
      expect(
        resolveHeight({ 'building:levels': '5' }, 400, CFG, undefined, -3).rule
      ).toBe('levels');
    });

    it('full ladder: height > override > lidar > levels > ms > fallback', () => {
      const all = {
        name: 'Republic Centre',
        height: '52',
        'building:levels': '5',
        building: 'office',
      };
      const seen: string[] = [];
      // Peel the winning rule off one at a time; each step must reveal the next.
      seen.push(resolveHeight(all, 2000, CFG, 12.0, 18.9).rule);
      const { height: _h, ...noHeight } = all;
      seen.push(resolveHeight(noHeight, 2000, CFG, 12.0, 18.9).rule);
      const { name: _n, ...noName } = noHeight;
      seen.push(resolveHeight(noName, 2000, CFG, 12.0, 18.9).rule);
      seen.push(resolveHeight(noName, 2000, CFG, 12.0).rule);
      const { 'building:levels': _l, ...noLevels } = noName;
      seen.push(resolveHeight(noLevels, 2000, CFG, 12.0).rule);
      seen.push(resolveHeight(noLevels, 2000, CFG).rule);
      expect(seen).toEqual([
        'height',
        'override',
        'lidar',
        'levels',
        'ms',
        'fallback',
      ]);
    });
  });
});
