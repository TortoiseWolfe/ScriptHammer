/**
 * Tests for the E2E parity comparator (#575).
 *
 * The comparator is the ONLY thing standing between "we switched E2E to a local
 * Supabase" and "we switched E2E to a local Supabase and quietly stopped running 228
 * messaging tests". If it can't fail, the switch is unlicensed. So these tests are
 * mostly about proving it REJECTS things.
 *
 * Runs under `pnpm test:scripts` (node:test), which ci.yml executes. vitest cannot
 * load `node:test`, hence the placement here — see vitest.config.ts:20-21.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MOD = pathToFileURL(
  path.join(__dirname, '..', 'e2e-parity-diff.mjs')
).href;

/** Minimal Playwright-JSON-shaped report. */
function report(entries) {
  return {
    suites: entries.map(([project, file, title, status]) => ({
      file,
      specs: [{ file, title, tests: [{ projectName: project, status }] }],
      suites: [],
    })),
  };
}

test('extractTests flattens nested suites and keys on project|file|title', async () => {
  const { extractTests } = await import(MOD);
  const r = {
    suites: [
      {
        file: 'a.spec.ts',
        specs: [
          {
            file: 'a.spec.ts',
            title: 'top',
            tests: [{ projectName: 'chromium-gen', status: 'expected' }],
          },
        ],
        suites: [
          {
            // No `file` here — must inherit from the parent suite, or nested describes
            // key on an empty path and silently collide.
            specs: [
              {
                title: 'nested',
                tests: [{ projectName: 'chromium-gen', status: 'skipped' }],
              },
            ],
          },
        ],
      },
    ],
  };
  const out = extractTests(r);
  assert.strictEqual(out['chromium-gen|a.spec.ts|top'], 'expected');
  assert.strictEqual(out['chromium-gen|a.spec.ts|nested'], 'skipped');
  assert.strictEqual(Object.keys(out).length, 2);
});

test('identical input passes', async () => {
  const { compare } = await import(MOD);
  const b = { 'p|f|t': 'expected', 'p|f|u': 'skipped' };
  assert.strictEqual(compare(b, { ...b }).ok, true);
});

test('expected -> skipped is a coverage LOSS and fails', async () => {
  const { compare } = await import(MOD);
  const b = { 'p|f|t': 'expected' };
  const res = compare(b, { 'p|f|t': 'skipped' });
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.lost, ['p|f|t']);
});

test('a test vanishing entirely fails', async () => {
  const { compare } = await import(MOD);
  const res = compare({ 'p|f|t': 'expected' }, {});
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.missing, ['p|f|t']);
});

test('same COUNT but different tests still fails', async () => {
  // The whole reason this compares identities. A count gate passes this.
  const { compare } = await import(MOD);
  const res = compare({ 'p|f|a': 'expected' }, { 'p|f|b': 'expected' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.missing.length, 1);
  assert.strictEqual(res.added.length, 1);
});

test('skipped -> expected is a GAIN: reported, allowed', async () => {
  // A local stack can legitimately enable a spec the cloud project could not run.
  // That must not fail the gate, but it must be visible.
  const { compare } = await import(MOD);
  const res = compare({ 'p|f|t': 'skipped' }, { 'p|f|t': 'expected' });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.gained, ['p|f|t']);
});

test('a genuine failure (expected -> unexpected) fails the gate', async () => {
  const { compare } = await import(MOD);
  const res = compare({ 'p|f|t': 'expected' }, { 'p|f|t': 'unexpected' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.changed.length, 1);
});

test('flaky is not treated as a pass', async () => {
  const { compare } = await import(MOD);
  const res = compare({ 'p|f|t': 'expected' }, { 'p|f|t': 'flaky' });
  assert.strictEqual(res.ok, false);
});

test('brand-new tests are allowed but reported', async () => {
  const { compare } = await import(MOD);
  const res = compare({}, { 'p|f|new': 'expected' });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.added, ['p|f|new']);
});

test('the committed baseline is well-formed and self-consistent', async () => {
  const fs = require('node:fs');
  const p = path.join(
    __dirname,
    '..',
    '..',
    'tests',
    'e2e',
    'parity',
    'baseline-de0f7f0.json'
  );
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));

  assert.strictEqual(m.sha, 'de0f7f080c8d75949e4e6c89fdf66ab7d3da8029');
  assert.strictEqual(m.backend, 'cloud');
  assert.deepStrictEqual(
    m.duplicateKeys,
    [],
    'keys must be unique or the diff is unsound'
  );

  const statuses = Object.values(m.tests);
  assert.strictEqual(statuses.length, m.totals.tests);
  assert.strictEqual(
    statuses.filter((s) => s === 'expected').length,
    m.totals.expected
  );
  assert.strictEqual(
    statuses.filter((s) => s === 'skipped').length,
    m.totals.skipped
  );
  // The numbers quoted throughout #575 and its PRs. If these ever change, the
  // baseline was regenerated and every claim referencing them needs revisiting.
  assert.strictEqual(m.totals.expected, 1807);
  assert.strictEqual(m.totals.skipped, 194);
  assert.strictEqual(m.totals.tests, 2001);
});

test('the baseline round-trips through compare() against itself', async () => {
  const fs = require('node:fs');
  const { compare } = await import(MOD);
  const p = path.join(
    __dirname,
    '..',
    '..',
    'tests',
    'e2e',
    'parity',
    'baseline-de0f7f0.json'
  );
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  const res = compare(m.tests, { ...m.tests });
  assert.strictEqual(res.ok, true);
});

test('report() shape: extract on a synthetic report matches compare expectations', async () => {
  const { extractTests, compare } = await import(MOD);
  const base = extractTests(
    report([['chromium-gen', 'x.spec.ts', 'one', 'expected']])
  );
  const now = extractTests(
    report([['chromium-gen', 'x.spec.ts', 'one', 'skipped']])
  );
  assert.strictEqual(compare(base, now).ok, false);
});
