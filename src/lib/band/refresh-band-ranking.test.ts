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
  readVoteRows,
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

describe('refresh-band-ranking: reading the table', () => {
  it('reads every page and sends the key only in headers', async () => {
    const calls: string[] = [];
    const page = (n: number) =>
      Array.from({ length: n }, () => ({ song_id: 'jam-2', up: 1, down: 0 }));
    const fake = (async (url: string, init: RequestInit) => {
      calls.push(url);
      const headers = init.headers as Record<string, string>;
      expect(headers.apikey).toBe('k');
      expect(url).not.toContain('k=');
      return {
        ok: true,
        status: 200,
        json: async () => (calls.length === 1 ? page(1000) : page(3)),
      };
    }) as unknown as typeof fetch;
    const rows = await readVoteRows('https://x.test', 'k', fake);
    expect(rows).toHaveLength(1003);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('offset=1000');
  });

  it('throws a message with the status and no key on a failed read', async () => {
    const fake = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(
      readVoteRows('https://x.test', 'secret-value-123', fake)
    ).rejects.toThrow(/HTTP 401/);
    await expect(
      readVoteRows('https://x.test', 'secret-value-123', fake)
    ).rejects.not.toThrow(/secret-value-123/);
  });
});

describe('refresh-band-ranking: run as a script', () => {
  it('leaves the file as committed and exits 0 with no key (a fork)', () => {
    const file = join(process.cwd(), 'public/data/band-ranking.json');
    const before = readFileSync(file, 'utf8');
    const out = execFileSync(
      process.execPath,
      [join(process.cwd(), 'scripts/ci/refresh-band-ranking.mjs')],
      {
        env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
        encoding: 'utf8',
      }
    );
    expect(out).toContain('left as committed');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
