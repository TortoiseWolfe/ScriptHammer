/**
 * Report tests that finished having run ZERO assertions (#396).
 *
 * WHY. #396 catalogues "gates that could not fail" and names this as the highest-value
 * remaining fix: *"a spec that runs zero assertions is visibly different from one that
 * runs twelve."* Every instance in that catalogue shares one symptom — a green result
 * that measured nothing — and every one of them was found by a person becoming
 * suspicious of a specific test. This makes the symptom visible without anyone having
 * to suspect anything.
 *
 * It is not hypothetical. On 2026-08-20 two specs were found guarding every assertion
 * behind `if (elements.length > 0)` while visiting a page with none of those elements
 * (#842); fixing them immediately exposed a real 40px touch target on production. Both
 * would have shown up here as `expects=0` the first time they ran.
 *
 * WHY A REPORTER AND NOT THE JSON OUTPUT. The `json` reporter's result objects carry
 * `annotations`, `attachments`, `duration`, `errors`, `status`, `stdout`… and **no
 * `steps`**. Assertion counts are only reachable through the reporter API's step
 * callbacks. Verified by generating a report and inspecting its keys — post-processing
 * `results.json` cannot do this.
 *
 * IT ONLY PRINTS. Deliberately, and following this repo's own pattern of landing a
 * gate in annotate mode first (`E2E_BUDGET_MODE`, `FLAKY_GATE_MODE`). A zero-assertion
 * test is not always a defect — a spec may legitimately assert via `toPass`, a fixture,
 * or a thrown helper — so failing on it immediately would redden the required lane for
 * reasons nobody has triaged yet. Turn it into a gate once the list is known and empty.
 *
 * WHAT IT CANNOT SEE, said plainly: assertions made inside a helper that does not go
 * through `expect` (a raw `throw`), and `soft` assertions are counted like any other.
 * A test with a nonzero count is not thereby proven to assert anything USEFUL.
 */
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/** Steps Playwright tags as assertions. */
const EXPECT = 'expect';

class AssertionCountReporter implements Reporter {
  private counts = new Map<string, number>();

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== EXPECT) return;
    const key = this.key(test);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = this.key(test);
    // Record a zero explicitly so a test that ran and asserted nothing is
    // distinguishable from one that never ran at all.
    if (!this.counts.has(key) && result.status === 'passed') {
      this.counts.set(key, 0);
    }
  }

  onEnd(): void {
    const silent = [...this.counts.entries()]
      .filter(([, n]) => n === 0)
      .map(([k]) => k)
      .sort();

    if (this.counts.size === 0) {
      // Non-vacuity. A reporter that observed nothing must say so rather than
      // printing a clean bill of health — that would be the very shape #396 is about.
      console.log(
        '\n[assertion-count] observed no tests; this run proves nothing about assertion coverage.'
      );
      return;
    }

    if (silent.length === 0) {
      console.log(
        `\n[assertion-count] ${this.counts.size} passing test(s), all ran at least one assertion.`
      );
      return;
    }

    console.log(
      `\n[assertion-count] ${silent.length} of ${this.counts.size} passing test(s) ran ZERO assertions (#396):`
    );
    for (const k of silent) console.log(`  ${k}`);
    console.log(
      '  A green result here measured nothing. Usually the page does not contain what ' +
        'the spec guards on — see #842. Reporting only; this does not fail the run.'
    );
  }

  private key(test: TestCase): string {
    return `${test.location.file.replace(`${process.cwd()}/`, '')}:${test.location.line} › ${test.title}`;
  }
}

export default AssertionCountReporter;
