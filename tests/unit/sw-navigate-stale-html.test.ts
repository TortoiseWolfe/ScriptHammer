/**
 * A navigation must never be answered with HTML older than the live assets.
 *
 * ## The bug (#467)
 * A real visitor got the site with NO CSS: no nav, white background, the logo
 * painting at its natural size. The DOM was perfectly correct.
 *
 * Three facts combine. GitHub Pages serves only the current build, so the
 * previous deploy's hashed CSS is deleted — measured, a stale hash 404s while the
 * current one is 200. The worker caches every successful HTML navigation and
 * serves it back on ANY fetch rejection, a tolerance added deliberately in #317
 * so a momentary blip would stop becoming a full "You're Offline" page. And
 * hashed CSS filenames change on every deploy.
 *
 * So a navigation that fails for a moment during a deploy gets answered with HTML
 * from the older build, and every `<link rel=stylesheet>` in it 404s.
 *
 * ## What the fix is, and what these tests pin
 * When the network is reachable, retry the navigation once before reaching for
 * anything stored. A deploy swap and a blip both recover, and neither can serve
 * HTML older than the server's assets.
 *
 * `navigator.onLine` only gates that EXTRA ATTEMPT — it never suppresses the
 * cache path, because it reports `true` behind a captive portal and #317's
 * symptom must not return. The offline case below is that guarantee.
 *
 * ## Why a unit test
 * The production render gate (`.pay-verify/prodcheck.mjs`) loads each route in a
 * clean context and again with the worker active, and PASSES on a healthy build
 * in both. It cannot see this: reproducing it needs cached HTML from build N
 * while the server is on build N+1. That state is cheap to construct here and
 * expensive to construct against a live site.
 *
 * Runs the REAL `public/sw.js` through the same harness as the other sw tests.
 *
 * @module tests/unit/sw-navigate-stale-html.test
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

interface Scenario {
  /** Is the client online? Gates the extra attempt, never the cache path. */
  onLine: boolean;
  /** Responses the worker's `fetch` returns, in order. `null` rejects. */
  fetchSequence: (Response | null)[];
  /** What the cache holds for this navigation, if anything. */
  cached?: Response;
}

interface Outcome {
  body: string;
  /** How many times the worker went to the network. */
  fetchCalls: number;
  /** Did the second attempt bypass the HTTP cache, as it must? */
  reloadUsed: boolean;
}

async function navigate(url: string, scenario: Scenario): Promise<Outcome> {
  const handlers: Record<string, FetchHandler> = {};
  let fetchCalls = 0;
  let reloadUsed = false;

  const caches = {
    match: async () => scenario.cached,
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
    // The worker reads this to decide whether an extra attempt is worth making.
    navigator: { onLine: scenario.onLine },
  };
  const workerFetch = async (_req: unknown, init?: { cache?: string }) => {
    if (init?.cache === 'reload') reloadUsed = true;
    const next = scenario.fetchSequence[fetchCalls];
    fetchCalls += 1;
    if (!next) throw new TypeError('Failed to fetch');
    return next;
  };

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
  run(scope, caches, scope.clients, workerFetch, Response, Headers, URL);

  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });

  let responded: Promise<Response> | Response | undefined;
  handlers.fetch({ request, respondWith: (r) => (responded = r) });
  expect(responded, 'the worker must handle a navigation').toBeDefined();
  const response = await responded!;
  return { body: await response.text(), fetchCalls, reloadUsed };
}

const fresh = () => new Response('FRESH-HTML', { status: 200 });
const staleCached = () => new Response('STALE-HTML', { status: 200 });

describe('a navigation is never answered with HTML older than the assets (#467)', () => {
  it('retries once when online, instead of serving the stale cached page', async () => {
    // THE REGRESSION GUARD. Before the fix this returned STALE-HTML after a
    // single failure, and that HTML referenced CSS the current deploy had
    // deleted — the site with no styles.
    const out = await navigate(`${SCOPE}blog/`, {
      onLine: true,
      fetchSequence: [null, fresh()],
      cached: staleCached(),
    });
    expect(out.body).toBe('FRESH-HTML');
    expect(out.fetchCalls).toBe(2);
  });

  it('bypasses the HTTP cache on that retry', async () => {
    // Without `cache: 'reload'` the retry can be answered from the browser's own
    // HTTP cache with the same stale document, which defeats the whole point.
    const out = await navigate(`${SCOPE}blog/`, {
      onLine: true,
      fetchSequence: [null, fresh()],
      cached: staleCached(),
    });
    expect(out.reloadUsed).toBe(true);
  });

  it('still serves the cached page when genuinely OFFLINE (#317 preserved)', async () => {
    // The tolerance #317 added must survive. An offline visitor gets their page,
    // and no extra attempt is wasted.
    const out = await navigate(`${SCOPE}blog/`, {
      onLine: false,
      fetchSequence: [null],
      cached: staleCached(),
    });
    expect(out.body).toBe('STALE-HTML');
    expect(out.fetchCalls).toBe(1);
  });

  it('falls back to cache when online but the retry also fails', async () => {
    // A real outage while online: one extra attempt, then the cached page. Still
    // better than an error screen, and the deploy-swap case is already handled.
    const out = await navigate(`${SCOPE}blog/`, {
      onLine: true,
      fetchSequence: [null, null],
      cached: staleCached(),
    });
    expect(out.body).toBe('STALE-HTML');
    expect(out.fetchCalls).toBe(2);
  });

  it('does not go to the network twice when the first attempt succeeds', async () => {
    // The happy path must be untouched — no doubled requests for every page view.
    const out = await navigate(`${SCOPE}blog/`, {
      onLine: true,
      fetchSequence: [fresh()],
    });
    expect(out.body).toBe('FRESH-HTML');
    expect(out.fetchCalls).toBe(1);
    expect(out.reloadUsed).toBe(false);
  });
});
