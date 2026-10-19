#!/usr/bin/env node
/**
 * Fail when a vitest JSON report contains any skipped or todo test (#1379).
 *
 * WHY. tests/rls gates every suite on `describe.skipIf(!hasRlsTestEnvironment())`, so a
 * missing env var turns the whole RLS suite into skips and vitest still exits 0. A skip
 * is not a pass: this is the gate that makes the conformance job say so.
 *
 * It fails closed on its own inputs as well: a missing, unparseable or empty report is an
 * error, never "nothing skipped" — a probe that cannot report failure proves nothing.
 *
 * Usage: node scripts/ci/assert-no-skipped.mjs <vitest-report.json>
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const NOT_RUN = new Set(['pending', 'skipped', 'todo', 'disabled']);

/**
 * @param {unknown} report parsed output of `vitest --reporter=json`
 * @returns {{ ok: boolean, total: number, passed: number, skipped: string[], problems: string[] }}
 */
export function evaluate(report) {
  const problems = [];
  const skipped = [];
  const r = /** @type {any} */ (report);
  if (!r || typeof r !== 'object' || !Array.isArray(r.testResults)) {
    return {
      ok: false,
      total: 0,
      passed: 0,
      skipped,
      problems: ['not a vitest JSON report (no testResults array)'],
    };
  }

  let total = 0;
  let passed = 0;
  for (const file of r.testResults) {
    for (const t of file.assertionResults ?? []) {
      total += 1;
      if (t.status === 'passed') passed += 1;
      if (NOT_RUN.has(t.status)) {
        skipped.push(`${file.name} :: ${t.fullName ?? t.title} [${t.status}]`);
      }
    }
  }

  // The report's own counters catch skips that never produced an assertionResult
  // (e.g. a file-level skip), so check them as well as the per-test rows.
  const counted = (r.numPendingTests ?? 0) + (r.numTodoTests ?? 0);
  if (counted > skipped.length) {
    problems.push(
      `report counts ${r.numPendingTests ?? 0} pending + ${r.numTodoTests ?? 0} todo but only ${skipped.length} were named`
    );
  }
  if (total === 0) problems.push('report contains zero tests');
  if (typeof r.numTotalTests === 'number' && r.numTotalTests !== total) {
    problems.push(
      `numTotalTests=${r.numTotalTests} but ${total} assertion results found`
    );
  }

  const ok = problems.length === 0 && skipped.length === 0;
  return { ok, total, passed, skipped, problems };
}

function main(argv) {
  const file = argv[2];
  if (!file) {
    console.error('usage: assert-no-skipped.mjs <vitest-report.json>');
    return 2;
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`::error::cannot read vitest report ${file}: ${e.message}`);
    return 1;
  }
  const res = evaluate(report);
  console.log(
    `  vitest report: ${res.total} tests, ${res.passed} passed, ${res.skipped.length} skipped/todo`
  );
  for (const p of res.problems) console.error(`::error::${p}`);
  if (res.skipped.length > 0) {
    console.error(
      `::error::${res.skipped.length} test(s) did not run. A skip is not a pass:`
    );
    for (const s of res.skipped) console.error(`  - ${s}`);
  }
  return res.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main(process.argv));
}
