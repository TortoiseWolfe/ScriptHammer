/**
 * Derive the intended security schema from the migration, instead of restating it.
 *
 * WHY THIS FILE EXISTS (#1038). `check-prod-schema-drift.mjs` has run daily since #903
 * and is well built — it queries production, compares against a declared intent, and
 * refuses to treat an empty observation as "no drift". It found nothing for months while
 * production carried a live privilege escalation, because its `INTENDED` map was written
 * by hand and contained ONE table: `payment_intents`. There are nineteen.
 *
 * The table that mattered was not in the list. Neither were `messages`, `conversations`,
 * `user_encryption_keys`, or fifteen others. The check was never wrong; it was answering a
 * much smaller question than its name implied, and a green result read as "production
 * matches the repo" when it meant "one table matches the repo".
 *
 * Widening the hand-written list would have bought a day. The list is a SECOND declaration
 * of intent that has to be kept in step with the migration by memory, and the hardening in
 * #1039 shows what happens when it is not: someone edits the migration, nobody edits the
 * list, and the check keeps asserting the OLD intent — which production still satisfies. It
 * reports green precisely when a security fix has failed to land, which is the worst
 * possible moment to be reassuring.
 *
 * So the intent is PARSED from the migration. The repo already does this where two lists
 * would drift: `e2e-local.yml`'s ignore list is derived from `e2e.yml` rather than copied,
 * for exactly this reason, and `color-contrast.spec.ts` enumerates routes rather than
 * listing them after a hand-written list of four let a failing page reach main (#411).
 *
 * WHAT IS AND IS NOT ASSERTED. Supabase's `pg_default_acl` grants `anon` and
 * `authenticated` every privilege on every table in `public`, so for most tables the live
 * grant set is the platform default and the migration says nothing about it. Asserting a
 * grant set there would be inventing an intent the file never expressed. So grants are
 * asserted ONLY for tables the migration explicitly REVOKEs from — where the file has taken
 * control and the expected set is exactly what it then GRANTs back. Everywhere else
 * `grants` is null, meaning "not asserted", and RLS and policies still are.
 *
 * That distinction is the difference between a check that is believed and one that is
 * muted: a check that fires on eighteen tables it has no opinion about gets switched off.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATION_PATH = path.join(
  HERE,
  '../../supabase/migrations/20251006_complete_monolithic_setup.sql'
);

/**
 * Strip `--` line comments.
 *
 * Load-bearing: this file's own prose names tables and policies, and several comments in
 * the migration quote the statements they warn against. A parser that reads its own
 * documentation as schema is the failure this repo has hit four times in one session.
 */
export function stripComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

/**
 * Is this object in `public`?
 *
 * The migration also creates policies on `storage.objects`, which the drift queries do not
 * cover — they scope to `public`. Counting those as declared-but-missing produced eight
 * phantom failures in the prototype for this change. An unqualified name is `public` by
 * convention throughout this file.
 */
function isPublic(qualified) {
  return !qualified.includes('.') || qualified.startsWith('public.');
}

/**
 * What Supabase's `pg_default_acl` already grants `anon` and `authenticated` on every table
 * in `public`. A partial REVOKE subtracts from THIS, not from an empty set — the role held
 * all seven before the migration said anything.
 */
const PLATFORM_DEFAULT_PRIVILEGES = [
  'DELETE',
  'INSERT',
  'REFERENCES',
  'SELECT',
  'TRIGGER',
  'TRUNCATE',
  'UPDATE',
];

const bare = (qualified) => qualified.replace(/^public\./, '').toLowerCase();

/** Roles named in a `TO a, b` clause; `[]` means the statement had none. */
function parseRoles(clause) {
  if (!clause) return [];
  return clause
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The text between a function's parentheses, scanning with a BALANCED counter.
 *
 * `\(([^)]*)\)` is wrong here and fails silently: a defaulted argument routinely contains
 * its own parentheses --
 *
 *   admin_audit_trends(p_start TIMESTAMPTZ DEFAULT (now() - interval '30 days'), ...)
 *
 * -- so a non-greedy match stops inside the DEFAULT and reports arity 1 for a 2-argument
 * function. Run live before this was fixed, that produced six confident findings: three
 * functions "declared but ABSENT from production" and three "live but NOT declared", all
 * six describing the same three functions the file and the database agree about.
 */
function argumentList(sql, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < sql.length; i++) {
    const c = sql[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return sql.slice(openParenIndex + 1, i);
    }
  }
  return null;
}

/** Count top-level commas, ignoring those nested inside a default expression. */
function countArgs(args) {
  const trimmed = args.trim();
  if (trimmed === '') return 0;
  let depth = 0;
  let n = 1;
  for (const c of trimmed) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) n++;
  }
  return n;
}

/**
 * Parse the migration into the shape `check-prod-schema-drift.mjs` compares against.
 *
 * Returns { tables: {name: {rls, policies:[{name, roles}], grants:{role:[priv]}|null}},
 *           functions: [{name, arity}] }
 */
export function deriveIntended(sql) {
  const S = stripComments(sql);
  const tables = {};

  const touch = (name) =>
    (tables[name] ??= { rls: false, policies: [], grants: null, revoked: [] });

  for (const m of S.matchAll(
    /CREATE TABLE(?: IF NOT EXISTS)?\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)/gi
  )) {
    if (isPublic(m[1])) touch(bare(m[1]));
  }

  for (const m of S.matchAll(
    /ALTER TABLE\s+(?:IF EXISTS\s+)?((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)\s+ENABLE ROW LEVEL SECURITY/gi
  )) {
    if (isPublic(m[1])) touch(bare(m[1])).rls = true;
  }

  // Policies. A DROP/CREATE pair per policy is the house style, so the CREATE is the
  // declaration; the last one for a given (table, name) wins.
  for (const m of S.matchAll(
    /CREATE POLICY\s+"([^"]+)"\s+ON\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)([\s\S]*?);/gi
  )) {
    const [, name, qualified, body] = m;
    if (!isPublic(qualified)) continue;
    const t = touch(bare(qualified));
    // `TO x` before the USING/WITH CHECK expression. No TO clause means PUBLIC, which
    // includes anon — the distinction that let unauthenticated callers read salts (#1039).
    const to = body.match(
      /\bTO\s+([a-z_][a-z0-9_, ]*?)\s+(?:USING|WITH CHECK)/i
    );
    const roles = to ? parseRoles(to[1]) : ['public'];
    const existing = t.policies.find((p) => p.name === name);
    if (existing) existing.roles = roles;
    else t.policies.push({ name, roles });
  }

  // REVOKE marks a table as one the file has taken control of. Only those get a grant
  // assertion; everywhere else the platform default is the live state and the file is silent.
  //
  // TWO FORMS, and only handling the first is a silent coverage LOSS rather than an error.
  // `payment_intents` -- the one table the hand-written list used to cover -- is narrowed by
  // partial revokes (`REVOKE UPDATE, DELETE, ... FROM authenticated`), not by REVOKE ALL. A
  // parser that only understood REVOKE ALL dropped it to "not asserted" and reported no
  // drift for it, which is precisely the regression this whole ticket is about.
  for (const m of S.matchAll(
    /REVOKE\s+(ALL(?:\s+PRIVILEGES)?|[A-Z][A-Z, ]*?)\s+ON\s+(?!FUNCTION\b)((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)\s+FROM\s+([^;]+);/gi
  )) {
    const [, privs, qualified, roleList] = m;
    if (!isPublic(qualified)) continue;
    const t = touch(bare(qualified));
    const isAll = /^ALL(\s+PRIVILEGES)?$/i.test(privs.trim());
    for (const r of parseRoles(roleList)) {
      if (r === 'public') continue;
      if (!t.revoked.includes(r)) t.revoked.push(r);
      t.grants ??= {};
      // REVOKE ALL clears the slate; a partial revoke subtracts from the platform default,
      // which is what the role actually holds until something says otherwise.
      const base = isAll
        ? []
        : (t.grants[r] ?? [...PLATFORM_DEFAULT_PRIVILEGES]).filter(
            (x) =>
              !privs
                .split(',')
                .map((y) => y.trim().toUpperCase())
                .includes(x)
          );
      t.grants[r] = base;
    }
  }

  // GRANTs that follow. Column-scoped grants (`GRANT SELECT (a, b) ON t TO r`) confer the
  // privilege on the table for the purpose of role_table_grants, so they count here; which
  // COLUMNS are withheld is a separate assertion the drift check makes directly.
  for (const m of S.matchAll(
    /GRANT\s+([A-Z, ]+?)(?:\s*\([^)]*\))?\s+ON\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)\s+TO\s+([^;]+);/gi
  )) {
    const [, privs, qualified, roleList] = m;
    if (!isPublic(qualified)) continue;
    const name = bare(qualified);
    const t = tables[name];
    if (!t || !t.grants) continue; // no REVOKE => the file expresses no grant intent
    for (const role of parseRoles(roleList)) {
      if (!(role in t.grants)) continue; // only roles the REVOKE named
      for (const p of privs.split(',').map((x) => x.trim().toUpperCase())) {
        if (p === 'ALL') {
          t.grants[role] = ['ALL'];
        } else if (
          !t.grants[role].includes(p) &&
          !t.grants[role].includes('ALL')
        ) {
          t.grants[role].push(p);
        }
      }
    }
  }

  const functions = [];
  const seen = new Set();
  for (const m of S.matchAll(
    /CREATE OR REPLACE FUNCTION\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)\s*\(/gi
  )) {
    if (!isPublic(m[1])) continue;
    const args = argumentList(S, m.index + m[0].length - 1);
    if (args === null) continue;
    const arity = countArgs(args);
    const key = `${bare(m[1])}/${arity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    functions.push({ name: bare(m[1]), arity });
  }

  for (const t of Object.values(tables)) {
    t.policies.sort((a, b) => a.name.localeCompare(b.name));
    for (const r of Object.keys(t.grants ?? {})) t.grants[r].sort();
    t.revoked.sort();
  }
  functions.sort((a, b) => a.name.localeCompare(b.name) || a.arity - b.arity);

  return { tables, functions };
}

/** Derive from the checked-in migration. */
export function loadIntended(file = MIGRATION_PATH) {
  return deriveIntended(readFileSync(file, 'utf8'));
}
