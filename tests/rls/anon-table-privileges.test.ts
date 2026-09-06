/**
 * The effective privileges the client roles hold on the ten tables of #1073.
 *
 * WHY THIS EXISTS. Supabase's platform defaults grant `anon` and `authenticated` ALL
 * privileges on every table in `public`. A narrower `GRANT` sits on top of a wider one and
 * changes nothing, so a migration can state the intended rule, read correctly to a human,
 * and have no effect on the database. Only a `REVOKE` takes control back.
 *
 * Ten tables were in that state. Every one of them could be emptied by any signed-in user,
 * and eight by `anon`, because **RLS does not gate TRUNCATE** — there is no row to test, so
 * no policy is consulted. Two of them carried policies literally named
 * `Orders cannot be deleted by users` and `Payment results are immutable`, both with a real
 * `USING (false)`. Both were true. Neither was reachable by the statement that mattered.
 *
 * WHY IT ASSERTS THE DATABASE AND NOT THE FILE. Reading the file is what hid this for
 * months — same reasoning as `payment-intents-grants.test.ts` (#897), which this follows.
 *
 * WHY IT COVERS ALL TEN AT ONCE. The per-table RLS suites could not see the destructive
 * privileges at all: handing `DELETE` back to `authenticated` on `subscriptions` left all
 * 118 tests green, because nothing exercised `DELETE` or `TRUNCATE` there. Each fix was
 * real and undefended. This is the guard that fails when one is undone.
 *
 * WHAT IT CANNOT DO. This suite runs against the LOCAL stack, so it pins what a FRESH
 * database gets from the migration. It cannot see production drift — that needs a scheduled
 * probe against the hosted project. A green run here must not be read as "production is
 * fine"; production is where all ten holes actually were.
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
 * What `authenticated` may hold on each table, and why.
 *
 * `anon` holds NOTHING on all ten — asserted separately below, because it is the headline
 * and deserves to fail on its own terms rather than inside a per-table diff.
 *
 * The rule for what stays is the one the `conversation_keys` block in the migration states:
 * the narrowest grant that keeps the DECLARED POLICY SURFACE reachable, not the narrowest
 * that keeps today's code working. Several of these tables have no client query at all.
 */
const ALLOWED: Record<string, string[]> = {
  // A SECURITY INVOKER admin RPC reads this as the caller, so SELECT must stay.
  rate_limit_attempts: ['SELECT'],
  // `getUserAuditLogs` uses select('*'), so a column list would name every column and
  // make a later column silently invisible. Table-wide SELECT is the honest choice.
  auth_audit_logs: ['SELECT'],
  conversation_keys: ['INSERT', 'SELECT'],
  // Table-wide UPDATE is deliberately ABSENT — replaced by a column grant, checked below.
  messages: ['INSERT', 'SELECT'],
  group_keys: ['INSERT', 'SELECT'],
  // No SELECT policy exists at all; the writers are edge functions holding the service
  // role key. The only table here where neither client role keeps anything.
  webhook_events: [],
  orders: ['SELECT'],
  payment_results: ['SELECT'],
  // Table-wide UPDATE is deliberately ABSENT — narrowed to three columns by #1089,
  // checked below. It used to be table-wide, which let a row owner rewrite plan_amount
  // and current_period_end as well as cancel.
  subscriptions: ['INSERT', 'SELECT'],
  // Three user-scoped policies; the DELETE policy says `TO service_role`. The migration
  // previously said GRANT ALL, which handed users a DELETE the policy set withholds.
  typing_indicators: ['INSERT', 'SELECT', 'UPDATE'],
};

const TABLES = Object.keys(ALLOWED);

/** Privileges that must be held by NEITHER client role, on EVERY table above. */
const NEVER = ['TRUNCATE', 'DELETE', 'TRIGGER', 'REFERENCES'];

describe.skipIf(!hasRlsTestEnvironment())(
  `client-role privileges on the #1073 tables ${RLS_SKIP_REASON}`,
  () => {
    let db: Client;
    /** table -> role -> sorted privileges */
    let grants: Record<string, Record<string, string[]>>;
    let existing: string[];

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();

      const present = await db.query(
        `SELECT c.relname
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
        [TABLES]
      );
      existing = present.rows.map((r) => r.relname).sort();

      const { rows } = await db.query(
        `SELECT table_name, grantee, privilege_type
           FROM information_schema.role_table_grants
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
            AND grantee = ANY(ARRAY['anon','authenticated'])`,
        [TABLES]
      );
      grants = {};
      for (const t of TABLES) grants[t] = { anon: [], authenticated: [] };
      for (const r of rows)
        grants[r.table_name][r.grantee].push(r.privilege_type);
      for (const t of TABLES)
        for (const role of Object.keys(grants[t])) grants[t][role].sort();
    });

    afterAll(async () => {
      await db.end();
    });

    it('every table under test actually exists', () => {
      // ANTI-VACUITY, and it is not decoration here. Six of the twenty role/table pairs
      // below expect an EMPTY privilege list, and a renamed table, a wrong schema or a
      // typo in a table name produces exactly that — so without this check those
      // assertions would pass by inspecting nothing. That failure mode is the same
      // species as the bug this file guards.
      expect(
        existing,
        'a table named in ALLOWED is missing from public — the assertions below would ' +
          'then be checking an empty result set rather than a narrow grant'
      ).toEqual([...TABLES].sort());
    });

    it('the grants query found something, so an empty result means revoked', () => {
      // Counterweight to the above: proves the query itself works. If this returned
      // nothing, every "holds nothing" assertion would be vacuously true.
      const total = TABLES.flatMap((t) => grants[t].authenticated).length;
      expect(
        total,
        'no client-role grants found on ANY of the ten tables — the query is wrong, ' +
          'not the database'
      ).toBeGreaterThan(0);
    });

    it('anon holds nothing on any of the ten', () => {
      // The headline. Eight of these tables could be emptied by a visitor with no
      // account at all, because a TRUNCATE consults no policy.
      const held = TABLES.filter((t) => grants[t].anon.length > 0).map(
        (t) => `${t}: ${grants[t].anon.join(',')}`
      );
      expect(
        held,
        'anon regained privileges. A GRANT cannot narrow — if a new GRANT was added ' +
          'for another role on one of these tables, check it did not re-widen anon, ' +
          'and remember Supabase grants anon everything on a NEW table by default (#1073).'
      ).toEqual([]);
    });

    for (const table of TABLES) {
      it(`authenticated holds exactly ${ALLOWED[table].join(' + ') || 'nothing'} on ${table}`, () => {
        expect(
          grants[table].authenticated,
          `authenticated privileges on ${table} changed.\n` +
            '  WIDER: a privilege came back. Check whether a new GRANT was added, or ' +
            'whether the REVOKE was moved somewhere it no longer runs on a fresh ' +
            'initdb — it is a silent no-op on an existing database, so a local test ' +
            'against a stale volume will not notice.\n' +
            '  NARROWER: if a call site was removed and the privilege is genuinely ' +
            'unused, update ALLOWED here and say so in the migration comment.'
        ).toEqual(ALLOWED[table]);
      });
    }

    it('neither client role holds TRUNCATE, DELETE, TRIGGER or REFERENCES anywhere', () => {
      // Stated separately from the per-table lists because TRUNCATE is the whole point:
      // it is the one privilege RLS does not gate, it is not exposed by PostgREST (so no
      // API-level test can reach it), and it is what made every one of these tables
      // destructible regardless of how correct its policies were.
      const offenders: string[] = [];
      for (const table of TABLES)
        for (const role of ['anon', 'authenticated'])
          for (const priv of NEVER)
            if (grants[table][role].includes(priv))
              offenders.push(`${role} holds ${priv} on ${table}`);
      expect(
        offenders,
        'a destructive privilege is back. TRUNCATE in particular is invisible to every ' +
          'other test in this suite: PostgREST does not expose it, so nothing but this ' +
          'assertion can see it.'
      ).toEqual([]);
    });

    it('messages keeps a COLUMN-scoped UPDATE rather than a table-wide one', async () => {
      // The one table where a table grant was the wrong instrument: users may edit some
      // fields of their own message and not others. A column grant is checked before any
      // policy or trigger runs, which makes it stronger than either. Asserting only the
      // absence of table-wide UPDATE would let the replacement be deleted silently.
      const { rows } = await db.query(
        `SELECT column_name
           FROM information_schema.column_privileges
          WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND grantee = 'authenticated'
            AND privilege_type = 'UPDATE'
          ORDER BY column_name`
      );
      const columns = rows.map((r) => r.column_name);
      expect(
        columns.length,
        'authenticated has no column-level UPDATE on messages — editing, delivery and ' +
          'read receipts are all broken, or the column grant was replaced by a table ' +
          'grant (which would also restore write access to sender_id).'
      ).toBeGreaterThan(0);
      expect(columns).toEqual([
        'deleted',
        'delivered_at',
        'edited',
        'edited_at',
        'encrypted_content',
        'initialization_vector',
        'key_version',
        'read_at',
      ]);
    });

    it('subscriptions keeps a COLUMN-scoped UPDATE covering only the cancellation surface', async () => {
      // #1089. A table-wide UPDATE here let a row owner rewrite their own plan_amount,
      // current_period_end, next_billing_date, grace_period_expires and the dunning
      // counters — the policy is USING (auth.uid() = template_user_id) with no column
      // scoping, so it gates rows and not columns.
      //
      // The three columns below are the cancellation surface, which is what the tested
      // capability actually needs ("user can UPDATE own subscription" sets
      // status='canceled'). Asserting only that table-wide UPDATE is gone would let the
      // replacement be widened one column at a time without any test noticing.
      //
      // This does NOT close the status flip itself — a row owner can still set
      // status='active' — nor the INSERT path. Both stay on #1089; they need a
      // predicate, which is a trigger's job, not a privilege's.
      const { rows } = await db.query(
        `SELECT column_name
           FROM information_schema.column_privileges
          WHERE table_schema = 'public'
            AND table_name = 'subscriptions'
            AND grantee = 'authenticated'
            AND privilege_type = 'UPDATE'
          ORDER BY column_name`
      );
      const columns = rows.map((r) => r.column_name);
      expect(
        columns.length,
        'authenticated has no column-level UPDATE on subscriptions — cancelling is ' +
          'broken, or the column grant was replaced by a table grant (which would also ' +
          'restore write access to plan_amount and current_period_end).'
      ).toBeGreaterThan(0);
      expect(columns).toEqual(['canceled_at', 'cancellation_reason', 'status']);
    });
  }
);
