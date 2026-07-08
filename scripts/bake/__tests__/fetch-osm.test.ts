import { describe, it, expect } from 'vitest';
import { buildOsmQL } from '../fetch-osm';

const BOX = { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 };

describe('buildOsmQL', () => {
  it('queries buildings (ways + relations) and highways with geometry, in the box', () => {
    const ql = buildOsmQL(BOX);
    expect(ql).toContain('[out:json]');
    expect(ql).toContain('way["building"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('relation["building"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('way["highway"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('out geom;'); // geometry inline so we don't resolve node refs
  });
  it('is box-parameterized — a different site queries its own bbox', () => {
    const ql = buildOsmQL({ swLat: 1, swLon: 2, neLat: 3, neLon: 4 });
    expect(ql).toContain('way["building"](1,2,3,4)');
  });
});
