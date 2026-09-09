/**
 * The usage report measures the right thing, and can never block a merge (#1138).
 *
 * TWO THINGS MAKE THE OBVIOUS IMPLEMENTATION WRONG, and both are pinned here because both
 * produce a plausible-looking report that is silently false:
 *
 *   1. `/actions/runs/{id}/timing` reports BILLABLE time, and a public repo is not billed — it
 *      answers `total_ms: 0` with every job at `duration_ms: 0`. A report built on it is a wall
 *      of zeros that reads as success.
 *   2. GitHub bills each JOB rounded UP to the whole minute. Summing raw seconds under-reports
 *      by ~13%. Validated against the billing API for 2026-09-08 — 157 runs, 677 jobs:
 *      raw 2,636 min (87.0%), ceil-per-job 2,974 min (98.2%), billed 3,028 min.
 *
 * AND IT MUST NOT BE ABLE TO FAIL. Net cost is $0.00, so a threshold that reddens a check would
 * be worse than the problem. That is easy to state and easy to erode — one `exit 1` "just for
 * the really bad case" and it is a gate. Asserted below rather than trusted.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ci', 'actions-usage-report.mjs');
const WF = path.join(ROOT, '.github', 'workflows', 'actions-usage.yml');
const mod = () => import(`file://${SCRIPT}`);

/** Full-line comments only, so a guard cannot match its own explanation. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the Actions usage report (#1138)', () => {
  it('bills a job the way GitHub does: whole minutes, rounded UP', async () => {
    const { billedMinutes } = await mod();
    // The 13% error. 61 seconds is two billed minutes, not 1.02.
    assert.strictEqual(
      billedMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:01:01Z'),
      2
    );
    assert.strictEqual(
      billedMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z'),
      1
    );
    assert.strictEqual(
      billedMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z'),
      1
    );
    // A job that never ran costs nothing, and must not become NaN in a total.
    assert.strictEqual(
      billedMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      0
    );
    assert.strictEqual(billedMinutes(null, null), 0);
  });

  it('ANTI-VACUITY: rounding up is what separates it from summing seconds', async () => {
    const { billedMinutes } = await mod();
    // 677 jobs of 61s each: the real shape of the 2026-09-08 sample. Summing seconds gives
    // 688 minutes; billing gives 1354. If this ever equals the former, the report has silently
    // reverted to the number that was 13% low.
    const jobs = 677;
    const billed =
      jobs * billedMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:01:01Z');
    const rawMinutes = Math.round((jobs * 61) / 60);
    assert.strictEqual(billed, 1354);
    assert.notStrictEqual(billed, rawMinutes);
  });

  it('percentiles are nearest-rank and survive an empty set', async () => {
    const { percentile } = await mod();
    const oneToHundred = [...Array(100).keys()].map((i) => i + 1);
    assert.strictEqual(percentile(oneToHundred, 95), 95);
    assert.strictEqual(percentile(oneToHundred, 50), 50);
    assert.strictEqual(percentile([7], 95), 7);
    // A workflow that produced no timed jobs must render as "—", not crash the whole report.
    assert.strictEqual(percentile([], 95), null);
  });

  it('a negative queue wait is clamped, not propagated', async () => {
    const { queueSeconds } = await mod();
    // Clock skew between the queueing and running hosts produces small negatives. Left alone
    // they drag a p95 downward, which is the direction that hides a problem.
    assert.strictEqual(
      queueSeconds('2026-01-01T00:00:10Z', '2026-01-01T00:00:00Z'),
      0
    );
    assert.strictEqual(
      queueSeconds('2026-01-01T00:00:00Z', '2026-01-01T00:00:30Z'),
      30
    );
  });

  it('totals per workflow, and ranks by the thing that is scarce', async () => {
    const { summarise } = await mod();
    const s = summarise([
      {
        name: 'E2E (local Supabase)',
        jobs: [
          {
            created_at: 'T0',
            started_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T00:10:00Z',
          },
          {
            created_at: '2026-01-01T00:00:00Z',
            started_at: '2026-01-01T00:05:00Z',
            completed_at: '2026-01-01T00:15:00Z',
          },
        ],
      },
      {
        name: 'CI',
        jobs: [
          {
            created_at: '2026-01-01T00:00:00Z',
            started_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T00:01:00Z',
          },
        ],
      },
    ]);
    assert.strictEqual(s.jobs, 3);
    assert.strictEqual(s.minutes, 21);
    assert.strictEqual(
      s.rows[0].name,
      'E2E (local Supabase)',
      'rows are not sorted by minutes'
    );
    assert.strictEqual(s.rows[0].minutes, 20);
    assert.strictEqual(s.rows[0].max, 300);
  });

  it('a job with no timestamps is skipped, not counted as free', async () => {
    const { summarise } = await mod();
    // A queued-but-never-started job has null timestamps. Counting it as a zero-minute job
    // would understate nothing but would inflate the job count and drag the p95 to zero.
    const s = summarise([
      { name: 'CI', jobs: [{ started_at: null, completed_at: null }] },
    ]);
    assert.strictEqual(s.jobs, 0);
    assert.strictEqual(s.waitP95, null);
  });

  it('IT CANNOT FAIL A BUILD — no threshold, no non-zero exit', () => {
    const code = stripComments(fs.readFileSync(SCRIPT, 'utf8'));
    assert.doesNotMatch(
      code,
      /process\.exit\s*\(\s*[1-9]/,
      'the report exits non-zero somewhere. It is deliberately not a gate: net cost is $0.00, ' +
        'so reddening a check over a number would be worse than the problem (#1138).'
    );
    assert.doesNotMatch(
      code,
      /process\.exitCode\s*=\s*[1-9]/,
      'the report sets a failing exit code — same objection'
    );
    assert.match(
      code,
      /catch/,
      'the report does not swallow its own errors, so a rate limit would redden the Actions tab'
    );
  });

  it('and the workflow neither fails nor is wired as a required check', () => {
    const wf = fs.readFileSync(WF, 'utf8');
    const code = wf
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    assert.doesNotMatch(code, /exit 1/, 'the workflow can fail the run');
    assert.doesNotMatch(
      code,
      /pull_request|push:/,
      'the report now triggers on PRs or pushes — it would cost minutes on every change, which ' +
        'is a self-defeating way to measure minutes, and puts a red X in front of merges'
    );
    assert.match(
      code,
      /schedule:/,
      'the weekly schedule is gone, so nothing measures anything'
    );
    assert.match(
      code,
      /actions:\s*read/,
      'the job cannot read run timings without `actions: read`'
    );
  });

  it('names its own sample window, so a partial read cannot read as a full one', () => {
    const code = stripComments(fs.readFileSync(SCRIPT, 'utf8'));
    assert.match(
      code,
      /most recent runs/,
      'the report no longer states that it sampled — a sample that hides its bounds is how a ' +
        'measurement becomes a claim'
    );
    assert.match(
      code,
      /covering/,
      'the report no longer prints the window it covered'
    );
  });
});
