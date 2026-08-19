/**
 * Every lane runs Playwright from the image that already has the browsers (#829).
 *
 * THIS FILE WAS `playwright-install-resilience.test.js`, AND THE RENAME IS THE POINT.
 * It guarded that `playwright install --with-deps` retried properly around a bad apt
 * mirror. There is no longer an install to guard, in any lane — so a file by that name
 * would keep passing while measuring nothing, which is the exact failure its own header
 * warned about ("a guard named for a property that turned out to be harmful is worse
 * than no guard"). One of its assertions had already reached that state: "lets apt give
 * up on its own, AT EVERY CALL SITE" passed green against zero call sites.
 *
 * WHY THE INSTALLS WENT AWAY — the history is load-bearing, because the cure is only
 * obviously right if you know what it replaced:
 *
 *   #762  `--with-deps` shells out to `apt-get` as root, and apt does not exit when a
 *         mirror is unreachable — it waits. The retry loop read `&& break`, which
 *         retries on non-zero EXIT, so a hang meant the three attempts could never run.
 *         Eight jobs sat ~26 minutes and were killed by the 30-minute cap having run
 *         ZERO tests: a required check red with no failing test anywhere.
 *   #798  Wrapping it in `timeout` failed twice (PRs #797, #799) for two structural
 *         reasons that rule out every value of the number: a wall-clock bound cannot
 *         tell STALLED from SLOW, and `timeout` signals the `pnpm exec` wrapper, not
 *         the root `apt-get` beneath it — which survives holding the dpkg lock, so
 *         every subsequent retry dies in ~1s on "Could not get lock".
 *   #829  Measured cost of keeping it: a median 11.6 min per shard, ~158 runner-minutes
 *         per run, 24 network fetches that could each fail independently.
 *
 * THE EVIDENCE THAT IT WORKED, on two consecutive commits of `main`:
 *   6a4e8f57 (installs present) — 8 jobs failed, EVERY ONE at `Install Playwright`,
 *                                 zero test failures.
 *   d45cfdc2 (installs removed) — 26 jobs, 0 failures, 0 install steps.
 *
 * WHAT THIS CANNOT CHECK: that the image actually pulls, or that a browser launches. It
 * asserts the lanes are wired to the image and that nothing has quietly gone back to
 * installing — stated so a green run is not over-read.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');
const RUNNER = path.join(
  REPO_ROOT,
  'scripts',
  'ci',
  'playwright-in-container.sh'
);

const workflows = () =>
  fs
    .readdirSync(WORKFLOW_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => ({
      file: f,
      src: fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8'),
    }));

/** Lines that would install browsers on the runner, ignoring comments. */
const installSites = () =>
  workflows().flatMap(({ file, src }) =>
    src
      .split('\n')
      .map((line, i) => ({ file, line, n: i + 1 }))
      .filter(
        ({ line }) => !/^\s*#/.test(line) && /playwright\s+install/.test(line)
      )
  );

/** Lines that actually run the suite, ignoring comments. */
const runSites = () =>
  workflows().flatMap(({ file, src }) =>
    src
      .split('\n')
      .map((line, i) => ({ file, line, n: i + 1 }))
      .filter(
        ({ line }) =>
          !/^\s*#/.test(line) &&
          /(playwright-in-container\.sh|playwright)\s+test\b|pnpm\s+test:e2e/.test(
            line
          )
      )
  );

describe('the lanes run Playwright from the image (#829)', () => {
  it('finds the invocations at all', () => {
    // NON-VACUITY, and it is the whole reason this test can be trusted. "No lane
    // installs Playwright" is trivially true of a repo with no lanes, of a glob that
    // matched nothing, and of a parser that broke. Anchor on the thing that must EXIST.
    const runs = runSites();
    assert.ok(
      runs.length >= 8,
      `expected to find the suite being run in several workflows, found ${runs.length}. ` +
        `Every assertion below would pass vacuously against an empty set.`
    );
    assert.ok(fs.existsSync(RUNNER), `${RUNNER} is missing — nothing can run`);
  });

  it('no workflow installs browsers on the runner', () => {
    const sites = installSites();
    assert.deepEqual(
      sites.map((s) => `${s.file}:${s.n}`),
      [],
      `these lines install Playwright on the runner. That is what #762, #798 and #819 ` +
        `were: a required check going red in the install step with no failing test. ` +
        `The browsers ship in the image — run the suite through ` +
        `scripts/ci/playwright-in-container.sh instead (#829).`
    );
  });

  it('every invocation goes through the shared runner', () => {
    // A lane calling `pnpm exec playwright test` directly would have no browsers, and
    // would fail in a way that reads like a test failure rather than a wiring mistake.
    const stray = runSites().filter(
      ({ line }) => !/playwright-in-container\.sh/.test(line)
    );
    assert.deepEqual(
      stray.map((s) => `${s.file}:${s.n}: ${s.line.trim()}`),
      [],
      'these invocations bypass the container runner and would find no browsers'
    );
  });

  it('the image tag matches the installed Playwright', () => {
    // Playwright refuses to drive browsers built for a different release, and the
    // error points nowhere near the cause.
    const runner = fs.readFileSync(RUNNER, 'utf8');
    const tag = /mcr\.microsoft\.com\/playwright:v([0-9.]+)/.exec(runner);
    assert.ok(tag, 'no pinned Playwright image found in the runner script');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
    );
    const dep =
      pkg.devDependencies?.['@playwright/test'] ??
      pkg.dependencies?.['@playwright/test'];
    assert.ok(dep, '@playwright/test is not a dependency');

    assert.equal(
      tag[1],
      dep.replace(/^[^0-9]*/, ''),
      `the image is pinned to v${tag[1]} but package.json has @playwright/test ` +
        `${dep}. Browsers and client must match; bump both together.`
    );
  });

  it('the runner refuses to start when a required credential is missing', () => {
    // The failure mode this replaced was not the typo, it was the SILENT FALLBACK: with
    // no URL forwarded, dotenv loaded the workspace .env (container-side hostnames) and
    // the run died 300 lines later as `getaddrinfo EAI_AGAIN supabase-kong` (#830).
    const runner = fs.readFileSync(RUNNER, 'utf8');
    assert.match(
      runner,
      /PLAYWRIGHT_REQUIRED_ENV/,
      'the runner no longer asserts that required credentials were forwarded'
    );
    assert.match(runner, /::error::/, 'the assertion does not fail loudly');
  });

  it('the lane that needs credentials arms that assertion', () => {
    // The check is parameterised, so moving it into the shared script without a lane
    // DECLARING its requirements would silently disarm the protection #830 added.
    const local = workflows().find((w) => w.file === 'e2e-local.yml');
    assert.ok(local, 'e2e-local.yml is missing');
    assert.match(
      local.src,
      /PLAYWRIGHT_REQUIRED_ENV:.*NEXT_PUBLIC_SUPABASE_URL/,
      'the required E2E lane does not declare the credentials it cannot run without, ' +
        'so the runner would let it fall back to .env (#830)'
    );
  });

  it('the detectors can actually fail', () => {
    // Controls. Each helper is shown rejecting the thing it must reject and accepting
    // the thing it must accept — four probes written in one session here were wrong in
    // exactly this way, and each was caught by an impossible number rather than a red.
    const hasInstall = (line) =>
      !/^\s*#/.test(line) && /playwright\s+install/.test(line);
    assert.equal(
      hasInstall('  pnpm exec playwright install --with-deps'),
      true
    );
    assert.equal(
      hasInstall(
        '  # No install step (#829): the browsers come from the image.'
      ),
      false,
      'a comment explaining the absence must not read as an install'
    );
    assert.equal(
      hasInstall('  scripts/ci/playwright-in-container.sh test'),
      false
    );

    const isRun = (line) =>
      !/^\s*#/.test(line) &&
      /(playwright-in-container\.sh|playwright)\s+test\b|pnpm\s+test:e2e/.test(
        line
      );
    assert.equal(
      isRun('  scripts/ci/playwright-in-container.sh test --project=x'),
      true
    );
    assert.equal(isRun('  pnpm exec playwright test --project=x'), true);
    assert.equal(isRun('  pnpm test:e2e:smoke'), true);
    assert.equal(isRun('  # run the suite'), false);
  });
});
