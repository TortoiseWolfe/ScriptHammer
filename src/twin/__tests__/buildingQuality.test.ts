// #259 iter 7 — the extent-based quality flag mirrors the QC badge
// (scripts/warehouse/qc-sheet.mjs). A rating-based flag would be meaningless:
// every rated chatt model is exactly 5.0.

import { describe, it, expect } from 'vitest';
import {
  buildingQuality,
  EXTENT_WARN_M,
  EXTENT_RED_M,
} from '../buildingQuality';

describe('buildingQuality', () => {
  it('is fine with no dimensions', () => {
    expect(buildingQuality(undefined)).toEqual({ level: 0, spanM: null });
  });

  it('is fine for a building-sized footprint', () => {
    expect(buildingQuality([100, 40, 140]).level).toBe(0);
  });

  it('flags level 1 above the warn threshold', () => {
    expect(buildingQuality([151, 40, 10]).level).toBe(1);
  });

  it('uses the LARGER of x/z (max span, not just x)', () => {
    expect(buildingQuality([10, 40, 151]).level).toBe(1);
    expect(buildingQuality([10, 40, 151]).spanM).toBe(151);
  });

  it('flags level 2 above the red threshold', () => {
    expect(buildingQuality([301, 40, 10]).level).toBe(2);
  });

  it('is strictly greater-than at the boundaries', () => {
    expect(buildingQuality([150, 40, 150]).level).toBe(0); // exactly warn → fine
    expect(buildingQuality([300, 40, 300]).level).toBe(1); // exactly red → still amber
  });

  it('pins the thresholds to the QC badge values', () => {
    expect(EXTENT_WARN_M).toBe(150);
    expect(EXTENT_RED_M).toBe(300);
  });
});
