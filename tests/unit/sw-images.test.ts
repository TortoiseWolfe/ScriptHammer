/**
 * Unit tests for the service worker's IMAGE handler (#438).
 *
 * ## Why these exist
 * Returning visitors lost blog images on every deploy. Four below-the-fold
 * thumbnails rendered as broken-image icons with their alt text showing, while
 * the already-painted cards above them were fine.
 *
 * Three things combined. `install` calls `skipWaiting()`, `activate` deleted
 * every cache whose name did not match the current `CACHE_VERSION` — which is
 * stamped with the commit SHA, so a code deploy destroyed the IMAGE cache —
 * and `activate` then calls `clients.claim()` on the page that is already open.
 * The page's not-yet-requested lazy images therefore faulted into an empty
 * cache all at once, and the image handler was the ONLY content handler with
 * no failure path, so a rejected fetch became a permanent broken image with no
 * retry and nothing cached.
 *
 * ## The trap these tests are shaped around
 * A fresh browser CANNOT reproduce this. With no previous worker there is no
 * takeover, no deletion, and no empty-cache window — a clean-profile check of
 * the live site reported 14 of 14 images loaded while real visitors saw them
 * break. Any test that exercises one version against a healthy network passes
 * straight through the bug.
 *
 * So these assert the two properties that actually failed: the handler must not
 * REJECT when the network does, and the image cache must not be keyed to the
 * build.
 *
 * Runs the REAL `public/sw.js` through the same `new Function` harness as
 * sw-navigate.test.ts — a reimplementation would drift and prove nothing.
 *
 * @module tests/unit/sw-images.test
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCOPE = 'https://scripthammer.com/';
const IMAGE = `${SCOPE}blog-images/auto-config/featured.svg`;

const SW_SOURCE = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');

type FetchHandler = (event: {
  request: Request;
  respondWith: (r: Promise<Response> | Response) => void;
}) => void;

interface Options {
  /** URLs present in the cache when the handler first looks. */
  cached?: string[];
  /** Whether the network `fetch` resolves. The failure path needs it to reject. */
  online: boolean;
  /**
   * URLs that appear in the cache only AFTER the network has been attempted —
   * models a sibling request populating the cache concurrently, which is
   * exactly what happens when a claimed page faults in many lazy images at once.
   */
  appearsAfterFetch?: string[];
}

/** Execute the real worker against a fake scope; return its `fetch` listener. */
function loadServiceWorker({
  cached = [],
  online,
  appearsAfterFetch = [],
}: Options) {
  const handlers: Record<string, FetchHandler> = {};
  const present = new Set(cached);

  const caches = {
    match: async (req: Request | string): Promise<Response | undefined> => {
      const url = typeof req === 'string' ? req : req.url;
      return present.has(url)
        ? new Response(`cached:${url}`, { status: 200 })
        : undefined;
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
    // The concurrent population lands as the network attempt is made.
    appearsAfterFetch.forEach((u) => present.add(u));
    if (!online) throw new TypeError('Failed to fetch');
    return new Response('network', { status: 200 });
  };

  // `new Function` is deliberate: it runs the REAL public/sw.js, a first-party
  // file read from the repo. No interpolation, no external input.
  const run = new Function(
    'self',
    'caches',
    'clients',
    'fetch',
    'Response',
    'Headers',
    'URL',
    SW_SOURCE
  );
  run(scope, caches, scope.clients, networkFetch, Response, Headers, URL);

  return handlers.fetch;
}

/** Drive one image request through the worker; return the settled outcome. */
async function requestImage(
  url: string,
  opts: Options
): Promise<{ rejected: boolean; body: string }> {
  const handler = loadServiceWorker(opts);
  const request = new Request(url);
  // `destination` is browser-set and not settable via the constructor, so it is
  // defined directly — what a real image request looks like inside a handler.
  Object.defineProperty(request, 'destination', { value: 'image' });

  let result: Promise<Response> | Response | undefined;
  handler({ request, respondWith: (r) => (result = r) });

  try {
    const response = await result;
    return { rejected: false, body: response ? await response.text() : '' };
  } catch {
    // A rejected promise handed to respondWith is rendered by the browser as a
    // network error — the broken-image icon users actually saw.
    return { rejected: true, body: '' };
  }
}

describe('service worker image handler (#438)', () => {
  it('does not reject when the network fails and the image is not cached', async () => {
    // THE REGRESSION GUARD. Before the fix this chain had no `.catch`, so a
    // rejected fetch rejected the promise given to respondWith and the browser
    // painted a broken image — permanently, since only 200s are ever cached.
    const { rejected } = await requestImage(IMAGE, {
      cached: [],
      online: false,
    });
    expect(rejected).toBe(false);
  });

  it('falls back to a concurrently-cached copy when the network fails', async () => {
    // The takeover case: the first lookup misses, a sibling request populates
    // the cache, then this request's fetch fails. The re-check in the catch is
    // what turns that into a rendered image instead of a broken one.
    const { rejected, body } = await requestImage(IMAGE, {
      cached: [],
      online: false,
      appearsAfterFetch: [IMAGE],
    });
    expect(rejected).toBe(false);
    expect(body).toBe(`cached:${IMAGE}`);
  });

  it('still serves a cached image without touching the network', async () => {
    const { rejected, body } = await requestImage(IMAGE, {
      cached: [IMAGE],
      online: false,
    });
    expect(rejected).toBe(false);
    expect(body).toBe(`cached:${IMAGE}`);
  });

  it('serves from the network on a cache miss when online', async () => {
    const { rejected, body } = await requestImage(IMAGE, {
      cached: [],
      online: true,
    });
    expect(rejected).toBe(false);
    expect(body).toBe('network');
  });
});

describe('image cache naming (#438)', () => {
  it('is not derived from CACHE_VERSION, which is stamped per build', () => {
    // The root cause. `IMAGE_CACHE = `${CACHE_VERSION}-images`` meant every
    // deploy renamed it and `activate` deleted the previous one, discarding
    // every cached image over a code change unrelated to images.
    const decl = /const IMAGE_CACHE = ([^;]+);/.exec(SW_SOURCE);
    expect(
      decl,
      'IMAGE_CACHE declaration not found — update this pattern'
    ).not.toBeNull();
    expect(decl![1]).not.toContain('CACHE_VERSION');
  });

  it('keeps the scripthammer- prefix so activate still purges it', () => {
    // activate's cleanup filters on this prefix. A name without it would leak
    // storage instead of being cleaned up — trading one bug for another.
    const decl = /const IMAGE_CACHE = '([^']+)';/.exec(SW_SOURCE);
    expect(
      decl,
      'IMAGE_CACHE is no longer a plain string literal'
    ).not.toBeNull();
    expect(decl![1].startsWith('scripthammer-')).toBe(true);
  });

  it('is preserved by the activate cleanup rather than deleted', () => {
    // Guards the other half: the keep-list must still name IMAGE_CACHE, or the
    // new stable cache would be purged on every activation.
    expect(SW_SOURCE).toMatch(/cacheName !== IMAGE_CACHE/);
  });
});
