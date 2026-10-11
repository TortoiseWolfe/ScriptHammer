/**
 * The app's client does not retry a failed read (#1298).
 *
 * postgrest-js retries a GET on 503, 520 or a rejected fetch by default since 2.102: three more
 * attempts over about seven seconds. Upgrading supabase-js would have switched that on silently.
 * The offline paths expect a read to fail at once when the network is gone, so `db.retry` is off
 * in src/lib/supabase/client.ts, and this is the test that fails if it is turned back on.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';

// tests/setup.ts mocks the app's client module for component tests; this is about the real one.
vi.unmock('@/lib/supabase/client');

describe('the app Supabase client', () => {
  const restUrl = 'http://abcdefgh.supabase.test';
  // A 503 with Retry-After: 0: retryable, and retried at once when retries are on, so turning
  // them on fails the count below in milliseconds. The control in the second case uses the same
  // answer, so it vouches for exactly what this one checks.
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (new URL(String(input)).pathname.startsWith('/rest/v1/')) {
      return new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
      });
    }
    return new Response('{}', { status: 200 });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('answers a failed read with one request, not four', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', restUrl);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    // supabase-js takes the global fetch when the client is built, so stub it first.
    vi.stubGlobal('fetch', fetchMock);
    const { createClient } = await import('@/lib/supabase/client');

    const { error } = await createClient().from('payment_intents').select('id');

    expect(error).not.toBeNull();
    const reads = fetchMock.mock.calls.filter(([input]) =>
      new URL(String(input)).pathname.startsWith('/rest/v1/')
    );
    expect(reads).toHaveLength(1);
  });

  it("is testing something: the library's own default does retry", async () => {
    // Without this, the test above would pass vacuously the day postgrest-js stops retrying by
    // default, and `db.retry: false` would be guarding nothing.
    const { createClient: createLibraryClient } = await import(
      '@supabase/supabase-js'
    );
    const calls: string[] = [];
    // A 503 with Retry-After: 0, which the library retries at once rather than after its 1-2-4 s
    // backoff, so this needs no timers.
    const unavailable = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(new URL(String(input)).pathname);
      return new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
      });
    });
    const library = createLibraryClient(restUrl, 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: unavailable },
    });

    const { error } = await library.from('payment_intents').select('id');

    expect(error).not.toBeNull();
    expect(
      calls.filter((p) => p.startsWith('/rest/v1/')).length
    ).toBeGreaterThan(1);
  });
});
