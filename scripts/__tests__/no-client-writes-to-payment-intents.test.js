/**
 * The browser must not write `payment_intents` (#559 T026).
 *
 * This is the check that makes T027 — dropping the client INSERT policy and the INSERT
 * grant — safe to land AND safe to keep. The ticket says the ordering is load-bearing:
 * dropping the grant while an unmigrated write site still exists breaks payments
 * SILENTLY rather than loudly, because the failure surfaces as a 403 inside a flow the
 * user has already committed to.
 *
 * A grep is the right shape here precisely because it cannot be satisfied by mocking.
 * Both defects in #1046 lived for as long as the code did, behind suites that stubbed
 * the Supabase client and asserted a payload the database would have rejected.
 *
 * SELECT stays granted and is not restricted here — reading your own intents is how the
 * payment result page works.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '../../src');

/** Every .ts/.tsx under src/, excluding tests. */
function sourceFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'tests') continue;
      sourceFiles(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Strip comments, so a comment ABOUT the old insert does not read as one. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');
}

const FILES = sourceFiles(SRC);

test('the sweep sees the files it claims to sweep', () => {
  // Anti-vacuity: a broken walk would report no violations by finding nothing.
  assert.ok(FILES.length > 200, `walked only ${FILES.length} source files`);
  assert.ok(
    FILES.some((f) => f.endsWith('payment-service.ts')),
    'payment-service.ts must be in the sweep — it is the file this rule is about'
  );
});

test('no client code writes payment_intents (#559 T026)', () => {
  const violations = [];
  for (const file of FILES) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    // Match a write chained onto .from('payment_intents'), across line breaks.
    const re =
      /\.from\(\s*['"]payment_intents['"]\s*\)[\s\S]{0,200}?\.(insert|upsert|update|delete)\s*\(/g;
    for (const m of src.matchAll(re)) {
      violations.push(
        `${path.relative(SRC, file)}: .${m[1]}() on payment_intents`
      );
    }
  }
  assert.deepStrictEqual(
    violations,
    [],
    `the browser must not write payment_intents — every row is written by the\n` +
      `create-order Edge Function, which is the only place that can price a purchase\n` +
      `from the catalog or authorise a retry (#559). Found:\n  ` +
      violations.join('\n  ')
  );
});

test('the migration matches: no INSERT grant, and a false INSERT policy (#559 T027)', () => {
  // The source half of what was applied to production. Both lines matter and they do
  // different jobs: the REVOKE takes the privilege back on an already-provisioned
  // database (narrowing the GRANT alone changes nothing there -- #565/#897), and the
  // false policy states the intent out loud where the next reader will find it.
  const sql = fs
    .readFileSync(
      path.join(
        __dirname,
        '../../supabase/migrations/20251006_complete_monolithic_setup.sql'
      ),
      'utf8'
    )
    .split('\n')
    .map((l) => {
      const i = l.indexOf('--');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');

  assert.match(
    sql,
    /GRANT SELECT ON payment_intents TO authenticated;/,
    'authenticated must hold SELECT only on payment_intents'
  );
  assert.ok(
    !/GRANT SELECT, INSERT ON payment_intents TO authenticated/.test(sql),
    'the INSERT grant must be gone (#559 T027)'
  );
  assert.match(
    sql,
    /REVOKE INSERT[^;]*ON payment_intents FROM authenticated;/,
    'INSERT must be REVOKEd from authenticated, not merely omitted from the GRANT'
  );
  assert.match(
    sql,
    /CREATE POLICY "Payment intents are server-written" ON payment_intents\s*\n\s*FOR INSERT WITH CHECK \(false\);/,
    'the INSERT policy must state the refusal rather than be absent'
  );
});

test('the detector can actually fail (control)', () => {
  // Without this, deleting the regex body would leave the test above green.
  const synthetic = `
    const { data } = await supabase
      .from('payment_intents')
      .insert({ amount: 999 })
      .select();
  `;
  const re =
    /\.from\(\s*['"]payment_intents['"]\s*\)[\s\S]{0,200}?\.(insert|upsert|update|delete)\s*\(/g;
  assert.strictEqual([...stripComments(synthetic).matchAll(re)].length, 1);
});

test('a comment describing the old write does not trip it', () => {
  // The real files carry long comments explaining what used to be here and why it
  // went. A guard that matched its own documentation would be unsatisfiable.
  const commented = `
    // This used to be supabase.from('payment_intents').insert({ ... }).
    /* .from('payment_intents').upsert(...) is what #1046 was about. */
    const x = 1;
  `;
  const re =
    /\.from\(\s*['"]payment_intents['"]\s*\)[\s\S]{0,200}?\.(insert|upsert|update|delete)\s*\(/g;
  assert.strictEqual([...stripComments(commented).matchAll(re)].length, 0);
});

test('reads are NOT restricted — SELECT stays granted', () => {
  const anyRead = FILES.some((f) =>
    /\.from\(\s*['"]payment_intents['"]\s*\)[\s\S]{0,120}?\.select\s*\(/.test(
      stripComments(fs.readFileSync(f, 'utf8'))
    )
  );
  assert.ok(
    anyRead,
    'expected at least one client READ of payment_intents; if these all vanished, ' +
      'this guard is no longer measuring what it thinks it is'
  );
});
