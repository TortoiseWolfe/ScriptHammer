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

// ── the @hosted allowlist (#575, #725) ──────────────────────────────────────

test('an allowlisted absence is reported, not counted as coverage loss', async () => {
  const { compare } = await import(MOD);
  const allow = [
    {
      file: 'security/oauth-csrf.spec.ts',
      title: 'needs a real provider',
      reason: 'x',
    },
  ];
  const baseline = {
    'chromium-gen|security/oauth-csrf.spec.ts|needs a real provider':
      'expected',
    'chromium-gen|security/oauth-csrf.spec.ts|runs anywhere': 'expected',
  };
  const actual = {
    'chromium-gen|security/oauth-csrf.spec.ts|runs anywhere': 'expected',
  };
  const res = compare(baseline, actual, allow);
  assert.strictEqual(res.missing.length, 0);
  assert.strictEqual(res.expectedAbsent.length, 1);
  assert.strictEqual(res.ok, true);
});

test('a NON-allowlisted absence in the same file still fails', async () => {
  // The seventh oauth-csrf test is deliberately not tagged @hosted. If the allowlist
  // matched by file it would swallow that too, and the differ would stop guarding the
  // one test in this file that a local lane genuinely must run.
  const { compare } = await import(MOD);
  const allow = [
    {
      file: 'security/oauth-csrf.spec.ts',
      title: 'needs a real provider',
      reason: 'x',
    },
  ];
  const baseline = {
    'chromium-gen|security/oauth-csrf.spec.ts|runs anywhere': 'expected',
  };
  const res = compare(baseline, {}, allow);
  assert.strictEqual(res.missing.length, 1);
  assert.strictEqual(res.ok, false);
});

test('a STALE allowlist entry fails the gate', async () => {
  // An entry whose test was renamed or re-tagged would otherwise sit here forever,
  // silently excusing whatever later takes that name.
  const { compare } = await import(MOD);
  const allow = [
    { file: 'security/oauth-csrf.spec.ts', title: 'gone', reason: 'x' },
  ];
  const baseline = {
    'chromium-gen|security/oauth-csrf.spec.ts|still here': 'expected',
  };
  const res = compare(baseline, { ...baseline }, allow);
  assert.deepStrictEqual(res.staleAllow, [
    'security/oauth-csrf.spec.ts :: gone',
  ]);
  assert.strictEqual(res.ok, false);
});

test('an entry for a file the baseline does not cover is NOT stale', async () => {
  // Otherwise the guard fires on every narrow report and gets deleted for being noisy.
  const { compare } = await import(MOD);
  const allow = [
    { file: 'security/oauth-csrf.spec.ts', title: 'gone', reason: 'x' },
  ];
  const baseline = { 'chromium-gen|other/thing.spec.ts|t': 'expected' };
  const res = compare(baseline, { ...baseline }, allow);
  assert.deepStrictEqual(res.staleAllow, []);
  assert.strictEqual(res.ok, true);
});

test('the allowlist matches the REAL baseline: 18 absences, 0 lost', async () => {
  // The check that mattered. A one-directional endsWith matched NOTHING against the real
  // baseline — which stores `security/...` while the repo path is `tests/e2e/security/...` —
  // and reported a clean run while excusing zero tests. The unit fixtures above could not
  // have caught that, because they use whatever shape the test author chose.
  const { compare, EXPECTED_ABSENT } = await import(MOD);
  const fs = require('node:fs');
  const baseline = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../tests/e2e/parity/baseline-de0f7f0.json'),
      'utf8'
    )
  ).tests;
  const norm = (f) => f.replace(/^tests\/e2e\//, '');
  const hosted = Object.keys(baseline).filter((k) => {
    const [, file = '', title = ''] = k.split('|');
    return EXPECTED_ABSENT.some(
      (a) => norm(file) === norm(a.file) && title === a.title
    );
  });
  assert.strictEqual(
    hosted.length,
    18,
    'six @hosted tests across three gen projects'
  );

  const local = Object.fromEntries(
    Object.keys(baseline)
      .filter((k) => !hosted.includes(k))
      .map((k) => [k, baseline[k]])
  );
  const res = compare(baseline, local);
  assert.strictEqual(res.missing.length, 0);
  assert.strictEqual(res.expectedAbsent.length, 18);
  assert.deepStrictEqual(res.staleAllow, []);
  assert.strictEqual(res.ok, true, 'step 3 of #575 must be able to pass');
});

test('the seventh oauth-csrf test is NOT excused by the allowlist', async () => {
  const { compare } = await import(MOD);
  const fs = require('node:fs');
  const baseline = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../tests/e2e/parity/baseline-de0f7f0.json'),
      'utf8'
    )
  ).tests;
  const SEVENTH = 'OAuth buttons should be visible and enabled on sign-in page';
  const seventh = Object.keys(baseline).filter((k) =>
    k.endsWith('|' + SEVENTH)
  );
  assert.strictEqual(seventh.length, 3, 'one per gen project');
  const local = Object.fromEntries(
    Object.keys(baseline)
      .filter((k) => !seventh.includes(k))
      .map((k) => [k, baseline[k]])
  );
  const res = compare(baseline, local);
  assert.strictEqual(res.missing.length, 3);
  assert.strictEqual(res.ok, false);
});
