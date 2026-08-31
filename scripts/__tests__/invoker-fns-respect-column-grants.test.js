/**
 * A SECURITY INVOKER function may only read columns the caller was GRANTed.
 *
 * #1029. `user_profiles` is column-scoped: the grant block REVOKEs everything
 * from `authenticated` and then names the readable columns one by one,
 * deliberately withholding `is_admin`. `admin_user_stats()` is SECURITY INVOKER
 * and read that column anyway (`WHERE is_admin = FALSE`), so Postgres refused
 * with ERRCODE 42501 — which PostgREST returns as HTTP 403.
 *
 * That is the SAME status the function returns for its own "caller is not an
 * admin" refusal. So an admin, for whom is_admin() returned true, got a 403 that
 * was indistinguishable from being told they were not an admin. Static reading
 * could not separate them and neither could the client; it took logging
 * auth.uid() and the bare is_admin() RPC side by side in CI to prove the refusal
 * was not the refusal. Four E2E specs sat fixme'd behind it.
 *
 * The audit that landed the revoke checked the CLIENT for column readers and
 * found none. It did not check the migration's own SQL. This test is the check
 * that was missing.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION = path.join(
  __dirname,
  '../../supabase/migrations/20251006_complete_monolithic_setup.sql'
);

/**
 * Strip `--` line comments. Load-bearing: the fix's own comment says
 * "`is_admin = FALSE`" to explain what not to write, and a guard that matched
 * its own prose would pass with the code deleted — a trap this repo has hit
 * four times in one session.
 */
function stripComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

/** Columns named in a per-column `GRANT <verb> (a, b, c) ON <table> TO <role>`. */
function grantedColumns(sql, table, role) {
  const re = new RegExp(
    `GRANT\\s+SELECT\\s*\\(([^)]*)\\)\\s*ON\\s+(?:public\\.)?${table}\\s+TO\\s+[^;]*\\b${role}\\b`,
    'gi'
  );
  const cols = new Set();
  for (const m of sql.matchAll(re)) {
    for (const c of m[1].split(',')) cols.add(c.trim().toLowerCase());
  }
  return cols;
}

/** Every column of `CREATE TABLE <table>`. */
function tableColumns(sql, table) {
  const m = sql.match(
    new RegExp(
      `CREATE TABLE(?: IF NOT EXISTS)? (?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
      'i'
    )
  );
  assert.ok(m, `could not find CREATE TABLE ${table}`);
  const cols = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    const name = line.match(/^([a-z_][a-z0-9_]*)\s+[A-Za-z]/i);
    if (name && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)$/i.test(name[1])) {
      cols.push(name[1].toLowerCase());
    }
  }
  return cols;
}

/**
 * Split into function blocks. A function with NO security clause is INVOKER —
 * that is Postgres's default, so absence must count as invoker or the guard
 * would miss every function that never says which it is.
 */
function functions(sql) {
  const out = [];
  const re =
    /CREATE OR REPLACE FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const m of sql.matchAll(re)) {
    const start = m.index;
    const end = sql.indexOf('$$;', start);
    const body = sql.slice(start, end === -1 ? sql.length : end);
    out.push({
      name: m[1],
      body,
      definer: /SECURITY\s+DEFINER/i.test(body),
    });
  }
  return out;
}

/** A read of `col` — a bare identifier, not a call to a same-named function. */
function readsColumn(body, col) {
  return new RegExp(`\\b${col}\\b\\s*(?!\\()`, 'i').test(body);
}

const RAW = fs.readFileSync(MIGRATION, 'utf8');
const SQL = stripComments(RAW);
const ROLE = 'authenticated';

/**
 * Every table the migration column-scopes, discovered rather than listed.
 *
 * This was `const TABLE = 'user_profiles'` when only one table was column-scoped.
 * #1040 made `user_encryption_keys` the second, withholding `encryption_salt`
 * from `authenticated` for the same reason `is_admin` is withheld -- and a guard
 * hardcoded to the first table would not have looked at it. That is the #1038
 * failure in miniature: a check whose coverage is a hand-written name.
 */
function columnScopedTables(sql) {
  const re = new RegExp(
    `GRANT\\s+SELECT\\s*\\(([^)]*)\\)\\s*ON\\s+(?:public\\.)?([a-z_][a-z0-9_]*)\\s+TO\\s+[^;]*\\b${ROLE}\\b`,
    'gi'
  );
  return [...new Set([...sql.matchAll(re)].map((m) => m[2].toLowerCase()))];
}

const TABLES = columnScopedTables(SQL);
const TABLE = 'user_profiles';

test('both column-scoped tables are discovered, not hardcoded', () => {
  assert.ok(
    TABLES.includes('user_profiles'),
    `user_profiles must be column-scoped; found: ${TABLES.join(', ')}`
  );
  assert.ok(
    TABLES.includes('user_encryption_keys'),
    `user_encryption_keys must be column-scoped (#1040); found: ${TABLES.join(', ')}`
  );
});

test('every column-scoped table withholds something from authenticated', () => {
  for (const table of TABLES) {
    const granted = grantedColumns(SQL, table, ROLE);
    const all = tableColumns(SQL, table);
    const withheld = all.filter((c) => !granted.has(c));
    assert.ok(granted.size > 0, `${table}: parsed no granted columns`);
    assert.ok(
      withheld.length > 0,
      `${table}: nothing is withheld — is the REVOKE still there, or did the ` +
        'column list quietly grow to cover everything?'
    );
  }
});

test('encryption_salt is withheld from authenticated (#1040)', () => {
  const granted = grantedColumns(SQL, 'user_encryption_keys', ROLE);
  assert.ok(
    granted.size > 0,
    'parsed no SELECT columns for user_encryption_keys — the parser is broken'
  );
  assert.ok(
    !granted.has('encryption_salt'),
    "encryption_salt must NOT be in the SELECT column list: beside the row's own " +
      'public_key it is an offline password oracle (#1040)'
  );
  // It must keep INSERT, or signup and rotation cannot write a salt at all.
  assert.match(
    SQL,
    /GRANT INSERT \([^)]*\bencryption_salt\b[^)]*\) ON public\.user_encryption_keys TO authenticated;/,
    'encryption_salt must keep INSERT — column privileges are per-privilege-type, ' +
      "and initializeKeys()/rotateKeys() write the caller's own salt"
  );
});

test('no SECURITY INVOKER function reads a withheld column of ANY scoped table', () => {
  const violations = [];
  for (const table of TABLES) {
    const granted = grantedColumns(SQL, table, ROLE);
    const withheld = tableColumns(SQL, table).filter((c) => !granted.has(c));
    const invokers = functions(SQL).filter(
      (f) => !f.definer && new RegExp(`\\b${table}\\b`).test(f.body)
    );
    for (const fn of invokers) {
      for (const col of withheld) {
        if (readsColumn(fn.body, col)) {
          violations.push(`${fn.name}() reads withheld column ${table}.${col}`);
        }
      }
    }
  }
  assert.deepStrictEqual(violations, [], violations.join('\n  '));
});

test('the column-scoped grant on user_profiles actually withholds columns', () => {
  const granted = grantedColumns(SQL, TABLE, ROLE);
  const all = tableColumns(SQL, TABLE);
  const withheld = all.filter((c) => !granted.has(c));

  // Anti-vacuity. If the grant block were deleted or reworded past this
  // parser, `granted` would be empty and every column would look withheld;
  // if it granted everything, `withheld` would be empty and the assertion
  // below would pass over nothing at all.
  assert.ok(
    granted.size > 0,
    'parsed no granted columns — the parser is broken'
  );
  assert.ok(
    all.length > granted.size,
    'no column is withheld — is the REVOKE still there?'
  );
  assert.ok(
    withheld.includes('is_admin'),
    `is_admin must stay withheld from ${ROLE}; withheld = ${withheld.join(', ')}`
  );
});

test('no SECURITY INVOKER function reads a column withheld from authenticated', () => {
  const granted = grantedColumns(SQL, TABLE, ROLE);
  const withheld = tableColumns(SQL, TABLE).filter((c) => !granted.has(c));

  const invokers = functions(SQL).filter(
    (f) => !f.definer && new RegExp(`\\b${TABLE}\\b`).test(f.body)
  );

  // Anti-vacuity: if no invoker function touches the table, this test proves
  // nothing and should say so rather than report green.
  assert.ok(
    invokers.length > 0,
    `no SECURITY INVOKER function reads ${TABLE} — the guard has no subject`
  );

  const violations = [];
  for (const fn of invokers) {
    for (const col of withheld) {
      if (readsColumn(fn.body, col)) {
        violations.push(`${fn.name}() reads withheld column ${TABLE}.${col}`);
      }
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `SECURITY INVOKER functions read columns ${ROLE} cannot select. Postgres ` +
      `refuses with 42501, which PostgREST returns as 403 — the same status as ` +
      `an admin refusal, so this fails as "you are not an admin" (#1029). ` +
      `Read admin-ness through is_admin(id) instead:\n  ` +
      violations.join('\n  ')
  );
});

test('the detector fires on a synthetic violator (control)', () => {
  // Proves the walk above can report a failure at all. Without this, deleting
  // the regex body would leave both tests green.
  const synthetic = `
CREATE OR REPLACE FUNCTION probe_fn()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN (SELECT count(*) FROM user_profiles WHERE is_admin = FALSE);
END;
$$;`;
  const fns = functions(synthetic).filter((f) => !f.definer);
  assert.strictEqual(fns.length, 1);
  assert.ok(
    readsColumn(fns[0].body, 'is_admin'),
    'the detector missed a plain `WHERE is_admin = FALSE` in an INVOKER function'
  );

  // And the fixed form must NOT trip it, or the guard would be unsatisfiable.
  const fixed = synthetic.replace(
    'is_admin = FALSE',
    'NOT public.is_admin(id)'
  );
  assert.ok(
    !readsColumn(functions(fixed)[0].body, 'is_admin'),
    'calling is_admin(id) must not read as a column reference'
  );
});

test('a function with no SECURITY clause counts as INVOKER (Postgres default)', () => {
  const fns = functions(`
CREATE OR REPLACE FUNCTION quiet_fn()
RETURNS INT
LANGUAGE sql
AS $$ SELECT 1 FROM user_profiles $$;`);
  assert.strictEqual(fns[0].definer, false);
});
