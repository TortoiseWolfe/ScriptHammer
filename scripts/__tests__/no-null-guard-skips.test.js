/**
 * No `test.skip(!<value>, ...)` null-guards in tests/e2e (#1378).
 *
 * Seed helpers used to return null on failure and ~60 specs answered with
 * `test.skip(!fixture, 'isolation seed failed')`. A run with no service-role key, or a
 * broken seed, then reported every one of them as skipped and the lane stayed green: a
 * skip is not a pass. Seed helpers now throw; a spec that needs a fixture lets that
 * throw fail the test.
 *
 * The scan strips comments first, so prose that quotes the old pattern does not trip it,
 * and it only reads tests/e2e, so this file's own source is never scanned. A control
 * proves the matcher can fail.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const E2E_DIR = path.resolve(__dirname, '..', '..', 'tests', 'e2e');

// Capability guards: the environment cannot do the thing, which is not a seed failing.
const ALLOWED = [
  // The service worker did not activate in this browser.
  { file: 'tests/e2e/tests/pwa-installation.spec.ts', cond: '!swActive' },
  // WebGL / GPU availability (#288).
  { file: 'tests/e2e/twin-walk-visible.spec.ts', cond: '!gpu.webgl' },
  { file: 'tests/e2e/twin-walk-visible.spec.ts', cond: '!hasWebGL' },
  { file: 'tests/e2e/twins.spec.ts', cond: '!(await webglAvailable(page' },
  // Hosted lane: admin seeding is refused against a non-local backend.
  { file: 'tests/e2e/admin/', cond: '!isLocalSupabaseUrl(resolveBackendUrl(' },
  // Backend CAPTCHA is the real Turnstile, not the local test key.
  {
    file: 'tests/e2e/auth/sign-up.spec.ts',
    cond: '!isLocalTurnstileTestEnabled(',
  },
  // Live Stripe sandbox credentials are present only on a developer machine (#188).
  {
    file: 'tests/e2e/payment/08-subscription-lifecycle.spec.ts',
    cond: '!isLiveStripeConfigured',
  },
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

// `test.skip(` / `testInfo.skip(` whose first argument starts with a single `!`.
const NULL_GUARD = /\b(?:test|testInfo)\.skip\(\s*(!(?!!)[^,)]*)/g;

function findNullGuards(src) {
  const code = stripComments(src);
  const hits = [];
  for (const m of code.matchAll(NULL_GUARD)) {
    const line = code.slice(0, m.index).split('\n').length;
    hits.push({ line, cond: m[1].trim() });
  }
  return hits;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.(ts|tsx|js|mjs)$/.test(e.name) ? [p] : [];
  });
}

describe('no null-guard skips in tests/e2e (#1378)', () => {
  it('control: the matcher flags a null-guard and ignores comments and !!', () => {
    assert.strictEqual(
      findNullGuards("test.skip(!fixture, 'seed failed');").length,
      1
    );
    assert.strictEqual(
      findNullGuards("test.skip(\n  !panel,\n  'not rendered'\n);").length,
      1
    );
    assert.strictEqual(
      findNullGuards("// test.skip(!fixture, 'x')\n/* test.skip(!a, 'b') */")
        .length,
      0
    );
    assert.strictEqual(
      findNullGuards("test.skip(!!process.env.CI, 'x');").length,
      0
    );
  });

  it('finds the e2e sources it is meant to scan', () => {
    assert.ok(walk(E2E_DIR).length > 20);
  });

  it('has no test.skip(!<value>) outside the capability allowlist', () => {
    const offenders = [];
    for (const file of walk(E2E_DIR)) {
      const rel = path.relative(path.resolve(E2E_DIR, '..', '..'), file);
      for (const h of findNullGuards(fs.readFileSync(file, 'utf8'))) {
        if (ALLOWED.some((a) => rel.startsWith(a.file) && h.cond === a.cond))
          continue;
        offenders.push(`${rel}:${h.line}  test.skip(${h.cond}, ...)`);
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      'Null-guard skips turn a failed seed into a green run. Let the seed helper throw, or ' +
        'assert with expect(). Capability guards go in ALLOWED with a reason:\n' +
        offenders.join('\n')
    );
  });
});
