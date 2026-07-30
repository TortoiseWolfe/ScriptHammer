/**
 * Horizontal Scroll Detection Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T010
 *
 * #373 §B1 — THIS GATE COULD NOT FAIL.
 *
 * It swept `TEST_PAGES`: three routes, `/`, `/blog` and one blog post, at four
 * widths. 12 of its 16 assertions, and every one of those 12, checked
 * `documentElement.scrollWidth <= clientWidth`.
 *
 * Measured across all 42 routes at 320/375/390/428px on live production:
 *
 *   documentElement.scrollWidth overflow ... 0 routes
 *   real element overflow .................. 41 of 42 routes
 *
 * The document can never report horizontal overflow, because the layout frame
 * in `src/app/layout.tsx` clips the x axis — `overflow-x-clip` today, and
 * `overflow-hidden` before #373 §A4. So `scrollWidth` is pinned to
 * `clientWidth` by construction and the assertion is decoration. Meanwhile a
 * `btn-ghost btn-sm` in the cookie banner sat 11px past the right edge of a
 * 320px viewport on 41 routes, and 17 green checks per PR said nothing.
 *
 * Two changes:
 *
 * 1. ROUTES ARE ENUMERATED from `src/app/**\/page.tsx`, the same as
 *    `color-contrast.spec.ts` since #411. A new route is covered the day it is
 *    created; opting out is a visible entry with a reason, not an omission.
 * 2. The PRIMARY assertion is per-element geometry, which sees THROUGH the
 *    clip. `scrollWidth` is kept as a cheap second signal — it is not
 *    load-bearing, but if the frame ever stops clipping it will start working.
 *
 * WHY THE ELEMENT CHECK NEEDS EXCLUSIONS, and why they are not a way to make it
 * pass. Measured unfiltered, it flagged 39 of 42 routes and 1228 elements. They
 * fell into three kinds and only one is a defect:
 *
 *   - clipped or scrolled by an ancestor — `IMG.leaflet-tile` extends past the
 *     map on purpose; DaisyUI puts `overflow-x: auto` on `.stats`, so a wide
 *     child is the design working. Content the user can reach by scrolling the
 *     element it lives in is the RECOMMENDED pattern, and content clipped by an
 *     ancestor produces no page scrollbar.
 *   - a transform artefact — `getBoundingClientRect` includes transforms, so
 *     the home page's scale-animating logo reports overflow no layout has.
 *     Asserting on it would be flaky by construction.
 *   - everything else. That is the defect, and after filtering it was exactly
 *     one element per route.
 */

import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CRITICAL_MOBILE_WIDTHS } from '@/config/test-viewports';
import { dismissCookieBanner } from '../utils/test-user-factory';

const APP_DIR = join(process.cwd(), 'src/app');

/** Routes that cannot be measured, each with the reason. Never silent. */
const EXCLUDED: Record<string, string> = {
  '/auth/callback':
    'transient OAuth handler — redirects on load, there is no UI to measure',
  '/twins/[slug]':
    'twin payloads are privacy-gated and gitignored; absent in a fresh checkout',
};

/** Dynamic segments need a real instance — the template alone proves nothing. */
const INSTANCES: Record<string, string> = {
  '/blog/[slug]': '/blog/playable-city-chattanooga',
  '/blog/tags/[tag]': '/blog/tags/digital-twin',
  '/docs/[slug]': '/docs/install-and-first-run',
};

function enumerateRoutes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Route groups `(name)` and private folders `_name` contribute no URL
      // segment; `[slug]` does.
      const seg =
        entry.name.startsWith('(') || entry.name.startsWith('_')
          ? ''
          : `/${entry.name}`;
      out.push(...enumerateRoutes(join(dir, entry.name), prefix + seg));
    } else if (entry.name === 'page.tsx') {
      out.push(prefix === '' ? '/' : prefix);
    }
  }
  return out;
}

const ALL = enumerateRoutes(APP_DIR).sort();
const SKIPPED = ALL.filter((r) => r in EXCLUDED);
const PAGES = ALL.filter((r) => !(r in EXCLUDED)).map((r) => INSTANCES[r] ?? r);

// Loudly, so a shrinking sweep can never read as a passing one.
console.log(
  `[mobile-horizontal-scroll] sweeping ${PAGES.length} of ${ALL.length} routes x ${CRITICAL_MOBILE_WIDTHS.length} widths` +
    (SKIPPED.length
      ? `\n[mobile-horizontal-scroll] excluded ${SKIPPED.length}:\n` +
        SKIPPED.map((r) => `  - ${r}: ${EXCLUDED[r]}`).join('\n')
      : '')
);

/**
 * Runs in the browser. Returns the elements whose right edge passes the
 * viewport and which are NOT excused, plus the excused tally so a run can show
 * the filter is doing triage rather than silently swallowing everything.
 */
function measureOverflow(vpWidth: number) {
  const CLIPS = ['hidden', 'clip', 'auto', 'scroll'];
  const real: string[] = [];
  let excused = 0;

  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.x + r.width <= vpWidth + 1) continue;

    let why: string | null = null;
    for (
      let n = el.parentElement;
      n && n !== document.documentElement;
      n = n.parentElement
    ) {
      if (CLIPS.includes(getComputedStyle(n).overflowX)) {
        why = 'clipped-or-scrolled';
        break;
      }
    }
    if (!why) {
      for (
        let n: Element | null = el;
        n && n !== document.documentElement;
        n = n.parentElement
      ) {
        const t = getComputedStyle(n).transform;
        if (t && t !== 'none') {
          why = 'transform';
          break;
        }
      }
    }

    if (why) {
      excused++;
      continue;
    }
    const cls =
      typeof (el as HTMLElement).className === 'string'
        ? (el as HTMLElement).className.slice(0, 60)
        : '';
    const aria = el.getAttribute('aria-label');
    real.push(
      `${el.tagName}.${cls}${aria ? ` [${aria}]` : ''} x=${Math.round(r.x)} w=${Math.round(r.width)} right=${Math.round(r.x + r.width)}`
    );
  }

  const de = document.documentElement;
  return {
    real,
    excused,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  };
}

test.describe('Horizontal Scroll Detection', () => {
  for (const url of PAGES) {
    // ONE navigation per route, then RESIZE. Four loads x 42 routes is four
    // times the CI cost for the same layout question, and layout re-runs on
    // resize. The gap this leaves, stated rather than hidden: a component that
    // reads its width only on mount will not re-evaluate, so a defect that
    // exists ONLY on a fresh load at one width would be missed.
    test(`No horizontal overflow on ${url}`, async ({ page }) => {
      // MEASURE THE FIRST-VISIT STATE, i.e. WITH the cookie banner.
      //
      // The global storage state seeds `cookie-consent`, so every spec in this
      // suite runs with the banner already dismissed and no gate in the repo
      // has ever measured it — #457, in the specific form that matters here:
      // the defect this sweep was written to catch is a `btn-ghost btn-sm` in
      // that banner sitting 11px past a 320px viewport on 41 of 42 routes.
      // Without this line the gate passes on the broken code, which is exactly
      // what it did the first time it was run.
      //
      // The banner is `position: fixed`, so its presence does not move page
      // content — measuring with it visible is strictly MORE coverage than
      // measuring without, not a different layout.
      await page.addInitScript(() => {
        window.localStorage.removeItem('cookie-consent');
      });
      await page.setViewportSize({
        width: CRITICAL_MOBILE_WIDTHS[0],
        height: 800,
      });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(1200);

      const failures: string[] = [];
      let excusedTotal = 0;

      for (const width of CRITICAL_MOBILE_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        // Let the resize settle before reading geometry back.
        await page.waitForTimeout(250);

        // A late client-side navigation destroys the execution context
        // mid-evaluate — the contrast gate records the same trap. This surfaced
        // here as `Execution context was destroyed` on /docs, which failed the
        // test for a reason that had nothing to do with overflow and read as a
        // successful mutation check. Retry once against the new context.
        let m: Awaited<ReturnType<typeof measureOverflow>>;
        try {
          m = await page.evaluate(measureOverflow, width);
        } catch (err) {
          if (!/context was destroyed|Execution context/i.test(String(err)))
            throw err;
          await page.waitForLoadState('load').catch(() => {});
          await page.waitForTimeout(800);
          m = await page.evaluate(measureOverflow, width);
        }
        excusedTotal += m.excused;

        if (m.real.length) {
          failures.push(
            `@${width}px — ${m.real.length} element(s) past the viewport:\n` +
              m.real
                .slice(0, 6)
                .map((r) => `    ${r}`)
                .join('\n')
          );
        }
        // Secondary, and NOT load-bearing: the layout frame clips the x axis so
        // this is pinned to clientWidth today. Kept so it starts reporting if
        // that ever changes.
        if (m.scrollWidth > m.clientWidth + 1) {
          failures.push(
            `@${width}px — document scrolls: scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}`
          );
        }
        if (m.bodyScrollWidth > m.bodyClientWidth + 1) {
          failures.push(
            `@${width}px — body scrolls: ${m.bodyScrollWidth} > ${m.bodyClientWidth}`
          );
        }
      }

      expect(
        failures,
        `Horizontal overflow on ${url} (${excusedTotal} element(s) excused as clipped/scrolled/transformed):\n${failures.join('\n')}`
      ).toEqual([]);
    });
  }

  test('Images do not cause horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await page.waitForTimeout(800);

    const images = await page.locator('img').all();

    for (const img of images) {
      if (await img.isVisible()) {
        const box = await img.boundingBox();

        if (box) {
          expect(
            box.width,
            'Image width must not exceed viewport'
          ).toBeLessThanOrEqual(390 + 1);
        }
      }
    }
  });

  test('Tables are responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');
    await dismissCookieBanner(page);
    await page.waitForTimeout(800);

    const tables = await page.locator('table').all();

    for (const table of tables) {
      if (await table.isVisible()) {
        const box = await table.boundingBox();

        if (box) {
          const parent = await table.evaluateHandle((el) => el.parentElement);
          const parentOverflow = await parent.evaluate(
            (el) => window.getComputedStyle(el!).overflowX
          );

          const fitsInViewport = box.width <= 390 + 1;
          const hasScrollableParent =
            parentOverflow === 'auto' || parentOverflow === 'scroll';

          expect(
            fitsInViewport || hasScrollableParent,
            'Table must either fit viewport or have scrollable parent'
          ).toBeTruthy();
        }
      }
    }
  });

  test('Pre/code blocks are responsive', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await page.waitForTimeout(800);

    const codeBlocks = await page.locator('pre, code').all();

    for (const block of codeBlocks) {
      if (await block.isVisible()) {
        const box = await block.boundingBox();

        if (box) {
          const overflowX = await block.evaluate(
            (el) => window.getComputedStyle(el).overflowX
          );

          const fitsInViewport = box.width <= 390 + 1;
          const hasHorizontalScroll =
            overflowX === 'auto' || overflowX === 'scroll';

          expect(
            fitsInViewport || hasHorizontalScroll,
            'Code block must either fit or have horizontal scroll'
          ).toBeTruthy();
        }
      }
    }
  });
});
