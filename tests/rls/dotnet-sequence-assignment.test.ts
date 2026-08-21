/**
 * C13 — message sequence assignment must survive the clean-room database (#265).
 *
 * WHAT WAS WRONG. The .NET backend owned no schema. `ConversationsController.cs`
 * inserts `sequence_number = 0` and depended on Supabase's `assign_sequence_number`
 * BEFORE-INSERT trigger to overwrite it. That holds only while both backends share one
 * Postgres. On the clean-room database #265 targets, the trigger is absent, every insert
 * lands 0, and the SECOND message in a conversation violates `unique_sequence`.
 *
 * WHY THIS TEST IS SHAPED THIS WAY. CI runs the .NET server against `supabase-db`
 * (`conformance.yml`), where the trigger always exists — so the defect is invisible to
 * every existing suite, and a fix could not be shown to fix anything. This builds a
 * scratch schema with NO trigger and demonstrates the failure first. Case 1 is a
 * negative control: if it ever stops raising 23505, this file has stopped testing its
 * subject and says so rather than going quietly green.
 *
 * The concurrency case is not decoration. A naive `MAX+1` passes the sequential case and
 * reintroduces #244 — two overlapping inserts read the same MAX and the loser is dropped.
 * Only the advisory lock makes the second insert block rather than collide.
 *
 * @module tests/rls/dotnet-sequence-assignment.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hasRlsTestEnvironment, RLS_SKIP_REASON } from '../fixtures/test-users';

const ROOT = path.resolve(__dirname, '..', '..');
const PORTED_SQL = path.join(
  ROOT,
  'dotnet-messaging/db/c13-sequence-assignment.sql'
);
const CANONICAL_SQL = path.join(
  ROOT,
  'supabase/migrations/20251006_complete_monolithic_setup.sql'
);

// Schema DDL needs an owner, not the least-privilege `dotnet_app` role (#321).
const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

const SCHEMA = 'c13_cleanroom';
const CONV = '11111111-2222-3333-4444-555555555555';

/**
 * The trigger + function as the .NET side ships them, aimed at the scratch schema.
 *
 * ONE substitution, not three. The artifact is deliberately written unqualified so that
 * whoever provisions a clean-room database applies it into their own schema via
 * `search_path` — so the test applies it the same way (see `beforeAll`) instead of
 * rewriting its SQL. An earlier version rewrote `ON messages` and `FROM messages` with
 * regexes but left `CREATE OR REPLACE FUNCTION assign_sequence_number()` unqualified,
 * which under the default `search_path` aimed it at **public** — i.e. at the live
 * `supabase-db` this suite runs against. It survived only because a multi-statement
 * simple query is one implicit transaction and a later statement happened to fail.
 *
 * The function's own `SET search_path` is the one thing session state cannot retarget:
 * it is baked into the definition and governs where the body's `FROM messages` resolves
 * at trigger time.
 */
function portedSql(): string {
  const src = readFileSync(PORTED_SQL, 'utf8');
  const pinned = /SET search_path = public/g;
  if (!pinned.test(src)) {
    throw new Error(
      'the ported artifact no longer pins `SET search_path = public` on the function — ' +
        'this test can no longer aim it at a scratch schema, and would silently run ' +
        'against public instead'
    );
  }
  return src.replace(pinned, `SET search_path = ${SCHEMA}`);
}

/** Identity of `public.assign_sequence_number`, or null on a database without it. */
async function publicCopy(c: Client): Promise<string | null> {
  const { rows } = await c.query(
    `SELECT p.prosrc || '|' || COALESCE(p.proconfig::text, '') AS ident
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'assign_sequence_number'`
  );
  return rows.length ? (rows[0].ident as string) : null;
}

async function connect(): Promise<Client> {
  const c = new Client(DB);
  await c.connect();
  return c;
}

/** Insert exactly as the controller does: sequence_number hardcoded to 0. */
const INSERT = `INSERT INTO ${SCHEMA}.messages
    (id, conversation_id, sequence_number) VALUES (gen_random_uuid(), $1, 0)`;

describe.skipIf(!hasRlsTestEnvironment())(
  `C13 sequence assignment on a clean-room database (#265) ${RLS_SKIP_REASON}`,
  () => {
    let db: Client;
    let publicBefore: string | null = null;

    beforeAll(async () => {
      db = await connect();
      publicBefore = await publicCopy(db);
      await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      await db.query(`CREATE SCHEMA ${SCHEMA}`);
      // Apply the artifact the way a provisioner does — by pointing `search_path` at the
      // target schema — rather than by rewriting its SQL. This is what keeps the
      // unqualified CREATE/DROP statements off `public`.
      await db.query(`SET search_path TO ${SCHEMA}`);
      // The two columns the rule actually turns on, plus the constraint it exists to
      // satisfy. Deliberately NOT the full messages table — a faithful subset makes the
      // failure unambiguous.
      await db.query(`
        CREATE TABLE ${SCHEMA}.messages (
          id uuid PRIMARY KEY,
          conversation_id uuid NOT NULL,
          sequence_number bigint NOT NULL,
          CONSTRAINT unique_sequence UNIQUE (conversation_id, sequence_number)
        )`);
    });

    afterAll(async () => {
      await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      await db.end();
    });

    it('WITHOUT the ported trigger, the second message collides — the defect', async () => {
      await db.query(INSERT, [CONV]);

      let code: string | undefined;
      try {
        await db.query(INSERT, [CONV]);
      } catch (err) {
        code = (err as { code?: string }).code;
      }

      // 23505 = unique_violation. This is the negative control: if it ever stops
      // raising, the scratch schema is no longer reproducing the clean-room condition
      // and every assertion below is measuring nothing.
      expect(
        code,
        'expected the second insert at sequence_number=0 to violate unique_sequence — ' +
          'without that, this file is not reproducing the clean-room database'
      ).toBe('23505');

      await db.query(`DELETE FROM ${SCHEMA}.messages`);
    });

    it('WITH the ported trigger, sequences are assigned 1, 2, 3', async () => {
      await db.query(portedSql());

      await db.query(INSERT, [CONV]);
      await db.query(INSERT, [CONV]);
      await db.query(INSERT, [CONV]);

      const { rows } = await db.query(
        `SELECT sequence_number FROM ${SCHEMA}.messages
          WHERE conversation_id = $1 ORDER BY sequence_number`,
        [CONV]
      );
      expect(rows.map((r) => Number(r.sequence_number))).toEqual([1, 2, 3]);

      await db.query(`DELETE FROM ${SCHEMA}.messages`);
    });

    it('applying the artifact lands in the target schema and leaves public alone', async () => {
      // THIS IS NOT HOUSEKEEPING. The first version of this file aimed
      // `CREATE OR REPLACE FUNCTION assign_sequence_number()` at public — the live
      // `supabase-db` these tests run against — while rewriting the body to read from a
      // scratch schema it then dropped in `afterAll`. Had it committed, the real
      // messaging trigger would have been left pointing at a schema that no longer
      // exists. It did not commit only because an unrelated statement later in the file
      // failed and rolled the implicit transaction back.
      //
      // So both halves are asserted: the artifact reached where it was aimed, AND it
      // did not reach anywhere else.
      const { rows } = await db.query(
        `SELECT to_regprocedure('${SCHEMA}.assign_sequence_number()') IS NOT NULL AS fn,
                EXISTS (
                  SELECT 1 FROM pg_trigger t
                   WHERE t.tgname = 'before_message_insert'
                     AND t.tgrelid = '${SCHEMA}.messages'::regclass
                ) AS trg`
      );
      // Damage first, aim second: this is the assertion whose failure means a shared
      // database has been altered, so it must be the one that reports.
      expect(
        await publicCopy(db),
        'applying the .NET artifact modified public.assign_sequence_number — it was ' +
          'aimed at the shared database instead of the scratch schema'
      ).toBe(publicBefore);

      expect(
        rows[0].fn,
        'the function did not land in the scratch schema'
      ).toBe(true);
      expect(rows[0].trg, 'the trigger did not land on the scratch table').toBe(
        true
      );
    });

    it('serialises concurrent inserts instead of dropping one (#244)', async () => {
      const a = await connect();
      const b = await connect();
      try {
        await a.query('BEGIN');
        await b.query('BEGIN');

        // A takes the per-conversation advisory lock and holds it, uncommitted.
        await a.query(INSERT, [CONV]);

        // B must BLOCK on that lock rather than read the same MAX and collide. Start it
        // without awaiting, commit A, then await B: a naive MAX+1 fails here with 23505
        // while passing the sequential case above.
        const bInsert = b.query(INSERT, [CONV]);
        await a.query('COMMIT');
        await bInsert;
        await b.query('COMMIT');

        const { rows } = await db.query(
          `SELECT sequence_number FROM ${SCHEMA}.messages
            WHERE conversation_id = $1 ORDER BY sequence_number`,
          [CONV]
        );
        expect(
          rows.map((r) => Number(r.sequence_number)),
          'both concurrent inserts must survive with distinct sequences'
        ).toEqual([1, 2]);
      } finally {
        await a.end();
        await b.end();
        await db.query(`DELETE FROM ${SCHEMA}.messages`);
      }
    });

    it('the .NET copy has not drifted from the Supabase original', () => {
      // Two files now define one rule. Without this, a change to either side diverges
      // silently and the backends disagree about sequencing — which is precisely the
      // class of bug the provider seam exists to prevent.
      const grab = (src: string): string => {
        const start = src.indexOf(
          'CREATE OR REPLACE FUNCTION assign_sequence_number()'
        );
        const end = src.indexOf('$$;', start) + 3;
        expect(
          start,
          'assign_sequence_number not found in source'
        ).toBeGreaterThan(-1);
        return src.slice(start, end).replace(/\s+/g, ' ').trim();
      };

      const ported = grab(readFileSync(PORTED_SQL, 'utf8'));
      const canonical = grab(readFileSync(CANONICAL_SQL, 'utf8'));

      expect(
        ported.length,
        'the extracted function body looks empty'
      ).toBeGreaterThan(200);
      expect(ported).toBe(canonical);
    });
  }
);
