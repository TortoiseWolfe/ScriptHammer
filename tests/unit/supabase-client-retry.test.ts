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
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (new URL(String(input)).pathname.startsWith('/rest/v1/')) {
      throw new TypeError('Failed to fetch');
    }
    return new Response('{}', { status: 200 });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('answers a read the network refused with one request, not four', async () => {
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
    // Room for the library's ~7 s of retries, so turning them on fails on the count above, with
    // a message that says why, rather than as a timeout that reads like a flake.
  }, 15_000);
});
