/**
 * Anonymous voting on the ranked songs (feature 054).
 *
 * What leaves the browser: one plain POST to one Supabase function (cast_band_vote)
 * carrying a song id, a direction and, when a visitor changes their vote, the previous
 * direction. What stays: a small flag in the browser's own storage, "voted up on song
 * X", that is never sent anywhere. The Supabase client library is NOT used, so no
 * sign-in session or token is ever written to the browser. The request carries no
 * cookies (credentials: omit) and no referrer.
 *
 * Every visitor counts as under 13 (COPPA, the United States children's privacy law),
 * so nothing here identifies a voter: no account, cookie, device id or address of ours.
 */

export type Direction = 'up' | 'down';

export interface VoteFlag {
  dir: Direction;
  /** A visitor may change their vote once; after that it stays. */
  changed: boolean;
}

export const VOTE_KEY_PREFIX = 'band-site-vote:';

export const PRIVACY_LINE =
  "Votes here are anonymous. We don't ask who you are, set no cookies and keep no address. Your browser remembers your own vote on your own device only.";

export interface VoteEndpoint {
  url: string;
  key: string;
}

/**
 * Where the vote goes, or null (no buttons). Null on a fork or a dev box with no
 * Supabase, and also until NEXT_PUBLIC_BAND_VOTE_OPEN is "true": the buttons stay
 * hidden until the database function exists on the hosted project, so no visitor is
 * ever offered a button that cannot work. Whoever applies the migration sets the
 * variable and re-runs the deploy.
 */
export function voteEndpoint(): VoteEndpoint | null {
  if (process.env.NEXT_PUBLIC_BAND_VOTE_OPEN !== 'true') return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  return { url: `${base.replace(/\/+$/, '')}/rest/v1/rpc/cast_band_vote`, key };
}

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): FlagStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readFlag(
  songId: string,
  store: FlagStorage | null = storage()
): VoteFlag | null {
  try {
    const raw = store?.getItem(VOTE_KEY_PREFIX + songId);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<VoteFlag>;
    if (
      (v.dir === 'up' || v.dir === 'down') &&
      typeof v.changed === 'boolean'
    ) {
      return { dir: v.dir, changed: v.changed };
    }
  } catch {
    // An unreadable flag counts as no flag.
  }
  return null;
}

export function writeFlag(
  songId: string,
  flag: VoteFlag,
  store: FlagStorage | null = storage()
): void {
  try {
    store?.setItem(VOTE_KEY_PREFIX + songId, JSON.stringify(flag));
  } catch {
    // Storage full or blocked: the vote still counts for this page view.
  }
}

export type VotePlan =
  | { kind: 'cast'; previous: null }
  | { kind: 'change'; previous: Direction }
  | { kind: 'same' }
  | { kind: 'blocked' };

/** One vote per song per device, changeable once. */
export function planVote(flag: VoteFlag | null, dir: Direction): VotePlan {
  if (!flag) return { kind: 'cast', previous: null };
  if (flag.dir === dir) return { kind: 'same' };
  if (flag.changed) return { kind: 'blocked' };
  return { kind: 'change', previous: flag.dir };
}

export type VoteResult = 'ok' | 'later' | 'error';

/** One plain request. Resolves to 'later' past the server's hourly cap. */
export async function sendVote(
  endpoint: VoteEndpoint,
  songId: string,
  dir: Direction,
  previous: Direction | null,
  doFetch: typeof fetch = fetch
): Promise<VoteResult> {
  try {
    const res = await doFetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: endpoint.key,
        Authorization: `Bearer ${endpoint.key}`,
      },
      body: JSON.stringify({
        p_song_id: songId,
        p_direction: dir,
        p_previous: previous,
      }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return 'error';
    const answer: unknown = await res.json();
    return answer === 'ok' ? 'ok' : answer === 'later' ? 'later' : 'error';
  } catch {
    return 'error';
  }
}
