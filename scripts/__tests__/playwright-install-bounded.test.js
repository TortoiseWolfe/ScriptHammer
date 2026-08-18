/**
 * `playwright install --with-deps` must be time-bounded in every workflow (#762).
 *
 * WHAT WENT WRONG. `--with-deps` shells out to `apt-get` as root, and apt does not
 * exit when a mirror is unreachable — it waits. Every call site wrapped the install
 * in a retry loop shaped like:
 *
 *     for i in 1 2 3; do
 *       pnpm exec playwright install --with-deps chromium && break
 *       echo "Retry $i: ..."; sleep 10
 *     done
 *
 * `&& break` retries on a non-zero EXIT. A hang never exits, so `i` never reached 2
 * and the three attempts written to survive a bad install could not run. On
 * 2026-08-18 apt logged 18-26 `Ign:` lines against azure.archive.ubuntu.com, went
 * silent, and EIGHT jobs sat in that one step for ~26 minutes until the 30-minute
 * cap killed them — having run ZERO tests. `E2E (local) result`, a required check,
 * went red twice with no failing test anywhere and blocked a merge both times.
 *
 * This is the #765 shape: an escape hatch that could never fire, so the job died on
 * the line written to save it. `timeout` converts the hang into the exit code the
 * loop already knows how to handle.
 *
 * WHY THIS GUARDS ALL WORKFLOWS RATHER THAN THE ONE THAT FAILED. The same call site
 * is copied into `e2e.yml` (7x), `smoke.yml` and `signup-mailer.yml`. A guard on one
 * lane is how two lanes drift in the worst direction — the lesson `e2e-local-changes`
 * already records. `smoke.yml` runs post-deploy against LIVE production, so a silent
 * 30-minute hang there is worse, not better.
 *
 * WHAT THIS CANNOT CHECK: whether the bound is the right SIZE. 300s is ~6x a healthy
 * install here. If installs legitimately grow past it, this test still passes and the
 * lane starts failing fast instead of hanging — which is the better failure, and is
 * the point.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');

/**
 * Every line in every workflow that INVOKES `playwright install`.
 *
 * Matching `playwright install` alone is too broad and the first version of this
 * guard did exactly that: it flagged the `echo "Retry $i: playwright install
 * failed..."` lines and the `::error::` message as unbounded call sites. Anchoring on
 * `pnpm exec` is what separates running the command from talking about it.
 */
function installSites() {
  const sites = [];
  for (const file of fs
    .readdirSync(WORKFLOW_DIR)
    .filter((f) => /\.ya?ml$/.test(f))) {
    const lines = fs
      .readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')
      .split('\n');
    lines.forEach((text, i) => {
      const trimmed = text.trim();
      if (
        /pnpm exec playwright install/.test(trimmed) &&
        !trimmed.startsWith('#')
      ) {
        sites.push({ file, line: i + 1, text: trimmed });
      }
    });
  }
  return sites;
}

/**
 * Is this invocation bounded? The bound has to be on the COMMAND — a job-level
 * `timeout-minutes` does not help, because it kills the job rather than letting the
 * retry loop do its work, which is precisely the failure being fixed.
 */
function isBounded(text) {
  return /\btimeout\s+\d+\s+pnpm exec playwright install/.test(text);
}

describe('playwright install is time-bounded (#762)', () => {
  it('finds install call sites at all', () => {
    // Without this the assertions below pass vacuously the moment the command is
    // renamed or moved into a composite action — the #396 shape.
    const sites = installSites();

    assert.ok(
      sites.length >= 5,
      `expected several 'playwright install' call sites across .github/workflows, ` +
        `found ${sites.length}. If the install moved, point this guard at its new home ` +
        `rather than deleting it.`
    );
  });

  it('bounds EVERY invocation, in every workflow', () => {
    const unbounded = installSites().filter((s) => !isBounded(s.text));

    assert.deepEqual(
      unbounded.map((s) => `${s.file}:${s.line}`),
      [],
      `unbounded 'playwright install --with-deps' found. apt HANGS rather than ` +
        `failing when a mirror is unreachable, so the surrounding retry loop cannot ` +
        `fire and the job burns its whole timeout having run zero tests (#762). ` +
        `Wrap it: 'timeout 300 pnpm exec playwright install ...'`
    );
  });

  it('the detector can actually fail', () => {
    // The control. Without it, a regex that matches nothing would report every
    // workflow as bounded and this file would be decoration.
    assert.equal(
      isBounded('pnpm exec playwright install --with-deps chromium && break'),
      false,
      'the bare, unbounded form must be detected as unbounded'
    );
    assert.equal(
      isBounded(
        'timeout 300 pnpm exec playwright install --with-deps chromium'
      ),
      true,
      'the bounded form must be detected as bounded'
    );
    assert.equal(
      isBounded('timeout-minutes: 30'),
      false,
      'a job-level timeout-minutes is NOT a command bound — it kills the job instead ' +
        'of letting the retry loop run, which is the failure this guards against'
    );
  });

  it('the required lane fails loudly instead of falling through', () => {
    // If all three bounded attempts fail, the loop simply ends. Without an explicit
    // failure the test step then launches browsers that were never installed and the
    // shard dies somewhere unrelated — which is how an install outage gets diagnosed
    // as a test bug.
    const yaml = fs.readFileSync(
      path.join(WORKFLOW_DIR, 'e2e-local.yml'),
      'utf8'
    );

    assert.match(
      yaml,
      /playwright install did not succeed in 3 bounded attempts/,
      'e2e-local.yml must fail explicitly when every install attempt fails, rather ' +
        'than continuing into the test step with no browsers'
    );
  });
});
