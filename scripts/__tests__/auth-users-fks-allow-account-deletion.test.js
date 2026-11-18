/**
 * Deleting an account must not be blocked by a foreign key (#1309).
 *
 * The delete-account Edge Function calls `auth.admin.deleteUser`. Postgres refuses to delete
 * an `auth.users` row while a table still points at it with the default `NO ACTION`, so any
 * buyer (every checkout writes a `payment_intents` row and an `orders` row) got a 500 and kept
 * their account.
 *
 * What this checks, and why it is shaped this way:
 *
 *   - It reads the FINAL state of every foreign key that points at `auth.users(id)`: the
 *     inline `REFERENCES` in a CREATE TABLE, overridden by any later
 *     `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. The inline form alone proves nothing for
 *     a database that already exists, because `CREATE TABLE IF NOT EXISTS` never runs on it.
 *     The fix has to be an ALTER, and this is the only check that notices when it is missing.
 *   - Any NEW table that references auth.users without a delete action fails here too, which is
 *     the same bug arriving a second time.
 *   - A SET NULL action needs a nullable column. A NOT NULL column with ON DELETE SET NULL
 *     passes the foreign key and then fails the delete with a not-null violation, so the two
 *     are checked together.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SQL = fs.readFileSync(
  path.join(
    __dirname,
    '../../supabase/migrations/20251006_complete_monolithic_setup.sql'
  ),
  'utf8'
);

/** Drop `--` comments so prose about an old constraint does not read as one. */
const CODE = SQL.split('\n')
  .map((l) => {
    const i = l.indexOf('--');
    return i === -1 ? l : l.slice(0, i);
  })
  .join('\n');

const ACTION = '(CASCADE|SET\\s+NULL|SET\\s+DEFAULT|RESTRICT|NO\\s+ACTION)';

/**
 * Final delete action and nullability of every `table.column` that references auth.users(id).
 * Returns Map<"table.column", { action, notNull }>.
 */
function authUsersForeignKeys() {
  const fks = new Map();

  // 1. Inline column definitions inside CREATE TABLE bodies.
  const createRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi;
  for (const m of CODE.matchAll(createRe)) {
    const table = m[1];
    for (const line of m[2].split('\n')) {
      const col = line.match(
        /^\s*(\w+)\s+UUID\b([^,]*?)REFERENCES\s+(?:auth\.)users\s*\(\s*id\s*\)([^,]*)/i
      );
      if (!col) continue;
      const act = col[3].match(new RegExp(`ON\\s+DELETE\\s+${ACTION}`, 'i'));
      fks.set(`${table}.${col[1]}`, {
        action: act ? act[1].replace(/\s+/g, ' ').toUpperCase() : 'NO ACTION',
        notNull: /NOT\s+NULL/i.test(col[2] + col[3]),
      });
    }
  }

  // 2. ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (col) REFERENCES auth.users(id) ...
  const addRe = new RegExp(
    `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?(\\w+)\\s+ADD\\s+CONSTRAINT\\s+\\w+\\s+FOREIGN\\s+KEY\\s*\\(\\s*(\\w+)\\s*\\)\\s*REFERENCES\\s+auth\\.users\\s*\\(\\s*id\\s*\\)([^;]*);`,
    'gi'
  );
  for (const m of CODE.matchAll(addRe)) {
    const key = `${m[1]}.${m[2]}`;
    const act = m[3].match(new RegExp(`ON\\s+DELETE\\s+${ACTION}`, 'i'));
    const prev = fks.get(key) ?? { notNull: false };
    fks.set(key, {
      ...prev,
      action: act ? act[1].replace(/\s+/g, ' ').toUpperCase() : 'NO ACTION',
    });
  }

  // 3. A later ALTER COLUMN ... DROP NOT NULL / SET NOT NULL changes nullability.
  const nullRe =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+ALTER\s+COLUMN\s+(\w+)\s+(DROP|SET)\s+NOT\s+NULL/gi;
  for (const m of CODE.matchAll(nullRe)) {
    const key = `${m[1]}.${m[2]}`;
    if (fks.has(key)) fks.get(key).notNull = m[3].toUpperCase() === 'SET';
  }

  return fks;
}

const FKS = authUsersForeignKeys();

test('the parser sees the foreign keys it claims to check', () => {
  // Anti-vacuity: a broken regex would pass by finding nothing.
  for (const key of [
    'user_profiles.id',
    'payment_intents.template_user_id',
    'subscriptions.template_user_id',
    'orders.buyer_user_id',
  ]) {
    assert.ok(FKS.has(key), `${key} must be among the auth.users foreign keys`);
  }
  assert.ok(FKS.size >= 6, `found only ${FKS.size} auth.users foreign keys`);
});

test('no foreign key to auth.users blocks deleting the user', () => {
  const blocking = [...FKS].filter(
    ([, v]) => !['CASCADE', 'SET NULL'].includes(v.action)
  );
  assert.deepStrictEqual(
    blocking.map(([k, v]) => `${k}: ${v.action}`),
    [],
    'these foreign keys make auth.admin.deleteUser fail (#1309)'
  );
});

test('every SET NULL foreign key to auth.users is on a nullable column', () => {
  const bad = [...FKS].filter(([, v]) => v.action === 'SET NULL' && v.notNull);
  assert.deepStrictEqual(
    bad.map(([k]) => k),
    [],
    'SET NULL on a NOT NULL column turns the delete into a not-null violation'
  );
});

test('payment records are kept, not deleted, when the buyer is erased', () => {
  // Retention decision recorded on #1309: anonymise, so the accounting trail survives.
  for (const key of [
    'payment_intents.template_user_id',
    'subscriptions.template_user_id',
    'orders.buyer_user_id',
  ]) {
    assert.strictEqual(FKS.get(key)?.action, 'SET NULL', key);
  }
});
