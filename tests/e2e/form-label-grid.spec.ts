/**
 * A field's position must not depend on how long its label reads (#436).
 *
 * ## The defect this pins
 * DaisyUI's `.label` is `inline-flex`. In a wrapper holding a label and then its
 * control, that makes layout a function of the COPY: when
 * `labelWidth + controlWidth` happens to fit the container, the control rides up
 * onto the label's line and that one field sits a label-width right of every
 * other field in the same form.
 *
 * Measured before the `globals.css` fix, sweeping these routes at these widths:
 * 5 of 27 forms had fields that disagreed with their own siblings. `/contact`'s
 * "Subject" shared its label's line while the other three fields did not;
 * `/reset-password` put "New Password" and "Confirm Password" inputs 108px apart.
 *
 * ## Why the assertion is DISAGREEMENT, not absolute position
 * "The input sits beside its label" is not the defect. `/sign-in` and `/sign-up`
 * do exactly that on purpose (#384's two-column rows), and asserting that every
 * control must start at its label's left edge would report those as broken. What
 * is never intentional is one field in a form behaving differently from the
 * others, so this compares each field against its own siblings.
 *
 * ## Why the existing gates cannot catch it
 * `all form inputs have labels` checks a label EXISTS and is associated.
 * `ContactForm.test.tsx` uses `getByLabelText`, which resolves through
 * `htmlFor`/`id` regardless of geometry — correct for accessibility, blind to
 * layout. Neither looks at where anything renders.
 */

import { test, expect } from '@playwright/test';
import { waitForLoadStateOrGiveUp } from './utils/settle';

/** Routes with at least two labelled fields in one form. */
const ROUTES = [
  '/contact',
  '/reset-password',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
];

/**
 * The defect appears and disappears with the viewport, because it depends on
 * whether label + control fit the container. A single width finds one instance
 * and calls the rest clean.
 */
const WIDTHS = [320, 390, 768, 1024, 1280];

interface FieldGeometry {
  text: string;
  ctrlLeft: number;
  sharesLine: boolean;
}

test.describe('Form fields follow one grid per form (#436)', () => {
  for (const width of WIDTHS) {
    test(`fields agree with their siblings at ${width}px`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });

      const disagreements: string[] = [];
      let formsMeasured = 0;
      let fieldsMeasured = 0;

      for (const route of ROUTES) {
        // `E2E_PATH_PREFIX` exists only so this spec can be run by hand against
        // the dev server, which serves under a basePath. In CI the static build
        // is served at the root and the prefix is empty — the same convention
        // `color-contrast.spec.ts` uses. It is NOT a fallback that can hide a
        // bad URL: a wrong path yields the 404 page, which has no labelled
        // fields, and the coverage floor below fails loudly on that.
        const prefix = process.env.E2E_PATH_PREFIX ?? '';
        await page.goto(`${prefix}${route}`, {
          waitUntil: 'domcontentloaded',
        });
        await waitForLoadStateOrGiveUp(page, 'load');
        await page.waitForTimeout(1200);

        const forms = await page.evaluate(() => {
          const byForm = new Map<Element, FieldGeometry[]>();
          for (const label of document.querySelectorAll('label.label')) {
            const forId = label.getAttribute('for');
            const ctrl = forId
              ? document.getElementById(forId)
              : label.parentElement?.querySelector('input,textarea,select') ||
                null;
            if (!ctrl) continue;
            // A checkbox or radio IS the affordance beside its words, so being
            // inline is correct for them. Excluded deliberately.
            const type = (ctrl.getAttribute('type') || '').toLowerCase();
            if (type === 'checkbox' || type === 'radio') continue;
            const lr = label.getBoundingClientRect();
            const cr = ctrl.getBoundingClientRect();
            if (lr.width < 1 || cr.width < 1) continue;
            const owner = ctrl.closest('form') ?? document.body;
            if (!byForm.has(owner)) byForm.set(owner, []);
            byForm.get(owner)!.push({
              text: (label.textContent || '')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 30),
              ctrlLeft: Math.round(cr.left),
              sharesLine: cr.top < lr.bottom - 1 && cr.bottom > lr.top + 1,
            });
          }
          return [...byForm.values()].filter((rows) => rows.length >= 2);
        }, undefined);

        for (const rows of forms) {
          formsMeasured++;
          fieldsMeasured += rows.length;
          const shares = new Set(rows.map((r) => r.sharesLine));
          const lefts = new Set(rows.map((r) => r.ctrlLeft));
          if (shares.size === 1 && lefts.size === 1) continue;
          disagreements.push(
            `${route} @${width}px:\n` +
              rows
                .map(
                  (r) =>
                    `    ctrlLeft=${r.ctrlLeft} sharesLine=${r.sharesLine} "${r.text}"`
                )
                .join('\n')
          );
        }
      }

      // COVERAGE FLOOR. Every check above is conditional on finding a labelled
      // control, so a selector that stops matching would leave zero fields
      // measured and the test would pass. Zero measured is indistinguishable
      // from zero defects. 8 is MEASURED at every width in this list; raise it
      // deliberately if routes are added, and never lower it to go green.
      expect(
        fieldsMeasured,
        `measured only ${fieldsMeasured} labelled fields across ${formsMeasured} forms — ` +
          `the label/control selector has probably stopped matching`
      ).toBeGreaterThanOrEqual(8);

      expect(
        disagreements,
        `Fields in the same form laid out differently. DaisyUI's .label is\n` +
          `inline-flex, so whether a control fits on its label's line depends on\n` +
          `the label TEXT. globals.css sets .label { display: flex } for this.\n\n` +
          disagreements.join('\n\n')
      ).toEqual([]);
    });
  }
});
