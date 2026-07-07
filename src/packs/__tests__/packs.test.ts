import { describe, it, expect } from 'vitest';
import { PALETTES, applyProfile } from '../themes';
import { RIVERFRONT_TOUR } from '../tours';

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

describe('riverfront tour', () => {
  it('visits the four riverfront landmarks with captions', () => {
    expect(RIVERFRONT_TOUR).toHaveLength(4);
    expect(RIVERFRONT_TOUR.map((w) => w.name)).toEqual([
      "Ross's Landing",
      'Tennessee Aquarium',
      'Walnut Street Bridge',
      'Coolidge Park',
    ]);
    for (const w of RIVERFRONT_TOUR) expect(w.blurb.length).toBeGreaterThan(0);
  });
});
