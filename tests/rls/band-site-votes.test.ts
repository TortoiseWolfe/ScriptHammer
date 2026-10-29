/**
 * The anonymous song vote on /band (#1416, feature 054).
 *
 * The page is a kid-safe route and every visitor counts as under 13, so a vote carries no
 * identity and the table holds counters only. These tests run as the real `anon` role against
 * the real function and read the CATALOG for what that role may do, because the file text says
 * what was meant and the database says what happens (the same reasoning as
 * definer-privileges.test.ts).
 *
 * LOCAL STACK ONLY. They write to band_site_votes and clear the current hour before and after.
 * They pin what a fresh database gets from the migration; production is checked by the daily
 * drift job once the migration has been applied there.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import { hasRlsTestEnvironment, RLS_SKIP_REASON } from '../fixtures/test-users';
import { sendVote } from '../../src/lib/band/vote';
import rankingFile from '../../public/data/band-ranking.json';

const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

const PER_SONG_CAP = 30;
const OVERALL_CAP = 300;
const SONGS = [
  'jam-1',
  'jam-2',
  'jam-3',
  'n01',
  'n03',
  'n05',
  'n07',
  'n08',
  'n09',
  'n10',
  'n11',
  'n12',
];

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: anonymous band votes (#1416) [${RLS_SKIP_REASON}]`,
  () => {
    let db: Client;

    /** Run one statement as `anon`, then come back to the owner role. */
    async function asAnon<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ) {
      await db.query('SET ROLE anon');
      try {
        return (await db.query(sql, params)).rows as T[];
      } finally {
        await db.query('RESET ROLE');
      }
    }

    const vote = async (id: string, dir: string, prev: string | null = null) =>
      (
        await asAnon<{ r: string }>('SELECT cast_band_vote($1, $2, $3) AS r', [
          id,
          dir,
          prev,
        ])
      )[0].r;

    const clear = () =>
      db.query(
        "DELETE FROM band_site_votes WHERE hour = date_trunc('hour', now())"
      );

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();
    });

    beforeEach(clear);

    afterAll(async () => {
      await clear();
      await db?.end();
    });

    it('has row-level security on, and no policy for anyone', async () => {
      const { rows } = await db.query(
        `SELECT c.relrowsecurity,
                (SELECT count(*) FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'band_site_votes')::int AS policies
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'band_site_votes'`
      );
      expect(rows).toEqual([{ relrowsecurity: true, policies: 0 }]);
    });

    it('lets anon run the function, and not authenticated', async () => {
      const { rows } = await db.query(
        `SELECT has_function_privilege('anon', 'public.cast_band_vote(text,text,text)', 'EXECUTE') AS anon,
                has_function_privilege('authenticated', 'public.cast_band_vote(text,text,text)', 'EXECUTE') AS authd`
      );
      expect(rows).toEqual([{ anon: true, authd: false }]);
    });

    it('cannot read or write the table directly', async () => {
      await expect(asAnon('SELECT * FROM band_site_votes')).rejects.toThrow(
        /permission denied/
      );
      await expect(
        asAnon(
          "INSERT INTO band_site_votes (song_id, hour, up, down, requests) VALUES ('n05', now(), 99, 0, 1)"
        )
      ).rejects.toThrow(/permission denied/);
      await expect(asAnon('TRUNCATE band_site_votes')).rejects.toThrow(
        /permission denied/
      );
    });

    it('counts an up vote, and a changed vote moves one from the old side to the new', async () => {
      expect(await vote('n05', 'up')).toBe('ok');
      expect(await vote('n05', 'down', 'up')).toBe('ok');
      const { rows } = await db.query(
        "SELECT up, down, requests FROM band_site_votes WHERE song_id = 'n05'"
      );
      expect(rows).toEqual([{ up: 0, down: 1, requests: 2 }]);
    });

    it('rejects an unknown song, a bad direction and a bad previous direction', async () => {
      await expect(vote('not-a-song', 'up')).rejects.toThrow(/unknown song/);
      await expect(vote('n05', 'sideways')).rejects.toThrow(
        /direction must be up or down/
      );
      await expect(vote('n05', 'up', 'x')).rejects.toThrow(
        /previous must be up, down or empty/
      );
      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM band_site_votes'
      );
      expect(rows[0].n).toBe(0);
    });

    it('stops one song at the hourly cap and records nothing past it', async () => {
      const answers: string[] = [];
      for (let i = 0; i < PER_SONG_CAP + 5; i++)
        answers.push(await vote('n05', 'up'));
      expect(answers.filter((a) => a === 'ok')).toHaveLength(PER_SONG_CAP);
      expect(answers.filter((a) => a === 'later')).toHaveLength(5);
      const { rows } = await db.query(
        "SELECT up, requests FROM band_site_votes WHERE song_id = 'n05'"
      );
      expect(rows).toEqual([{ up: PER_SONG_CAP, requests: PER_SONG_CAP }]);
      // Another song is not held back by n05's cap.
      expect(await vote('n01', 'up')).toBe('ok');
    });

    it('stops all songs together at the overall hourly cap', async () => {
      let ok = 0;
      let later = 0;
      for (let i = 0; i < OVERALL_CAP + 20; i++) {
        const answer = await vote(SONGS[i % SONGS.length], 'up');
        if (answer === 'ok') ok++;
        else later++;
      }
      // 12 songs x 30 = 360 would fit under the per-song caps; the overall cap stops at 300.
      expect(ok).toBe(OVERALL_CAP);
      expect(later).toBe(20);
      const { rows } = await db.query(
        'SELECT sum(requests)::int AS total FROM band_site_votes'
      );
      expect(rows[0].total).toBe(OVERALL_CAP);
    });

    it('stores nothing about the voter: only song, hour and counters', async () => {
      const { rows } = await db.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'band_site_votes'
          ORDER BY column_name`
      );
      expect(rows.map((r) => r.column_name)).toEqual([
        'down',
        'hour',
        'requests',
        'song_id',
        'up',
      ]);
    });

    // The page's own request, sent the way a browser sends it: through the REST gateway
    // with the public key, not through a database connection. This is the round trip a
    // visitor's click makes, and the only test that would catch a renamed parameter or
    // a song the page lists that the function refuses.
    describe('over HTTP, as the page sends it', () => {
      const endpoint = () => {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!base || !key) {
          throw new Error(
            'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
          );
        }
        return {
          url: `${base.replace(/\/+$/, '')}/rest/v1/rpc/cast_band_vote`,
          key,
        };
      };

      it('accepts a vote for every song the page lists, and counts each once', async () => {
        const ids = rankingFile.songs.map((s) => s.id);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
          expect(await sendVote(endpoint(), id, 'up', null)).toBe('ok');
        }
        const { rows } = await db.query(
          'SELECT song_id, up, down FROM band_site_votes ORDER BY song_id'
        );
        expect(rows.map((r) => r.song_id)).toEqual([...ids].sort());
        expect(rows.every((r) => r.up === 1 && r.down === 0)).toBe(true);
      });

      it('moves a changed vote from one side to the other', async () => {
        expect(await sendVote(endpoint(), 'n05', 'up', null)).toBe('ok');
        expect(await sendVote(endpoint(), 'n05', 'down', 'up')).toBe('ok');
        const { rows } = await db.query(
          "SELECT up, down FROM band_site_votes WHERE song_id = 'n05'"
        );
        expect(rows).toEqual([{ up: 0, down: 1 }]);
      });

      it('answers an unknown song with an error and records nothing', async () => {
        expect(await sendVote(endpoint(), 'not-a-song', 'up', null)).toBe(
          'error'
        );
        const { rows } = await db.query(
          'SELECT count(*)::int AS n FROM band_site_votes'
        );
        expect(rows[0].n).toBe(0);
      });
    });
  }
);
