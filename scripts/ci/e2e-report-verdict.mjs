/**
 * Say out loud whether the hosted E2E lane's tests passed (#1069).
 *
 * WHY THIS EXISTS. `Test Report` merges every shard's blob report and was GREEN while three
 * tests failed. It was not lying — it reports on whether MERGING worked, and merging worked.
 * But its name promises a verdict about the tests, so a reader takes green to mean the tests
 * passed. Measured on run 33830200821 (2026-09-03):
 *
 *     E2E (chromium-gen 1/6) ..... FAILURE, log ends in artifact-upload noise
 *     E2E (chromium-gen 3/6) ..... FAILURE, only annotation: "Process completed with exit code 1"
 *     Test Report ................ SUCCESS, carrying 10 annotations naming the 3 failed tests
 *
 * So the eye goes to the red job, which says nothing, while the job that knows everything sits
 * green and unopened. Two genuine user-facing defects rode that gap for a day: the avatar
 * upload rollback (#1068) and a $99 SKU advertised on /pricing that was absent from the
 * production `products` table.
 *
 * The job summary did not help either — it said which browsers ran and "Download the
 * playwright-report artifact for detailed results". No counts, no names.
 *
 * WHAT THIS DOES. Reads the merged JSON report that `check-flaky-count.mjs` already consumes,
 * writes a real summary — counts plus every failing test by file and line — and EXITS NON-ZERO
 * when tests failed, so the job carrying the detail is the one that goes red.
 *
 * IT WALKS THE TREE RATHER THAN TRUSTING `stats`. Same reason check-flaky-count.mjs does:
 * a count is a reconstruction, and #934 was a required aggregate reporting PASS while three of
 * its shards reported FAIL because it rebuilt a verdict instead of reading one. `stats` is
 * still printed when it disagrees, because a disagreement is itself a finding.
 *
 * A MISSING OR UNREADABLE REPORT IS A FAILURE, NOT A PASS. The opposite choice is what
 * check-flaky-count.mjs makes, and correctly — it hunts flakes, and no report is no evidence
 * of a flake. This script asks whether the tests passed, and no report is no evidence they did.
 *
 * USAGE
 *   node scripts/ci/e2e-report-verdict.mjs <merged-report.json>
 */

import { readFileSync, appendFileSync } from 'node:fs';

/** Append to the GitHub job summary; falls back to stdout so local runs still show it. */
function summary(line) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${line}\n`);
  else console.log(line);
}

/**
 * Walk Playwright's nested suite tree, bucketing every test by its final status.
 *
 * `expected` and `unexpected` are Playwright's words, and they are not synonyms for pass and
 * fail: a test declared with `test.fail()` that does fail is `expected`, and reporting it as
 * red would make this repo's own convention unusable (#511).
 */
export function collect(
  suites,
  acc = { failed: [], flaky: [], passed: 0, skipped: 0 }
) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const where = {
          title: spec.title,
          project: test.projectName || test.projectId || 'unknown',
          file: spec.file || suite.file || '',
          line: spec.line || suite.line || 0,
        };
        if (test.status === 'unexpected') acc.failed.push(where);
        else if (test.status === 'flaky') acc.flaky.push(where);
        else if (test.status === 'skipped') acc.skipped++;
        else acc.passed++;
      }
    }
    if (suite.suites) collect(suite.suites, acc);
  }
  return acc;
}

/**
 * The first error message a failing test produced, flattened to one line.
 *
 * The whole point of this file is that a reader should not have to download an artifact, so
 * the message travels with the name. Trimmed hard, and newlines collapsed: a Playwright diff
 * runs to hundreds of lines and would destroy the markdown table it sits in. A summary nobody
 * can scan is the problem being fixed, not a smaller version of it.
 */
export function firstError(suites, target) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      if (spec.title !== target.title) continue;
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          const msg = result.error?.message || result.errors?.[0]?.message;
          if (msg) {
            return msg
              .replace(/\[[0-9;]*m/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 200);
          }
        }
      }
    }
    if (suite.suites) {
      const found = firstError(suite.suites, target);
      if (found) return found;
    }
  }
  return '';
}

/**
 * The CLI, guarded so the helpers above stay importable.
 *
 * Without the guard, importing this module for a unit test runs it and calls `process.exit`,
 * which is how the first version of this file could not be tested at all.
 */
export function main(argv = process.argv) {
  const reportPath = argv[2];
  if (!reportPath) {
    console.error(
      '::error::[e2e-verdict] usage: e2e-report-verdict.mjs <report.json>'
    );
    return 1;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (e) {
    console.error(
      `::error::[e2e-verdict] no readable merged report at ${reportPath} (${e.message}). ` +
        'Cannot confirm the tests passed, so this is not a pass.'
    );
    summary(
      "## E2E result\n\n**Could not read the merged report.** The lane's outcome is unknown."
    );
    return 1;
  }

  const acc = collect(report.suites);
  const total = acc.passed + acc.failed.length + acc.flaky.length + acc.skipped;

  // A report with no tests in it is a failed observation, not a clean run — the same
  // anti-vacuity rule the schema-drift checks follow. It is reachable: every shard skipped,
  // or a merge that produced an empty tree.
  if (total === 0) {
    console.error(
      '::error::[e2e-verdict] the merged report contains NO tests. That is a failed ' +
        'observation, not a pass.'
    );
    summary(
      '## E2E result\n\n**The merged report contained no tests.** Not treated as a pass.'
    );
    return 1;
  }

  const statsUnexpected = report.stats?.unexpected;
  if (
    typeof statsUnexpected === 'number' &&
    statsUnexpected !== acc.failed.length
  ) {
    console.log(
      `::notice::[e2e-verdict] stats.unexpected=${statsUnexpected} but walked ` +
        `${acc.failed.length} — reporting the walked set.`
    );
  }

  const icon = acc.failed.length ? '❌' : acc.flaky.length ? '⚠️' : '✅';
  summary(
    `## ${icon} E2E result — ${acc.failed.length} failed, ${acc.flaky.length} flaky, ` +
      `${acc.passed} passed, ${acc.skipped} skipped`
  );
  summary('');

  if (acc.failed.length) {
    summary('### Failed');
    summary('');
    summary('| test | where | error |');
    summary('| --- | --- | --- |');
    for (const f of acc.failed) {
      const err = firstError(report.suites, f).replace(/\|/g, '\\|');
      summary(
        `| ${f.title.replace(/\|/g, '\\|')} | \`${f.file}:${f.line}\` (${f.project}) | ${err} |`
      );
    }
    summary('');
  }

  if (acc.flaky.length) {
    summary(
      `### Flaky (${acc.flaky.length}) — passed on retry, counted as passes by Playwright`
    );
    summary('');
    for (const f of acc.flaky)
      summary(`- ${f.title} — \`${f.file}:${f.line}\``);
    summary('');
  }

  console.log(
    `E2E result — ${acc.failed.length} failed, ${acc.flaky.length} flaky, ` +
      `${acc.passed} passed, ${acc.skipped} skipped (${total} total)`
  );

  for (const f of acc.failed) {
    // One annotation per failure, on THIS job, so the red check and the detail are in the
    // same place. Playwright's own `github` reporter already annotates from the merge step,
    // but those land on a job that was green — which is the whole defect.
    console.error(
      `::error file=${f.file},line=${f.line}::[e2e-verdict] ${f.title} — ` +
        `${firstError(report.suites, f)}`
    );
  }

  if (acc.failed.length) {
    console.error(
      `::error::[e2e-verdict] ${acc.failed.length} E2E test(s) failed on the hosted lane. ` +
        'The named tests above ran against the REAL production backend, so a failure here ' +
        'can mean a defect the local lane cannot see by construction (#1069).'
    );
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
