import { describe, it, expect } from 'vitest';
import { planPhotoreal, KEY_ENV } from '../photoreal';

describe('planPhotoreal', () => {
  it('is off unless asked for — the baked twin stays the default', () => {
    expect(planPhotoreal('', 'k')).toEqual({ kind: 'off' });
    expect(planPhotoreal('?diorama', 'k')).toEqual({ kind: 'off' });
  });

  it('turns on when asked and a key exists', () => {
    expect(planPhotoreal('?photoreal', 'abc')).toEqual({ kind: 'on', key: 'abc' });
    expect(planPhotoreal('?photoreal&notour', 'abc')).toEqual({ kind: 'on', key: 'abc' });
  });

  it('distinguishes ASKED-AND-UNAVAILABLE from NOT-ASKED', () => {
    // Collapsing these to a boolean is how a missing key becomes an
    // unexplained blank globe with nothing to read in the HUD.
    expect(planPhotoreal('?photoreal', undefined)).toEqual({ kind: 'no-key' });
    expect(planPhotoreal('?photoreal', '')).toEqual({ kind: 'no-key' });
    expect(planPhotoreal('?photoreal', '   ')).toEqual({ kind: 'no-key' });
    expect(planPhotoreal('', undefined)).toEqual({ kind: 'off' });
  });

  it('honours ?photoreal=off even where a key is configured', () => {
    for (const v of ['off', '0', 'false']) {
      expect(planPhotoreal(`?photoreal=${v}`, 'abc')).toEqual({ kind: 'off' });
    }
  });

  it('names the env var in one place, so a typo cannot read as no-key', () => {
    expect(KEY_ENV).toBe('NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY');
  });
});
