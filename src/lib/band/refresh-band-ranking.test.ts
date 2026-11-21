import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import weights from '../../../public/data/band-weights.json';
import shipped from '../../../public/data/band-ranking.json';
import { rankSongs, type BandRankingFile, type BandWeights } from './ranking';
// The deploy runs this file before the build; these tests run its real functions.
import {
  applySiteVotes,
  readVoteTotals,
} from '../../../scripts/ci/refresh-band-ranking.mjs';

const W = weights as BandWeights;
const FILE = shipped as BandRankingFile;
const order = (r: BandRankingFile) =>
  rankSongs(r.songs, r.asOf, W).map((s) => s.id);
// The script is plain JavaScript, so its return type is inferred loosely; it returns the same
// shape it was given.
const apply = (rows: Array<{ song_id: string; up: number; down: number }>) =>
  applySiteVotes(FILE, rows) as BandRankingFile;

describe('refresh-band-ranking: a vote row reaches the ranking', () => {
  it('moves the last-ranked song up when its vote rows are up votes', () => {
    const before = order(FILE);
    const last = before[before.length - 1];
    const after = order(
      apply([
        { song_id: last, up: 10, down: 0 },
        { song_id: last, up: 10, down: 0 },
      ])
    );
    expect(after.indexOf(last)).toBeLessThan(before.indexOf(last));
  });

  it('moves the first-ranked song down when its vote rows are down votes', () => {
    const before = order(FILE);
    const first = before[0];
    const after = order(apply([{ song_id: first, up: 0, down: W.siteCap }]));
    expect(after.indexOf(first)).toBeGreaterThan(before.indexOf(first));
  });

  it('adds the hourly rows of one song together', () => {
    const id = FILE.songs[0].id;
    const out = applySiteVotes(FILE, [
      { song_id: id, up: 3, down: 1 },
      { song_id: id, up: 4, down: 2 },
    ]);
    expect(out.songs.find((s) => s.id === id)!.site).toEqual({
      up: 7,
      down: 3,
    });
  });

  it('gives a song with no rows 0 and 0, and ignores an id the file does not list', () => {
    const [a, b] = FILE.songs;
    const out = applySiteVotes(FILE, [
      { song_id: a.id, up: 2, down: 0 },
      { song_id: 'not-a-song', up: 99, down: 99 },
    ]);
    expect(out.songs.find((s) => s.id === b.id)!.site).toEqual({
      up: 0,
      down: 0,
    });
    expect(out.songs).toHaveLength(FILE.songs.length);
    expect(JSON.stringify(out)).not.toContain('not-a-song');
  });

  it('changes only each song’s site counts: asOf and every other field stay', () => {
    const out = applySiteVotes(FILE, [
      { song_id: FILE.songs[0].id, up: 5, down: 1 },
    ]);
    expect(out.asOf).toBe(FILE.asOf);
    for (const [i, s] of out.songs.entries()) {
      const { site: _a, ...rest } = s;
      const { site: _b, ...orig } = FILE.songs[i];
      expect(rest).toEqual(orig);
    }
  });

  it('does not change the committed file object it was given', () => {
    const snapshot = JSON.stringify(FILE);
    applySiteVotes(FILE, [{ song_id: FILE.songs[0].id, up: 5, down: 5 }]);
    expect(JSON.stringify(FILE)).toBe(snapshot);
  });
});

describe('refresh-band-ranking: reading the totals', () => {
  it('makes one POST to the function, with the key only in headers and an empty body', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const totals = [
      { song_id: 'jam-2', up: 4, down: 1 },
      { song_id: 'jam-3', up: 0, down: 2 },
    ];
    const fake = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return { ok: true, status: 200, json: async () => totals };
    }) as unknown as typeof fetch;
    const rows = await readVoteTotals('https://x.test', 'k', fake);
    expect(rows).toEqual(totals);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://x.test/rest/v1/rpc/get_band_vote_totals');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.body).toBe('{}');
    const headers = seen[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBe('k');
    expect(headers.Authorization).toBe('Bearer k');
    expect(seen[0].url).not.toContain('k=');
  });

  it('throws a message with the status and no key on a failed read', async () => {
    const fake = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const failure = readVoteTotals('https://x.test', 'secret-value-123', fake);
    await expect(failure).rejects.toThrow(/HTTP 401/);
    await expect(failure).rejects.toSatisfy(
      (e: Error) => !e.message.includes('secret-value-123')
    );
  });

  it('throws when the answer is not a list', async () => {
    const fake = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: 'oops' }),
    })) as unknown as typeof fetch;
    await expect(readVoteTotals('https://x.test', 'k', fake)).rejects.toThrow(
      /did not answer a list/
    );
  });
});

describe('refresh-band-ranking: run as a script', () => {
  const file = join(process.cwd(), 'public/data/band-ranking.json');
  const script = join(process.cwd(), 'scripts/ci/refresh-band-ranking.mjs');
  const run = (env: Record<string, string>) =>
    execFileSync(process.execPath, [script], {
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env },
      encoding: 'utf8',
    });

  it('leaves the file as committed and exits 0 with no URL (a fork)', () => {
    const before = readFileSync(file, 'utf8');
    const out = run({});
    expect(out).toContain('left as committed');
    expect(out).toContain('no NEXT_PUBLIC_SUPABASE_URL');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('leaves the file as committed and exits 0 with a URL but no anon key', () => {
    const before = readFileSync(file, 'utf8');
    const out = run({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1' });
    expect(out).toContain('no NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('never fails the deploy when the database cannot be reached', () => {
    const before = readFileSync(file, 'utf8');
    const out = run({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-key-123',
    });
    expect(out).toContain('::warning::band ranking: left as committed');
    expect(out).not.toContain('not-a-real-key-123');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
