/**
 * Everything the test process READS must survive the container env filter (#829).
 *
 * WHAT WENT WRONG, TWICE. Playwright now runs inside an image (`scripts/ci/
 * playwright-in-container.sh`), so the suite only sees variables explicitly forwarded
 * through `--env-file`. The forwarding is a `grep -E` over `env`, and it has been wrong
 * in two different ways within one day:
 *
 *   1. `^(CI|…|NEXT_PUBLIC_|SUPABASE_)=` binds the `=` to EVERY branch of the
 *      alternation, so a PREFIX only matches when it is the whole variable name. That
 *      forwarded exactly two variables, dropped every Supabase credential, and failed
 *      25 of 26 jobs — as `getaddrinfo EAI_AGAIN supabase-kong` three hundred lines
 *      downstream, because the suite fell back to the workspace `.env` (#830).
 *   2. With that fixed, seven variables no prefix covered were still missing —
 *      `MAILPIT_URL` among them, without which the signup-mailer lane cannot observe a
 *      delivered message at all.
 *
 * Both were found by reading, not by a failing check. This is the check.
 *
 * WHY DERIVE THE LIST. A hand-maintained roster of forwarded names drifts the moment
 * someone adds `process.env.SOMETHING_NEW` to a spec, and the failure it produces is a
 * confusing one far from the cause. So the expectation is computed from the sources.
 *
 * WHAT THIS CANNOT CHECK: that a forwarded variable is SET in CI, or that its value is
 * right. It asserts the pipe is connected, not what flows through it.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ci', 'playwright-in-container.sh');

/** The `-e '…'` patterns the script hands to grep. */
function filterPatterns(src) {
  const line = src.split('\n').find((l) => l.startsWith('env | grep'));
  if (!line) return [];
  return [...line.matchAll(/-e\s+'([^']+)'/g)].map((m) => m[1]);
}

/**
 * Does the filter forward a variable of this name?
 *
 * Mirrors grep's own semantics deliberately, including the trap: a pattern ending in
 * `=` only matches when the name is followed by `=`, so a prefix family written inside
 * such a group matches nothing but its literal self.
 */
function forwards(patterns, name) {
  return patterns.some((p) => new RegExp(p).test(`${name}=value`));
}

/** Every `process.env.X` the test process could evaluate. */
function readsEnv() {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|mts|js)$/.test(e.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, 'tests', 'e2e'));
  for (const f of fs.readdirSync(ROOT)) {
    if (/^playwright.*\.config\.ts$/.test(f)) files.push(path.join(ROOT, f));
  }
  const names = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

describe('the container gets every variable the suite reads (#829)', () => {
  it('parses the filter and finds a substantial set of reads', () => {
    // Non-vacuity, both halves. A filter that parsed to [] would make `forwards`
    // return false for everything and the main test would fail loudly rather than
    // silently — but an empty READS list would make it pass against nothing, which is
    // the #396 shape this repo keeps paying for.
    const patterns = filterPatterns(fs.readFileSync(SCRIPT, 'utf8'));
    assert.ok(
      patterns.length >= 2,
      `expected at least two -e patterns in the filter, parsed ${patterns.length}`
    );
    assert.ok(
      readsEnv().length >= 15,
      `expected the suite to read many env vars, found ${readsEnv().length}`
    );
  });

  it('forwards every variable the suite reads', () => {
    const patterns = filterPatterns(fs.readFileSync(SCRIPT, 'utf8'));
    const dropped = readsEnv().filter((n) => !forwards(patterns, n));

    assert.deepEqual(
      dropped,
      [],
      `these variables are read by the E2E sources but are NOT forwarded into the ` +
        `container, so the suite will see them undefined and fall back to the ` +
        `workspace .env: ${dropped.join(', ')}. Add them to the exact-name group in ` +
        `scripts/ci/playwright-in-container.sh (#829).`
    );
  });

  it('the detector can actually fail', () => {
    // Control 1: an unknown name must NOT be forwarded, or the check is a rubber stamp.
    const real = filterPatterns(fs.readFileSync(SCRIPT, 'utf8'));
    assert.equal(
      forwards(real, 'TOTALLY_MADE_UP_VARIABLE'),
      false,
      'the filter appears to forward everything'
    );

    // Control 2: THE #830 BUG ITSELF, pinned. With the `=` bound to every branch, a
    // prefix family matches nothing — this is the exact pattern that shipped, and it
    // must be reported as dropping Supabase credentials.
    const broken = ['^(CI|BASE_URL|NEXT_PUBLIC_|SUPABASE_)='];
    assert.equal(forwards(broken, 'CI'), true, 'exact names still matched');
    assert.equal(
      forwards(broken, 'NEXT_PUBLIC_SUPABASE_URL'),
      false,
      'the anchored-alternation bug must be detectable — this is what #830 shipped'
    );

    // Control 3: the corrected split forwards the same name.
    const fixed = ['^(CI|BASE_URL)=', '^(NEXT_PUBLIC_|SUPABASE_)'];
    assert.equal(forwards(fixed, 'NEXT_PUBLIC_SUPABASE_URL'), true);
  });
});
