/**
 * `supabase/seed-admin-demo.sql` must satisfy the schema it is seeded into (#940).
 *
 * WHAT HAPPENED. The file packed up to six `succeeded` payment_results onto ONE intent, against
 * the partial unique index `idx_payment_results_one_succeeded_per_intent` that #239 added to make
 * exactly that impossible. Being one BEGIN/COMMIT, the first 23505 discarded all 154 rows.
 *
 * Measured against a real local database before the fix:
 *
 *   with -v ON_ERROR_STOP=1  ->  ERROR 23505, Key (intent_id)=(...222201) already exists
 *   without it               ->  psql EXIT CODE 0, and payment_intents=0 payment_results=0
 *
 * That second line is why this test exists rather than trusting a CI step's exit code. A consumer
 * that pipes this file to psql without ON_ERROR_STOP is told it succeeded over an empty database —
 * the #396 shape, and #914 was about to add exactly such a step.
 *
 * SQL COMMENTS ARE STRIPPED BEFORE MATCHING. The file now carries a long comment block explaining
 * the removed admin step, and that prose names `raw_app_meta_data` and `is_admin` while saying they
 * must not be used. Matching raw text would fail on a correct file, or pass on a broken one after
 * a reword. This repo has hit that four times.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SEED = path.resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'seed-admin-demo.sql'
);
const RAW = fs.readFileSync(SEED, 'utf8');

/** Line comments removed. `--` inside a string literal is not one, and none appear here. */
const SQL = RAW.split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

/** The VALUES rows of one INSERT, as raw tuple strings. */
function valuesOf(table) {
  const start = SQL.indexOf(`INSERT INTO ${table}`);
  if (start === -1) return [];
  const end = SQL.indexOf('ON CONFLICT', start);
  const body = SQL.slice(start, end === -1 ? start + 12000 : end);
  return body.match(/\(\s*'[0-9a-f-]{36}'[^\n]*?\)/g) ?? [];
}

/** [{ id, intentId, status }] for payment_results. */
function results() {
  return valuesOf('payment_results')
    .map((row) => {
      const m = row.match(
        /^\(\s*'([0-9a-f-]{36})',\s*'([0-9a-f-]{36})',\s*'\w+',\s*'[^']*',\s*'(\w+)'/
      );
      return m ? { id: m[1], intentId: m[2], status: m[3] } : null;
    })
    .filter(Boolean);
}

/** Intent ids declared by the payment_intents INSERT. */
function declaredIntents() {
  return valuesOf('payment_intents')
    .map((r) => r.match(/^\(\s*'([0-9a-f-]{36})'/)?.[1])
    .filter(Boolean);
}

/** The invariant #239's index enforces. Returns offending [intentId, count] pairs. */
function intentsWithMultipleSuccesses(rows) {
  const byIntent = new Map();
  for (const r of rows) {
    if (r.status !== 'succeeded') continue;
    byIntent.set(r.intentId, (byIntent.get(r.intentId) ?? 0) + 1);
  }
  return [...byIntent.entries()].filter(([, n]) => n > 1);
}

describe('seed-admin-demo.sql matches the schema it seeds (#940)', () => {
  it('the parser found the rows it is asserting about', () => {
    // Anti-vacuity, first and loudest. A renamed table or a reformat makes every
    // assertion below pass by inspecting an empty list — which is precisely how a
    // broken seed stayed invisible for five months.
    const rows = results();
    assert.ok(
      rows.length >= 20,
      `parsed only ${rows.length} payment_results rows — the parser is stale, so nothing ` +
        'below means anything'
    );
    assert.ok(declaredIntents().length >= 5, 'parsed no payment_intents rows');
  });

  it('never more than one `succeeded` result per intent', () => {
    // #239: CREATE UNIQUE INDEX ... ON payment_results(intent_id) WHERE status = 'succeeded'.
    // A second succeeded INSERT raises 23505 and, in a single-transaction file, discards
    // everything. Add a new successful payment by adding an INTENT, not by adding a row to
    // an existing one — which is also what really happens.
    const bad = intentsWithMultipleSuccesses(results());
    assert.deepStrictEqual(
      bad,
      [],
      'these intents carry more than one succeeded payment_result, which violates ' +
        'idx_payment_results_one_succeeded_per_intent and makes the WHOLE file roll back: ' +
        bad.map(([i, n]) => `${i} x${n}`).join(', ')
    );
  });

  it('every referenced intent is actually declared', () => {
    // A dangling intent_id is a foreign-key violation, which fails the same way: one
    // transaction, everything discarded.
    const declared = new Set(declaredIntents());
    const dangling = [...new Set(results().map((r) => r.intentId))].filter(
      (i) => !declared.has(i)
    );
    assert.deepStrictEqual(
      dangling,
      [],
      `payment_results reference intents that payment_intents never creates: ${dangling.join(', ')}`
    );
  });

  it('the file confers admin on nobody', () => {
    // Section 6 used to write raw_app_meta_data.is_admin for the SHARED test@example.com.
    // That was inert after #240 (is_admin() reads the user_profiles COLUMN; the token hook
    // derives the claim FROM it), and repointing it at the column would be worse than
    // inert — that account is the storageState for all 24 E2E shards, and admin_list_users
    // counts only `is_admin = FALSE`. Tests use seedIsolatedAdmin(). See #914.
    assert.doesNotMatch(
      SQL,
      /UPDATE\s+auth\.users[\s\S]{0,200}?is_admin/i,
      'the seed is granting admin via auth.users again — use seedIsolatedAdmin() in the test'
    );
    assert.doesNotMatch(
      SQL,
      /UPDATE\s+user_profiles[\s\S]{0,200}?SET[\s\S]{0,120}?is_admin\s*=\s*true/i,
      'the seed is promoting a user to admin — that belongs in a test fixture, not shared seed data'
    );
    // The demo users it DOES create must all be non-admin, or they vanish from
    // admin_list_users (migration:1605) and the pagination spec counts the wrong population.
    const profiles = valuesOf('user_profiles');
    assert.ok(profiles.length >= 5, 'parsed no user_profiles rows');
    for (const row of profiles) {
      assert.doesNotMatch(
        row,
        /,\s*true\s*,\s*now\(\)/,
        `a demo profile is being created with is_admin = true: ${row.slice(0, 80)}`
      );
    }
  });

  it('CONTROL: the invariant check reports a violation when one exists', () => {
    // Without this, an always-empty parse would satisfy the assertions above. This is the
    // mutation a reviewer cannot perform by reading.
    const synthetic = [
      { id: 'a', intentId: 'X', status: 'succeeded' },
      { id: 'b', intentId: 'X', status: 'succeeded' },
      { id: 'c', intentId: 'Y', status: 'failed' },
    ];
    assert.deepStrictEqual(
      intentsWithMultipleSuccesses(synthetic),
      [['X', 2]],
      'the checker did not flag two successes on one intent — it cannot detect the bug it exists for'
    );
  });

  it('CONTROL: comment stripping actually removes comments', () => {
    // The guard above searches for `UPDATE auth.users ... is_admin`, and this file's own
    // comments describe exactly that statement while explaining why it was removed.
    assert.ok(
      SQL.length < RAW.length - 500,
      'stripComments removed almost nothing — the assertions may be matching prose'
    );
    // Keyed on a phrase that exists ONLY in prose. `raw_app_meta_data` would be the
    // obvious choice and is wrong: it is also a real column in the auth.users INSERT,
    // so asserting its absence fails on a correct file. (It did, on the first run.)
    assert.match(
      RAW,
      /seedIsolatedAdmin/,
      'expected the explanatory comment naming the supported alternative to exist'
    );
    assert.doesNotMatch(
      SQL,
      /seedIsolatedAdmin/,
      'a comment-only phrase survived stripping — the stripper is not working, so the ' +
        'assertions above may be matching prose rather than SQL'
    );
    // And the column name IS expected to survive, because it is code.
    assert.match(
      SQL,
      /raw_app_meta_data/,
      'the auth.users INSERT lost its raw_app_meta_data column — parser or file changed'
    );
  });
});
