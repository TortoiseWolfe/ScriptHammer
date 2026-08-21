/**
 * The effective privileges on `payment_intents`, asserted against a database (#897).
 *
 * WHY NOT READ THE MIGRATION. Because reading the migration is what hid this. The file
 * says `GRANT SELECT, INSERT ON payment_intents TO authenticated`, and at `:2199` it
 * reasons that `anon` needs no attention since "there is no other GRANT ... TO anon in
 * this file." Both statements are true of the file and false of the database: Supabase's
 * platform defaults grant `anon` and `authenticated` ALL privileges on every table in
 * `public`, so the narrower GRANT sits on top of a wider one and changes nothing.
 *
 * Measured on PRODUCTION 2026-08-21, before the fix: both roles held DELETE, INSERT,
 * REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE. #565 had removed `authenticated`'s
 * UPDATE — in the file — three weeks earlier, and production had never received it. The
 * comment above that revoke names the exact trap it then fell into:
 *
 *   > Correcting the file without correcting the databases it already provisioned is the
 *   > "a migration file is not a migration" trap CLAUDE.md records.
 *
 * So this test asks a live database what it actually grants. It runs in the RLS suite,
 * which the required `Conformance result` check executes against a real stack.
 *
 * WHAT IT CANNOT DO. This suite runs against the LOCAL stack, so it pins what a FRESH
 * database gets from the migration. It cannot see production drift — that needs a
 * scheduled probe against the hosted project, in the shape of `auth-config-drift.yml`.
 * Stating the limit here because a green run must not be read as "production is fine";
 * production was not fine, and this test would have been green throughout.
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

/**
 * What each client role is allowed to hold.
 *
 * `authenticated` keeps INSERT until #559 T025 moves the three client write sites behind
 * an Edge Function; removing it before then breaks payments silently rather than loudly,
 * which is why #559 calls its own ordering load-bearing.
 */
const ALLOWED: Record<string, string[]> = {
  anon: ['SELECT'],
  authenticated: ['INSERT', 'SELECT'],
};

describe.skipIf(!hasRlsTestEnvironment())(
  `payment_intents grants are narrow (#897) ${RLS_SKIP_REASON}`,
  () => {
    let db: Client;
    let grants: Record<string, string[]>;

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();
      const { rows } = await db.query(
        `SELECT grantee, privilege_type
           FROM information_schema.role_table_grants
          WHERE table_schema = 'public'
            AND table_name = 'payment_intents'
            AND grantee = ANY($1::text[])`,
        [Object.keys(ALLOWED)]
      );
      grants = {};
      for (const key of Object.keys(ALLOWED)) grants[key] = [];
      for (const r of rows) grants[r.grantee].push(r.privilege_type);
      for (const key of Object.keys(grants)) grants[key].sort();
    });

    afterAll(async () => {
      await db.end();
    });

    it('the table exists and the query found it', () => {
      // Anti-vacuity. A renamed table, a wrong schema or a typo in either role name
      // yields empty arrays, and every assertion below would then pass by checking
      // nothing — which is the failure mode #897 itself is an instance of.
      expect(
        Object.values(grants).flat().length,
        'no grants found for anon or authenticated on public.payment_intents — the ' +
          'query is looking at the wrong table, schema, or role names, so the ' +
          'assertions below are inspecting an empty set'
      ).toBeGreaterThan(0);
    });

    for (const [role, allowed] of Object.entries(ALLOWED)) {
      it(`${role} holds exactly ${allowed.join(' + ') || 'nothing'}`, () => {
        expect(
          grants[role],
          `${role} privileges on payment_intents changed.\n` +
            '  WIDER: something re-granted a privilege that RLS already makes ' +
            'unusable — UPDATE and DELETE are USING (false), TRUNCATE is not exposed ' +
            "by PostgREST, and anon's INSERT can never satisfy " +
            'WITH CHECK (auth.uid() = template_user_id). A privilege that reads as a ' +
            'live capability and is not one is what #565 and #897 both removed.\n' +
            '  NARROWER: if INSERT is gone from authenticated, #559 T025 has landed — ' +
            'update ALLOWED here and check T027 off.'
        ).toEqual(allowed);
      });
    }

    it('UPDATE and DELETE are still refused by policy, not merely by grant', () => {
      // The grants above are defence in depth. The POLICIES are the actual control, and
      // a future migration that re-grants UPDATE must still find it unusable. Asserting
      // only the grant would let the real protection be deleted silently.
      return db
        .query(
          `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
             FROM pg_policy
            WHERE polrelid = 'public.payment_intents'::regclass
              AND polcmd IN ('w', 'd')`
        )
        .then(({ rows }) => {
          const byCmd = Object.fromEntries(
            rows.map((r) => [r.polcmd, r.using_expr])
          );
          expect(byCmd.w, 'no UPDATE policy on payment_intents').toBe('false');
          expect(byCmd.d, 'no DELETE policy on payment_intents').toBe('false');
        });
    });
  }
);
