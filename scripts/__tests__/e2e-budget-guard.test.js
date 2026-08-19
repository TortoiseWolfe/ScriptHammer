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

// ── budgetWindowStart — a quota belongs to a BACKEND, not to a calendar (#640).
//
// The #567 migration deleted the old Supabase project on 2026-08-07. Of the 88
// runs counted in the 2026-08-02 cycle, 61 had been billed to that dead project,
// and the breaker went on refusing on its behalf. Counting evidence about a
// resource that no longer exists is the bug these cases pin.

test('budgetWindowStart: an epoch inside the cycle wins over the billing boundary', async () => {
  const { budgetWindowStart } = await import(MOD);
  assert.strictEqual(
    budgetWindowStart(new Date('2026-08-08T12:00:00Z'), '2026-08-07T06:00:00Z'),
    '2026-08-07T06:00:00.000Z'
  );
});

test('budgetWindowStart: an epoch BEFORE the cycle does not widen the window', async () => {
  // The backend predates this cycle, so the billing boundary is the real limit.
  const { budgetWindowStart } = await import(MOD);
  assert.strictEqual(
    budgetWindowStart(new Date('2026-08-08T12:00:00Z'), '2026-06-01T00:00:00Z'),
    '2026-08-02T00:00:00.000Z'
  );
});

test('budgetWindowStart: a FUTURE epoch is ignored, not trusted', async () => {
  // Otherwise the window starts after `now`, nothing is counted, and the guard
  // silently opens — the failure mode this whole file exists to prevent.
  const { budgetWindowStart } = await import(MOD);
  assert.strictEqual(
    budgetWindowStart(new Date('2026-08-08T12:00:00Z'), '2027-01-01T00:00:00Z'),
    '2026-08-02T00:00:00.000Z'
  );
});

test('budgetWindowStart: empty or invalid epoch falls back to the billing cycle', async () => {
  // `null` and empty/garbage strings mean "disable the epoch". `undefined` does
  // NOT appear here on purpose — it triggers the default parameter, i.e. "use the
  // shipped epoch", which is the same distinction main() draws when reading
  // E2E_BUDGET_BACKEND_EPOCH: an ABSENT variable keeps the default, an empty one
  // opts out. Asserting otherwise here is what caught the ambiguity.
  const { budgetWindowStart } = await import(MOD);
  for (const bad of ['', '   ', 'not-a-date', null]) {
    assert.strictEqual(
      budgetWindowStart(new Date('2026-08-08T12:00:00Z'), bad),
      '2026-08-02T00:00:00.000Z',
      `epoch ${JSON.stringify(bad)} should disable the epoch, not the guard`
    );
  }
});

test('budgetWindowStart: an ABSENT epoch keeps the default, an EMPTY one opts out', async () => {
  // The pair that makes the distinction above executable rather than a comment.
  const { budgetWindowStart } = await import(MOD);
  const now = new Date('2026-08-08T12:00:00Z');
  assert.strictEqual(budgetWindowStart(now), '2026-08-07T06:00:00.000Z');
  assert.strictEqual(budgetWindowStart(now, ''), '2026-08-02T00:00:00.000Z');
});

test('budgetWindowStart: the shipped default reflects the live backend', async () => {
  const { budgetWindowStart, BACKEND_EPOCH } = await import(MOD);
  assert.strictEqual(BACKEND_EPOCH, '2026-08-07T06:00:00Z');
  assert.strictEqual(
    budgetWindowStart(new Date('2026-08-08T12:00:00Z')),
    '2026-08-07T06:00:00.000Z'
  );
});

test('budgetWindowStart: never returns a window start in the future', async () => {
  // Property check across the whole cycle rather than one date.
  const { budgetWindowStart } = await import(MOD);
  for (let d = 2; d <= 28; d++) {
    const now = new Date(Date.UTC(2026, 7, d, 9, 0, 0));
    const got = Date.parse(budgetWindowStart(now));
    assert.ok(
      got <= now.getTime(),
      `window start ${new Date(got).toISOString()} is after now ${now.toISOString()}`
    );
  }
});

// ── the guard must not count ITSELF (#647).
//
// Its own run is `in_progress` while the budget job executes, and runConsumedQuota
// treats any non-completed run as having spent quota — correct in general, an
// off-by-one when applied to itself. It makes the effective limit `day - 1`: at
// limit-1 the guard adds itself, reaches the limit exactly, and refuses.
//
// Measured 2026-08-08: a manual read at 15:59Z said 9/10 OK; the budget job on the
// run created at 16:00Z reported 10/10 DAY_EXCEEDED with nothing else in between,
// and the reading fell back to 9/10 once that run finished with every shard
// skipped. #644 merged with no E2E behind it because of it.

// Shape must satisfy listRuns(): `ok`, and a body carrying BOTH `total_count` and
// `workflow_runs`, or it throws before the exclusion is ever reached.
// `in_progress` is the state that matters here — runConsumedQuota counts any
// non-completed run as spent, which is precisely why self-counting was an
// off-by-one rather than a rounding detail.
const RUNS_FIXTURE = (ids) => ({
  ok: true,
  json: async () => ({
    total_count: ids.length,
    workflow_runs: ids.map((id) => ({
      id,
      status: 'in_progress',
      conclusion: null,
    })),
  }),
});

test('countRuns EXCLUDES the current run', async () => {
  const { countRuns } = await import(MOD);
  const fetchImpl = async () => RUNS_FIXTURE([111, 222, 333]);
  const n = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-07T00:00:00Z',
    excludeRunId: '222',
  });
  assert.strictEqual(n, 2, 'the run doing the asking must not count itself');
});

test('countRuns counts everything when there is no self to exclude', async () => {
  // Local/dry-run invocation: GITHUB_RUN_ID is absent, so nothing is excluded.
  const { countRuns } = await import(MOD);
  const fetchImpl = async () => RUNS_FIXTURE([111, 222, 333]);
  for (const exclude of [null, undefined]) {
    const n = await countRuns(fetchImpl, {
      repo: 'o/r',
      token: 't',
      sinceIso: '2026-08-07T00:00:00Z',
      excludeRunId: exclude,
    });
    assert.strictEqual(n, 3, `excludeRunId=${exclude} should exclude nothing`);
  }
});

test('countRuns matches the run id across string/number types', async () => {
  // GITHUB_RUN_ID arrives as a string; the API returns a number. A strict ===
  // between them silently excludes nothing and restores the off-by-one.
  const { countRuns } = await import(MOD);
  const fetchImpl = async () => RUNS_FIXTURE([111, 222, 333]);
  const n = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-07T00:00:00Z',
    excludeRunId: 222, // number, while run.id is also a number — and vice versa
  });
  assert.strictEqual(n, 2);
});

test('the off-by-one it fixes: at limit-1, self-counting would refuse', async () => {
  // The whole defect, end to end. 9 other runs + itself = 10 = the limit.
  const { countRuns, evaluate, DEFAULT_LIMITS } = await import(MOD);
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 999];
  const fetchImpl = async () => RUNS_FIXTURE(ids);

  const counted = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-07T00:00:00Z',
    excludeRunId: '999',
  });
  assert.strictEqual(counted, 9);
  assert.strictEqual(
    evaluate({ dayCount: counted, monthCount: 0, limits: DEFAULT_LIMITS })
      .allowed,
    true,
    '9 others under a limit of 10 must be allowed'
  );

  const selfCounted = await countRuns(fetchImpl, {
    repo: 'o/r',
    token: 't',
    sinceIso: '2026-08-07T00:00:00Z',
  });
  assert.strictEqual(selfCounted, 10);
  assert.strictEqual(
    evaluate({ dayCount: selfCounted, monthCount: 0, limits: DEFAULT_LIMITS })
      .allowed,
    false,
    'counting itself is what produced the observed 10/10 DAY_EXCEEDED'
  );
});

// ── a CANCELLED run that never started shards spent nothing (#640, one branch over).
//
// runConsumedQuota used to short-circuit on `conclusion !== 'failure'`, so every
// cancelled run was billed at the price of a full 8-shard run without ever asking
// the jobs endpoint. The docblock justified it with "cancelled -> may have run
// partially", and that `may` was the whole argument.
//
// Measured against the live window on 2026-08-12: 11 of 11 cancelled runs had
// executed ZERO shards. They are cancelled *because* they never started — the
// repo-wide concurrency mutex holds one pending run per group and a newer push
// supersedes it. The guard reported 31/30 and blocked everything; real consumption
// was 20/30.
//
// Both directions are pinned, because a cancelled run that DID start shards must
// still be charged.
const JOBS = (names) => ({
  ok: true,
  json: async () => ({
    jobs: names.map(([name, conclusion]) => ({ name, conclusion })),
  }),
});

test('a cancelled run whose shards never started does NOT count', async () => {
  const { runConsumedQuota } = await import(MOD);
  const spent = await runConsumedQuota(
    async () =>
      JOBS([
        ['E2E (chromium-gen 1/6)', 'skipped'],
        ['Build', 'skipped'],
      ]),
    {
      repo: 'o/r',
      token: 't',
      run: { id: 1, status: 'completed', conclusion: 'cancelled' },
    }
  );
  assert.strictEqual(
    spent,
    false,
    'cancelled + every shard skipped = zero Supabase requests; billing it is what produced 31/30'
  );
});

test('a cancelled run that DID start shards still counts', async () => {
  const { runConsumedQuota } = await import(MOD);
  const spent = await runConsumedQuota(
    async () =>
      JOBS([
        ['E2E (chromium-gen 1/6)', 'cancelled'],
        ['Build', 'success'],
      ]),
    {
      repo: 'o/r',
      token: 't',
      run: { id: 2, status: 'completed', conclusion: 'cancelled' },
    }
  );
  assert.strictEqual(spent, true, 'partial spend is still spend');
});

test('a SUCCESSFUL run counts — shards ran by definition', async () => {
  const { runConsumedQuota } = await import(MOD);
  const spent = await runConsumedQuota(
    async () => JOBS([['E2E (chromium-gen 1/6)', 'success']]),
    {
      repo: 'o/r',
      token: 't',
      run: { id: 3, status: 'completed', conclusion: 'success' },
    }
  );
  assert.strictEqual(spent, true);
});

test('still fails CONSERVATIVE: jobs endpoint error counts as spent', async () => {
  const { runConsumedQuota } = await import(MOD);
  const spent = await runConsumedQuota(async () => ({ ok: false }), {
    repo: 'o/r',
    token: 't',
    run: { id: 4, status: 'completed', conclusion: 'cancelled' },
  });
  assert.strictEqual(
    spent,
    true,
    'under-counting costs the quota this guard exists to protect'
  );
});

/**
 * #726 — the guard had no idea which backend it was metering, and its one escape
 * hatch could not be reached from a workflow.
 *
 * It counts GitHub Actions runs of `e2e.yml`. That is a proxy for Supabase usage and
 * it cannot see the backend at all: `SUPABASE_PROJECT_REF` was never read, and
 * `BACKEND_EPOCH` is a hardcoded date belonging to one specific project. The #567
 * swap already invalidated that date once, silently.
 *
 * The subtle half is the epoch override. `E2E_BUDGET_BACKEND_EPOCH` was read but never
 * passed, and its documented contract — "an ABSENT variable falls back to the
 * constant, an empty one opts out" — is UNREACHABLE from a workflow: GitHub evaluates
 * `${{ vars.FOO }}` to an empty string when the variable is unset. So plumbing it in
 * as the issue asks would have flipped the default to opt-out and widened the window
 * from the epoch back to the billing-cycle start. Measured: 5 days on 2026-08-19,
 * counting runs billed to a project that no longer exists.
 */

test('#726: an unset repo variable keeps the default epoch, it does not opt out', async () => {
  const { resolveBackendEpoch, BACKEND_EPOCH } = await import(MOD);
  // The exact value a workflow sends for an unset `${{ vars.X }}`.
  assert.strictEqual(resolveBackendEpoch(''), BACKEND_EPOCH);
  assert.strictEqual(resolveBackendEpoch(undefined), BACKEND_EPOCH);
});

test('#726: opting out is spelled explicitly, and still works', async () => {
  const { resolveBackendEpoch, EPOCH_OPT_OUT } = await import(MOD);
  assert.strictEqual(resolveBackendEpoch(EPOCH_OPT_OUT), '');
  assert.strictEqual(resolveBackendEpoch('None'), '', 'case-insensitive');
  assert.strictEqual(resolveBackendEpoch('  none  '), '', 'tolerates padding');
});

test('#726: a real ISO override is still honoured', async () => {
  const { resolveBackendEpoch } = await import(MOD);
  assert.strictEqual(
    resolveBackendEpoch('2026-09-01T00:00:00Z'),
    '2026-09-01T00:00:00Z'
  );
});

test('#726: opting out really does widen the window — the regression this prevents', async () => {
  // Without this, the two epoch values above could both be wrong and the tests would
  // still pass. Pin that the choice CHANGES the measured window, so a future refactor
  // cannot quietly make the override inert.
  const {
    budgetWindowStart,
    resolveBackendEpoch,
    BACKEND_EPOCH,
    EPOCH_OPT_OUT,
  } = await import(MOD);
  const now = new Date('2026-08-19T12:00:00Z');

  const withDefault = budgetWindowStart(now, resolveBackendEpoch(''));
  const withOptOut = budgetWindowStart(now, resolveBackendEpoch(EPOCH_OPT_OUT));

  // Compare instants, not strings: budgetWindowStart normalises to milliseconds
  // ('…:00.000Z') while the constant is written without them.
  assert.strictEqual(Date.parse(withDefault), Date.parse(BACKEND_EPOCH));
  assert.notStrictEqual(
    withDefault,
    withOptOut,
    'opting out must widen the window; if these match the override does nothing'
  );
  assert.ok(
    Date.parse(withOptOut) < Date.parse(withDefault),
    'the opt-out window must start EARLIER — that is what made it dangerous as a default'
  );
});

test('#726: the epoch records which project it belongs to', async () => {
  // The epoch is meaningless without this. A bare date cannot tell anyone that it
  // stopped describing reality when the backend was swapped.
  const { BACKEND_EPOCH_PROJECT_REF } = await import(MOD);
  assert.match(
    BACKEND_EPOCH_PROJECT_REF,
    /^[a-z]{20}$/,
    'BACKEND_EPOCH_PROJECT_REF should be a Supabase project ref'
  );
});

test('#726: the workflow passes the ref and the epoch to the guard', async () => {
  // The guard reading an env var is worthless if nothing sets it — which is exactly
  // how E2E_BUDGET_BACKEND_EPOCH sat dead. Assert the wiring, not just the reader.
  // CommonJS file (see the requires at the top) — no import.meta here, or Node
  // reinterprets the whole file as ESM and every `require` above it breaks.
  const { readFileSync } = require('node:fs');
  const wf = readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'e2e.yml'),
    'utf8'
  );
  const step = wf.slice(
    wf.indexOf('Check recent E2E run rate'),
    wf.indexOf('e2e-budget-guard.mjs')
  );
  assert.match(
    step,
    /SUPABASE_PROJECT_REF:\s*\$\{\{\s*vars\.SUPABASE_PROJECT_REF\s*\}\}/,
    'the budget step no longer passes SUPABASE_PROJECT_REF, so the guard cannot tell ' +
      'which backend it is metering'
  );
  assert.match(
    step,
    /E2E_BUDGET_BACKEND_EPOCH:\s*\$\{\{\s*vars\.E2E_BUDGET_BACKEND_EPOCH\s*\}\}/,
    'the epoch override is unreachable again — it is read by the guard but not passed'
  );
});
