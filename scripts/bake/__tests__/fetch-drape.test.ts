import { describe, it, expect } from 'vitest';
import {
  drapePixelSize,
  drapeUrl,
  sliceDrapeTiles,
  assertRenderMatchesTile,
} from '../fetch-drape';
import { createProjection } from '../enu';

const proj = createProjection({
  swLat: 35.0078,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
});

// Choo-Choo corridor box: 1.46km E-W x 5.79km N-S. The drape is a plate-carrée
// (SR 4326) request, so its pixel aspect MUST equal the DEGREE aspect (~0.307)
// or ArcGIS over-scans the latitude extent. E-W resolution is fixed at 2 m/px
// (730 px); height is derived from the degree aspect → 730 x 2382. The runtime
// maps world-Z→row linearly via groundHm (true metres), independent of pixel
// count, so this taller-in-pixels image still registers correctly.
// (Dims moved 729x2378 → 730x2382 when enu.ts switched from equator/spherical
// constants to WGS-84 arc lengths at the box latitude — #229.)
describe('drape sizing (plate-carrée, degree-aspect for exact-bbox return)', () => {
  it('matches the DEGREE aspect (~0.307) so the returned extent is not expanded', () => {
    const { width, height } = drapePixelSize(proj, 2);
    const aspect = width / height;
    const degAspect = (-85.3 - -85.316) / (35.06 - 35.0078);
    expect(aspect).toBeCloseTo(degAspect, 3);
  });
  it('sizes 730 x 2382 at mpp=2 (E-W at 2 m/px, height from degree aspect)', () => {
    const { width, height } = drapePixelSize(proj, 2);
    expect(width).toBe(730);
    expect(height).toBe(2382);
  });
  it('requests NAIP exportImage with the exact box bbox at SR 4326', () => {
    const url = drapeUrl(proj, 2, 'naip');
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('exportImage');
    expect(url).toContain('bbox=-85.316,35.0078,-85.3,35.06'); // minx,miny,maxx,maxy
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=730,2382');
  });
  it('routes the esri source to World_Imagery (the non-US fallback)', () => {
    const url = drapeUrl(proj, 2, 'esri');
    expect(url).toContain('server.arcgisonline.com');
    expect(url).toContain('World_Imagery');
  });
  it('routes the tnmap source to the TDOT ortho MapServer, geographic in AND out', () => {
    // imageSR=4326 makes the server reproject its Web-Mercator cache to
    // plate-carrée, so rows stay uniform-in-lat and the degree-aspect
    // registration discipline applies unchanged. MapServer /export honors SIZE
    // and adjusts the EXTENT on aspect mismatch (verified live) — the fetch
    // path validates the returned extent via f=json before downloading.
    const url = drapeUrl(proj, 2, 'tnmap');
    expect(url).toContain('tnmap.tn.gov');
    expect(url).toContain('MapServer/export');
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=730,2382');
  });

  it('requested pixel aspect matches the bbox aspect IN THE REQUEST SR (no extent expansion)', () => {
    // REGISTRATION INVARIANT: ArcGIS exportImage returns the requested bbox
    // EXACTLY only when the requested pixel aspect equals the bbox aspect in the
    // request's spatial reference. If they differ, ArcGIS expands the extent to
    // preserve pixel squareness — verified live: requesting SR 4326 with a
    // metre-proportional 729x2886 returned lat 35.00223..35.06557 instead of
    // 35.0078..35.06 (~616 m over-scan each end), which shifts every N-S feature
    // and floats south-bank buildings out over the water.
    //
    // The drape is requested in `imageSR` units, so the pixel aspect must equal
    // the bbox aspect measured IN THOSE UNITS. Metre-proportional pixels only
    // stay consistent with a metric imageSR (3857), or the bbox must be sized in
    // the same unit as the pixels.
    const url = drapeUrl(proj, 2, 'naip');
    const bbox = /bbox=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/.exec(url)!;
    const [, xmin, ymin, xmax, ymax] = bbox.map(Number);
    const size = /size=(\d+),(\d+)/.exec(url)!;
    const [, width, height] = size.map(Number);

    const pixelAspect = width / height;
    const bboxAspect = (xmax - xmin) / (ymax - ymin);
    expect(pixelAspect).toBeCloseTo(bboxAspect, 3);
  });
});

describe('assertRenderMatchesTile (the MapServer f=json extent guard)', () => {
  // MapServer /export honors SIZE unconditionally and silently ADJUSTS THE
  // EXTENT on aspect mismatch (verified live on tnmap: ±1.5 m lon widening
  // for a 0.2% aspect error) — the one failure mode a dims check cannot see.
  const tile = sliceDrapeTiles(proj, 4).tiles[0];
  const exact = {
    href: 'https://tnmap.tn.gov/arcgis/rest/directories/x/y.jpeg',
    width: tile.cols,
    height: tile.rows,
    extent: {
      xmin: tile.bbox[0],
      ymin: tile.bbox[1],
      xmax: tile.bbox[2],
      ymax: tile.bbox[3],
    },
  };
  it('passes an exact render and returns the href', () => {
    expect(assertRenderMatchesTile(tile, exact, 'tnmap')).toBe(exact.href);
  });
  it('tolerates sub-tolerance jitter (≤0.75 px per edge)', () => {
    const pxLon = (tile.bbox[2] - tile.bbox[0]) / tile.cols;
    const jittered = {
      ...exact,
      extent: { ...exact.extent, xmin: tile.bbox[0] - 0.5 * pxLon },
    };
    expect(assertRenderMatchesTile(tile, jittered, 'tnmap')).toBe(exact.href);
  });
  it('throws on the live-observed silent lon widening (aspect-mismatch adjustment)', () => {
    const pxLon = (tile.bbox[2] - tile.bbox[0]) / tile.cols;
    const widened = {
      ...exact,
      extent: {
        ...exact.extent,
        xmin: tile.bbox[0] - 3 * pxLon,
        xmax: tile.bbox[2] + 3 * pxLon,
      },
    };
    expect(() => assertRenderMatchesTile(tile, widened, 'tnmap')).toThrow(
      /adjusted the extent/
    );
  });
  it('throws on clamped dims and on a missing href/extent', () => {
    expect(() =>
      assertRenderMatchesTile(tile, { ...exact, width: tile.cols - 1 }, 'tnmap')
    ).toThrow(/rendered/);
    expect(() =>
      assertRenderMatchesTile(tile, { extent: exact.extent }, 'tnmap')
    ).toThrow(/missing href/);
  });
});
