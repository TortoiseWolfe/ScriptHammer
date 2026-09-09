/**
 * Stripe's `success_url` must point at a route that mounts `BookingStep` (#1126).
 *
 * THE DEFECT THIS EXISTS FOR. `create-stripe-checkout` sent buyers to `/payment-result`, and
 * `BookingStep` was mounted only on `/checkout`. Nothing in the app navigated to
 * `/checkout?session_id=`, so the per-SKU booking work of #1092, #1100 and #1113 ran on a route
 * with no traffic. Someone paid for a scheduled session and was offered "Back to Payment Demo".
 *
 * WHY NOTHING CAUGHT IT — and this is the part worth keeping. Every test in the area was
 * individually correct:
 *
 *   - `BookingStep.test.tsx` renders the component with props. All 13 tests pass regardless of
 *     which route mounts it. Structurally blind to a mounting problem.
 *   - `checkout-paid-return.test.tsx` mocks `useSearchParams` to return `session_id=cs_test_…`
 *     and asserts the page threads the SKU. All 5 pass no matter where `success_url` points,
 *     because the URL is hardcoded rather than derived.
 *   - `payment-return.test.ts` is right about the *shape* of the return URL and silent about its
 *     *destination*.
 *   - `check-calendar-configured.mjs` greps the deployed chunk graph, which is emitted whether
 *     or not the branch is reachable.
 *
 * The assertion that closes the loop — the path Stripe redirects to equals a path that mounts
 * the component — existed in no layer. It needs two files read together, and no test read two
 * files.
 *
 * WHY IT LIVES HERE. `vitest.config.ts` excludes `supabase/functions/**`, and no workflow runs
 * `deno test` — so the Edge Function's own tests never execute in CI. `pnpm test:scripts` runs
 * inside the required `Test (20.x)` check (`ci.yml:89`), so this gates. It reads the function
 * source as text rather than importing it, which is what makes that possible.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const APP = path.join(ROOT, 'src', 'app');

/** The `success_url` template each one-time checkout function hands to Stripe. */
function successUrlPaths() {
  const fn = path.join(
    ROOT,
    'supabase/functions/create-stripe-checkout/index.ts'
  );
  const src = fs.readFileSync(fn, 'utf8');
  const out = [];
  for (const m of src.matchAll(/success_url:\s*`\$\{siteUrl\}([^`?]*)/g)) {
    out.push(m[1].replace(/\/$/, '') || '/');
  }
  return out;
}

/** Every app route whose `page.tsx` imports `BookingStep`. */
function routesMountingBookingStep(dir = APP, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      routesMountingBookingStep(full, out);
    } else if (e.name === 'page.tsx') {
      const src = fs.readFileSync(full, 'utf8');
      // Strip comments so a file merely *discussing* BookingStep does not count as mounting it.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (/\bBookingStep\b/.test(code)) {
        const route =
          '/' +
          path.relative(APP, path.dirname(full)).split(path.sep).join('/');
        out.push(route === '/.' ? '/' : route);
      }
    }
  }
  return out;
}

describe("Stripe's success_url lands on a route that mounts BookingStep (#1126)", () => {
  it('finds a success_url to check, so the assertion is not vacuous', () => {
    const paths = successUrlPaths();
    assert.ok(
      paths.length > 0,
      'no success_url template found in create-stripe-checkout/index.ts — the matcher is ' +
        'broken, or the function was restructured. Re-point this guard rather than deleting it.'
    );
  });

  it('finds at least one route mounting BookingStep, so the assertion is not vacuous', () => {
    const routes = routesMountingBookingStep();
    assert.ok(
      routes.length > 0,
      'no page.tsx imports BookingStep — either the component is now dead code, or this ' +
        'sweep is broken. Both are worth failing over.'
    );
  });

  it('every success_url path mounts BookingStep', () => {
    const routes = routesMountingBookingStep();
    const orphans = successUrlPaths().filter((p) => !routes.includes(p));

    assert.deepStrictEqual(
      orphans,
      [],
      'Stripe returns paying buyers to a route that does not mount BookingStep, so they ' +
        'reach no booking link (#1126).\n\n' +
        `  success_url path(s): ${successUrlPaths().join(', ')}\n` +
        `  routes mounting BookingStep: ${routes.join(', ') || '(none)'}\n\n` +
        'Fix by mounting BookingStep on the return route. Changing success_url instead is ' +
        'possible but NOT equivalent: no workflow deploys supabase/functions/**, so an edge ' +
        'function edit is inert in production until someone deploys it by hand.'
    );
  });

  it('a file that only MENTIONS BookingStep in a comment does not count', () => {
    // Counterweight. Without comment-stripping this guard would pass the moment someone wrote
    // "we should mount BookingStep here" in a TODO — which is the failure mode this repo has
    // hit four times.
    const withOnlyAComment =
      '// TODO: mount BookingStep here one day\nexport default null;';
    const code = withOnlyAComment
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/\bBookingStep\b/.test(code));
  });
});
