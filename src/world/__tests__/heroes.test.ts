import { describe, it, expect } from 'vitest';
import { HERO_KEYS } from '../Heroes';

describe('hero swap slots', () => {
  it('defines all 8 hero-swap keys', () => {
    expect(new Set(HERO_KEYS)).toEqual(
      new Set([
        'aquarium',
        'walnut_st_bridge',
        'tivoli',
        'dome_building',
        'courthouse',
        'hunter_museum',
        'choo_choo',
        'republic_centre',
      ])
    );
  });
});
