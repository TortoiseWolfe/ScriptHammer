import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  openAuthedPage,
  dismissCookieBanner,
  type IsolatedAdmin,
} from './utils/test-user-factory';
import { join } from 'node:path';

/**
 * WCAG 2.4.1 Bypass Blocks + one `<main>` per document, on every route (#475).
 *
 * Before this gate, "Skip to main content" existed on `/` alone — so on every
 * other route a keyboard or screen-reader user traversed the whole nav, 13
 * destinations plus the Display panel, before reaching content. On every
 * navigation. Nothing in the suite noticed, because nothing looked.
 *
 * THREE THINGS THIS GATE DOES THAT THE ORIGINAL PROBE DID NOT, each because the
 * original got them wrong:
 *
 * 1. IT RECORDS THE HTTP STATUS AND REFUSES TO JUDGE A NON-200.
 *    `.pay-verify/landmark.mjs` ran against the dev server. A 500 page renders
 *    `body{display:none}`, so `querySelectorAll('main').length` is 0 — and the
 *    probe wrote that down as "this route has no landmark". It reported exactly
 *    that for `/contact` and `/docs/install-and-first-run`, which render `<main>`
 *    at page.tsx:18 and :44 with no gate and no dynamic import. Every zero it
 *    produced during that window was a 500 (#298). A gate that cannot tell "I
 *    measured nothing" from "I found nothing" invents defects.
 *
 * 2. IT IDENTIFIES THE SKIP LINK BY MARKER, NOT BY "FIRST IN-PAGE ANCHOR".
 *    On a blog post the first `a[href^="#"]` is a table-of-contents entry.
 *    #475's own method note records nearly filing a false report off that.
 *
 * 3. IT REACHES `not-found.tsx`, WHICH ENUMERATION CANNOT SEE.
 *    Route templates are not `page.tsx`. The 404 renders on every bad URL in the
 *    product and sat outside every route-enumerating gate — which is how a
 *    6.62:1 contrast violation lived there undetected (#425), and it had no
 *    `<main>` either. A template has no URL, so it has to be REACHED.
 */

const APP_DIR = join(process.cwd(), 'src/app');

/** Routes that cannot be measured, each with the reason. Never silent. */
const EXCLUDED: Record<string, string> = {
  '/auth/callback':
    'transient OAuth handler — redirects on load, there is no UI to measure',
  '/twins/[slug]':
    'twin payloads are privacy-gated and gitignored; absent in a fresh checkout',
  '/chatt':
    'Cesium canvas host; the widget owns the viewport and headless Firefox has no WebGL',
};

/** Dynamic segments need a real instance — the template alone proves nothing. */
const INSTANCES: Record<string, string> = {
  '/blog/[slug]': '/blog/playable-city-chattanooga',
  '/blog/tags/[tag]': '/blog/tags/digital-twin',
  '/docs/[slug]': '/docs/install-and-first-run',
};

/**
 * Templates reached deliberately, with a string proving we landed on the right
 * one. Without the assertion, a path that started resolving elsewhere would
 * leave this measuring some other page and passing.
 */
const TEMPLATE_PROBES: Record<string, { source: string; contains: string }> = {
  '/__landmark-probe-unmatched-route__/': {
    source: 'src/app/not-found.tsx',
    contains: 'Page Not Found',
  },
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
const PATHS = [
  ...ALL.filter((r) => !(r in EXCLUDED)).map((r) => INSTANCES[r] ?? r),
  ...Object.keys(TEMPLATE_PROBES),
];

/**
 * A coverage floor, not decoration. `.sh-btn` alongside DaisyUI's `.btn` once
 * dropped a touch-target sweep from 6 measured elements to 5 — the buttons had
 * not shrunk, they had stopped being looked at, and only the floor caught it
 * (#396). Raise it when routes are added.
 *
 * 42 = 44 `page.tsx` − 3 EXCLUDED + 1 template probe. It is the CURRENT
 * measured coverage, which is what a floor should be.
 *
 * It was 36. The six `/admin` routes were excluded because the E2E user was not
 * an admin and `AdminGate` bounced it; `seedIsolatedAdmin` (#454) removed that
 * constraint, so they are measured now and the floor rose with them.
 *
 * **Not an instance of the #396 anti-pattern.** The first version said 40 —
 * above the achievable maximum, so it failed on a run where all 36 paths passed.
 * That is arithmetic being corrected, not a floor being lowered to hide a gap:
 * the count went UP from 1 route with a skip link to 36. If you ever find
 * yourself reducing this because a run went red, the sweep shrank — find out
 * which routes stopped being measured before touching the number.
 */
const MIN_PATHS = 42;

// Loudly, so a shrinking sweep can never read as a passing one.
console.log(
  `[landmarks] sweeping ${PATHS.length} paths ` +
    `(${ALL.length - SKIPPED.length} of ${ALL.length} routes + ` +
    `${Object.keys(TEMPLATE_PROBES).length} route template(s))` +
    (SKIPPED.length
      ? `\n[landmarks] excluded ${SKIPPED.length}:\n` +
        SKIPPED.map((r) => `  - ${r}: ${EXCLUDED[r]}`).join('\n')
      : '') +
    `\n[landmarks] route templates reached by probe:\n` +
    Object.entries(TEMPLATE_PROBES)
      .map(([p, t]) => `  - ${t.source} via ${p}`)
      .join('\n')
);

test.describe('Landmarks and skip link', () => {
  test('the sweep covers every enumerated route', () => {
    expect(
      PATHS.length,
      `only ${PATHS.length} paths enumerated — the sweep shrank, which reads as ` +
        `a pass while covering less. Check EXCLUDED and enumerateRoutes.`
    ).toBeGreaterThanOrEqual(MIN_PATHS);
  });

  for (const path of PATHS) {
    test(`${path} has one <main> and a working skip link`, async ({
      page: defaultPage,
      browser,
    }) => {
      // The six `/admin` routes need an ADMIN session. `AdminGate.tsx:81`
      // bounces an authenticated non-admin to `/`, and `/` has both a <main>
      // and a skip link — so measuring them on the default page would PASS
      // while measuring the home page. That is #454's defect exactly, and
      // deleting the old exclusion without this would have re-created it here.
      const needsAdmin = path.startsWith('/admin');
      let adminFixture: IsolatedAdmin | null = null;
      let openedAdmin: Awaited<ReturnType<typeof openAuthedPage>> | null = null;
      let page = defaultPage;
      let resp: Awaited<ReturnType<typeof defaultPage.goto>> = null;

      if (needsAdmin) {
        adminFixture = await seedIsolatedAdmin();
        test.skip(!adminFixture, 'Admin client unavailable to seed an admin');
        if (!adminFixture) return;
        // `openAuthedPage` + our OWN goto, deliberately — not `openAdminAs`.
        // That helper prepends NEXT_PUBLIC_BASE_PATH and navigates itself, so
        // going again here with the bare path produced a 404: an absolute path
        // REPLACES the basePath rather than appending to it. Navigating exactly
        // once, with the same bare path every other route in this sweep uses,
        // keeps admin and non-admin routes measured identically.
        openedAdmin = await openAuthedPage(browser, adminFixture.session);
        page = openedAdmin.page;
      }
      resp = await page.goto(path, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      if (needsAdmin) await dismissCookieBanner(page);
      const status = resp?.status() ?? 0;

      // Landing check, for the admin routes specifically: a redirect leaves
      // every assertion below measuring `/`.
      if (needsAdmin) {
        await expect(
          page,
          `${path}: redirected away — the admin fixture did not take, and the ` +
            `assertions below would be measuring the home page`
        ).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}\\/?$`));
      }

      // A route template is REACHED, not enumerated — its probe path is
      // expected to 404. Everything else must be a real 200: see the header,
      // a non-200 measured as an a11y result is how phantom defects get filed.
      const probe = TEMPLATE_PROBES[path];
      if (probe) {
        expect(status, `${path} should render ${probe.source}`).toBe(404);
        await expect(
          page.getByText(probe.contains),
          `${path} did not land on ${probe.source} — the probe is measuring the wrong page`
        ).toBeVisible();
      } else {
        expect(
          status,
          `${path} returned HTTP ${status}. NOT an a11y finding — the page did ` +
            `not render, so nothing here was measured. Fix the route first.`
        ).toBe(200);
      }

      await expect(
        page.locator('main'),
        `${path} must have exactly one <main>. Zero means the skip link lands ` +
          `nowhere and screen-reader users get no landmark; more than one is ` +
          `ambiguous. Gate screens count — ProtectedRoute/MessagingGate/AdminGate ` +
          `render INSTEAD of the page, so their branches need the landmark too.`
      ).toHaveCount(1);

      const skip = page.locator('a[data-skip-link]');
      await expect(
        skip,
        `${path} has no skip link. It lives in app/layout.tsx so every route ` +
          `inherits one — if this fails, the layout changed.`
      ).toHaveCount(1);

      const href = await skip.getAttribute('href');
      expect(href, `${path}: skip link must target an in-page id`).toMatch(
        /^#.+/
      );
      await expect(
        page.locator(href!),
        `${path}: skip link points at ${href}, which does not exist. A skip ` +
          `link with no target is worse than none — it silently does nothing.`
      ).toHaveCount(1);

      if (openedAdmin) await openedAdmin.close();
      await deleteIsolatedAdmin(adminFixture);
    });
  }

  test('the skip link is the first thing keyboard focus reaches, and moves focus into content', async ({
    page,
  }) => {
    // Presence is not the requirement — REACHABILITY is. A skip link that is
    // not the first tab stop bypasses nothing, and one that only scrolls leaves
    // focus in the nav so the next Tab walks the whole menu again.
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');

    const focused = page.locator('a[data-skip-link]');
    await expect(focused).toBeFocused();
    await expect(
      focused,
      'the skip link must become visible on focus — sr-only only until focused'
    ).toBeVisible();

    await page.keyboard.press('Enter');
    const movedTo = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(
      movedTo,
      'activating the skip link must MOVE FOCUS to the content wrapper, not ' +
        'merely scroll to it — that is what tabIndex={-1} on the target is for'
    ).toBe('main-content');
  });
});
