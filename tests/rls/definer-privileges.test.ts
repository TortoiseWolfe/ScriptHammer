/**
 * Which SECURITY DEFINER functions can the anon key execute? (#1245)
 *
 * Read from the CATALOG, not the migration text: on Supabase the platform's default ACL grants
 * anon and authenticated EXECUTE by name, so a file full of `REVOKE … FROM PUBLIC` reads as
 * locked down while every function stays open — 21 of 22 were, on a fresh stack and on
 * production alike. `has_function_privilege` is the question Postgres actually asks, and it
 * accounts for PUBLIC, direct grants and role membership at once.
 *
 * Every callable definer anon can execute must be on the allowlist with a reason, and every
 * allowlisted one must still exist and still be open — so both a new open function and a stale
 * entry fail. Trigger functions are excluded: they cannot be called as RPCs.
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

/** Open to anon on purpose. Each entry says why, and which stage of #1245 changes it. */
const ANON_EXECUTABLE: Record<string, string> = {
  'check_rate_limit(text,text,inet)':
    'only tabs still running the pre-A2 bundle call it; a client gets a constant (#1245 A2), revoked in A4',
  'record_failed_attempt(text,text,inet)':
    'only tabs still running the pre-A2 bundle call it; a client writes nothing (#1245 A2), revoked in A4',
  'is_admin(uuid)':
    'an RLS policy helper that anon-reachable policies call; its body answers only about the caller',
  'is_conversation_member(uuid,uuid)':
    'an RLS policy helper; its body answers only about the caller',
  'is_conversation_owner(uuid,uuid)':
    'an RLS policy helper; its body answers only about the caller',
  'is_conversation_creator(uuid,uuid)':
    'no longer called by any policy since #1247 B1 (the founder helpers replaced it); dropped in B2 — its body answers only about the caller',
  'log_auth_event(text,uuid,jsonb,boolean,text,text)':
    'pre-session telemetry (failed sign-ins, reset requests); what anon may write is bounded in the body',
};

/** Must be closed to both client roles. */
const CLOSED_TO_CLIENTS = [
  'consume_rate_limit(text,text,inet)',
  'cleanup_old_audit_logs(integer,integer)',
  'custom_access_token_hook(jsonb)',
];

type Row = { fn: string; anon: boolean; authd: boolean };

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: SECURITY DEFINER execute privileges (#1245) [${RLS_SKIP_REASON}]`,
  () => {
    let db: Client;
    let rows: Row[] = [];

    beforeAll(async () => {
      db = new Client(DB);
      await db.connect();
      const res = await db.query<Row>(`
        -- The full signature, not the name: a new overload of an allowlisted name that answers
        -- about anyone would otherwise pass as the entry it shadows (#1245 review, measured).
        select p.oid::regprocedure::text as fn,
               has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
               has_function_privilege('authenticated', p.oid, 'EXECUTE') as authd
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
        order by p.proname`);
      rows = res.rows;
    });

    afterAll(async () => {
      await db?.end();
    });

    it('CONTROL: the query sees the definers, and reads both a closed one and an open one correctly', () => {
      // Without this, an empty result or a query that reads every privilege the same way would
      // satisfy both assertions below.
      expect(rows.length).toBeGreaterThanOrEqual(15);
      expect(
        rows.find((r) => r.fn === 'custom_access_token_hook(jsonb)')?.anon
      ).toBe(false);
      expect(rows.find((r) => r.fn === 'is_admin(uuid)')?.anon).toBe(true);
    });

    it('every definer anon can execute is on the allowlist, with a reason', () => {
      const open = rows.filter((r) => r.anon).map((r) => r.fn);
      const unexplained = open.filter((fn) => !(fn in ANON_EXECUTABLE));
      expect(
        unexplained,
        `anon can execute these, and nothing says why: ${unexplained.join(', ')}`
      ).toEqual([]);
    });

    it('every allowlist entry still exists and is still open — no stale reasons', () => {
      const openNow = new Set(rows.filter((r) => r.anon).map((r) => r.fn));
      const stale = Object.keys(ANON_EXECUTABLE).filter(
        (fn) => !openNow.has(fn)
      );
      expect(
        stale,
        `allowlisted but no longer anon-executable — remove them: ${stale.join(', ')}`
      ).toEqual([]);
    });

    it('each allowlisted name has exactly one SECURITY DEFINER overload — a second would be unreviewed', () => {
      const names = Object.keys(ANON_EXECUTABLE).map((sig) =>
        sig.slice(0, sig.indexOf('('))
      );
      const wrong = names.filter(
        (n) => rows.filter((r) => r.fn.startsWith(`${n}(`)).length !== 1
      );
      expect(wrong, `not exactly one overload: ${wrong.join(', ')}`).toEqual(
        []
      );
    });

    it('the server-only functions are closed to anon AND authenticated', () => {
      for (const fn of CLOSED_TO_CLIENTS) {
        const row = rows.find((r) => r.fn === fn);
        expect(row, `${fn} is missing from the catalog`).toBeDefined();
        expect({ fn, anon: row?.anon, authd: row?.authd }).toEqual({
          fn,
          anon: false,
          authd: false,
        });
      }
    });
  }
);
