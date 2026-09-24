/**
 * The exact DELETE the nightly retention job sends to production (#1295), run against the local
 * stack. It must remove a bucket nobody has touched for a day, and keep both a recent bucket and
 * a stale one still under a live lock — deleting the last would hand a throttled caller a fresh
 * budget.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { hasRlsTestEnvironment, RLS_SKIP_REASON } from '../fixtures/test-users';
import {
  RATE_LIMIT_CENSUS_SQL,
  RATE_LIMIT_DELETE_SQL,
} from '../../scripts/lib/rate-limit-retention';

const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

const tag = `rls-1295-${Date.now().toString(36)}`;
const ids = {
  stale: `${tag}-stale`,
  recent: `${tag}-recent`,
  locked: `${tag}-locked`,
};

describe.skipIf(!hasRlsTestEnvironment())(
  `rate_limit_attempts retention (#1295) [${RLS_SKIP_REASON}]`,
  () => {
    let db: Client;
    const present = async () =>
      (
        await db.query(
          `SELECT identifier FROM rate_limit_attempts WHERE identifier = ANY($1) ORDER BY 1`,
          [Object.values(ids)]
        )
      ).rows.map((r) => r.identifier);

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();
      await db.query(
        `INSERT INTO rate_limit_attempts (identifier, attempt_type, attempt_count, window_start, updated_at, locked_until)
         VALUES ($1, 'contact_form', 1, now() - interval '2 days', now() - interval '2 days', NULL),
                ($2, 'contact_form', 1, now() - interval '1 hour', now() - interval '1 hour', NULL),
                ($3, 'contact_form', 6, now() - interval '2 days', now() - interval '2 days', now() + interval '10 minutes')`,
        [ids.stale, ids.recent, ids.locked]
      );
    });

    afterAll(async () => {
      await db.query(
        `DELETE FROM rate_limit_attempts WHERE identifier = ANY($1)`,
        [Object.values(ids)]
      );
      await db.end();
    });

    it('CONTROL: all three seeded buckets exist, and the census counts the stale one', async () => {
      expect(await present()).toEqual(
        [ids.locked, ids.recent, ids.stale].sort()
      );
      const { rows } = await db.query(RATE_LIMIT_CENSUS_SQL);
      expect(Number(rows[0].stale)).toBeGreaterThanOrEqual(1);
    });

    it('deletes the stale bucket and keeps the recent and the locked ones', async () => {
      const { rows } = await db.query(RATE_LIMIT_DELETE_SQL);
      expect(Number(rows[0].deleted)).toBeGreaterThanOrEqual(1);
      expect(await present()).toEqual([ids.locked, ids.recent].sort());
    });
  }
);
