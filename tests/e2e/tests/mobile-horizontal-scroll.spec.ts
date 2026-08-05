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
 *   - SCROLLED by an ancestor — DaisyUI puts `overflow-x: auto` on `.stats`, so
 *     a wide child is the design working. Content the user can reach by
 *     scrolling the element it lives in is the RECOMMENDED pattern.
 *   - a transform artefact — `getBoundingClientRect` includes transforms, so
 *     the home page's scale-animating logo reports overflow no layout has.
 *     Asserting on it would be flaky by construction.
 *   - everything else. That is the defect, and after filtering it was exactly
 *     one element per route.
 *
 * #506 — `hidden` AND `clip` USED TO EXCUSE TOO, AND THEY ARE THE OPPOSITE CASE.
 *
 * The excuse list was `['hidden', 'clip', 'auto', 'scroll']`, which collapses
 * two opposite outcomes. `auto`/`scroll` means the user can still REACH the
 * content. `hidden`/`clip` means it is GONE — and an ancestor clip is precisely
 * what stops overflow from producing the page scrollbar this file's secondary
 * assertion looks for, so excusing it made the gate blind wherever it mattered
 * most.
 *
 * Measured on a root build carrying Cloudflare's public test key, `/sign-in` at
 * 320px:
 *
 *     CaptchaWidget size    widget    elements past the viewport
 *     compact (shipped)     150x140    0
 *     normal  (pre-#488)    300x65    28
 *
 * All 28 were excused by an ancestor with `overflow-x: clip`, and NONE of them
 * was transform-excused. So on the exact defect #488 fixed, this gate reported
 * green — the "gate that cannot fail" pattern catalogued in #396.
 *
 * NO `/map` CARVE-OUT IS NEEDED, and #506 predicted otherwise. That ticket says
 * splitting these four "turns 4 leaflet tiles on /map into failures". It does
 * not: the transform check below runs AFTER this one, leaflet positions its
 * tiles with `translate3d`, and the home page's spinning logo is the transform
 * artefact named above — so both fall through to that branch and are excused
 * there. `/map` and `/` pass at all four widths. An allowlist would have been
 * dead weight that grew with every future viewport-owning component.
 *
 * WHAT IT DID FIND: six routes with real, pre-existing, previously invisible
 * overflow — `#main-content` scrolls to 368px on `/blog/seo` and 471px on
 * `/accessibility` inside a 320px frame. Those are quarantined in
 * `KNOWN_OVERFLOW` below and ticketed as #511.
 *
 * TWO NOTES ON HOW THAT WAS NEARLY GOT WRONG, both this file's own lesson
 * turned on its author — measure the condition that fails, not the one in front
 * of you:
 *
 *   1. The split was first checked against four routes (`/`, `/map`, `/blog`,
 *      `/themes`), all of which pass, and that was briefly taken to mean it
 *      changed nothing anywhere. It changed six. Four convenient routes are not
 *      forty-two, and three of the six only reproduce AUTHENTICATED, which an
 *      anonymous probe reports as clean.
 *   2. The quarantine was first written with eight entries, because the local
 *      build had no payment keys and rendered a "Payment providers not
 *      configured" panel that CI — which sets dummy keys — never shows. The
 *      build env has to match `e2e.yml`'s or the ledger records defects that
 *      do not exist there.
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

/**
 * Routes with PRE-EXISTING overflow that the old `hidden`/`clip` excuse hid
 * (#511). These are NOT exclusions — they still run, and they run as
 * `test.fail()`, which means:
 *
 *   - the defect still there  -> expected failure, run stays green
 *   - the defect FIXED        -> "expected to fail but passed" -> run goes RED
 *
 * so the list cleans itself up and cannot quietly outlive the bug. A `skip`
 * would have done the opposite.
 *
 * Every entry was measured, and each is a real clip, not an artefact — on
 * `/blog/seo` and `/accessibility` `#main-content` genuinely scrolls
 * (clientWidth 320 vs scrollWidth 368 and 471), i.e. content is cut off and
 * unreachable. They are pre-existing: they fail identically with this split
 * applied to an unmodified `main`. Details and per-route evidence in #511.
 */
const KNOWN_OVERFLOW: Record<string, string> = {
  '/accessibility': '.stats renders 455px wide at every mobile width (#511)',
  '/account': 'a 196px sh-btn-ghost overruns 320/375 when authenticated (#511)',
  '/account/audit': 'same authenticated 196px sh-btn-ghost (#511)',
  '/blog/playable-city-chattanooga':
    'the social-links row overruns 320px (#511)',
  '/blog/seo': '439 elements past 320px — the card grid does not shrink (#511)',
  '/payment': 'same authenticated 196px sh-btn-ghost (#511)',
};

/**
 * The quarantine may SHRINK, never grow. A new route landing in here is a new
 * defect being normalised, which is the #396 anti-pattern — so it fails the
 * suite rather than being absorbed. Lower this as routes are fixed.
 *
 * It has already come down once, and `test.fail()` is why. The list first had
 * EIGHT entries, adding `/payment-demo` and `/payment-result` for a 374px
 * "Payment providers not configured" panel — which only rendered because the
 * local build had no payment keys. CI sets dummy ones, the panel does not
 * render, and both routes reported "Expected to fail, but passed". A `skip`
 * would have swallowed that silently and quarantined two working routes.
 */
const MAX_KNOWN_OVERFLOW = 6;

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
      : '') +
    `\n[mobile-horizontal-scroll] ${Object.keys(KNOWN_OVERFLOW).length} route(s) ` +
    `quarantined as known pre-existing overflow (#511) — asserted STILL BROKEN, ` +
    `so fixing one turns this suite red until it is removed from the list:\n` +
    Object.entries(KNOWN_OVERFLOW)
      .map(([r, why]) => `  - ${r}: ${why}`)
      .join('\n')
);

/**
 * Runs in the browser. Returns the elements whose right edge passes the
 * viewport and which are NOT excused, plus the excused tally so a run can show
 * the filter is doing triage rather than silently swallowing everything.
 */
function measureOverflow(vpWidth: number) {
  // `auto`/`scroll` ONLY (#506). `hidden`/`clip` used to sit in this list and
  // are the opposite case — see the header. Do not add them back.
  const REACHABLE = ['auto', 'scroll'];
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
      if (REACHABLE.includes(getComputedStyle(n).overflowX)) {
        why = 'scrollable';
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
  test('the known-overflow quarantine only ever shrinks', () => {
    const routes = Object.keys(KNOWN_OVERFLOW);
    expect(
      routes.length,
      `${routes.length} routes are quarantined as known-broken, over the ceiling ` +
        `of ${MAX_KNOWN_OVERFLOW}. Adding a route here normalises a NEW defect, ` +
        `which is exactly the pattern #396 catalogues. Fix the route, or if it ` +
        `genuinely belongs in the ledger, raise the ceiling in the same commit ` +
        `that adds evidence to #511 — never to make a red run green.\n  ` +
        routes.join('\n  ')
    ).toBeLessThanOrEqual(MAX_KNOWN_OVERFLOW);

    // Every quarantined route must actually be swept — an entry naming a route
    // this file never visits is a dead line that reads like coverage.
    const orphans = routes.filter((r) => !PAGES.includes(r));
    expect(
      orphans,
      `quarantined route(s) that this sweep does not visit — stale entries, ` +
        `delete them: ${orphans.join(', ')}`
    ).toEqual([]);
  });

  for (const url of PAGES) {
    // ONE navigation per route, then RESIZE. Four loads x 42 routes is four
    // times the CI cost for the same layout question, and layout re-runs on
    // resize. The gap this leaves, stated rather than hidden: a component that
    // reads its width only on mount will not re-evaluate, so a defect that
    // exists ONLY on a fresh load at one width would be missed.
    test(`No horizontal overflow on ${url}`, async ({ page }) => {
      // Known pre-existing overflow (#511): assert it is STILL BROKEN rather
      // than skipping. Fixing the route makes this "expected to fail but
      // passed" and turns the suite red, which is the prompt to delete the
      // entry. A skip would let the quarantine outlive the defect silently.
      const known = KNOWN_OVERFLOW[url];
      if (known) test.fail(true, known);

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
        `Horizontal overflow on ${url} (${excusedTotal} element(s) excused as ` +
          `scrollable or transform-artefact — NOT as clipped; see #506):\n${failures.join('\n')}`
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
