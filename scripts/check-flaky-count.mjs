#!/usr/bin/env node
// Flaky-count honesty gate for the E2E rollup (#300).
//
// The gap this closes: Playwright's `retries: 2` reports a test that failed then
// passed on retry as a PASS. The job conclusion stays GREEN, the rollup says
// CLEAN, and the only trace is a per-test annotation from the `github` reporter
// that nobody reads. That is how FOUR distinct flakes accumulated across five
// merges to main with every checkmark green (#300) — "the checkmark is not the
// signal." This gate reads the merged report, counts the flaky tests, and
// surfaces them as ONE aggregated, unmissable block in the job summary plus a
// GitHub annotation per flake.
//
// Modes (env FLAKY_GATE_MODE, default "annotate"):
//   annotate — surface flakes loudly (::warning:: + summary) but exit 0, so a
//              flake does NOT red main while the four known ones are still open.
//   block    — a non-zero flaky count is a build failure (::error:: + exit 1).
//              Flip to this once #300's four are cleared, so no NEW flake can
//              ride in behind a green tick again.
//
// A missing/unparseable report is an INFRA gap (the e2e jobs surface their own
// failures), never treated as a flake — this gate stays exit 0 for it in either
// mode so it can't mask or invent a signal.
//
// Usage: node scripts/check-flaky-count.mjs [merged-report.json]

import { readFileSync, appendFileSync } from 'node:fs';

const reportPath = process.argv[2] || 'flaky-report.json';
const mode = (process.env.FLAKY_GATE_MODE || 'annotate').toLowerCase();

/** Append a line to the GitHub Actions job summary, if running in CI. */
function summary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) {
    try {
      appendFileSync(f, md + '\n');
    } catch {
      /* summary is best-effort */
    }
  }
}

/** Recursively collect flaky tests from Playwright's nested suite tree. */
function collectFlaky(suites, acc) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        // Playwright marks a test 'flaky' when an earlier attempt failed but a
        // retry passed — precisely the retry-laundered case this gate hunts.
        if (test.status === 'flaky') {
          acc.push({
            title: spec.title,
            project: test.projectName || test.projectId || 'unknown',
            file: spec.file || suite.file || '',
            line: spec.line || suite.line || 0,
          });
        }
      }
    }
    if (suite.suites) collectFlaky(suite.suites, acc);
  }
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (e) {
  // No report / unreadable → infra gap, not a flake. Do not fail the gate.
  console.log(
    `::notice::flaky-gate: no readable report at ${reportPath} (${
      String(e.message).split('\n')[0]
    }) — skipping flake assessment.`
  );
  summary(
    '## 🎲 Flaky-count gate\n\nNo readable E2E report — flake assessment skipped.'
  );
  process.exit(0);
}

const flaky = [];
collectFlaky(report.suites, flaky);

// Cross-check against Playwright's own aggregate if present (detail count is
// authoritative; a mismatch just means a shape we didn't walk — log it).
const statsFlaky = report.stats?.flaky;
if (typeof statsFlaky === 'number' && statsFlaky !== flaky.length) {
  console.log(
    `::notice::flaky-gate: stats.flaky=${statsFlaky} but walked ${flaky.length} — reporting the walked set.`
  );
}

if (flaky.length === 0) {
  console.log('✅ flaky-gate: 0 flaky tests in the merged E2E report.');
  summary(
    '## 🎲 Flaky-count gate\n\n✅ **0 flaky tests** in the merged E2E report.'
  );
  process.exit(0);
}

// There are flakes. Surface them the same way whether we block or not — the
// only difference is the annotation severity and the exit code.
const level = mode === 'block' ? 'error' : 'warning';

for (const f of flaky) {
  const loc = f.file ? ` file=${f.file},line=${f.line}` : '';
  console.log(
    `::${level}${loc}::[${f.project}] flaked (passed only on retry): ${f.title}`
  );
}

summary(`## 🎲 Flaky-count gate\n`);
summary(
  `**${flaky.length} flaky test${flaky.length === 1 ? '' : 's'}** — each failed an attempt then passed on retry, so \`retries: 2\` reported it as a PASS. A flake is a failed build (#300).\n`
);
summary('| # | project | test | location |');
summary('| --- | --- | --- | --- |');
flaky.forEach((f, i) => {
  const loc = f.file ? `${f.file}:${f.line}` : '—';
  summary(`| ${i + 1} | \`${f.project}\` | ${f.title} | \`${loc}\` |`);
});
summary('');

if (mode === 'block') {
  console.error(
    `\n❌ flaky-gate: ${flaky.length} flaky test(s) — failing the build (FLAKY_GATE_MODE=block).`
  );
  summary(
    '**Mode: block** — this run is failed. Fix the flake or its root cause; do not re-run to green.'
  );
  process.exit(1);
}

console.log(
  `\n⚠️  flaky-gate: ${flaky.length} flaky test(s) surfaced (FLAKY_GATE_MODE=annotate — not failing the build).`
);
summary(
  '**Mode: annotate** — surfaced, not blocking. Flip `FLAKY_GATE_MODE=block` once #300 is clear.'
);
process.exit(0);
