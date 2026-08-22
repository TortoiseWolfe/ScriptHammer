/**
 * The monolithic migration must be applicable to a NEWLY CREATED Supabase Cloud
 * project -- the one path every fork has to take, and the one path nothing else
 * exercises (#929).
 *
 * WHAT WENT WRONG. A single statement created a function inside the `auth`
 * schema:
 *
 *     CREATE OR REPLACE FUNCTION auth.jwt() ...
 *
 * On a new cloud project `postgres` has USAGE but NOT CREATE on schema auth, so
 * that aborted the whole single-transaction file with
 *
 *     42501: permission denied for schema auth
 *
 * leaving ZERO tables. It survived for months because it is a harmless no-op
 * everywhere it was ever run: the local stack (where it is genuinely needed, before
 * GoTrue's first boot) and the long-lived hosted projects (which already have the
 * function, and were provisioned when `postgres` still had the privilege).
 *
 * WHY THIS IS A SOURCE TEST AND NOT AN INTEGRATION TEST. Actually provisioning a
 * throwaway project per CI run costs a project slot on a two-project account and
 * minutes of wall clock. The failure is fully determined by the SQL text, so the
 * text is what gets checked.
 *
 * TWO WAYS A CHECK LIKE THIS FOOLS ITSELF, both avoided here:
 *
 *   1. It matches its own explanatory comment and passes with the code deleted.
 *      So comments are stripped before anything is matched.
 *   2. It matches `auth.uid()` inside a CREATE POLICY body and flags 97 false
 *      positives. So it matches the object BEING CREATED, not any mention of the
 *      schema. `CREATE TRIGGER ... ON auth.users` is likewise fine and must stay
 *      allowed -- the trigger does not live in `auth`, and postgres holds TRIGGER
 *      on that table (verified on a fresh project).
 *
 * The guarded form -- a DO block that creates the function only when it is absent
 * -- passes, because the DO block is the top-level statement and the CREATE lives
 * inside its body.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

/**
 * Strip SQL comments without touching string or dollar-quoted bodies, then split
 * into top-level statements on semicolons that are not inside a quote.
 */
function topLevelStatements(sql) {
  const out = [];
  let cur = '';
  let i = 0;
  let dollarTag = null;
  let inSingle = false;

  while (i < sql.length) {
    const rest = sql.slice(i);

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        cur += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      cur += sql[i++];
      continue;
    }

    if (inSingle) {
      if (sql[i] === "'") inSingle = false;
      cur += sql[i++];
      continue;
    }

    // line comment
    if (rest.startsWith('--')) {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }

    // block comment
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    // dollar-quote open, e.g. $$ or $guard$
    const dq = rest.match(/^\$[A-Za-z_]*\$/);
    if (dq) {
      dollarTag = dq[0];
      cur += dollarTag;
      i += dollarTag.length;
      continue;
    }

    if (sql[i] === "'") {
      inSingle = true;
      cur += sql[i++];
      continue;
    }

    if (sql[i] === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      i++;
      continue;
    }

    cur += sql[i++];
  }

  if (cur.trim()) out.push(cur.trim());
  return out;
}

const CREATES_IN_AUTH =
  /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TABLE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|TYPE|DOMAIN|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?auth\s*\./i;

const ALTERS_IN_AUTH =
  /^\s*ALTER\s+(?:FUNCTION|PROCEDURE|TABLE|VIEW|SEQUENCE|TYPE|DOMAIN)\s+auth\s*\./i;

function offenders(sql) {
  return topLevelStatements(sql).filter(
    (s) => CREATES_IN_AUTH.test(s) || ALTERS_IN_AUTH.test(s)
  );
}

test('no top-level statement creates or alters an object inside the auth schema', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const bad = offenders(sql);
  assert.deepStrictEqual(
    bad.map((s) => s.split('\n')[0].slice(0, 90)),
    [],
    'These run as `postgres`, which has USAGE but NOT CREATE on schema auth on a ' +
      'newly created Supabase project. Wrap the statement in a DO block that skips ' +
      'it when the object already exists -- see #929.'
  );
});

test('the harness can actually fail — an unguarded auth.jwt() is caught', () => {
  // The mutation: exactly the statement #929 was about, at top level.
  const mutated = `
    CREATE TABLE public.fine (id int);
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT '{}'::jsonb
    $$;
  `;
  assert.strictEqual(
    offenders(mutated).length,
    1,
    'the detector must flag an unguarded CREATE ... auth.jwt()'
  );
});

test('the guarded form passes', () => {
  const guarded = `
    DO $guard$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_proc) THEN
        EXECUTE $fn$ CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $body$ SELECT '{}'::jsonb $body$ $fn$;
        EXECUTE 'ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin';
      END IF;
    END
    $guard$;
  `;
  assert.deepStrictEqual(offenders(guarded), []);
});

test('a comment describing the old statement does not trip the detector', () => {
  // The trap: a guard that greps raw source matches its own explanation and keeps
  // passing after the code it guards is deleted.
  const commentOnly = `
    -- CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb ... (why this used to exist)
    /* ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin; */
    SELECT 1;
  `;
  assert.deepStrictEqual(offenders(commentOnly), []);
});

test('auth.uid() inside a policy body is not an offender', () => {
  const policy = `
    CREATE POLICY "own rows" ON public.things FOR SELECT
      USING (auth.uid() = user_id);
  `;
  assert.deepStrictEqual(offenders(policy), []);
});

test('a trigger ON auth.users is allowed — it does not live in the auth schema', () => {
  const trigger = `
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION create_user_profile();
  `;
  assert.deepStrictEqual(offenders(trigger), []);
});
