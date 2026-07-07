import { describe, it, expect } from 'vitest';
import { buildOsmQL } from '../fetch-osm';

describe('buildOsmQL', () => {
  it('queries buildings (ways + relations) and highways with geometry, in the box', () => {
    const ql = buildOsmQL();
    expect(ql).toContain('[out:json]');
    expect(ql).toContain('way["building"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('relation["building"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('way["highway"](35.0078,-85.316,35.06,-85.3)');
    expect(ql).toContain('out geom;'); // geometry inline so we don't resolve node refs
  });
});
