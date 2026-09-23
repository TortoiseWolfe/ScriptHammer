const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const path = require('node:path');

/**
 * supabase/migrations/ holds exactly one file: the monolithic migration (#1248).
 *
 * CLAUDE.md: "NEVER create separate migration files." The directory nevertheless
 * accumulated a drop-everything script with a numeric prefix — which is what the
 * Supabase CLI treats as a migration — and a deprecated seed. Both are gone; this
 * keeps the next stray file from arriving quietly.
 */
const DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const MONOLITH = '20251006_complete_monolithic_setup.sql';

/** The rule, as a function, so the CONTROL below can prove it can fail. */
function strays(entries) {
  return entries.filter((e) => e !== MONOLITH);
}

test('the migrations directory contains only the monolithic migration', () => {
  const entries = readdirSync(DIR);
  assert.ok(entries.includes(MONOLITH), `${MONOLITH} is missing`);
  assert.deepEqual(
    strays(entries),
    [],
    'a file other than the monolith is in supabase/migrations/ — a numeric prefix ' +
      'there is a migration to the CLI; put scripts under supabase/scripts/'
  );
});

test('CONTROL: the rule rejects a stray file', () => {
  assert.deepEqual(strays([MONOLITH, '999_drop_all_tables.sql']), [
    '999_drop_all_tables.sql',
  ]);
  assert.deepEqual(strays([MONOLITH]), []);
});
