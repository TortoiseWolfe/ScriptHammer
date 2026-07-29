/**
 * The service worker must never sit in Next's router path.
 *
 * ## The bug
 * Clicking "Blog" in the nav landed the user on
 * `https://scripthammer.com/blog/index.txt` — the raw RSC flight payload —
 * instead of the blog.
 *
 * Under `output: 'export'` the App Router fetches a per-route `index.txt` flight
 * payload to perform a client-side navigation. That request fell through to the
 * stale-while-revalidate handler at the bottom of `sw.js`, which had no failure
 * path: one rejected `fetch` rejects `respondWith`, the router's fetch dies, and
 * Next recovers by HARD-NAVIGATING to the URL it was fetching. The address bar
 * ends up on the payload.
 *
 * The `_next` bypass was scoped to `hostname === 'localhost'`, so production was
 * the only environment where the worker was in the router's path — the one place
 * it could break navigation for real users.
 *
 * ## Why these assert "not handled" rather than a response
 * A worker declines a request by NOT calling `respondWith`. So the guard here is
 * that the fetch listener leaves the event untouched, which is what lets the
 * browser fetch it normally.
 *
 * Runs the REAL `public/sw.js` through the same harness as sw-images and
 * sw-navigate.
 *
 * @module tests/unit/sw-router-bypass.test
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCOPE = 'https://scripthammer.com/';
const SW_SOURCE = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');

type FetchHandler = (event: {
  request: Request;
  respondWith: (r: Promise<Response> | Response) => void;
}) => void;

/** Load the real worker; return its fetch listener. */
function loadWorker() {
  const handlers: Record<string, FetchHandler> = {};
  const caches = {
    match: async () => undefined,
    open: async () => ({ put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
  };
  const scope = {
    addEventListener: (t: string, fn: FetchHandler) => {
      handlers[t] = fn;
    },
    registration: { scope: SCOPE },
    skipWaiting: () => {},
    clients: { claim: () => {}, matchAll: async () => [] },
  };
  // Deliberately NO `location` on the scope. A plain worker scope has none, and
  // an earlier version of this fix read `self.location.origin` — which threw on
  // every request and would have disabled the whole worker in production.
  const networkFetch = async () => new Response('network', { status: 200 });
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

/** True when the worker DECLINED the request (never called respondWith). */
function isPassedThrough(
  url: string,
  init?: { destination?: string }
): boolean {
  const handler = loadWorker();
  const request = new Request(url);
  if (init?.destination) {
    Object.defineProperty(request, 'destination', {
      value: init.destination,
    });
  }
  let handled = false;
  handler({ request, respondWith: () => (handled = true) });
  return !handled;
}

describe('the worker stays out of Next router traffic', () => {
  it('passes RSC flight payloads straight through', () => {
    // THE REGRESSION GUARD for the reported bug. If the worker handles this,
    // a failure inside it makes Next hard-navigate to this very URL.
    expect(isPassedThrough(`${SCOPE}blog/index.txt`)).toBe(true);
  });

  it.each([
    'index.txt',
    'docs/index.txt',
    'sign-in/index.txt',
    'blog/playable-city-chattanooga/index.txt',
  ])('passes through /%s', (path) => {
    expect(isPassedThrough(`${SCOPE}${path}`)).toBe(true);
  });

  it('passes _next assets through on a real host, not just localhost', () => {
    // The old guard was `hostname === 'localhost' && …`, so production — the
    // only environment with real users — was the one place it did NOT apply.
    expect(
      isPassedThrough(`${SCOPE}_next/static/chunks/main-app-abc123.js`)
    ).toBe(true);
    expect(isPassedThrough(`${SCOPE}_next/static/css/abc123.css`)).toBe(true);
  });

  it('does not throw while deciding (no self.location dependency)', () => {
    // The harness scope has no `location`. Reading `.origin` off it threw on
    // every request, which would have taken the entire worker down.
    expect(() => isPassedThrough(`${SCOPE}blog/index.txt`)).not.toThrow();
    expect(() => isPassedThrough(`${SCOPE}anything.png`)).not.toThrow();
  });

  it('STILL handles the things it is supposed to', () => {
    // The bypass must be narrow. If it swallowed real assets the PWA would
    // stop working offline, which is a different bug with the same shape.
    expect(isPassedThrough(`${SCOPE}blog-images/x/featured.svg`)).toBe(false);
    expect(isPassedThrough(`${SCOPE}icon-192x192.png`)).toBe(false);
  });
});
