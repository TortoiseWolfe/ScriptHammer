/**
 * Every table the migration creates in `public` must enable RLS, and no policy
 * may grant SELECT to an unauthenticated caller by omission.
 *
 * #1039. On Supabase, saying NOTHING about a table in `public` is not neutral.
 * `pg_default_acl` has already granted `anon` and `authenticated` arwdDxtm on
 * every table in the schema, and PostgREST exposes the schema over HTTP. So a
 * table with no RLS and no REVOKE is world-readable and world-writable the moment
 * it is created -- the grant is the default, and RLS is the only thing normally
 * standing behind it.
 *
 * `edge_idempotency_keys` was created that way and stayed that way. It was the
 * only one of 19 public tables with `relrowsecurity = false`, its own comment
 * said "not client-facing", and an anonymous caller with the publishable key
 * could read, overwrite and delete the payment idempotency cache. Nothing in the
 * repo could see it: the daily production drift check covered one table, and it
 * was a different one.
 *
 * This is a SOURCE check, not a production check. It runs on every PR with no
 * credentials, and it fails for a fork exactly as it fails here -- which matters,
 * because a fork inherits the defect and has no way to learn about it otherwise.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION = path.join(
  __dirname,
  '../../supabase/migrations/20251006_complete_monolithic_setup.sql'
);

/** Strip `--` line comments so the guard cannot match its own prose. */
function stripComments(sql) {
  return sql
    .split('\n')
    .map((l) => {
      const i = l.indexOf('--');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');
}

const SQL = stripComments(fs.readFileSync(MIGRATION, 'utf8'));

/** Tables CREATEd in public (the migration omits the schema qualifier). */
function createdTables(sql) {
  const out = new Set();
  const re =
    /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  for (const m of sql.matchAll(re)) out.add(m[1].toLowerCase());
  return out;
}

/** Tables given `ENABLE ROW LEVEL SECURITY`. */
function rlsEnabled(sql) {
  const out = new Set();
  const re =
    /ALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+ENABLE ROW LEVEL SECURITY/gi;
  for (const m of sql.matchAll(re)) out.add(m[1].toLowerCase());
  return out;
}

test('the parsers see the schema they are about', () => {
  // Anti-vacuity: a regex that silently matches nothing would make every
  // assertion below pass over an empty set.
  const tables = createdTables(SQL);
  const rls = rlsEnabled(SQL);
  assert.ok(
    tables.size >= 15,
    `parsed only ${tables.size} CREATE TABLE statements`
  );
  assert.ok(
    rls.size >= 15,
    `parsed only ${rls.size} ENABLE ROW LEVEL SECURITY statements`
  );
  assert.ok(tables.has('user_profiles'), 'parser missed user_profiles');
  assert.ok(
    tables.has('edge_idempotency_keys'),
    'parser missed edge_idempotency_keys'
  );
});

test('every table created in public enables row level security', () => {
  const tables = [...createdTables(SQL)];
  const rls = rlsEnabled(SQL);
  const naked = tables.filter((t) => !rls.has(t)).sort();

  assert.deepStrictEqual(
    naked,
    [],
    `these tables are created in public with no ENABLE ROW LEVEL SECURITY:\n  ` +
      naked.join('\n  ') +
      `\n\nOn Supabase that is not "no policy yet" -- pg_default_acl already grants ` +
      `anon and authenticated every privilege on every table in public, and PostgREST ` +
      `serves the schema. Without RLS the table is world-readable and world-writable ` +
      `to anyone holding the publishable key (#1039). Enable RLS, and REVOKE from ` +
      `anon/authenticated if no client role should reach it at all.`
  );
});

test('no SELECT policy is open to unauthenticated callers by omission', () => {
  // `FOR SELECT USING (true)` with no TO clause applies to PUBLIC, which includes
  // anon. That is how every user's Argon2 salt was readable without signing in.
  const re =
    /CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)([\s\S]*?);/gi;
  const offenders = [];
  for (const m of SQL.matchAll(re)) {
    const [, name, table, body] = m;
    if (!/FOR\s+SELECT/i.test(body)) continue;
    if (!/USING\s*\(\s*true\s*\)/i.test(body)) continue;
    if (/\bTO\s+(authenticated|service_role)/i.test(body)) continue;
    offenders.push(`${table}: "${name}"`);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `these SELECT policies are USING (true) with no TO clause, so they apply to ` +
      `PUBLIC -- which includes anon, i.e. anyone holding the publishable key:\n  ` +
      offenders.join('\n  ') +
      `\nAdd \`TO authenticated\` unless the data is genuinely public (#1039).`
  );
});

test('the two tables this ticket is about are locked down specifically', () => {
  assert.match(
    SQL,
    /REVOKE ALL ON edge_idempotency_keys FROM anon, authenticated;/,
    'edge_idempotency_keys must REVOKE the platform default; RLS alone leaves the grant'
  );
  assert.match(
    SQL,
    /REVOKE ALL ON user_encryption_keys FROM anon;/,
    'user_encryption_keys must REVOKE anon; a narrower GRANT does not undo a wider default'
  );
});

test('the detectors can actually fail (control)', () => {
  const nakedTable = `CREATE TABLE IF NOT EXISTS lonely_table (id UUID);`;
  assert.ok(
    createdTables(nakedTable).has('lonely_table') &&
      !rlsEnabled(nakedTable).has('lonely_table'),
    'the walk failed to notice a table with no RLS'
  );
  const openPolicy = `CREATE POLICY "wide" ON some_table
  FOR SELECT USING (true);`;
  const found = [
    ...openPolicy.matchAll(
      /CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)([\s\S]*?);/gi
    ),
  ].filter(
    (m) =>
      /FOR\s+SELECT/i.test(m[3]) &&
      /USING\s*\(\s*true\s*\)/i.test(m[3]) &&
      !/\bTO\s+(authenticated|service_role)/i.test(m[3])
  );
  assert.strictEqual(
    found.length,
    1,
    'the policy detector missed a PUBLIC USING (true) SELECT'
  );
});
