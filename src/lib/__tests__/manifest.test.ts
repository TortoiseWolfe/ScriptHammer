import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  loadManifest,
  loadSiteJson,
  siteAssetUrl,
  validateManifest,
  type Manifest,
} from '../manifest';

const origBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = origBasePath;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetchOnce(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const VALID: Manifest = {
  box: { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 },
  groundWm: 1460,
  groundHm: 5791.1,
  cosLat: 0.8197099093234276,
  drape: { path: 'drape.jpg', width: 730, height: 2382, mpp: 2 },
  provenance: '© OpenStreetMap · USGS 3DEP · USGS NAIP',
  fetchedAt: '2026-07-08T03:31:27.325Z',
  ruleHistogram: { a: 1 },
  site: {
    slug: 'chatt',
    name: 'Chattanooga Mini',
    subtitle: 'a living tilt-shift diorama',
    palette: 'toy',
    day: 0.4,
    tour: [
      {
        pos: [-40, 240, -1980],
        look: [-220, 20, -2340],
        dwell: 5,
        name: "Ross's Landing",
        blurb: 'The 1815 riverfront landing where Chattanooga began.',
      },
    ],
    trolley: [-180, -2180, -220, -2320, -180, -2460],
    framing: { homeFocus: [-100, 0, -2000] },
  },
};

describe('loadManifest', () => {
  it('routes through getAssetUrl: fetches /twins/chatt/manifest.json when basePath is empty', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    const fetchMock = mockFetchOnce(VALID);

    const result = await loadManifest('chatt');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('/twins/chatt/manifest.json');
    expect(result).toEqual(VALID);
  });

  it('prefixes the basePath when NEXT_PUBLIC_BASE_PATH is set (GH Pages project site)', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/chattanooga-mini';
    const fetchMock = mockFetchOnce({});

    await loadSiteJson('chatt', 'manifest.json');

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toBe('/chattanooga-mini/twins/chatt/manifest.json');
  });

  it('builds per-site asset URLs for any slug', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    expect(siteAssetUrl('main-st', 'drape.jpg')).toBe(
      '/twins/main-st/drape.jpg'
    );
  });

  it('throws a descriptive error when the response is not ok', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    await expect(loadSiteJson('chatt', 'missing.json')).rejects.toThrow(/404/);
  });
});

describe('validateManifest (the bake↔runtime contract)', () => {
  const clone = () => JSON.parse(JSON.stringify(VALID)) as Manifest;

  it('passes a valid manifest through unchanged', () => {
    expect(validateManifest(VALID, 'chatt')).toEqual(VALID);
  });
  it('throws when the site block is missing (pre-#232 manifest)', () => {
    const m = clone() as Partial<Manifest>;
    delete m.site;
    expect(() => validateManifest(m, 'chatt')).toThrow(/site block missing/);
  });
  it('throws on a slug mismatch (artifacts copied to the wrong dir)', () => {
    expect(() => validateManifest(clone(), 'main-st')).toThrow(
      /does not match/
    );
  });
  it('throws when the HUD title is missing', () => {
    const m = clone();
    m.site.name = '';
    expect(() => validateManifest(m, 'chatt')).toThrow(/site\.name/);
  });
  it('throws on a malformed tour waypoint', () => {
    const m = clone();
    // @ts-expect-error deliberately malformed
    delete m.site.tour![0].blurb;
    expect(() => validateManifest(m, 'chatt')).toThrow(/tour\[0\]/);
  });
  it('throws on an odd-length trolley', () => {
    const m = clone();
    m.site.trolley = [1, 2, 3];
    expect(() => validateManifest(m, 'chatt')).toThrow(/trolley/);
  });
  it('throws on non-finite ground extents', () => {
    const m = clone();
    m.groundWm = NaN;
    expect(() => validateManifest(m, 'chatt')).toThrow(/groundWm/);
  });
  it('accepts a tour-less, trolley-less site (optional paths)', () => {
    const m = clone();
    delete m.site.tour;
    delete m.site.trolley;
    delete m.site.subtitle;
    expect(() => validateManifest(m, 'chatt')).not.toThrow();
  });
  it('throws on a non-finite tour coordinate', () => {
    const m = clone();
    // @ts-expect-error deliberately malformed
    m.site.tour![0].pos = [-40, 'high', -1980];
    expect(() => validateManifest(m, 'chatt')).toThrow(/tour\[0\]/);
  });
  it('throws on an unknown palette', () => {
    const m = clone();
    // @ts-expect-error deliberately malformed
    m.site.palette = 'neon';
    expect(() => validateManifest(m, 'chatt')).toThrow(/palette/);
  });
  it('throws on a non-finite framing field or homeFocus', () => {
    const m = clone();
    // @ts-expect-error deliberately malformed
    m.site.framing = { homeRadius: 'far' };
    expect(() => validateManifest(m, 'chatt')).toThrow(/homeRadius/);
    const m2 = clone();
    // @ts-expect-error deliberately malformed
    m2.site.framing = { homeFocus: [0, null, 0] };
    expect(() => validateManifest(m2, 'chatt')).toThrow(/homeFocus/);
  });
  it('throws on a non-boolean water flag; accepts booleans', () => {
    const m = clone();
    // @ts-expect-error deliberately malformed
    m.site.water = 'yes';
    expect(() => validateManifest(m, 'chatt')).toThrow(/water/);
    const m2 = clone();
    m2.site.water = true;
    expect(() => validateManifest(m2, 'chatt')).not.toThrow();
  });
});
