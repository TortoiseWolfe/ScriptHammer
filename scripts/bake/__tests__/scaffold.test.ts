import { describe, expect, it } from 'vitest';
import { buildSiteConfig } from '../scaffold';

const BASE = {
  slug: 'sample-site',
  name: 'Sample Site',
  centerLat: 35.0563,
  centerLon: -85.3111,
  widthM: 1600,
  heightM: 1600,
};

describe('buildSiteConfig terrain dataset', () => {
  it('uses the US terrain dataset for US geocodes', () => {
    expect(
      buildSiteConfig({ ...BASE, countryCode: 'us' }).terrain?.dataset
    ).toBe('ned10m');
  });

  it('selects global SRTM terrain for non-US geocodes', () => {
    expect(
      buildSiteConfig({ ...BASE, countryCode: 'fr' }).terrain?.dataset
    ).toBe('srtm30m');
  });

  it('keeps the existing US default when no country code is supplied', () => {
    expect(buildSiteConfig(BASE).terrain?.dataset).toBe('ned10m');
  });
});
