import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PRIVACY_LINE,
  VOTE_KEY_PREFIX,
  planVote,
  readFlag,
  sendVote,
  voteEndpoint,
  writeFlag,
} from './vote';

const ENDPOINT = {
  url: 'https://example.supabase.co/rest/v1/rpc/cast_band_vote',
  key: 'anon-key',
};

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('voteEndpoint', () => {
  it('is null until the deploy turns voting on', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'k');
    vi.stubEnv('NEXT_PUBLIC_BAND_VOTE_OPEN', '');
    expect(voteEndpoint()).toBeNull();
  });

  it('is null with no Supabase address', () => {
    vi.stubEnv('NEXT_PUBLIC_BAND_VOTE_OPEN', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(voteEndpoint()).toBeNull();
  });

  it('points at the one function and nothing else', () => {
    vi.stubEnv('NEXT_PUBLIC_BAND_VOTE_OPEN', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co/');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'k');
    expect(voteEndpoint()).toEqual({
      url: 'https://example.supabase.co/rest/v1/rpc/cast_band_vote',
      key: 'k',
    });
  });
});

describe('the device flag', () => {
  it('round-trips and lives under a band-only key', () => {
    const store = memoryStore();
    writeFlag('n05', { dir: 'up', changed: false }, store);
    expect([...store.data.keys()]).toEqual([`${VOTE_KEY_PREFIX}n05`]);
    expect(readFlag('n05', store)).toEqual({ dir: 'up', changed: false });
    expect(readFlag('n01', store)).toBeNull();
  });

  it('treats a damaged flag as no flag', () => {
    const store = memoryStore();
    store.data.set(`${VOTE_KEY_PREFIX}n05`, '{not json');
    expect(readFlag('n05', store)).toBeNull();
    store.data.set(
      `${VOTE_KEY_PREFIX}n05`,
      JSON.stringify({ dir: 'sideways', changed: false })
    );
    expect(readFlag('n05', store)).toBeNull();
  });

  it('survives blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readFlag('n05', blocked)).toBeNull();
    expect(() =>
      writeFlag('n05', { dir: 'up', changed: false }, blocked)
    ).not.toThrow();
  });
});

describe('planVote: one vote per song per device, changeable once', () => {
  it('casts the first vote', () => {
    expect(planVote(null, 'up')).toEqual({ kind: 'cast', previous: null });
  });
  it('ignores a second click on the same choice', () => {
    expect(planVote({ dir: 'up', changed: false }, 'up')).toEqual({
      kind: 'same',
    });
  });
  it('allows one change, and names the earlier direction', () => {
    expect(planVote({ dir: 'up', changed: false }, 'down')).toEqual({
      kind: 'change',
      previous: 'up',
    });
  });
  it('blocks a second change', () => {
    expect(planVote({ dir: 'down', changed: true }, 'up')).toEqual({
      kind: 'blocked',
    });
  });
});

describe('sendVote: nothing identifies the voter', () => {
  const ok = (body: unknown) =>
    vi.fn(
      async () => new Response(JSON.stringify(body), { status: 200 })
    ) as unknown as typeof fetch;

  it('sends the song, the direction and the earlier direction, and nothing else', async () => {
    const f = ok('ok');
    expect(await sendVote(ENDPOINT, 'n05', 'down', 'up', f)).toBe('ok');
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT.url);
    expect(JSON.parse(init.body as string)).toEqual({
      p_song_id: 'n05',
      p_direction: 'down',
      p_previous: 'up',
    });
  });

  it('sets no cookie, sends no referrer and stores no answer', async () => {
    const f = ok('ok');
    await sendVote(ENDPOINT, 'n05', 'up', null, f);
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.cache).toBe('no-store');
    const headers = Object.keys(init.headers as Record<string, string>).map(
      (h) => h.toLowerCase()
    );
    expect(headers.sort()).toEqual(['apikey', 'authorization', 'content-type']);
  });

  it('passes "try again later" on', async () => {
    expect(await sendVote(ENDPOINT, 'n05', 'up', null, ok('later'))).toBe(
      'later'
    );
  });

  it('reports an error for a bad answer, a failed request or a network failure', async () => {
    expect(await sendVote(ENDPOINT, 'n05', 'up', null, ok('???'))).toBe(
      'error'
    );
    const failing = vi.fn(
      async () => new Response('no', { status: 400 })
    ) as unknown as typeof fetch;
    expect(await sendVote(ENDPOINT, 'n05', 'up', null, failing)).toBe('error');
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await sendVote(ENDPOINT, 'n05', 'up', null, down)).toBe('error');
  });
});

describe('the privacy line', () => {
  it('is the sentence the spec gives, word for word', () => {
    expect(PRIVACY_LINE).toBe(
      "Votes here are anonymous. We don't ask who you are, set no cookies and keep no address. Your browser remembers your own vote on your own device only."
    );
  });
});
