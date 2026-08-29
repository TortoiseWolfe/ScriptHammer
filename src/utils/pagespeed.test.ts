/**
 * #987: the key was a mandatory deploy secret nothing consumed. These tests are the
 * evidence that something consumes it now, and — more usefully — that every way the
 * call can go wrong renders as a state rather than as a broken page.
 *
 * The states matter more than the happy path. /status is where someone looks when they
 * already suspect something is wrong; a panel that throws, or that says "not
 * configured" when the real answer is "you are over the anonymous quota", sends them
 * to the wrong place.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPageSpeed,
  pageSpeedApiKey,
  pageSpeedRequestUrl,
} from './pagespeed';

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_PAGESPEED_API_KEY;

function psiBody(over: Record<string, unknown> = {}) {
  return {
    id: 'https://example.com/',
    lighthouseResult: {
      categories: {
        performance: { score: 0.97 },
        accessibility: { score: 1 },
        'best-practices': { score: 0.75 },
        seo: { score: 0.9 },
      },
    },
    ...over,
  };
}

function mockFetch(res: Partial<Response> & { json?: () => unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => psiBody(),
    ...res,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined)
    delete process.env.NEXT_PUBLIC_PAGESPEED_API_KEY;
  else process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = ORIGINAL_KEY;
});

describe('pageSpeedApiKey', () => {
  it('treats an unset repository secret (empty string) as no key', () => {
    // An unset GitHub secret arrives as '' rather than as absent, which is the
    // distinction the old deploy gate got right and nothing else did.
    process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = '';
    expect(pageSpeedApiKey()).toBeNull();
    process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = '   ';
    expect(pageSpeedApiKey()).toBeNull();
  });

  it('returns the trimmed key when one is set', () => {
    process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = '  abc  ';
    expect(pageSpeedApiKey()).toBe('abc');
  });
});

describe('pageSpeedRequestUrl', () => {
  it('sends each category as its own parameter', () => {
    // A comma-joined `category` is read as one unknown category and 400s. This is the
    // assertion that would have caught that, and it cannot pass on a joined value.
    const url = new URL(
      pageSpeedRequestUrl('https://example.com/', 'mobile', null)
    );
    expect(url.searchParams.getAll('category')).toEqual([
      'performance',
      'accessibility',
      'best-practices',
      'seo',
    ]);
  });

  it('omits the key entirely when there is none, rather than sending an empty one', () => {
    const url = new URL(
      pageSpeedRequestUrl('https://example.com/', 'mobile', null)
    );
    expect(url.searchParams.has('key')).toBe(false);
    const keyed = new URL(
      pageSpeedRequestUrl('https://example.com/', 'desktop', 'k')
    );
    expect(keyed.searchParams.get('key')).toBe('k');
    expect(keyed.searchParams.get('strategy')).toBe('desktop');
  });
});

describe('fetchPageSpeed', () => {
  it('normalises Google 0–1 scores to the 0–100 the rest of the UI uses', async () => {
    mockFetch({});
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.lab).toEqual({
      performance: 97,
      accessibility: 100,
      bestPractices: 75,
      seo: 90,
    });
  });

  it('reports no field data when CrUX has too little traffic for the URL', async () => {
    // The common case for a new fork, and for this site. It must be a null, not a
    // zero — rendering 0ms LCP because nobody has visited would be a lie.
    mockFetch({});
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state === 'ok' && result.field).toBeNull();
  });

  it('reads CrUX field metrics when they are present', async () => {
    mockFetch({
      json: async () =>
        psiBody({
          loadingExperience: {
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: {
                percentile: 2100,
                category: 'AVERAGE',
              },
              CUMULATIVE_LAYOUT_SHIFT_SCORE: {
                percentile: 5,
                category: 'FAST',
              },
              MALFORMED: { category: 'FAST' },
            },
          },
        }),
    });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.field?.map((m) => m.id)).toEqual([
      'LARGEST_CONTENTFUL_PAINT_MS',
      'CUMULATIVE_LAYOUT_SHIFT_SCORE',
    ]);
    expect(result.field?.[0].percentile).toBe(2100);
  });

  it('treats an empty metrics object as no field data', async () => {
    mockFetch({
      json: async () => psiBody({ loadingExperience: { metrics: {} } }),
    });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state === 'ok' && result.field).toBeNull();
  });

  it('reports 429 as rate-limited, and says whether a key was sent', async () => {
    mockFetch({ ok: false, status: 429 });
    const keyed = await fetchPageSpeed('https://example.com/');
    expect(keyed).toEqual({ state: 'rate-limited', keyless: false });

    process.env.NEXT_PUBLIC_PAGESPEED_API_KEY = '';
    const keyless = await fetchPageSpeed('https://example.com/');
    expect(keyless).toEqual({ state: 'rate-limited', keyless: true });
  });

  it('reports 403 as rate-limited too, because the fix is a key and not permissions', async () => {
    mockFetch({ ok: false, status: 403 });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state).toBe('rate-limited');
  });

  it('never throws on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await fetchPageSpeed('https://example.com/');
    expect(result).toEqual({ state: 'error', message: 'offline' });
  });

  it('never throws on a non-JSON body', async () => {
    mockFetch({
      json: async () => {
        throw new SyntaxError('unexpected token');
      },
    });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state).toBe('error');
  });

  it('surfaces an unexpected status rather than pretending it succeeded', async () => {
    mockFetch({ ok: false, status: 500 });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result).toEqual({
      state: 'error',
      message: 'PageSpeed API returned 500',
    });
  });

  it('tolerates a response with no lighthouseResult at all', async () => {
    mockFetch({ json: async () => ({ id: 'https://example.com/' }) });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.lab.performance).toBeNull();
  });
});

describe('CrUX origin fallback', () => {
  it('falls back to origin-level field data when the URL has none', async () => {
    // The common case by a wide margin: one page rarely has enough traffic to be
    // reported, while the origin often does. Taking only the URL-level field is why
    // this panel would have looked permanently empty on every site but the largest.
    mockFetch({
      json: async () =>
        psiBody({
          loadingExperience: { metrics: {} },
          originLoadingExperience: {
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: {
                percentile: 1800,
                category: 'FAST',
              },
            },
          },
        }),
    });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state === 'ok' && result.field?.[0].percentile).toBe(1800);
  });

  it('prefers URL-level data when both are present', async () => {
    mockFetch({
      json: async () =>
        psiBody({
          loadingExperience: {
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: {
                percentile: 999,
                category: 'FAST',
              },
            },
          },
          originLoadingExperience: {
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: {
                percentile: 1800,
                category: 'SLOW',
              },
            },
          },
        }),
    });
    const result = await fetchPageSpeed('https://example.com/');
    expect(result.state === 'ok' && result.field?.[0].percentile).toBe(999);
  });
});
