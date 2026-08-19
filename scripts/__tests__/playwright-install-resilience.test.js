/**
 * `playwright install --with-deps` must survive a bad apt mirror (#762, #798).
 *
 * THIS FILE REPLACES `playwright-install-bounded.test.js`, WHICH GUARDED THE WRONG
 * PROPERTY. It required a wall-clock `timeout` around the install. That wrapper is
 * now forbidden, and the rename is deliberate: a guard named for a property that
 * turned out to be harmful is worse than no guard, because it passes while the thing
 * it names breaks production lanes.
 *
 * THE ORIGINAL BUG (#762). `--with-deps` shells out to `apt-get` as root, and apt
 * does not exit when a mirror is unreachable — it waits. The retry loop around it
 * reads `&& break`, which retries on a non-zero EXIT, so a hang meant `i` never
 * reached 2 and the three attempts written to survive a bad install could not run.
 * Eight jobs sat in that step ~26 minutes and were killed by the 30-minute cap
 * having run ZERO tests, reddening a required check with no failing test anywhere.
 *
 * THE FIX THAT DIDN'T WORK, TWICE (#798). Wrapping the command in `timeout`:
 *
 *   - `timeout 300` broke PR #797. apt was actively downloading fonts — 3.5 MB,
 *     5.6 MB, 3.0 MB, every `Get:` line real progress — and was killed mid-download.
 *   - `timeout 480`, plus apt's own timeouts, plus a 60s dpkg-lock wait, broke PR
 *     #799 identically: still downloading at 480s, and the orphan was still running
 *     when the lock-wait gave up.
 *
 * Two structural reasons, and they rule out every value of the number:
 *
 *   1. A wall-clock bound cannot tell STALLED from SLOW. The real hang was 26
 *      minutes of total silence; a slow mirror looks identical from outside.
 *   2. `timeout` signals the `pnpm exec` wrapper, not the `apt-get` beneath it,
 *      which runs as ROOT, survives, and keeps holding
 *      /var/lib/dpkg/lock-frontend — so every retry after it dies in ~1s on
 *      "Could not get lock". The bound poisons the retries it was added to rescue.
 *
 * WHAT ACTUALLY BOUNDS IT, in layers that can observe what they bound:
 *
 *   apt's `Acquire::*::Timeout`  a STALLED mirror exits non-zero in ~60s, with no
 *                               orphan and no held lock, and the retry loop handles
 *                               it. Load-bearing; this is the #762 fix.
 *   `timeout-minutes: 30`       the outer backstop. A job-level cap is the only
 *                               bound that cannot leave a poisoned runner behind,
 *                               because the runner dies with it.
 *
 * WHAT THIS CANNOT CHECK: that the apt config is APPLIED at runtime — only that it
 * is written above every call site. Stated so a green run is not over-read.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');

function workflowFiles() {
  return fs.readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f));
}

/**
 * Every line in every workflow that INVOKES `playwright install`.
 *
 * Anchored on `pnpm exec`, not on the bare string: an earlier version matched
 * `playwright install` anywhere and flagged the `echo "Retry $i: playwright install
 * failed..."` messages as call sites.
 *
 * `--dry-run` is excluded, and the distinction is real rather than a convenience.
 * `playwright install-deps --dry-run` PRINTS the apt command and runs nothing — #801
 * uses it to hash the dependency set into a cache key. It touches no mirror and holds
 * no dpkg lock, so requiring apt timeouts above it would be requiring protection
 * against a call that cannot fail that way. A `install-deps` WITHOUT `--dry-run` does
 * invoke apt and is still caught.
 */
function installSites() {
  const sites = [];
  for (const file of workflowFiles()) {
    const lines = fs
      .readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')
      .split('\n');
    lines.forEach((text, i) => {
      const trimmed = text.trim();
      if (
        /pnpm exec playwright install/.test(trimmed) &&
        !/--dry-run/.test(trimmed) &&
        !trimmed.startsWith('#')
      ) {
        sites.push({ file, line: i + 1, text: trimmed, lines, index: i });
      }
    });
  }
  return sites;
}

/** Is this invocation wrapped in a wall-clock `timeout`? It must NOT be. */
function hasWallClockTimeout(text) {
  return /\btimeout\s+\d+\s+pnpm exec playwright install/.test(text);
}

/**
 * Does an apt network-timeout config get written above this call site, IN THE SAME STEP?
 *
 * This used to scan a fixed 30-line window, and that number was arbitrary: #809 added a
 * comment explaining the idle bound, which pushed the config to 33 lines above the call
 * and would have failed the guard for a reason that has nothing to do with the property.
 *
 * The property was never "within N lines" — it is "in the same `run:` block, above the
 * call". Scanning up to the enclosing step boundary (`- name:`) asserts exactly that, so
 * it cannot be defeated by a longer comment and cannot be satisfied by a config written
 * in a DIFFERENT step, which a large window would have allowed.
 */
function hasAptTimeoutsAbove(lines, index) {
  for (let i = index; i >= 0; i--) {
    if (/Acquire::http::Timeout/.test(lines[i])) return true;
    // Walked out of this step without finding it.
    if (/^\s*-\s+name:/.test(lines[i]) && i !== index) return false;
  }
  return false;
}

describe('playwright install survives a bad apt mirror (#762, #798, #829)', () => {
  it('finds install call sites at all', () => {
    // Without this every assertion below passes vacuously the moment the command is
    // renamed or moved into a composite action — the #396 shape.
    const sites = installSites();

    assert.ok(
      sites.length >= 5,
      `expected several 'playwright install' call sites across .github/workflows, ` +
        `found ${sites.length}. If the install moved, point this guard at its new ` +
        `home rather than deleting it.`
    );
  });

  it('lets apt give up on its own, at every call site', () => {
    // The load-bearing assertion. Without apt's own timeouts a stalled mirror hangs
    // until the job cap, having run zero tests (#762).
    const missing = installSites()
      .filter((s) => !hasAptTimeoutsAbove(s.lines, s.index))
      .map((s) => `${s.file}:${s.line}`);

    assert.deepEqual(
      missing,
      [],
      `'playwright install --with-deps' without apt network timeouts above it. ` +
        `apt HANGS rather than failing when a mirror is unreachable, and nothing ` +
        `else in the job can tell (#762).`
    );
  });

  it('is NOT wrapped in a wall-clock timeout', () => {
    // The inverted assertion, and the reason this file was renamed. Tried at 300s
    // (#797) and 480s (#799); both killed installs that were still downloading and
    // orphaned apt on the dpkg lock, which poisoned their own retries. No value of
    // the number is safe, because a wall-clock bound cannot see the difference
    // between a slow mirror and a stalled one.
    const wrapped = installSites()
      .filter((s) => hasWallClockTimeout(s.text))
      .map((s) => `${s.file}:${s.line}`);

    assert.deepEqual(
      wrapped,
      [],
      `'playwright install' wrapped in a wall-clock timeout. That cannot tell SLOW ` +
        `from STALLED, and killing apt mid-download orphans a root process holding ` +
        `/var/lib/dpkg/lock-frontend which makes every retry fail instantly. It ` +
        `broke two PRs (#797, #799). apt's own Acquire timeouts handle the stall; ` +
        `'timeout-minutes' is the outer backstop. See #798.`
    );
  });

  it('the required lane does not install Playwright at all any more (#829)', () => {
    // This assertion used to require the OPPOSITE: that e2e-local.yml fail loudly when
    // all three install attempts failed. That guarded a mitigation. The mitigation is
    // gone because the install is gone — the lane runs the suite from an image that
    // already ships the browsers, so there is nothing to download, retry or bound.
    //
    // Kept as an assertion rather than deleted, because a future edit re-adding
    // `playwright install` here would silently re-introduce the entire #809/#819
    // failure class: two third parties, 24 times per run.
    const yaml = fs.readFileSync(
      path.join(WORKFLOW_DIR, 'e2e-local.yml'),
      'utf8'
    );

    assert.doesNotMatch(
      yaml,
      /playwright install/,
      'e2e-local.yml installs Playwright again. It should run the suite from ' +
        'mcr.microsoft.com/playwright, which already has the browsers — installing ' +
        'them on the runner cost a median 11.6 min per shard and failed 17 of 25 ' +
        'shards on 2026-08-19 (#819, #829).'
    );
  });

  it('runs from an image whose tag matches the installed Playwright (#829)', () => {
    // A drifted tag is the failure mode Dockerfile.e2e already warns about: Playwright
    // refuses to drive browsers built for a different release, and the error points
    // nowhere near the cause.
    //
    // Compared against the RESOLVED version, never the `^1.55.0` range in package.json.
    // A range would let a lockfile bump pass this check while the image stayed behind —
    // the same staleness that made RETAIN_GENERATIONS misleading in #751.
    const yaml = fs.readFileSync(
      path.join(WORKFLOW_DIR, 'e2e-local.yml'),
      'utf8'
    );
    const tag = /mcr\.microsoft\.com\/playwright:v([\d.]+)-/.exec(yaml);
    assert.ok(tag, 'e2e-local.yml no longer pins a Playwright image tag');

    const resolved = require('@playwright/test/package.json').version;
    assert.strictEqual(
      tag[1],
      resolved,
      `the workflow runs mcr.microsoft.com/playwright:v${tag[1]} but the repo resolves ` +
        `@playwright/test to ${resolved}. Playwright refuses to drive browsers from a ` +
        `different release; bump the image tag with the package.`
    );
  });

  it('the detectors can actually fail', () => {
    // Controls. Without these, a regex that matches nothing reports every workflow
    // as correct and this file is decoration.
    assert.equal(
      hasWallClockTimeout(
        'timeout 480 pnpm exec playwright install --with-deps chromium'
      ),
      true,
      'a wrapped invocation must be detected as wrapped'
    );
    assert.equal(
      hasWallClockTimeout(
        'pnpm exec playwright install --with-deps chromium && break'
      ),
      false,
      'an unwrapped invocation must be detected as unwrapped'
    );
    assert.equal(
      hasAptTimeoutsAbove(['nothing here', 'pnpm exec playwright install'], 1),
      false,
      'a call site with no apt config above it must be detected as missing one'
    );
    assert.equal(
      hasAptTimeoutsAbove(
        ['Acquire::http::Timeout "20";', 'pnpm exec playwright install'],
        1
      ),
      true,
      'a call site with apt config above it must be detected as having one'
    );
    // Distance must NOT matter — only whether it is in the same step. #809's comment
    // pushed the config 33 lines up and the old fixed window would have failed on it.
    assert.equal(
      hasAptTimeoutsAbove(
        [
          'Acquire::http::Timeout "20";',
          ...Array(40).fill('  # comment'),
          'pnpm exec playwright install',
        ],
        41
      ),
      true,
      'a long comment between the config and the call must not fail the guard'
    );
    // But a config in a DIFFERENT step must not count, which a large window would
    // have wrongly accepted.
    assert.equal(
      hasAptTimeoutsAbove(
        [
          'Acquire::http::Timeout "20";',
          '      - name: Some other step',
          '        run: |',
          'pnpm exec playwright install',
        ],
        3
      ),
      false,
      'apt config in a previous step does not protect this call site'
    );
  });

  it('does not mistake `--dry-run` for an install that touches apt', () => {
    // #801 hashes `playwright install-deps --dry-run` into the cache key. That prints
    // the apt command and runs nothing, so it needs no apt timeouts above it — but a
    // real `install-deps` still does, and must stay caught. Both directions asserted,
    // because an over-broad exclusion here would silently un-guard the real thing.
    const isSite = (line) =>
      /pnpm exec playwright install/.test(line.trim()) &&
      !/--dry-run/.test(line.trim()) &&
      !line.trim().startsWith('#');

    assert.equal(
      isSite(
        'DEPS=$(pnpm exec playwright install-deps --dry-run chromium webkit)'
      ),
      false,
      '`--dry-run` runs no apt, so it is not a call site'
    );
    assert.equal(
      isSite('pnpm exec playwright install-deps chromium'),
      true,
      'a REAL install-deps does invoke apt and must still be caught'
    );
    assert.equal(
      isSite('pnpm exec playwright install --with-deps chromium'),
      true,
      'the ordinary install must still be caught'
    );
  });
});
