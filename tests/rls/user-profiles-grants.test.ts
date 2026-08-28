/**
 * `user_profiles` must not expose or accept `is_admin` from a browser.
 *
 * WHY THIS IS A GRANTS TEST AND NOT AN RLS TEST. RLS restricts ROWS. It has
 * nothing to say about COLUMNS, and this table's read policy is
 * `USING (true)` for `authenticated` by design, so friend search works. The
 * only thing standing between a signed-in stranger and every column of every
 * row is the GRANT — and the grant that used to be here read
 * `GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated`, which
 * narrowed nothing: Supabase's platform defaults hand both `anon` and
 * `authenticated` ALL privileges on every table in `public`, so the file's
 * narrower grant sat on top of a wider one. Measured on production before the
 * fix, both roles held DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
 * and UPDATE on all nine columns. Same trap as #897 on `payment_intents`.
 *
 * WHAT WAS EXPLOITABLE, and why this is more than disclosure. The update policy
 * allows `auth.uid() = id`, the grant covered every column, and no trigger
 * guards the flag, so any signed-in user could run
 *
 *   UPDATE user_profiles SET is_admin = true WHERE id = auth.uid();
 *
 * while `is_admin()` reads that column live as the single authority for every
 * admin RPC and policy. Confirmed refused against production after the fix,
 * with `42501 permission denied`.
 *
 * WHAT THIS CANNOT DO, stated so a green run is not over-read: it runs against
 * the LOCAL stack, so it pins what a FRESH database gets from the migration. It
 * cannot see production drift — that needs a scheduled probe in the shape of
 * `auth-config-drift.yml`. Production was NOT fine, and this test would have
 * been green throughout.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { hasRlsTestEnvironment, RLS_SKIP_REASON } from '../fixtures/test-users';

const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

/** The column a browser must never read or write, at any privilege. */
const FORBIDDEN = 'is_admin';

describe.skipIf(!hasRlsTestEnvironment())(
  `user_profiles column grants ${RLS_SKIP_REASON}`,
  () => {
    let db: Client;

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();
    });

    afterAll(async () => {
      await db.end();
    });

    async function columnsFor(grantee: string, privilege: string) {
      const { rows } = await db.query(
        `SELECT column_name FROM information_schema.role_column_grants
          WHERE table_schema='public' AND table_name='user_profiles'
            AND grantee=$1 AND privilege_type=$2
          ORDER BY column_name`,
        [grantee, privilege]
      );
      return rows.map((r) => r.column_name as string);
    }

    it('never grants is_admin to authenticated, for any privilege', async () => {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) {
        const cols = await columnsFor('authenticated', privilege);
        expect(
          cols,
          `authenticated holds ${privilege} on ${FORBIDDEN} — a browser can ` +
            `${privilege === 'SELECT' ? 'read the admin roster' : 'grant itself admin'}`
        ).not.toContain(FORBIDDEN);
      }
    });

    it('grants anon nothing at all on this table', async () => {
      const { rows } = await db.query(
        `SELECT DISTINCT privilege_type FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='user_profiles' AND grantee='anon'`
      );
      expect(rows.map((r) => r.privilege_type)).toEqual([]);
    });

    it('holds NO table-wide privilege, which is what makes the column lists bind', async () => {
      // A table-level grant subsumes every column list beneath it. If one comes
      // back, the REVOKE was dropped and the columns above are decoration.
      const { rows } = await db.query(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='user_profiles'
            AND grantee IN ('anon','authenticated')`
      );
      expect(rows).toEqual([]);
    });

    it('still grants the columns the app actually uses', async () => {
      // The other half: a fix that locks the table down and breaks the profile
      // page is not a fix. These are the columns real call sites select.
      const select = await columnsFor('authenticated', 'SELECT');
      for (const col of [
        'id',
        'username',
        'display_name',
        'avatar_url',
        'bio',
        'welcome_message_sent',
      ]) {
        expect(
          select,
          `SELECT (${col}) is needed by a live call site`
        ).toContain(col);
      }
      const update = await columnsFor('authenticated', 'UPDATE');
      // welcome-service.ts:266 sets this; avatar upload sets avatar_url.
      expect(update).toContain('welcome_message_sent');
      expect(update).toContain('avatar_url');
      // But never the identity or the audit columns.
      for (const col of ['id', 'created_at', 'updated_at']) {
        expect(
          update,
          `nothing in a browser should rewrite ${col}`
        ).not.toContain(col);
      }
    });

    it('only lets a signed-in user insert their OWN profile row', async () => {
      // Was `FOR INSERT WITH CHECK (true)` with no role restriction, while anon
      // held a platform-default INSERT grant.
      const { rows } = await db.query(
        `SELECT roles::text AS roles, with_check FROM pg_policies
          WHERE schemaname='public' AND tablename='user_profiles' AND cmd='INSERT'`
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.with_check).not.toBe('true');
        expect(r.roles).toContain('authenticated');
        expect(r.roles).not.toContain('anon');
      }
    });
  }
);
