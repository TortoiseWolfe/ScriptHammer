import { describe, it, expect } from 'vitest';
import { PALETTES, applyProfile } from '../themes';

// (The riverfront tour moved from src/packs/tours.ts into data — sites/chatt.json,
// baked into the manifest's site block. Its content is locked by
// scripts/bake/__tests__/golden-chatt.test.ts.)
describe('packs', () => {
  it('has two palette profiles that differ in saturation, fov, blur', () => {
    expect(PALETTES.trueToLife.gradeSat).toBeLessThan(PALETTES.toy.gradeSat);
    expect(PALETTES.trueToLife.maxBlur).toBeLessThan(PALETTES.toy.maxBlur);
    expect(PALETTES.trueToLife.fov).not.toBe(PALETTES.toy.fov);
  });
  it('applyProfile scales the day/night base (single owner)', () => {
    const out = applyProfile(
      { saturation: 1.3, contrast: 1.1, vignette: 0.4 },
      PALETTES.toy
    );
    expect(out.saturation).toBeGreaterThan(1.3); // toy pushes saturation up
  });
});
