/**
 * Unit tests for the service worker's navigation fallback (#317).
 *
 * ## Why these exist
 * A transient network blip made EVERY non-home route show the PWA "You're
 * Offline" page while the homepage kept working. The cause was not the blip —
 * that only opens the fallback path — but the fallback itself: STATIC_ASSETS
 * precaches `'./blog/'` (with a trailing slash, as the static export names it)
 * while users navigate to `/blog` (without one). A cache lookup is exact, so it
 * missed and served offline.html.
 *
 * `public/sw.js` had NO tests at all, which is how a cache-key bug survived in
 * the one file that is hardest to debug in production: a service worker is
 * sticky once installed, so a stale worker makes a correct fix look broken.
 *
 * ## How this runs the REAL worker
 * The file is loaded and executed against a mocked service-worker global scope,
 * the same way the bug was originally diagnosed. Nothing is reimplemented here
 * — a copy of the logic would drift and prove nothing.
 *
 * @module tests/unit/sw-navigate.test
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCOPE = 'https://scripthammer.com/';

type FetchHandler = (event: {
  request: Request;
  respondWith: (r: Promise<Response> | Response) => void;
}) => void;

/**
 * Execute the real `public/sw.js` against a fake global scope and return its
 * captured `fetch` listener.
 *
 * @param cached - URLs present in the cache, exactly as stored.
 * @param online - Whether the network `fetch` resolves or rejects. The
 * fallback path is only reachable when it rejects.
 */
function loadServiceWorker(cached: string[], online: boolean) {
  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');
  const handlers: Record<string, FetchHandler> = {};

  const cacheHas = (url: string) => cached.includes(url);

  const caches = {
    // Mirrors CacheStorage.match: exact URL match, with ignoreSearch stripping
    // the query string from BOTH sides before comparing.
    match: async (
      req: Request | string,
      opts?: { ignoreSearch?: boolean }
    ): Promise<Response | undefined> => {
      const url = typeof req === 'string' ? req : req.url;
      if (cacheHas(url)) return new Response(`cached:${url}`, { status: 200 });
      if (opts?.ignoreSearch) {
        const bare = url.split('?')[0];
        const hit = cached.find((c) => c.split('?')[0] === bare);
        if (hit) return new Response(`cached:${hit}`, { status: 200 });
      }
      return undefined;
    },
    open: async () => ({ put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
  };

  const scope = {
    addEventListener: (type: string, fn: FetchHandler) => {
      handlers[type] = fn;
    },
    registration: { scope: SCOPE },
    skipWaiting: () => {},
    clients: { claim: () => {}, matchAll: async () => [] },
  };

  const networkFetch = async () => {
    if (!online) throw new TypeError('Failed to fetch');
    return new Response('network', { status: 200 });
  };

  // `new Function` is deliberate and the point of this harness: it executes the
  // REAL public/sw.js rather than a reimplementation that could drift from it.
  // The body is a first-party file read from the repo — no interpolation, no
  // external input.
  const run = new Function(
    'self',
    'caches',
    'clients',
    'fetch',
    'Response',
    'Headers',
    'URL',
    source
  );
  run(scope, caches, scope.clients, networkFetch, Response, Headers, URL);

  return handlers.fetch;
}

/** Drive one navigation through the worker and return what it responded with. */
async function navigate(
  url: string,
  { cached, online }: { cached: string[]; online: boolean }
): Promise<string> {
  const handler = loadServiceWorker(cached, online);
  // `mode: 'navigate'` cannot be set through the Request constructor — the spec
  // reserves it for the browser's own navigations — so both discriminators the
  // worker reads are defined directly, which is what a real navigation looks
  // like from inside a fetch handler.
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  Object.defineProperty(request, 'destination', { value: 'document' });

  let result: Promise<Response> | Response | undefined;
  handler({ request, respondWith: (r) => (result = r) });
  const response = await result;
  return response ? await response.text() : '<no response>';
}

describe('service worker navigation fallback (#317)', () => {
  const BLOG = `${SCOPE}blog/`;
  const OFFLINE = `${SCOPE}offline.html`;

  it('serves the cached page when the URL lacks the precached trailing slash', async () => {
    // THE REGRESSION GUARD. Cache holds '/blog/', user navigates to '/blog'.
    // Before the fix this fell through to offline.html.
    const body = await navigate(`${SCOPE}blog`, {
      cached: [BLOG, OFFLINE],
      online: false,
    });
    expect(body).toBe(`cached:${BLOG}`);
  });

  it('serves the cached page when the URL matches exactly', async () => {
    const body = await navigate(BLOG, {
      cached: [BLOG, OFFLINE],
      online: false,
    });
    expect(body).toBe(`cached:${BLOG}`);
  });

  it('still serves offline.html for a genuinely uncached route', async () => {
    // The case that keeps this suite honest. A "fix" that returns any cached
    // page would satisfy the tests above while destroying offline behaviour —
    // offline.html exists precisely for routes the user has never visited.
    const body = await navigate(`${SCOPE}never-visited`, {
      cached: [BLOG, OFFLINE],
      online: false,
    });
    expect(body).toBe(`cached:${OFFLINE}`);
  });

  it('does not touch the fallback while online', async () => {
    const body = await navigate(`${SCOPE}blog`, {
      cached: [BLOG, OFFLINE],
      online: true,
    });
    expect(body).toBe('network');
  });

  it('ignores a query string before giving up', async () => {
    // A cached page beats the offline screen when only tracking params differ.
    const body = await navigate(`${SCOPE}blog/?utm_source=x`, {
      cached: [BLOG, OFFLINE],
      online: false,
    });
    expect(body).toBe(`cached:${BLOG}`);
  });

  it('does not strip the root path to an empty string', async () => {
    // Toggling '/' would yield '', which must never be looked up.
    const body = await navigate(SCOPE, {
      cached: [SCOPE, OFFLINE],
      online: false,
    });
    expect(body).toBe(`cached:${SCOPE}`);
  });
});
