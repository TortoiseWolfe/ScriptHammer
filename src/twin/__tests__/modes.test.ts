import { describe, it, expect } from 'vitest';
import { modesForSite } from '../TwinCanvas.client';

describe('modesForSite — every dock entry must DO something on the site', () => {
  it('flagship (tour + trolley): all five modes, Ride labeled as riding', () => {
    expect(modesForSite(true, true).map((m) => `${m.key}:${m.label}`)).toEqual([
      'tour:Tour',
      'orbit:Miniature',
      'follow:Ride',
      'walk:Walk',
      'ortho:Top-down',
    ]);
  });
  it('mini twin (no tour, no trolley): Ride is ABSENT — an unboarded follow mode chases an invisible avatar', () => {
    expect(modesForSite(false, false).map((m) => m.key)).toEqual([
      'orbit',
      'walk',
      'ortho',
    ]);
  });
  it('trolley without tour keeps Ride', () => {
    expect(modesForSite(false, true).map((m) => m.key)).toEqual([
      'orbit',
      'follow',
      'walk',
      'ortho',
    ]);
  });

  // #259 iter 7 — Walk and Top-down are `secondary` (rendered in the HUD's ⋯
  // overflow, not the primary bar). The array order/length are untouched so
  // the position-based digit-key shortcuts don't drift.
  it('marks exactly Walk and Top-down as secondary', () => {
    const secondary = modesForSite(true, true)
      .filter((m) => m.secondary)
      .map((m) => m.key);
    expect(secondary).toEqual(['walk', 'ortho']);
  });
  it('keeps the primary modes non-secondary', () => {
    const primary = modesForSite(true, true)
      .filter((m) => !m.secondary)
      .map((m) => m.key);
    expect(primary).toEqual(['tour', 'orbit', 'follow']);
  });
});
