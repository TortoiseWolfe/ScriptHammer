import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadManifest, loadJson, type Manifest } from '../manifest';

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

describe('loadManifest', () => {
  it('routes through getAssetUrl: fetches /chatt/manifest.json when basePath is empty', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    const manifest: Manifest = {
      box: { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 },
      groundWm: 1458.4,
      groundHm: 5772,
      cosLat: 0.8188125348994125,
      drape: { path: 'chatt/drape.jpg', width: 729, height: 2886, mpp: 2 },
      provenance: '© OpenStreetMap · USGS 3DEP · USGS NAIP',
      fetchedAt: '2026-07-07T03:31:27.325Z',
      ruleHistogram: { a: 1 },
    };
    const fetchMock = mockFetchOnce(manifest);

    const result = await loadManifest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('/chatt/manifest.json');
    expect(result).toEqual(manifest);
  });

  it('prefixes the basePath when NEXT_PUBLIC_BASE_PATH is set (GH Pages project site)', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/chattanooga-mini';
    const fetchMock = mockFetchOnce({});

    await loadJson('manifest.json');

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toBe('/chattanooga-mini/chatt/manifest.json');
  });

  it('throws a descriptive error when the response is not ok', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    await expect(loadJson('missing.json')).rejects.toThrow(/404/);
  });
});
