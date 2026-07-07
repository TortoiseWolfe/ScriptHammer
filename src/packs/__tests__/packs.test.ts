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
  it('starts at the riverfront and ends at the Choo Choo, every stop captioned', () => {
    // North riverfront cluster first, then south down the spine to the Choo Choo.
    const names = RIVERFRONT_TOUR.map((w) => w.name);
    expect(names.slice(0, 4)).toEqual([
      "Ross's Landing",
      'Tennessee Aquarium',
      'Walnut Street Bridge',
      'Coolidge Park',
    ]);
    expect(names).toContain('Chattanooga Choo Choo');
    for (const w of RIVERFRONT_TOUR) expect(w.blurb.length).toBeGreaterThan(0);
  });

  it('traverses the whole corridor: has both north (z<0) and south (z>0) stops', () => {
    // #216 — the tour used to cluster entirely at the north end; it must now
    // reach the Choo Choo at the south (positive z).
    expect(RIVERFRONT_TOUR.some((w) => w.look[2] < -2000)).toBe(true); // north
    expect(RIVERFRONT_TOUR.some((w) => w.look[2] > 2000)).toBe(true); // south
  });
});
