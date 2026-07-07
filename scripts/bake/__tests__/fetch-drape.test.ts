import { describe, it, expect } from 'vitest';
import { drapePixelSize, drapeUrl } from '../fetch-drape';

describe('drape sizing (meter-proportional, cos-lat corrected)', () => {
  it('matches the TRUE ground aspect (~0.507), not the degree aspect (0.615)', () => {
    const { width, height } = drapePixelSize(2);
    const aspect = width / height;
    expect(aspect).toBeCloseTo(0.507, 2); // ground metres, NOT 0.615 degrees
  });
  it('sizes ~729 x 1437 at mpp=2', () => {
    const { width, height } = drapePixelSize(2);
    expect(width).toBeCloseTo(729, -1);
    expect(height).toBeCloseTo(1437, -1);
  });
  it('requests NAIP exportImage with the exact box bbox at SR 4326', () => {
    const url = drapeUrl(2, 'naip');
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('exportImage');
    expect(url).toContain('bbox=-85.316,35.034,-85.3,35.06'); // minx,miny,maxx,maxy
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=729,1437');
  });
});
