#!/usr/bin/env node
/**
 * What CI actually costs, in the unit that is actually scarce (#1138).
 *
 * WHY THIS EXISTS. This repo built a careful, well-tested circuit breaker for Supabase quota —
 * whose invoices read $0.00 — and had NO instrument of any kind on the resource it was really
 * spending. Measured 2026-09-09: 27,462 Actions minutes in nine days, 458 runner-hours, **62%
 * of the whole account**, with 26-job runs queuing up to 1,811s for a machine while 10-job runs
 * waited two seconds. Three changes shipped that day to reduce it (#1134, #1140, #1143) and not
 * one of them could be shown to have worked.
 *
 * IT IS A REPORT, NOT A GATE, AND THAT IS THE DESIGN. Net cost is $0.00 — the repo is public and
 * every runner is `ubuntu-latest` — so a threshold that reddens a required check would be worse
 * than the problem it addresses. This never exits non-zero for a number it dislikes. The failure
 * mode here is latency, and latency is something you look at, not something you block a merge on.
 *
 * ── TWO THINGS THAT MAKE THE OBVIOUS IMPLEMENTATION WRONG ────────────────────────────────────
 *
 * 1. THE TIMING ENDPOINTS RETURN ZEROS. `/actions/runs/{id}/timing` and
 *    `/actions/workflows/{id}/timing` report BILLABLE time, and a public repo is not billed —
 *    so they answer `{"billable":{}}` and `total_ms: 0` with every job at `duration_ms: 0`.
 *    Built on those, this report would be a wall of zeros that looked like success.
 *
 * 2. RAW SECONDS UNDER-REPORT BY ~13%. GitHub bills each JOB rounded UP to the whole minute.
 *    Validated against the billing API for 2026-09-08, a day with 157 runs and 677 jobs:
 *
 *        raw seconds summed  2,636 min   (87.0% of billed — wrong)
 *        ceil per job        2,974 min   (98.2% of billed — right)
 *        billing API         3,028 min
 *
 *    The residual is runs that cross midnight and land in the other day's bucket.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────────────────────
 *
 * It does not read the billing API. That needs a user-scoped token, and `GITHUB_TOKEN` is
 * repo-scoped, so a CI run cannot see dollars or the private-repo allowance at all. The Actions
 * API is in any case MORE useful here: it gives per-workflow granularity that billing does not.
 * The dollar cross-check is a human command, printed at the end of every report.
 *
 * It samples the most recent runs rather than a full window. Exhausting a month would be ~1,400
 * job calls against a 1,000/hour limit. The report always states the window it actually covered,
 * because a sample that hides its own bounds is how a measurement becomes a claim.
 */

const API = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || process.argv[2];
const SAMPLE = Number(process.env.USAGE_SAMPLE_RUNS || 100);

/** Percentile of a numeric array, nearest-rank. Returns null for an empty set. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** Minutes GitHub would bill for one job: whole minutes, rounded UP. Never negative. */
export function billedMinutes(startedAt, completedAt) {
  const secs = (Date.parse(completedAt) - Date.parse(startedAt)) / 1000;
  if (!Number.isFinite(secs) || secs <= 0) return 0;
  return Math.ceil(secs / 60);
}

/** Seconds a job waited for a runner. Clock skew can make this slightly negative; clamp. */
export function queueSeconds(createdAt, startedAt) {
  const secs = (Date.parse(startedAt) - Date.parse(createdAt)) / 1000;
  return Number.isFinite(secs) && secs > 0 ? secs : 0;
}

/** Fold jobs into per-workflow totals. Pure, so the arithmetic is testable without a network. */
export function summarise(runs) {
  const byWorkflow = new Map();
  let jobs = 0;
  const allWaits = [];
  for (const run of runs) {
    const key = run.name || '(unnamed workflow)';
    const wf = byWorkflow.get(key) ?? {
      name: key,
      runs: 0,
      jobs: 0,
      minutes: 0,
      waits: [],
    };
    wf.runs += 1;
    for (const job of run.jobs ?? []) {
      if (!job.started_at || !job.completed_at) continue;
      jobs += 1;
      wf.jobs += 1;
      wf.minutes += billedMinutes(job.started_at, job.completed_at);
      const wait = queueSeconds(job.created_at ?? job.started_at, job.started_at);
      wf.waits.push(wait);
      allWaits.push(wait);
    }
    byWorkflow.set(key, wf);
  }
  const rows = [...byWorkflow.values()]
    .map((w) => ({
      ...w,
      p50: percentile(w.waits, 50),
      p95: percentile(w.waits, 95),
      max: w.waits.length ? Math.max(...w.waits) : null,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  return {
    rows,
    jobs,
    minutes: rows.reduce((n, r) => n + r.minutes, 0),
    waitP50: percentile(allWaits, 50),
    waitP95: percentile(allWaits, 95),
    waitMax: allWaits.length ? Math.max(...allWaits) : null,
  };
}

const mins = (s) => (s == null ? '—' : `${Math.round(s)}s`);

export function render(summary, meta) {
  const L = [];
  L.push('## Actions usage — a report, not a gate (#1138)');
  L.push('');
  L.push(
    `Sampled the **${meta.sampled} most recent runs** of \`${meta.repo}\`` +
      (meta.from ? `, covering **${meta.from} → ${meta.to}**.` : '.')
  );
  L.push('');
  L.push('| | |');
  L.push('|---|---:|');
  L.push(`| runs sampled | ${meta.sampled} |`);
  L.push(`| jobs | ${summary.jobs} |`);
  L.push(`| billed-equivalent minutes | **${summary.minutes.toLocaleString()}** |`);
  L.push(`| queue wait p50 | ${mins(summary.waitP50)} |`);
  L.push(`| queue wait p95 | **${mins(summary.waitP95)}** |`);
  L.push(`| queue wait max | ${mins(summary.waitMax)} |`);
  L.push('');
  L.push('### By workflow');
  L.push('');
  L.push('| workflow | runs | jobs | minutes | wait p50 | wait p95 | wait max |');
  L.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const r of summary.rows) {
    L.push(
      `| ${r.name} | ${r.runs} | ${r.jobs} | ${r.minutes.toLocaleString()} | ` +
        `${mins(r.p50)} | ${mins(r.p95)} | ${mins(r.max)} |`
    );
  }
  L.push('');
  L.push('### How to read this');
  L.push('');
  L.push(
    '**Minutes are not money here.** This repo is public and every runner is `ubuntu-latest`, ' +
      'so net cost is $0.00 — verified across two months. What is finite is **account-wide ' +
      'runner concurrency**, and its symptom is the queue-wait column. A rising p95 means other ' +
      'repos on this account are waiting behind this one.'
  );
  L.push('');
  L.push(
    'Baselines from #1134, measured 2026-09-09 before any reduction: **27,462 minutes over 9 ' +
      'days**, 62% of the account, queue max **1,811s**.'
  );
  L.push('');
  L.push(
    'Dollars and the private-repo allowance need a user-scoped token, which CI does not have. ' +
      'Check those by hand — the legacy endpoints return `410`:'
  );
  L.push('');
  L.push('```');
  L.push(`gh api "/users/<owner>/settings/billing/usage?year=YYYY&month=M" \\`);
  L.push(`  --jq '[.usageItems[]|select(.netAmount>0)] | length'   # 0 means nothing was billed`);
  L.push('```');
  return L.join('\n');
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function main() {
  // Skip, never fail. A fork without a token, or a token without `actions: read`, must not
  // redden anything — this is a report.
  if (!token || !repo) {
    console.log(
      '[usage] skipped — GITHUB_TOKEN and GITHUB_REPOSITORY are both required, and this is a ' +
        'report rather than a gate, so a missing one is not an error.'
    );
    return;
  }
  const per = Math.min(100, SAMPLE);
  const list = await api(
    `/repos/${repo}/actions/runs?per_page=${per}&page=1`
  ).catch((e) => {
    console.log(`[usage] skipped — ${e.message}`);
    return null;
  });
  if (!list) return;

  const runs = list.workflow_runs ?? [];
  for (const run of runs) {
    try {
      const jobs = await api(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`);
      run.jobs = jobs.jobs ?? [];
    } catch {
      run.jobs = [];
    }
  }
  const stamps = runs.map((r) => r.created_at).filter(Boolean).sort();
  const summary = summarise(runs);
  const out = render(summary, {
    repo,
    sampled: runs.length,
    from: stamps[0]?.slice(0, 16).replace('T', ' '),
    to: stamps[stamps.length - 1]?.slice(0, 16).replace('T', ' '),
  });
  console.log(out);
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) (await import('node:fs')).appendFileSync(file, `${out}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    // Even an unexpected failure must not redden anything.
    console.log(`[usage] skipped — ${e.message}`);
  });
}
