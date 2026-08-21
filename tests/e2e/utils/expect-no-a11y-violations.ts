import { expect, type Page } from '@playwright/test';
import { getViolations } from 'axe-playwright';

/**
 * Assert a page has no axe violations, THROUGH `expect` (#861).
 *
 * WHY THIS EXISTS RATHER THAN `checkA11y`. `checkA11y` asserts with Node's
 * `assert.strictEqual` (axe-playwright/dist/utils.js:15), not Playwright's `expect`. A
 * raw `assert` throws, so the test genuinely can fail — but it produces no `expect` step,
 * and the assertion-count reporter counts `expect` steps. So four real accessibility
 * tests reported as running ZERO assertions on every shard, and sat in the #850 queue for
 * days as "false positives" that had to be explained each time somebody read the list.
 *
 * The tempting fixes were an allowlist or teaching the reporter to recognise the helper.
 * Both leave the tests dishonest-looking and the reporter's number wrong. This makes the
 * assertion visible instead, which is the thing #396 actually asks for: a spec that
 * asserts should be indistinguishable, in the report, from one that asserts.
 *
 * It is also strictly better than `checkA11y` at failing: `assert.strictEqual(0, n)`
 * prints "expected 0 to equal 3", while this prints which rules fired, their impact, and
 * the offending selectors — the information you need without re-running with a debugger.
 *
 * @param page       the page to scan; `injectAxe(page)` must have run first
 * @param options    axe-playwright options, e.g. `{ axeOptions: { rules: {...} } }`
 * @param impacts    when given, only these impact levels count as failures
 */
export async function expectNoA11yViolations(
  page: Page,
  options?: Parameters<typeof getViolations>[2],
  impacts?: string[]
): Promise<void> {
  const all = await getViolations(page, undefined, options);
  const violations = impacts
    ? all.filter((v) => v.impact && impacts.includes(v.impact))
    : all;

  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join('\n    ')}`
  );

  expect(
    violations.map((v) => v.id),
    violations.length
      ? `${violations.length} accessibility violation(s):\n  ${summary.join('\n  ')}`
      : 'no violations'
  ).toEqual([]);
}
