import { describe, it, expect } from 'vitest';
import { drapePixelSize, drapeUrl } from '../fetch-drape';

// Choo-Choo corridor box: 1.46km E-W x 5.77km N-S. The drape is a plate-carrée
// (SR 4326) request, so its pixel aspect MUST equal the DEGREE aspect (~0.307)
// or ArcGIS over-scans the latitude extent. E-W resolution is fixed at 2 m/px
// (729 px); height is derived from the degree aspect → 729 x 2378. The runtime
// maps world-Z→row linearly via groundHm (true metres), independent of pixel
// count, so this taller-in-pixels image still registers correctly.
describe('drape sizing (plate-carrée, degree-aspect for exact-bbox return)', () => {
  it('matches the DEGREE aspect (~0.307) so the returned extent is not expanded', () => {
    const { width, height } = drapePixelSize(2);
    const aspect = width / height;
    const degAspect = (-85.3 - -85.316) / (35.06 - 35.0078);
    expect(aspect).toBeCloseTo(degAspect, 3);
  });
  it('sizes 729 x 2378 at mpp=2 (E-W at 2 m/px, height from degree aspect)', () => {
    const { width, height } = drapePixelSize(2);
    expect(width).toBe(729);
    expect(height).toBe(2378);
  });
  it('requests NAIP exportImage with the exact box bbox at SR 4326', () => {
    const url = drapeUrl(2, 'naip');
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('exportImage');
    expect(url).toContain('bbox=-85.316,35.0078,-85.3,35.06'); // minx,miny,maxx,maxy
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=729,2378');
  });

  it('requested pixel aspect matches the bbox aspect IN THE REQUEST SR (no extent expansion)', () => {
    // REGISTRATION INVARIANT: ArcGIS exportImage returns the requested bbox
    // EXACTLY only when the requested pixel aspect equals the bbox aspect in the
    // request's spatial reference. If they differ, ArcGIS expands the extent to
    // preserve pixel squareness — verified live: requesting SR 4326 with a
    // metre-proportional 729x2886 returned lat 35.00223..35.06557 instead of
    // 35.0078..35.06 (~616 m over-scan each end), which shifts every N-S feature
    // and floats south-bank buildings out over the river.
    //
    // The drape is requested in `imageSR` units, so the pixel aspect must equal
    // the bbox aspect measured IN THOSE UNITS. Metre-proportional pixels only
    // stay consistent with a metric imageSR (3857), or the bbox must be sized in
    // the same unit as the pixels.
    const url = drapeUrl(2, 'naip');
    const bbox = /bbox=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/.exec(url)!;
    const [, xmin, ymin, xmax, ymax] = bbox.map(Number);
    const size = /size=(\d+),(\d+)/.exec(url)!;
    const [, width, height] = size.map(Number);
    const imageSR = /imageSR=(\d+)/.exec(url)![1];

    const pixelAspect = width / height;
    if (imageSR === '4326') {
      // degrees
      const bboxAspect = (xmax - xmin) / (ymax - ymin);
      expect(pixelAspect).toBeCloseTo(bboxAspect, 3);
    } else {
      // metric SR (e.g. 3857): the bbox must already be in metres and its aspect
      // must match; the projected metre extent aspect equals the ground aspect.
      const bboxAspect = (xmax - xmin) / (ymax - ymin);
      expect(pixelAspect).toBeCloseTo(bboxAspect, 3);
    }
  });
});
