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
 * Blank out `--` line comments, PRESERVING LENGTH.
 *
 * Load-bearing: this file's own prose names tables and policies, and several comments in
 * the migration quote the statements they warn against. A parser that reads its own
 * documentation as schema is the failure this repo has hit four times in one session.
 *
 * LENGTH IS PART OF THE CONTRACT. Comments are replaced with spaces rather than removed so
 * that an index into the masked text is also a valid index into the RAW text. Function
 * bodies are extracted from the raw string at indices found in the masked one, because
 * `prosrc` stores a body byte-for-byte — including the `--` comments inside it. Deleting
 * those before comparing would make every commented function look like drift.
 */
export function stripComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
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

/**
 * Split a GRANT's privilege clause into its items.
 *
 * `GRANT SELECT (a, b), UPDATE ON t TO r` is two items: SELECT scoped to columns a and b,
 * and UPDATE held on the whole table. Postgres attaches a column list to the privilege it
 * follows, not to the statement, so this splits on TOP-LEVEL commas only -- the commas
 * inside `(a, b)` separate columns, not privileges, and treating them alike turns one
 * column-scoped grant into several nonexistent privileges.
 */
export function parseGrantClause(clause) {
  const items = [];
  let depth = 0;
  let cur = '';
  for (const ch of clause) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      items.push(cur);
      cur = '';
    } else cur += ch;
  }
  items.push(cur);
  return items
    .map((raw) => {
      const t = raw.trim();
      if (!t) return null;
      const open = t.indexOf('(');
      const priv = (open === -1 ? t : t.slice(0, open))
        .trim()
        .toUpperCase()
        .replace(/\s+PRIVILEGES$/, '');
      const columns =
        open === -1
          ? null
          : t
              .slice(open + 1, t.lastIndexOf(')'))
              .split(',')
              .map((c) => c.trim().toLowerCase())
              .filter(Boolean)
              .sort();
      return { priv, columns };
    })
    .filter(Boolean);
}

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
 * The dollar-quoted body of a function, taken from the RAW sql, plus the modifiers that
 * decide what the body is allowed to do.
 *
 * The body is read from `raw` at indices located in the MASKED text. `prosrc` stores what
 * was written between the dollar quotes byte-for-byte, `--` comments included, so a body
 * read from the comment-stripped copy differs from production for every commented function
 * -- twelve of them here. That is why `stripComments` preserves length.
 */
function readFunctionBody(raw, masked, from) {
  const open = /\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(masked.slice(from));
  if (!open) return { body: null, securityDefiner: false, config: [] };
  const openAt = from + open.index;
  const tag = open[0];
  const closeAt = masked.indexOf(tag, openAt + tag.length);
  if (closeAt === -1) return { body: null, securityDefiner: false, config: [] };

  // Everything between the argument list and `AS $$` -- LANGUAGE, volatility, SECURITY,
  // and any SET. Read from the masked copy: this region is heavily commented.
  const header = masked.slice(from, openAt);
  const config = [
    ...header.matchAll(
      /\bSET\s+([a-z_][a-z0-9_]*)\s*=\s*([^\n]+?)(?=\s*(?:AS|LANGUAGE|SECURITY|STABLE|VOLATILE|IMMUTABLE|SET)\b|\s*$)/gi
    ),
  ]
    .map((c) => `${c[1].toLowerCase()}=${c[2].trim().replace(/\s+/g, ' ')}`)
    .sort();

  return {
    body: raw.slice(openAt + tag.length, closeAt),
    securityDefiner: /\bSECURITY\s+DEFINER\b/i.test(header),
    config,
  };
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
    (tables[name] ??= {
      rls: false,
      policies: [],
      grants: null,
      tableGrants: null,
      columnGrants: null,
      revoked: [],
      triggers: [],
    });

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
    // FOR <cmd>, and its absence. No FOR clause means ALL, which is four commands rather
    // than one: flipping `FOR SELECT` to `FOR ALL` hands the role a DELETE path while the
    // name, the roles and the predicate all stay byte-identical.
    const forClause = body.match(
      /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i
    );
    const cmd = forClause ? forClause[1].toUpperCase() : 'ALL';
    // PERMISSIVE is the default. A RESTRICTIVE policy is ANDed with the permissive ones
    // instead of ORed, so the same expression means the opposite thing about access.
    const permissive = !/\bAS\s+RESTRICTIVE\b/i.test(body);
    const existing = t.policies.find((p) => p.name === name);
    if (existing) Object.assign(existing, { roles, cmd, permissive });
    else t.policies.push({ name, roles, cmd, permissive });
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
      t.tableGrants ??= {};
      t.columnGrants ??= {};
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
      // What survives a partial REVOKE is held table-wide -- the platform default is a
      // table-level grant, never a column-scoped one.
      t.tableGrants[r] = [...base];
      t.columnGrants[r] ??= {};
    }
  }

  // GRANTs that follow.
  //
  // A COLUMN LIST IS THE WHOLE POINT AND USED TO BE DISCARDED. The previous regex ended in
  // `(?:\s*\([^)]*\))?`, which threw the columns away, so `GRANT UPDATE (status) ON
  // user_connections TO authenticated` and `GRANT UPDATE ON user_connections TO
  // authenticated` produced byte-identical intent. The first is #1059's fix -- the column
  // grant is the instrument that stops a group owner rewriting `user_id` -- and the second
  // undoes it. The gate could not tell them apart.
  //
  // Three facts about how Postgres reports these, all measured on production:
  //   * `role_table_grants` shows TABLE-level grants only. `user_profiles` has none, so
  //     that view reports the table as holding NOTHING.
  //   * `column_privileges` shows column-level grants AND expands a table-level grant to
  //     every column. So a privilege appearing there says nothing on its own about which
  //     of the two it came from -- the pair has to be read together.
  //   * DELETE, TRUNCATE and TRIGGER are not column-grantable and never appear there.
  // Hence the two are recorded separately here and compared separately in the checker.
  const PRIV =
    '(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|MAINTAIN|ALL(?:\\s+PRIVILEGES)?)';
  const GRANT_RE = new RegExp(
    `GRANT\\s+(${PRIV}(?:\\s*\\([^)]*\\))?(?:\\s*,\\s*${PRIV}(?:\\s*\\([^)]*\\))?)*)` +
      `\\s+ON\\s+((?:[a-z_][a-z0-9_]*\\.)?[a-z_][a-z0-9_]*)\\s+TO\\s+([^;]+);`,
    'gi'
  );
  for (const m of S.matchAll(GRANT_RE)) {
    const [, clause, qualified, roleList] = m;
    if (!isPublic(qualified)) continue;
    const name = bare(qualified);
    const t = tables[name];
    if (!t || !t.grants) continue; // no REVOKE => the file expresses no grant intent
    for (const role of parseRoles(roleList)) {
      if (!(role in t.grants)) continue; // only roles the REVOKE named
      t.tableGrants[role] ??= [];
      t.columnGrants[role] ??= {};
      for (const { priv, columns } of parseGrantClause(clause)) {
        if (priv === 'ALL') {
          t.grants[role] = ['ALL'];
          t.tableGrants[role] = ['ALL'];
          t.columnGrants[role] = {};
          continue;
        }
        if (!t.grants[role].includes(priv) && !t.grants[role].includes('ALL'))
          t.grants[role].push(priv);
        if (columns) {
          const set = (t.columnGrants[role][priv] ??= []);
          for (const c of columns) if (!set.includes(c)) set.push(c);
        } else if (!t.tableGrants[role].includes(priv)) {
          t.tableGrants[role].push(priv);
        }
      }
    }
  }

  // Triggers, by name per table. Seven are live on production and NOTHING asserted them --
  // `pg_trigger` appeared zero times in either script. `before_message_update_column_guard`
  // is #281's fix for OR-combined UPDATE policies gating rows rather than columns, so its
  // silent absence would reopen that hole with every policy still reading correctly.
  for (const m of S.matchAll(
    /CREATE TRIGGER\s+([a-z_][a-z0-9_]*)[\s\S]*?\sON\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)/gi
  )) {
    if (!isPublic(m[2])) continue;
    const t = touch(bare(m[2]));
    if (!t.triggers.includes(m[1].toLowerCase()))
      t.triggers.push(m[1].toLowerCase());
  }

  // Functions, WITH THEIR BODIES.
  //
  // Comparing name and arity alone is the largest hole in this gate: 22 of the 26 public
  // functions are SECURITY DEFINER, and every predicate worth anything delegates to four of
  // them. `is_conversation_member` could be rewritten to `SELECT true` on production and all
  // 83 policy expressions would still match their declarations, because the policies name
  // the function rather than inlining what it does.
  //
  // The body is compared as TEXT, not a hash -- when this fires, the diff is the entire
  // value of the finding, and `md5 differs` sends the reader back to the database to find
  // out what changed.
  //
  // `prosecdef` and `proconfig` travel with it. Dropping `SET search_path = public` from a
  // SECURITY DEFINER function is a privilege-escalation primitive that leaves the body
  // byte-identical, so the body alone would report nothing.
  //
  // LAST DECLARATION WINS, matching the DROP/CREATE house style used for policies: a
  // function redefined later in the file is redefined, not overloaded.
  const byKey = new Map();
  for (const m of S.matchAll(
    /CREATE OR REPLACE FUNCTION\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)\s*\(/gi
  )) {
    if (!isPublic(m[1])) continue;
    const openParen = m.index + m[0].length - 1;
    const args = argumentList(S, openParen);
    if (args === null) continue;
    const arity = countArgs(args);
    const afterArgs = openParen + args.length + 2;
    byKey.set(`${bare(m[1])}/${arity}`, {
      name: bare(m[1]),
      arity,
      ...readFunctionBody(sql, S, afterArgs),
    });
  }
  const functions = [...byKey.values()];

  for (const t of Object.values(tables)) {
    t.policies.sort((a, b) => a.name.localeCompare(b.name));
    for (const r of Object.keys(t.grants ?? {})) t.grants[r].sort();
    for (const r of Object.keys(t.tableGrants ?? {})) t.tableGrants[r].sort();
    for (const r of Object.keys(t.columnGrants ?? {}))
      for (const p of Object.keys(t.columnGrants[r]))
        t.columnGrants[r][p].sort();
    t.revoked.sort();
    t.triggers.sort();
  }
  functions.sort((a, b) => a.name.localeCompare(b.name) || a.arity - b.arity);

  return { tables, functions };
}

/** Derive from the checked-in migration. */
export function loadIntended(file = MIGRATION_PATH) {
  return deriveIntended(readFileSync(file, 'utf8'));
}
