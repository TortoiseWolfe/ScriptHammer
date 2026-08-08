/**
 * Tests for the E2E cloud-quota circuit breaker (#567).
 *
 * This guard is the only thing standing between a busy day and a repeat of the
 * outage that took production down for a billing cycle. Almost every test below
 * asserts that it says NO, because a budget guard that cannot refuse is decoration.
 *
 * Runs under `pnpm test:scripts` (node:test), executed by ci.yml. vitest cannot load
 * `node:test` — see vitest.config.ts:20-21.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MOD = pathToFileURL(
  path.join(__dirname, '..', 'ci', 'e2e-budget-guard.mjs')
).href;

test('under budget allows', async () => {
  const { evaluate, DEFAULT_LIMITS } = await import(MOD);
  const r = evaluate({ dayCount: 3, monthCount: 5, limits: DEFAULT_LIMITS });
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.code, 'OK');
});

test('daily limit blocks AT the limit, not one past it', async () => {
  // Off-by-one matters: the run being evaluated is itself about to consume quota,
  // so reaching the limit must already block.
  const { evaluate } = await import(MOD);
  const limits = { day: 10, month: 30 };
  assert.strictEqual(
    evaluate({ dayCount: 9, monthCount: 0, limits }).allowed,
    true
  );
  assert.strictEqual(
    evaluate({ dayCount: 10, monthCount: 0, limits }).allowed,
    false
  );
  assert.strictEqual(
    evaluate({ dayCount: 10, monthCount: 0, limits }).code,
    'DAY_EXCEEDED'
  );
});

test('cycle limit blocks independently of the daily count', async () => {
  const { evaluate } = await import(MOD);
  const limits = { day: 10, month: 30 };
  const r = evaluate({ dayCount: 0, monthCount: 30, limits });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'MONTH_EXCEEDED');
});

test('API failure BLOCKS — the guard fails closed', async () => {
  // The counts are 0 when the API fails, which reads as "plenty of budget".
  // If the API check did not come first, a network blip would silently open the gate.
  const { evaluate } = await import(MOD);
  const r = evaluate({ dayCount: 0, monthCount: 0, apiFailed: true });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'API_FAILED');
});

test('an override cannot mask an API failure', async () => {
  const { evaluate } = await import(MOD);
  const r = evaluate({
    dayCount: 0,
    monthCount: 0,
    apiFailed: true,
    override: 'just let me through',
  });
  assert.strictEqual(
    r.allowed,
    false,
    'override must not bypass a broken guard'
  );
  assert.strictEqual(r.code, 'API_FAILED');
});

test('override with a stated reason allows, and reports the reason', async () => {
  const { evaluate } = await import(MOD);
  const r = evaluate({
    dayCount: 999,
    monthCount: 999,
    override: 'verifying the #575 cutover',
  });
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.code, 'OVERRIDDEN');
  assert.match(r.message, /verifying the #575 cutover/);
});

test('a blank override is not an override', async () => {
  // A bare `true` or an accidental empty input must not open the gate — the reason
  // IS the audit trail.
  const { evaluate } = await import(MOD);
  for (const v of ['', '   ', null, undefined]) {
    const r = evaluate({ dayCount: 999, monthCount: 999, override: v });
    assert.strictEqual(
      r.allowed,
      false,
      `override=${JSON.stringify(v)} must block`
    );
  }
});

// ---------------------------------------------------------------------------
// cycleStart — the bug that a live run caught.
//
// A trailing 30-day window would still be counting August's 382 runs on
// 2026-09-02, the very day the quota refills, and would block through October —
// including the parity run needed to retire the cloud dependency entirely.
// The window must align to the billing cycle it protects, which the invoice
// history (Apr 02, May 02, Jun 02, Jul 02, Aug 02) puts on the 2nd.
// ---------------------------------------------------------------------------

test('cycleStart: mid-month resolves to the 2nd of the same month', async () => {
  const { cycleStart } = await import(MOD);
  assert.strictEqual(
    cycleStart(new Date('2026-08-06T20:00:00Z')),
    '2026-08-02T00:00:00.000Z'
  );
});

test('cycleStart: before the 2nd belongs to the PREVIOUS cycle', async () => {
  const { cycleStart } = await import(MOD);
  assert.strictEqual(
    cycleStart(new Date('2026-09-01T23:59:59Z')),
    '2026-08-02T00:00:00.000Z'
  );
});

test('cycleStart: the 2nd at 00:00 opens the new cycle', async () => {
  const { cycleStart } = await import(MOD);
  assert.strictEqual(
    cycleStart(new Date('2026-09-02T00:00:00Z')),
    '2026-09-02T00:00:00.000Z'
  );
});

test('cycleStart: the reset actually clears August — the whole point', async () => {
  // On 2026-09-02 the window must NOT reach back into August. A trailing 30-day
  // window would, and the guard would stay locked after the quota refilled.
  const { cycleStart } = await import(MOD);
  const atReset = cycleStart(new Date('2026-09-02T06:00:00Z'));
  assert.ok(
    new Date(atReset) >= new Date('2026-09-02T00:00:00Z'),
    `window opened at ${atReset}, which still includes the previous cycle`
  );
});

test('cycleStart: January rolls back to December of the prior year', async () => {
  const { cycleStart } = await import(MOD);
  assert.strictEqual(
    cycleStart(new Date('2027-01-01T12:00:00Z')),
    '2026-12-02T00:00:00.000Z'
  );
});

test('countRuns throws on a non-OK response rather than returning 0', async () => {
  // Returning 0 here would be indistinguishable from "no runs yet" and would open
  // the gate. It must throw so the caller sets apiFailed and blocks.
  const { countRuns } = await import(MOD);
  const fakeFetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'upstream unavailable',
  });
  await assert.rejects(
    () =>
      countRuns(fakeFetch, { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }),
    /503/
  );
});

test('countRuns throws when total_count is missing', async () => {
  const { countRuns } = await import(MOD);
  const fakeFetch = async () => ({ ok: true, json: async () => ({}) });
  await assert.rejects(
    () =>
      countRuns(fakeFetch, { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }),
    /total_count/
  );
});

/**
 * THE BUG THIS REPLACES (2026-08-07). countRuns used to return `total_count` — every
 * workflow-run RECORD in the window. A run this guard itself blocked at step 0 consumed
 * zero Supabase quota and was counted exactly like a full 24-job run.
 *
 * That made the guard self-reinforcing: once tripped, every push added another
 * blocked-but-counted run, so the count climbed on activity that spent nothing and could
 * never fall back under the limit while anyone worked. Observed at 49/10 in 24h against
 * a one-day-old project whose data API answered 200, not 402.
 *
 * These tests exist so the unit of measure cannot silently revert to "runs recorded".
 */
const runsPage = (runs) => ({
  ok: true,
  json: async () => ({ total_count: runs.length, workflow_runs: runs }),
});
const jobsPage = (jobs) => ({ ok: true, json: async () => ({ jobs }) });

const BLOCKED = { id: 1, status: 'completed', conclusion: 'failure' };
const REAL_FAIL = { id: 2, status: 'completed', conclusion: 'failure' };
const PASSED = { id: 3, status: 'completed', conclusion: 'success' };

/** Routes run-list vs jobs calls; jobs answer per run id. */
const fetchFor = (runs, jobsById) => async (url) => {
  if (url.includes('/jobs')) {
    const id = Number(url.match(/runs\/(\d+)\/jobs/)[1]);
    return jobsPage(jobsById[id] ?? []);
  }
  return runsPage(url.includes('page=1') ? runs : []);
};

test('a run this guard blocked does NOT count — it spent no quota', async () => {
  const { countRuns } = await import(MOD);
  const n = await countRuns(
    fetchFor([BLOCKED], {
      // every matrix job skipped: build needs budget, so nothing downstream ran
      1: [
        { name: 'E2E (chromium-gen 1/6)', conclusion: 'skipped' },
        { name: 'E2E (webkit-msg 1/1)', conclusion: 'skipped' },
      ],
    }),
    { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }
  );
  assert.strictEqual(n, 0);
});

test('a run that genuinely failed tests DOES count — it spent quota', async () => {
  const { countRuns } = await import(MOD);
  const n = await countRuns(
    fetchFor([REAL_FAIL], {
      2: [
        { name: 'E2E (chromium-gen 1/6)', conclusion: 'failure' },
        { name: 'E2E (webkit-msg 1/1)', conclusion: 'success' },
      ],
    }),
    { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }
  );
  assert.strictEqual(n, 1);
});

test('blocked and real runs in one window are told apart', async () => {
  const { countRuns } = await import(MOD);
  const n = await countRuns(
    fetchFor([BLOCKED, REAL_FAIL, PASSED], {
      1: [{ name: 'E2E (chromium-gen 1/6)', conclusion: 'skipped' }],
      2: [{ name: 'E2E (chromium-gen 1/6)', conclusion: 'failure' }],
    }),
    { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }
  );
  // BLOCKED excluded; REAL_FAIL and PASSED counted. Not 3.
  assert.strictEqual(n, 2);
});

test('a success needs no jobs lookup and still counts', async () => {
  const { countRuns } = await import(MOD);
  let jobCalls = 0;
  const fetchImpl = async (url) => {
    if (url.includes('/jobs')) {
      jobCalls++;
      return jobsPage([]);
    }
    return runsPage(url.includes('page=1') ? [PASSED] : []);
  };
  const n = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-02',
  });
  assert.strictEqual(n, 1);
  assert.strictEqual(jobCalls, 0, 'unambiguous runs must not cost an API call');
});

test('counts conservatively when the jobs endpoint fails', async () => {
  // Under-counting spends the quota this guard protects; over-counting costs a re-run.
  const { countRuns } = await import(MOD);
  const fetchImpl = async (url) => {
    if (url.includes('/jobs')) throw new Error('boom');
    return runsPage(url.includes('page=1') ? [BLOCKED] : []);
  };
  const n = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-02',
  });
  assert.strictEqual(n, 1);
});

test('an in-progress run counts without a jobs lookup', async () => {
  const { countRuns } = await import(MOD);
  const n = await countRuns(
    fetchFor([{ id: 9, status: 'in_progress', conclusion: null }], {}),
    { repo: 'o/r', token: 't', sinceIso: '2026-08-02' }
  );
  assert.strictEqual(n, 1);
});

test('the limits are the measured ones, not round numbers someone liked', async () => {
  const { DEFAULT_LIMITS } = await import(MOD);
  // 44 runs consumed a full cycle (measured 2026-08-02..05), so a run is ~2.3%.
  // 30 leaves deliberate headroom for the canary and manual verification.
  assert.strictEqual(DEFAULT_LIMITS.month, 30);
  // 2026-08-05 saw 30 runs in one day; 10 stops that at a third.
  assert.strictEqual(DEFAULT_LIMITS.day, 10);
});
