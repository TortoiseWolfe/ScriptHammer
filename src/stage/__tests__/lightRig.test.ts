import { describe, it, expect } from 'vitest';
import { computeDay } from '../lightRig';

describe('computeDay', () => {
  it('is darker at midnight than at noon', () => {
    const night = computeDay(0.0);
    const noon = computeDay(0.5);
    expect(noon.sunIntensity).toBeGreaterThan(night.sunIntensity);
    expect(noon.ambient).toBeGreaterThan(night.ambient);
  });
  it('returns base grade + bloom that day/night animates', () => {
    const d = computeDay(0.5);
    expect(d.gradeBase.saturation).toBeGreaterThan(1);
    expect(d.bloom.strength).toBeGreaterThan(0);
  });
});
