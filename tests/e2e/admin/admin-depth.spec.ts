/**
 * The admin console rendered AS AN ADMIN (#430, #454).
 *
 * ## Why this file exists
 *
 * Until now nothing in the suite had ever rendered an admin page. `AdminGate`
 * calls `router.push('/')` for an authenticated non-admin (`AdminGate.tsx:81`)
 * and returns `null` while that navigation is in flight (`:98`), so the E2E
 * user — authenticated but not an admin — was bounced every time.
 *
 * That is not a gap you can see from a test report. It is why draft PR #503 sat
 * at 17/17 green and unmergeable: the suite never reached the pages the work
 * changed, so green meant "measured nothing", not "verified".
 *
 * These tests use the isolated-admin fixture, which promotes a throwaway user
 * via `user_profiles.is_admin` — the single authority since #240 — and refuses
 * to hand back a fixture whose `is_admin()` does not answer true through the
 * user's OWN session.
 *
 * ## The assertion that has to come first
 *
 * Every test here asserts it LANDED on the admin route before it measures
 * anything. Without that, a redirect leaves the assertions measuring the home
 * page, and a clean home page passes them. That failure mode is #454 exactly,
 * and it is the reason this file leads with the landing check rather than
 * trusting the fixture.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  openAdminAs,
  type IsolatedAdmin,
} from '../utils/test-user-factory';

/**
 * Prove we are on the route we asked for, and that AdminGate let us through.
 *
 * `AdminGate` renders `null` for a non-admin, so "the URL is right" is not
 * enough on its own — the console's own rail is the evidence the gate opened.
 */
async function assertLandedOnAdmin(page: Page, route: string): Promise<void> {
  await expect(
    page,
    `expected to land on ${route}; a redirect here means AdminGate bounced the ` +
      `fixture and everything below would be measuring the home page`
  ).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}\\/?$`));

  await expect(
    page.getByRole('navigation', { name: /admin/i }).first(),
    `${route} rendered without the admin rail — AdminGate returned null, so the ` +
      `page is empty and any assertion below would pass on nothing`
  ).toBeVisible({ timeout: 20000 });
}

test.describe('Admin console, rendered as an admin', () => {
  test.describe.configure({ timeout: 90000 });

  /**
   * `/admin/payments`'s scroller well is UNCONDITIONAL. `/admin/messaging`'s is
   * behind `top_senders.length > 0` (`AdminMessagingOverview.tsx:176`), so on a
   * project with no recent senders it legitimately does not render — a
   * data-dependent element, the same shape that made #495 look like a flake.
   *
   * So the assertion is the INVARIANT rather than the element: every horizontal
   * scroller in the admin console is wrapped by `sh-well`. That holds whether
   * or not the data exists. `minScrollers` is the floor that stops it passing
   * vacuously — without it, "no scrollers rendered" and "every scroller is
   * welled" are the same green.
   */
  const ROUTES = [
    { route: '/admin/payments', minScrollers: 1 },
    { route: '/admin/messaging', minScrollers: 0 },
  ];

  for (const { route, minScrollers } of ROUTES) {
    test(`${route}: every table scroller sits in a padded well`, async ({
      browser,
    }) => {
      let fixture: IsolatedAdmin | null = null;
      let opened: Awaited<ReturnType<typeof openAdminAs>> | null = null;
      try {
        fixture = await seedIsolatedAdmin();
        test.skip(!fixture, 'Admin client unavailable to seed an admin');
        if (!fixture) return;

        opened = await openAdminAs(browser, fixture.session, route);
        const { page } = opened;

        await assertLandedOnAdmin(page, route);

        // WAIT FOR THE DATA, don't sleep at it. The admin panels render a
        // `loading loading-spinner` until their RPCs return, and the tables do
        // not exist before that. `page.evaluate` does NOT retry the way a
        // web-first assertion does (#396, instance 5) — it snapshots the DOM
        // once — so counting too early reports 0 scrollers and passes on
        // nothing. That is exactly what happened: a 3.5s settle measured 0/0 on
        // /admin/payments, which had measured 1/1 moments earlier.
        await expect(
          page.locator('.loading-spinner'),
          `${route}: still loading after 30s — the count below would be taken ` +
            `before the tables exist`
        ).toHaveCount(0, { timeout: 30000 });

        // #430: the scroller is WRAPPED, not replaced — `sh-well` paints an
        // inset shadow BELOW its children, so on the `overflow-x-auto` div
        // itself the shadow is clipped inside the scroll area and hidden under
        // the table.
        const readScrollers = () =>
          page.evaluate(() => {
            const scrollers = [
              ...document.querySelectorAll('.overflow-x-auto'),
            ];
            return {
              total: scrollers.length,
              welled: scrollers.filter((el) => !!el.closest('.sh-well')).length,
              unwelled: scrollers
                .filter((el) => !el.closest('.sh-well'))
                .map((el) => (el.parentElement?.className || '').slice(0, 60)),
            };
          });

        // Retry the READ as well, so a table that paints a frame after the
        // spinner clears cannot be missed.
        await expect
          .poll(async () => (await readScrollers()).unwelled.length, {
            timeout: 15000,
            message: `${route}: waiting for every scroller to be welled`,
          })
          .toBe(0);

        const counts = await readScrollers();

        // Printed every run: a route measuring zero scrollers must be visibly
        // different from one measuring three.
        console.log(
          `[admin-depth] ${route}: ${counts.welled}/${counts.total} scrollers welled`
        );

        expect(
          counts.total,
          `${route}: expected at least ${minScrollers} horizontal scroller(s); ` +
            `found ${counts.total}. A vacuous pass is not a pass.`
        ).toBeGreaterThanOrEqual(minScrollers);

        expect(
          counts.unwelled,
          `${route}: ${counts.unwelled.length} scroller(s) are not wrapped in ` +
            `.sh-well — this is the assertion #503 never had, and the reason ` +
            `that PR could not be verified on a green run.`
        ).toEqual([]);
      } finally {
        if (opened) await opened.close();
        await deleteIsolatedAdmin(fixture);
      }
    });
  }

  test('an admin route is reachable at all — the gate opens for a promoted user', async ({
    browser,
  }) => {
    // Deliberately separate from the well assertions. If the fixture ever stops
    // producing a real admin, this fails on its own and names the cause, rather
    // than every admin test failing with a confusing "well not found".
    let fixture: IsolatedAdmin | null = null;
    let opened: Awaited<ReturnType<typeof openAdminAs>> | null = null;
    try {
      fixture = await seedIsolatedAdmin();
      test.skip(!fixture, 'Admin client unavailable to seed an admin');
      if (!fixture) return;

      opened = await openAdminAs(browser, fixture.session, '/admin');
      await assertLandedOnAdmin(opened.page, '/admin');
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedAdmin(fixture);
    }
  });
});
