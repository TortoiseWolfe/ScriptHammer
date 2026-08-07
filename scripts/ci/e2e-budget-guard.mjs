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

/** Count workflow runs created at or after `sinceIso`. Throws on any API problem. */
export async function countRuns(fetchImpl, { repo, token, sinceIso }) {
  const url =
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs` +
    `?created=%3E%3D${encodeURIComponent(sinceIso)}&per_page=100`;
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (typeof body.total_count !== 'number') {
    throw new Error('GitHub API response missing total_count');
  }
  // total_count reflects the full filtered set, not just this page, so a busy
  // window past 100 runs is still counted correctly.
  return body.total_count;
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
  const dryRun = argv.includes('--dry-run');
  const env = process.env;
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  const limits = limitsFromEnv(env);

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
    });
    monthCount = await countRuns(fetch, {
      repo,
      token,
      sinceIso: cycleStart(new Date(now)),
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
      `   (since ${cycleStart(new Date(now)).slice(0, 10)})`
  );
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
      console.log('(--dry-run: would have blocked, exiting 0)');
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
