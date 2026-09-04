/**
 * `Test Report` must be able to report failure (#1069).
 *
 * It could not. On run 33830200821 it merged every shard's blob report, emitted ten
 * annotations naming three failed tests, and reported SUCCESS — because it was reporting on
 * whether MERGING worked, and merging worked. Meanwhile the two red shard jobs carried only
 * "Process completed with exit code 1" and their logs ended in artifact-upload noise. The
 * reader's eye goes to the red check, finds nothing, and the job that knows sits green.
 *
 * Two real user-facing defects rode that gap for a day: #1068's avatar-upload rollback, and a
 * $99 SKU advertised on /pricing that was absent from the production `products` table.
 *
 * So the comparator is driven here in both directions, and the passing case is not optional:
 * without it, every assertion below is satisfied by a script that always exits 1.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'ci', 'e2e-report-verdict.mjs');
const load = () => import(`file://${SCRIPT}`);

const ESC = String.fromCharCode(27);

/**
 * One spec in Playwright's merged-JSON shape.
 *
 * `errors: [...]` is the REAL shape — verified by generating a merged report from an actual
 * Playwright run on 2026-09-04, whose result objects carry
 * `workerIndex, parallelIndex, status, duration, errors, stdout, stderr, retry, …` and NO
 * singular `error` key. The first version of these fixtures used `error: {message}`, so every
 * test passed while exercising a branch that never fires in CI. `shape` lets each case say
 * which form it means; the default is the one production actually produces.
 */
const spec = (title, line, status, error, shape = 'errors') => ({
  title,
  file: 'tests/e2e/commerce/pricing-links.spec.ts',
  line,
  tests: [
    {
      status,
      projectName: 'chromium-gen',
      results: [
        error
          ? shape === 'errors'
            ? { errors: [{ message: error }] }
            : { error: { message: error } }
          : {},
      ],
    },
  ],
});

const report = (specs, stats) => ({
  stats,
  suites: [
    {
      title: 'commerce',
      file: 'tests/e2e/commerce/pricing-links.spec.ts',
      suites: [
        {
          title: 'pricing',
          file: 'tests/e2e/commerce/pricing-links.spec.ts',
          specs,
        },
      ],
    },
  ],
});

const HEALTHY = () =>
  report(
    [
      spec('passes fine', 12, 'expected'),
      spec('also passes', 70, 'expected'),
      spec('deliberately skipped', 60, 'skipped'),
    ],
    { expected: 2, unexpected: 0, flaky: 0, skipped: 1 }
  );

/** Run the CLI on a temp file; returns {code, stdout, stderr, summary}. */
function run(json) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-verdict-'));
  const file = path.join(dir, 'report.json');
  const summaryFile = path.join(dir, 'summary.md');
  if (json !== undefined) fs.writeFileSync(file, JSON.stringify(json));
  const r = spawnSync(process.execPath, [SCRIPT, file], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile },
  });
  const summary = fs.existsSync(summaryFile)
    ? fs.readFileSync(summaryFile, 'utf8')
    : '';
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, summary };
}

describe('the E2E test-report verdict (#1069)', () => {
  it('passes a clean run — the control the red tests below depend on', () => {
    const r = run(HEALTHY());
    assert.strictEqual(
      r.code,
      0,
      `expected exit 0, got ${r.code}: ${r.stderr}`
    );
    assert.match(r.summary, /✅/);
    assert.match(r.summary, /0 failed/);
  });

  it('WOULD HAVE CAUGHT the office-hours SKU — fails, and names the test', () => {
    // The real failure from 2026-09-03, which sat under a green `Test Report` for a day.
    const r = run(
      report(
        [
          spec(
            'every advertised SKU resolves',
            39,
            'unexpected',
            'Expected checkout to accept prd-office-hours, got 400'
          ),
          spec('passes fine', 12, 'expected'),
        ],
        { expected: 1, unexpected: 1, flaky: 0, skipped: 0 }
      )
    );
    assert.strictEqual(r.code, 1, 'a failed test must fail the job');
    assert.match(r.summary, /every advertised SKU resolves/);
    assert.match(r.summary, /pricing-links\.spec\.ts:39/);
    assert.match(r.summary, /prd-office-hours/);
    // An annotation on THIS job, so the red check and the detail are the same place.
    assert.match(
      r.stderr,
      /::error file=tests\/e2e\/commerce\/pricing-links\.spec\.ts,line=39::/
    );
  });

  it('strips ANSI colour from the error, so the summary stays readable', () => {
    const r = run(
      report(
        [
          spec(
            'coloured failure',
            39,
            'unexpected',
            `${ESC}[31mExpected${ESC}[39m  a value,\n   got none`
          ),
        ],
        { unexpected: 1 }
      )
    );
    assert.strictEqual(r.code, 1);
    assert.doesNotMatch(r.summary, /\[/);
    // Newlines collapsed too — a multi-line diff would destroy the markdown table.
    assert.match(r.summary, /\| Expected a value, got none \|/);
  });

  it('reads the error from `errors[]`, the shape real reports use', () => {
    // Generated from a real Playwright run: result objects have `errors: [...]` and no
    // singular `error`. Both forms are accepted, but this is the one that fires in CI.
    for (const shape of ['errors', 'error']) {
      const r = run(
        report(
          [spec('boom', 39, 'unexpected', 'checkout returned 400', shape)],
          { unexpected: 1 }
        )
      );
      assert.strictEqual(r.code, 1, `${shape} shape must still fail`);
      assert.match(
        r.summary,
        /checkout returned 400/,
        `the error text was lost for the "${shape}" shape`
      );
    }
  });

  it('reports flaky tests without failing on them', () => {
    // `retries: 2` reports a retry-passed test as a PASS, which is how four rode into main
    // behind green ticks (#300). Named here, but the job stays green — the flaky gate owns
    // that decision, and two jobs failing for one reason is noise.
    const r = run(
      report(
        [spec('retried then passed', 50, 'flaky'), spec('ok', 12, 'expected')],
        {
          expected: 1,
          flaky: 1,
        }
      )
    );
    assert.strictEqual(r.code, 0, 'a flake must not fail this job');
    assert.match(r.summary, /⚠️/);
    assert.match(r.summary, /retried then passed/);
  });

  it('does not count an expected failure as a failure', () => {
    // Playwright's `expected` means "the outcome matched what the test declared", which for
    // a test.fail() is a FAILURE that passed. Treating it as red would make the repo's own
    // `test.fail()` convention unusable (#511).
    const r = run(
      report([spec('known-bad, declared', 12, 'expected')], { expected: 1 })
    );
    assert.strictEqual(r.code, 0);
  });

  it('an empty report is a failed observation, not a pass', () => {
    // Reachable: every shard skipped, or a merge that produced an empty tree. The same
    // anti-vacuity rule the schema-drift checks follow.
    const r = run({ stats: {}, suites: [] });
    assert.strictEqual(r.code, 1);
    assert.match(r.stderr, /NO tests/);
    assert.match(r.summary, /no tests/i);
  });

  it('a missing report is a failure, deliberately unlike the flaky gate', () => {
    // check-flaky-count.mjs tolerates a missing report and is right to: absence is not
    // evidence of a flake. This script asks whether the tests PASSED, and absence is not
    // evidence that they did.
    const r = run(undefined);
    assert.strictEqual(r.code, 1);
    assert.match(r.stderr, /no readable merged report/);
  });

  it('walks the tree rather than trusting stats, and says when they disagree', async () => {
    // #934: a required aggregate reported PASS while three of its shards reported FAIL,
    // because it rebuilt a verdict from artifacts instead of reading one.
    const r = run(
      report([spec('really failed', 39, 'unexpected', 'boom')], {
        expected: 1,
        unexpected: 0, // a lying stats block
      })
    );
    assert.strictEqual(r.code, 1, 'the walked tree must win over stats');
    assert.match(r.stdout, /stats\.unexpected=0 but walked 1/);
  });

  it('counts nested suites, not just the top level', async () => {
    const { collect } = await load();
    const nested = {
      suites: [
        {
          specs: [],
          suites: [
            { specs: [spec('deep failure', 9, 'unexpected', 'x')], suites: [] },
          ],
        },
      ],
    };
    const acc = collect(nested.suites);
    assert.strictEqual(acc.failed.length, 1);
    assert.strictEqual(acc.failed[0].title, 'deep failure');
  });
});

describe('the verdict is wired into the report job', () => {
  const yml = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '.github', 'workflows', 'e2e.yml'),
    'utf8'
  );

  it('runs, and runs even when a shard failed', () => {
    // A failing shard is exactly when this matters most, so it cannot be `success()`-gated.
    const idx = yml.indexOf('e2e-report-verdict.mjs');
    assert.notStrictEqual(idx, -1, 'the verdict script is never invoked');
    const step = yml.slice(Math.max(0, idx - 400), idx);
    assert.match(step, /if:\s*always\(\)/);
  });

  it('the shard jobs print their failures instead of only uploading a blob', () => {
    // `--reporter=blob` alone emits nothing human-readable, which is why a red shard's log
    // ended in artifact-upload noise. `list` puts the failing test names in the red job.
    const shards = [...yml.matchAll(/--reporter=([^\s\\]+)/g)].map((m) => m[1]);
    const blobs = shards.filter((r) => r.startsWith('blob'));
    assert.ok(
      blobs.length >= 3,
      `expected 3 blob-reporting shards, found ${blobs.length}`
    );
    for (const r of blobs) {
      assert.match(
        r,
        /(^|,)list(,|$)/,
        `shard reporter "${r}" has no human-readable output`
      );
    }
  });
});
