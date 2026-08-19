#!/usr/bin/env node
/**
 * E2E cloud-quota circuit breaker (#567).
 *
 * WHAT HAPPENED. On 2026-08-05, 30 full E2E runs landed in one day. 44 runs total,
 * across 3.9 days, consumed an ENTIRE MONTH of the Supabase free tier — egress, MAU
 * and realtime all exceeded — and took production down with it until the billing
 * cycle resets on the 2nd.
 *
 * WHY THE EXISTING PROTECTION DID NOT HELP. e2e.yml has a repo-wide `concurrency`
 * mutex, and it was widely described (by me, repeatedly) as protection. It is not.
 * A mutex SERIALIZES runs; it does not CAP them. All 30 runs on 2026-08-05 queued
 * politely and then each executed in full. Orderly, not fewer.
 *
 * THIS IS THE CAP. It counts recent runs of the E2E workflow and refuses to start a
 * new one past a budget.
 *
 * FAIL-CLOSED, DELIBERATELY. If the API call fails, this BLOCKS rather than allows.
 * A quota guard that opens on error is a guard that an error can bypass — the exact
 * shape of defect #396 catalogues. A blocked run costs a re-run; an unblocked one
 * cost production for a month.
 *
 *   node scripts/ci/e2e-budget-guard.mjs            # enforce (CI)
 *   node scripts/ci/e2e-budget-guard.mjs --dry-run  # report, never fail
 *   node scripts/ci/e2e-budget-guard.mjs --selftest # prove it can fail
 *
 * Env:
 *   GITHUB_TOKEN         required (the workflow's own token is enough)
 *   GITHUB_REPOSITORY    owner/repo
 *   E2E_BUDGET_OVERRIDE  a non-empty REASON to bypass; logged as a warning
 *   E2E_BUDGET_DAY       override the daily cap (testing)
 *   E2E_BUDGET_MONTH     override the monthly cap (testing)
 *   GITHUB_RUN_ID        set by Actions; the run excludes ITSELF from the count
 */

import { pathToFileURL } from 'node:url';

/**
 * Measured, not guessed: 44 runs consumed 100% of a monthly quota (2026-08-02 →
 * 2026-08-05). So one run is ~2.3% of the month.
 *
 * MONTH_LIMIT 30 is ~68% of that ceiling, leaving deliberate headroom for the cloud
 * canary and for manual verification runs.
 * DAY_LIMIT 10 would have stopped 2026-08-05 at run 10 of 30.
 *
 * These are intentionally uncomfortable. The free tier funds ~22 PRs a month (a PR
 * costs two runs — the PR run plus the main run on merge). If this fires during
 * normal work, the answer is #575 (move E2E off the shared cloud project), not a
 * bigger number here.
 */
export const DEFAULT_LIMITS = { day: 10, month: 30 };

export const WORKFLOW_FILE = 'e2e.yml';

/**
 * When the Supabase project currently being metered came into service.
 *
 * The #567 migration deleted the old project and created `ozbdyopxmeqmwnfsmglp`
 * around 2026-08-07T06:00Z. Runs before this point were billed to a project that
 * no longer exists, so counting them tells you nothing about today's quota — see
 * budgetWindowStart() for the measurement.
 *
 * Override with E2E_BUDGET_BACKEND_EPOCH (ISO 8601), or set it empty to fall back
 * to a pure billing-cycle window.
 */
export const BACKEND_EPOCH = '2026-08-07T06:00:00Z';

/**
 * The project that epoch belongs to.
 *
 * The epoch above is meaningful for ONE Supabase project. If the backend is swapped
 * again — as #567 swapped it once already — the date silently starts describing a
 * project that no longer exists, and the guard keeps counting with total confidence
 * and no way to notice. That is the failure #726 is about: this script has never had
 * any idea which backend it is metering.
 *
 * Compared against `SUPABASE_PROJECT_REF` at runtime. A mismatch does not block — the
 * count may still be roughly right — but it says so loudly, because the epoch is then
 * stale by definition.
 */
export const BACKEND_EPOCH_PROJECT_REF = 'ozbdyopxmeqmwnfsmglp';

/**
 * Explicit opt-out value for the epoch override.
 *
 * NOT the empty string, and that is the point. GitHub Actions evaluates
 * `${{ vars.FOO }}` to an EMPTY STRING when the variable is unset, so a workflow
 * cannot express "absent" through `env:` at all. Treating empty as the opt-out made
 * the documented default unreachable: wiring the variable up while it is unset would
 * silently widen the window from the epoch back to the billing-cycle start —
 * measured at 5 days on 2026-08-19 — and count runs billed to the DELETED project.
 *
 * So empty now means "use the default", and opting out is spelled out.
 */
export const EPOCH_OPT_OUT = 'none';

/**
 * Resolve the epoch from the environment, safely for a workflow-supplied value.
 *
 * @param {string|undefined} raw
 * @returns {string} ISO date, or '' meaning "no epoch, use the billing cycle"
 */
export function resolveBackendEpoch(raw) {
  if (raw === undefined || raw === '') return BACKEND_EPOCH;
  if (raw.trim().toLowerCase() === EPOCH_OPT_OUT) return '';
  return raw;
}

/**
 * The Supabase billing cycle runs 2nd → 2nd (confirmed from the invoice history:
 * Apr 02, May 02, Jun 02, Jul 02, Aug 02, all $0.00, one per cycle reset).
 *
 * The monthly budget MUST align to that boundary rather than being a trailing
 * 30-day window. With a trailing window, August's runs would still be counted on
 * 2026-09-02 — the very day the quota refills — and the guard would block through
 * to October, including the parity run needed to retire the cloud dependency.
 * A quota guard that stays locked after the quota resets is just an outage with
 * extra steps.
 *
 * @param {Date} now
 * @returns {string} ISO timestamp of the current cycle's start (UTC)
 */
export function cycleStart(now) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisMonth = Date.UTC(y, m, 2, 0, 0, 0);
  // Before the 2nd we are still inside the cycle that opened last month.
  const start = now.getTime() >= thisMonth ? thisMonth : Date.UTC(y, m - 1, 2);
  return new Date(start).toISOString();
}

/**
 * Where the monthly count should actually start: the later of the billing
 * boundary and the epoch of the backend being metered.
 *
 * A quota is a property of a BACKEND, not of a calendar. When the Supabase
 * project is replaced, runs made against the old one are not evidence about the
 * new one — the resource they consumed no longer exists.
 *
 * Measured 2026-08-08: of 88 counted runs in the 2026-08-02 cycle, **61 predated
 * the #567 migration** and had been billed to a project deleted on 2026-08-07.
 * The live project answered HTTP 200 on `/rest/v1` and `/auth/v1/health` and was
 * not quota-restricted at all — the breaker was refusing on behalf of a backend
 * that no longer existed, and would have gone on refusing until Sept 2.
 *
 * Kept SEPARATE from cycleStart() on purpose: that function means "when did the
 * billing cycle open", which is still true and still tested. This one means
 * "how far back is the evidence still about the thing we are metering".
 *
 * A future epoch is ignored rather than trusted — it would otherwise start the
 * window after `now` and count nothing at all, which is a silent open gate.
 *
 * @param {Date} now
 * @param {string|null|undefined} backendEpochIso ISO 8601; empty/invalid disables
 * @returns {string} ISO timestamp to count from (UTC)
 */
export function budgetWindowStart(now, backendEpochIso = BACKEND_EPOCH) {
  const start = Date.parse(cycleStart(now));
  const epoch = Date.parse(backendEpochIso ?? '');
  const usable =
    Number.isFinite(epoch) && epoch > start && epoch <= now.getTime();
  return new Date(usable ? epoch : start).toISOString();
}

/**
 * Pure decision function — no I/O, so it is unit-testable and the branch that
 * BLOCKS can be exercised directly.
 *
 * @param {{dayCount:number, monthCount:number, limits:{day:number,month:number},
 *          override?:string|null, apiFailed?:boolean}} input
 * @returns {{allowed:boolean, code:string, message:string}}
 */
export function evaluate({
  dayCount,
  monthCount,
  limits = DEFAULT_LIMITS,
  override = null,
  apiFailed = false,
}) {
  // Order matters. The API check comes FIRST so that a failure cannot be masked by
  // counts that were never actually fetched (they would be 0, i.e. "plenty of
  // budget" — a gate that silently passes on error).
  if (apiFailed) {
    return {
      allowed: false,
      code: 'API_FAILED',
      message:
        'Could not read recent run history, so the quota budget cannot be verified. ' +
        'Blocking rather than guessing (#567). Re-run once the API is reachable.',
    };
  }

  // The override is checked AFTER the API failure so it cannot be used to paper
  // over a broken guard, and it requires a stated reason — a bare "true" is not
  // accepted, because the reason is the audit trail.
  const reason = typeof override === 'string' ? override.trim() : '';
  if (reason) {
    return {
      allowed: true,
      code: 'OVERRIDDEN',
      message: `Budget bypassed deliberately. Reason: ${reason}`,
    };
  }

  if (dayCount >= limits.day) {
    return {
      allowed: false,
      code: 'DAY_EXCEEDED',
      message:
        `${dayCount} E2E runs in the last 24h, limit ${limits.day}. ` +
        `Each full run is ~2.3% of the monthly Supabase quota; this pace exhausts it in days (#567).`,
    };
  }
  if (monthCount >= limits.month) {
    return {
      allowed: false,
      code: 'MONTH_EXCEEDED',
      message:
        `${monthCount} E2E runs this billing cycle, limit ${limits.month}. ` +
        `The free tier funds ~44 runs per cycle total; this is the stop line before production is affected. ` +
        `Resets on the 2nd (#567).`,
    };
  }

  return {
    allowed: true,
    code: 'OK',
    message: `within budget — ${dayCount}/${limits.day} today, ${monthCount}/${limits.month} this month`,
  };
}

const GH_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

/** Pages this workflow's runs created at or after `sinceIso`. Throws on any API problem. */
async function listRuns(fetchImpl, { repo, token, sinceIso, maxPages = 6 }) {
  const runs = [];
  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs` +
      `?created=%3E%3D${encodeURIComponent(sinceIso)}&per_page=100&page=${page}`;
    const res = await fetchImpl(url, { headers: GH_HEADERS(token) });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const body = await res.json();
    if (typeof body.total_count !== 'number') {
      throw new Error('GitHub API response missing total_count');
    }
    const batch = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
    runs.push(...batch);
    if (runs.length >= body.total_count || batch.length === 0) break;
  }
  return runs;
}

/**
 * Did this run actually execute E2E — i.e. did it SPEND Supabase quota?
 *
 * A blocked run is `completed`/`failure` with every downstream job `skipped`, because
 * `build` has `needs: budget`. That is indistinguishable from a genuine test failure by
 * conclusion alone, so the ambiguous conclusions are the ones that cost an API call:
 *
 *   in-progress / queued  -> it may be testing right now. Count it, no call.
 *   success               -> its shards ran by definition. Count it, no call.
 *   anything else         -> ambiguous. Ask the jobs endpoint; shards decide.
 *
 * CANCELLED USED TO SHORT-CIRCUIT HERE, and it was the same defect #640 fixed one branch
 * over. The docblock said "cancelled -> may have run partially. Count it, no call." That
 * `may` was carrying the whole argument, and it is false in practice: measured against
 * the live window on 2026-08-12, **11 of 11 cancelled runs had executed ZERO shards.**
 *
 * They are cancelled precisely because they never started. The repo-wide `concurrency`
 * mutex holds one pending run per group and a newer push SUPERSEDES it — so a cancelled
 * run is almost always one that was still queued. Billing it at the price of a full
 * 8-shard run made the meter climb on activity that spent nothing, which is exactly the
 * self-reinforcing loop the comment on countRuns() below warns about. Measured effect:
 * the guard reported 31/30 and blocked everything while real consumption was 20/30.
 *
 * A cancelled run that HAD started shards still counts — the jobs check sees them, so
 * partial spend is charged honestly rather than assumed in either direction.
 *
 * Still counted conservatively on genuine doubt: a non-completed run, or a jobs-endpoint
 * error. Over-counting costs a delayed run; under-counting costs the quota this guard
 * exists to protect. What changed is that "cancelled" is no longer treated as doubt when
 * the answer is one API call away.
 */
export async function runConsumedQuota(fetchImpl, { repo, token, run }) {
  if (run.status !== 'completed') return true;
  // Only `success` is unambiguous — it cannot succeed without its shards running.
  // Everything else (failure, cancelled, timed_out, startup_failure…) is settled by
  // the jobs endpoint rather than assumed.
  if (run.conclusion === 'success') return true;

  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
      { headers: GH_HEADERS(token) }
    );
    if (!res.ok) return true;
    const body = await res.json();
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    // The matrix jobs are named `E2E (<project> <shard>)`. If none of them got past
    // `skipped`, no browser started and no Supabase request was made.
    return jobs.some(
      (j) => /^E2E \(/.test(j.name ?? '') && j.conclusion !== 'skipped'
    );
  } catch {
    return true;
  }
}

/**
 * Count runs since `sinceIso` that actually consumed quota.
 *
 * WHY NOT `total_count` (#635-adjacent, found 2026-08-07). The original counted every
 * workflow-run RECORD in the window, filtered only by creation time. A run this guard
 * itself blocked at step 0 — zero browsers, zero Supabase requests — was counted exactly
 * like a full 24-job run.
 *
 * That made the guard self-reinforcing: once tripped, every push created another
 * blocked-but-counted run, so the count climbed on activity that consumed nothing and
 * could never fall back under the limit while anyone was working. Observed at 49/10 in
 * 24h against a one-day-old project whose data API was answering 200, not 402 — the
 * guard was protecting a quota nobody had touched.
 *
 * The unit of measure has to be quota spent, not runs recorded.
 */
export async function countRuns(
  fetchImpl,
  { repo, token, sinceIso, excludeRunId = null }
) {
  const runs = await listRuns(fetchImpl, { repo, token, sinceIso });
  let n = 0;
  for (const run of runs) {
    // THE GUARD MUST NOT COUNT ITSELF. Its own run is `in_progress` while the
    // budget job executes, and runConsumedQuota treats any non-completed run as
    // having spent quota (correct in general — an in-flight run really might be
    // testing right now). Applied to itself that is an off-by-one which makes the
    // effective limit `day - 1`: the guard can never permit a run when the count
    // sits at limit-1, because adding itself reaches the limit exactly.
    //
    // Measured 2026-08-08: a manual read at 15:59Z said 9/10 OK; the budget job on
    // the run created at 16:00Z reported 10/10 DAY_EXCEEDED and blocked. Nothing
    // else had run in between. After that run finished with every shard skipped,
    // the reading returned to 9/10. #644 merged with no E2E behind it because of
    // this, which is exactly what the merge ordering was meant to avoid.
    if (excludeRunId != null && String(run.id) === String(excludeRunId))
      continue;
    if (await runConsumedQuota(fetchImpl, { repo, token, run })) n++;
  }
  return n;
}

function limitsFromEnv(env) {
  const n = (v, d) => {
    const p = Number.parseInt(v ?? '', 10);
    return Number.isFinite(p) && p > 0 ? p : d;
  };
  return {
    day: n(env.E2E_BUDGET_DAY, DEFAULT_LIMITS.day),
    month: n(env.E2E_BUDGET_MONTH, DEFAULT_LIMITS.month),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  // Modes (env E2E_BUDGET_MODE, default "block"):
  //   block    — over budget is a build failure. The default, because this guard
  //              exists after CI took production down (#567).
  //   annotate — surface it loudly (::warning:: + summary) but exit 0.
  //
  // Mirrors FLAKY_GATE_MODE in scripts/check-flaky-count.mjs:13-18, deliberately.
  // The point is de-escalation WITHOUT a code edit: `.github/**` is not in
  // `paths-ignore`, so editing this file to relax the guard triggers another run of
  // the very workflow it is blocking. A repo variable can be flipped from a phone.
  const mode = (process.env.E2E_BUDGET_MODE || 'block').trim().toLowerCase();
  const dryRun = argv.includes('--dry-run') || mode === 'annotate';
  const env = process.env;
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  const limits = limitsFromEnv(env);
  // GitHub sets GITHUB_RUN_ID for the run this job belongs to. Absent locally,
  // where there is no self to exclude.
  const selfRunId = env.GITHUB_RUN_ID || null;
  // See resolveBackendEpoch: empty means "default", `none` means opt out. An unset
  // repo variable arrives here as '' and must NOT silently widen the window.
  const backendEpoch = resolveBackendEpoch(env.E2E_BUDGET_BACKEND_EPOCH);

  // The guard counts GitHub Actions runs, which says nothing about WHICH backend
  // those runs consumed. This is the one cross-check available without a usage API:
  // is the project being metered the same one the epoch describes?
  const projectRef = env.SUPABASE_PROJECT_REF || null;
  if (projectRef && projectRef !== BACKEND_EPOCH_PROJECT_REF) {
    console.warn(
      `::warning::E2E budget guard is metering project ${projectRef}, but its backend ` +
        `epoch (${BACKEND_EPOCH}) belongs to ${BACKEND_EPOCH_PROJECT_REF}. The count ` +
        `includes runs billed to a different project. Update BACKEND_EPOCH and ` +
        `BACKEND_EPOCH_PROJECT_REF, or set E2E_BUDGET_BACKEND_EPOCH (#726).`
    );
  } else if (!projectRef) {
    console.warn(
      '::warning::SUPABASE_PROJECT_REF is not set, so the budget guard cannot tell ' +
        'which backend it is metering. Pass it from vars.SUPABASE_PROJECT_REF (#726).'
    );
  }

  if (!repo || !token) {
    console.error(
      '✗ GITHUB_REPOSITORY and GITHUB_TOKEN are required. Blocking (#567).'
    );
    process.exit(dryRun ? 0 : 1);
  }

  const now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();

  let dayCount = 0;
  let monthCount = 0;
  let apiFailed = false;
  try {
    dayCount = await countRuns(fetch, {
      repo,
      token,
      sinceIso: iso(24 * 60 * 60 * 1000),
      excludeRunId: selfRunId,
    });
    monthCount = await countRuns(fetch, {
      repo,
      token,
      sinceIso: budgetWindowStart(new Date(now), backendEpoch),
      excludeRunId: selfRunId,
    });
  } catch (err) {
    apiFailed = true;
    console.error(`  api error: ${err.message}`);
  }

  const verdict = evaluate({
    dayCount,
    monthCount,
    limits,
    override: env.E2E_BUDGET_OVERRIDE,
    apiFailed,
  });

  console.log('E2E cloud-quota budget');
  console.log(
    `  last 24h ....... ${apiFailed ? '?' : dayCount} / ${limits.day}`
  );
  console.log(
    `  this cycle ..... ${apiFailed ? '?' : monthCount} / ${limits.month}` +
      `   (since ${budgetWindowStart(new Date(now), backendEpoch).slice(0, 10)})`
  );
  console.log(`  mode ........... ${mode}`);
  console.log(`  verdict ........ ${verdict.code}`);
  console.log(`  ${verdict.message}`);

  if (verdict.code === 'OVERRIDDEN') {
    console.log(
      `::warning::E2E quota budget was overridden. Reason: ${env.E2E_BUDGET_OVERRIDE}`
    );
  }

  if (!verdict.allowed) {
    console.log(
      `::error::E2E blocked by the cloud-quota circuit breaker — ${verdict.message}`
    );
    if (dryRun) {
      console.log(
        mode === 'annotate'
          ? '::warning::E2E_BUDGET_MODE=annotate — over budget, running anyway.'
          : '(--dry-run: would have blocked, exiting 0)'
      );
      process.exit(0);
    }
    process.exit(1);
  }
  process.exit(0);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--selftest')) {
    // Prove the BLOCKING branches can fire. A budget guard that cannot say no is
    // decoration.
    const cases = [
      ['under budget allows', { dayCount: 1, monthCount: 1 }, true],
      ['day limit blocks', { dayCount: 10, monthCount: 1 }, false],
      ['month limit blocks', { dayCount: 0, monthCount: 30 }, false],
      [
        'api failure blocks',
        { dayCount: 0, monthCount: 0, apiFailed: true },
        false,
      ],
      [
        'override with reason allows',
        { dayCount: 99, monthCount: 99, override: 'hotfix verification' },
        true,
      ],
      [
        'override cannot mask an API failure',
        { dayCount: 0, monthCount: 0, apiFailed: true, override: 'nope' },
        false,
      ],
      [
        'empty override is not an override',
        { dayCount: 99, monthCount: 99, override: '   ' },
        false,
      ],
    ];
    let bad = 0;
    for (const [name, input, want] of cases) {
      const got = evaluate({ limits: DEFAULT_LIMITS, ...input }).allowed;
      const ok = got === want;
      if (!ok) bad++;
      console.log(`  ${ok ? '✓' : '✗'} ${name} — allowed=${got}, want ${want}`);
    }
    console.log(bad ? `\n✗ selftest FAILED (${bad})` : '\n✓ selftest passed');
    process.exit(bad ? 1 : 0);
  }
  main();
}
