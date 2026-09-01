#!/usr/bin/env node
/**
 * E2E parity diff — compare a Playwright JSON report against a captured baseline.
 *
 * #575. Switching E2E from the shared cloud project to a per-runner ephemeral stack
 * is only safe if the local run covers the SAME TESTS. Counts alone cannot show that:
 * a suite can drop one test and gain another and still total 2001.
 *
 * So this compares per-test IDENTITIES, not totals, and it is directional — a test
 * that went `expected -> skipped` is a coverage LOSS and fails; the reverse is a gain
 * and is reported but allowed (a local stack legitimately enables things cloud could
 * not run, e.g. a spec gated on a service the cloud project lacks).
 *
 *   node scripts/e2e-parity-diff.mjs <merged-report.json> [--baseline <path>] [--json]
 *   node scripts/e2e-parity-diff.mjs --selftest
 *
 * WHY A SELFTEST. Every probe written in this repo that could not fail turned out to
 * be wrong (#396, and four in one session). `--selftest` mutates a copy of the baseline
 * three ways and asserts this script REJECTS each. Run it in CI next to the real diff;
 * a comparison tool that cannot fail is worse than none, because it licenses the switch.
 */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASELINE = 'tests/e2e/parity/baseline-de0f7f0.json';

/** Extract {key -> status} from a Playwright JSON report. Key excludes line numbers
 *  deliberately: they shift on any edit above a test and would churn without any
 *  change in coverage. */
export function extractTests(report) {
  const out = {};
  const walk = (suite, inheritedFile) => {
    const file = suite.file || inheritedFile;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        out[`${t.projectName || ''}|${spec.file || file}|${spec.title || ''}`] =
          t.status || '';
      }
    }
    for (const s of suite.suites || []) walk(s, file);
  };
  for (const s of report.suites || []) walk(s, s.file);
  return out;
}

/**
 * Identities the LOCAL lane deliberately does not run (#575, #725).
 *
 * `e2e-local.yml` passes `--grep-invert='@hosted'`, and `--grep-invert` removes tests from
 * the report ENTIRELY — unlike `test.skip()`, which would record them as `skipped`. So a
 * local report diffed against a hosted baseline shows them as `missing`, which is a
 * COVERAGE LOSS and correctly exits 1. Correct behaviour for the tool, wrong verdict for
 * this situation: the coverage moved to the hosted lane rather than vanishing.
 *
 * Matched on file + title, WITHOUT the project, because the same six tests are absent from
 * chromium-gen, firefox-gen and webkit-gen alike — six entries rather than eighteen, and
 * adding a browser to the matrix does not require touching this list.
 *
 * A STALE ENTRY IS A HOLE, so `compare` fails when an entry here matches nothing. Otherwise
 * un-tagging a test, or renaming it, would silently hand this list a permanent excuse for a
 * test nobody runs anywhere — which is exactly the failure this differ exists to catch, one
 * level up.
 */
export const EXPECTED_ABSENT = [
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'OAuth redirect should include state parameter for CSRF protection',
    reason:
      '@hosted: waits for a redirect to a real OAuth provider, which a local Supabase never performs',
  },
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'OAuth state parameter should be unique per request',
    reason:
      '@hosted: needs two real provider redirects to compare state across them',
  },
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'OAuth redirect should go to correct provider',
    reason: '@hosted: asserts the provider host in the redirect URL',
  },
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'OAuth flow should include required OAuth parameters',
    reason: '@hosted: reads query parameters off a real provider redirect',
  },
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'different browser sessions should have isolated OAuth state',
    reason: '@hosted: two contexts, each needing a real provider redirect',
  },
  {
    file: 'tests/e2e/security/oauth-csrf.spec.ts',
    title: 'OAuth redirect_uri should point to Supabase callback',
    reason: '@hosted: asserts the callback URL a hosted project issues',
  },
];

/**
 * Compare two spec paths that may or may not carry the `tests/e2e/` prefix.
 *
 * The baseline stores `security/oauth-csrf.spec.ts` while the repo path is
 * `tests/e2e/security/oauth-csrf.spec.ts`. A one-directional `endsWith` silently matched
 * NOTHING and reported a clean run — the allowlist looked correct and excused zero tests.
 * Caught only by simulating the real baseline instead of trusting the unit fixtures.
 */
function sameFile(a, b) {
  const norm = (f) => f.replace(/^tests\/e2e\//, '');
  return norm(a) === norm(b);
}

/** Does this baseline key name an identity the local lane deliberately skips? */
function isExpectedAbsent(key, allow) {
  const [, file = '', title = ''] = key.split('|');
  return allow.some((a) => sameFile(file, a.file) && title === a.title);
}

/** Directional comparison. Returns {lost, missing, added, gained, changed, ok}. */
export function compare(baselineTests, actualTests, allow = EXPECTED_ABSENT) {
  const lost = []; // expected -> skipped: COVERAGE LOSS
  const missing = []; // present in baseline, absent entirely: COVERAGE LOSS
  const added = []; // absent from baseline, present now: report only
  const gained = []; // skipped -> expected: report only
  const changed = []; // any other status transition

  const expectedAbsent = []; // allowlisted: ran on the hosted lane instead

  for (const [k, was] of Object.entries(baselineTests)) {
    if (!(k in actualTests)) {
      if (isExpectedAbsent(k, allow)) {
        expectedAbsent.push(k);
        const [, file = '', title = ''] = k.split('|');
      } else {
        missing.push(k);
      }
      continue;
    }
    const now = actualTests[k];
    if (was === now) continue;
    if (was === 'expected' && now === 'skipped') lost.push(k);
    else if (was === 'skipped' && now === 'expected') gained.push(k);
    else changed.push(`${k}  (${was} -> ${now})`);
  }
  for (const k of Object.keys(actualTests)) {
    if (!(k in baselineTests)) added.push(k);
  }

  // `changed` includes transitions to `unexpected` (a real failure) and `flaky`.
  // Both must fail the gate — a parity run that goes red on a test the cloud passed
  // is precisely the signal this exists to surface.
  // A stale allowlist entry is a hole: if the test it excuses was renamed, re-tagged or
  // deleted, the entry stays behind and silently excuses whatever later takes that name.
  //
  // Staleness is judged against the BASELINE's identities, not against what happened to be
  // missing. An entry whose test the baseline still knows about is fine even when nothing
  // was excused this run — that is simply a lane which ran everything, and the first
  // version of this check failed the hosted lane for it. An entry naming a file the
  // baseline never covered is also not stale: the differ is not looking at that area, and
  // firing there would make the guard noisy enough to get deleted.
  const baselineIdentities = Object.keys(baselineTests).map((k) =>
    k.split('|')
  );
  const baselineFiles = new Set(baselineIdentities.map(([, f = '']) => f));
  const fileIsCovered = (f) => [...baselineFiles].some((bf) => sameFile(bf, f));
  const staleAllow = allow
    .map((a) => {
      if (!fileIsCovered(a.file)) return null;
      const known = baselineIdentities.some(
        ([, f = '', t = '']) => sameFile(f, a.file) && t === a.title
      );
      return known ? null : `${a.file} :: ${a.title}`;
    })
    .filter(Boolean);

  return {
    lost,
    missing,
    added,
    gained,
    changed,
    expectedAbsent,
    staleAllow,
    ok:
      lost.length === 0 &&
      missing.length === 0 &&
      changed.length === 0 &&
      staleAllow.length === 0,
  };
}

function loadReport(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  // Accept either a raw Playwright report or a previously-written baseline manifest.
  if (raw.tests && !raw.suites) return raw.tests;
  return extractTests(raw);
}

function report(res, baseCount, actualCount) {
  const line = (label, arr, fatal) => {
    if (!arr.length) return;
    console.log(`\n${fatal ? '✗' : 'ℹ'} ${label}: ${arr.length}`);
    for (const k of arr.slice(0, 25)) console.log(`    ${k}`);
    if (arr.length > 25) console.log(`    … and ${arr.length - 25} more`);
  };
  console.log(`baseline tests: ${baseCount}`);
  console.log(`actual tests:   ${actualCount}`);
  line('COVERAGE LOST (ran on baseline, skipped now)', res.lost, true);
  line('MISSING ENTIRELY (in baseline, absent now)', res.missing, true);
  line('STATUS REGRESSION', res.changed, true);
  line('gained (skipped on baseline, runs now)', res.gained, false);
  line('new tests (not in baseline)', res.added, false);
}

function selftest() {
  if (!existsSync(DEFAULT_BASELINE)) {
    console.error(`✗ selftest needs ${DEFAULT_BASELINE}`);
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(DEFAULT_BASELINE, 'utf8')).tests;
  const keys = Object.keys(base);
  const ranKey = keys.find((k) => base[k] === 'expected');
  let failures = 0;
  const check = (name, actual, shouldPass) => {
    const res = compare(base, actual);
    const good = res.ok === shouldPass;
    console.log(
      `  ${good ? '✓' : '✗'} ${name} — ok=${res.ok}, want ${shouldPass}`
    );
    if (!good) failures++;
  };

  // 1. Identity: the baseline against itself MUST pass, or every other case is noise.
  check('identity (baseline vs itself) passes', { ...base }, true);

  // 2. A test silently flipping to skipped MUST be rejected. This is the exact
  //    failure mode: 228 *-msg-iso tests sit behind `test.skip(!fixture, …)`.
  const flipped = { ...base, [ranKey]: 'skipped' };
  check('expected -> skipped is REJECTED', flipped, false);

  // 3. A test vanishing entirely MUST be rejected — a dropped shard or project.
  const dropped = { ...base };
  delete dropped[ranKey];
  check('missing test is REJECTED', dropped, false);

  // 4. Swapping one test for another keeps the COUNT identical. A count-based gate
  //    passes here; this one must not.
  const swapped = { ...base };
  delete swapped[ranKey];
  swapped['chromium-gen|tests/e2e/fake.spec.ts|invented'] = 'expected';
  check('same count, different tests is REJECTED', swapped, false);

  console.log(
    failures ? `\n✗ selftest FAILED (${failures})` : '\n✓ selftest passed'
  );
  process.exit(failures ? 1 : 0);
}

// Only run the CLI when invoked directly. Without this guard, importing this module
// from a test executes the argument parsing below and exits the test runner.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) {
  // Imported for its exports (see scripts/__tests__/e2e-parity-diff.test.js).
} else {
  runCli();
}

function runCli() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) selftest();

  const asJson = argv.includes('--json');
  const bi = argv.indexOf('--baseline');
  // `bi + 1` is only a real argument when --baseline was actually passed. Without this
  // guard bi is -1, argv[0] IS the report path, and the filter below discards it —
  // which made every real invocation print usage and exit 2 while --selftest passed.
  const baselineArg = bi >= 0 ? argv[bi + 1] : null;
  const baselinePath = baselineArg ?? DEFAULT_BASELINE;
  const reportPath = argv.find((a) => !a.startsWith('--') && a !== baselineArg);

  if (!reportPath) {
    console.error(
      'Usage: node scripts/e2e-parity-diff.mjs <merged-report.json> [--baseline <path>] [--json]\n' +
        '       node scripts/e2e-parity-diff.mjs --selftest'
    );
    process.exit(2);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).tests;
  const actual = loadReport(reportPath);
  const res = compare(baseline, actual);

  if (asJson) console.log(JSON.stringify(res, null, 2));
  else report(res, Object.keys(baseline).length, Object.keys(actual).length);

  if (!res.ok) {
    console.log(
      `\n✗ PARITY FAILED — ${res.lost.length} lost, ${res.missing.length} missing, ${res.changed.length} regressed.`
    );
    process.exit(1);
  }
  console.log('\n✓ parity holds — every baseline test still runs.');
}
