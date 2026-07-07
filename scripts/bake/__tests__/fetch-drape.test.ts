import { describe, it, expect } from 'vitest';
import { drapePixelSize, drapeUrl } from '../fetch-drape';

// Choo-Choo corridor box: 1.46km E-W x 5.77km N-S. Meter-proportional so the
// plate-carrée image registers on the cos(lat) ground: 729 x 2886 @ 2 m/px,
// aspect ~0.253 (NOT the degree aspect ~0.28, and definitely not a stretched square).
describe('drape sizing (meter-proportional, cos-lat corrected)', () => {
  it('matches the TRUE ground metre aspect (~0.253), not the degree aspect', () => {
    const { width, height } = drapePixelSize(2);
    const aspect = width / height;
    expect(aspect).toBeCloseTo(0.253, 2); // ground metres (cos-lat corrected)
  });
  it('sizes ~729 x 2886 at mpp=2', () => {
    const { width, height } = drapePixelSize(2);
    expect(width).toBeCloseTo(729, -1);
    expect(height).toBeCloseTo(2886, -1);
  });
  it('requests NAIP exportImage with the exact box bbox at SR 4326', () => {
    const url = drapeUrl(2, 'naip');
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('exportImage');
    expect(url).toContain('bbox=-85.316,35.0078,-85.3,35.06'); // minx,miny,maxx,maxy
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=729,2886');
  });
});
