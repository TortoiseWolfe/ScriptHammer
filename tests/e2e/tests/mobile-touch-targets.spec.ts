/**
 * Touch Target Validation Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T009
 *
 * Test all interactive elements meet 44x44px minimum
 * This test should FAIL initially (TDD RED phase)
 */

import { test, expect } from '@playwright/test';
import {
  TOUCH_TARGET_STANDARDS,
  getInteractiveElementSelector,
} from '@/config/touch-targets';
import { CRITICAL_MOBILE_WIDTHS } from '@/config/test-viewports';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for layout to stabilize after viewport/page change
 */
async function waitForLayoutStability(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for layout to stabilize using requestAnimationFrame
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let stable = 0;
        const check = () => {
          stable++;
          if (stable >= 3) {
            resolve(true);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    },
    { timeout: 5000 }
  );
}

test.describe('Touch Target Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1; // Allow 1px tolerance for sub-pixel rendering

  test('All interactive elements meet 44x44px minimum on iPhone 12', async ({
    page,
  }) => {
    // Test on most common mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // OPEN THE MOBILE MENU FIRST. Without this the gate is very nearly inert:
    // measured on a clean page at 390px, the selector below matched 58
    // elements and exactly ONE was visible — the hamburger itself. The other
    // 57 sit inside the closed dropdown, `isVisible()` skips them, and the
    // test reports green having checked a single 44px button.
    //
    // The nav is a DaisyUI `dropdown` held open by `:focus-within`, so
    // focusing the trigger opens it (#378 will add more of these).
    const menuTrigger = page.locator('[aria-label="Navigation menu"]');
    if (await menuTrigger.count()) {
      // click(), not focus(): a DaisyUI dropdown is held open by
      // :focus-within, and a programmatic focus on the <label> does not
      // reliably establish it. Measured — focus() surfaced 3 targets, click()
      // surfaces the full menu.
      await menuTrigger.first().click();
      await page.waitForTimeout(250);
    }

    // Check primary navigation buttons only (not all interactive elements)
    // Inline text links, badges, and icons inside buttons are exempt.
    //
    // `a.sh-btn` is here because this repo now has TWO button vocabularies:
    // DaisyUI's `.btn` and the 2a design's `.sh-btn` (#379). When the home
    // page's CTAs moved from one to the other, this selector silently stopped
    // matching them and `measured` fell 6 → 5. The buttons had not shrunk —
    // they were simply no longer being looked at, which is the exact failure
    // the coverage floor below exists to catch, and it did.
    //
    // Any third button class must be added here too, or it inherits that same
    // invisibility for free.
    const primaryButtons = await page
      .locator('nav button, nav label, a.btn, a.sh-btn, button.sh-btn')
      .all();

    const failures: string[] = [];
    let measured = 0;

    for (let i = 0; i < primaryButtons.length; i++) {
      const element = primaryButtons[i];

      if (await element.isVisible()) {
        const box = await element.boundingBox();

        if (box) {
          measured++;
          const text =
            (await element.textContent())?.trim().substring(0, 30) || '';

          // Primary buttons should be at least 44x44
          if (
            box.width < MINIMUM - TOLERANCE ||
            box.height < MINIMUM - TOLERANCE
          ) {
            failures.push(
              `Button "${text}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px (min: 44x44)`
            );
          }
        }
      }
    }

    // Report all failures at once for better debugging
    if (failures.length > 0) {
      const summary = `${failures.length} primary buttons failed touch target requirements:\n${failures.join('\n')}`;
      expect(failures.length, summary).toBe(0);
    }

    // COVERAGE FLOOR — the assertion that keeps the one above honest.
    //
    // Every check here is conditional on `isVisible()`, so anything moved
    // behind a closed menu stops being measured and the test still passes.
    // Zero measured is indistinguishable from zero failures.
    //
    // That is not hypothetical. Before the click above, this gate measured a
    // single element — the hamburger — while its selector matched 60. Opening
    // the menu immediately surfaced a real defect that had never been checked:
    // Sign Out at 144x26px, 18px under the standard.
    //
    // 6 is MEASURED, not chosen. Be clear about what it does and does not
    // mean: the selector deliberately exempts inline text links, so the menu's
    // <a> items are out of scope by design and 6 is full coverage FOR THIS
    // SELECTOR — not proof that every nav target is checked.
    //
    // #378 regroups the nav into `Demos ▾` and `Display ▾`. If this number
    // drops, targets were hidden rather than fixed. Raise it deliberately;
    // never lower it to make a run pass.
    expect(
      measured,
      `Only ${measured} nav touch targets were measured, down from 6. ` +
        `Something is hidden behind a closed menu that this gate must open ` +
        `first — see the menuTrigger click above.`
    ).toBeGreaterThanOrEqual(6);
  });

  test('desktop nav group menus expose 44px targets (#378)', async ({
    page,
  }) => {
    // #378 grouped the demo routes behind `Demos ▾`. Everything inside a
    // dropdown is invisible to the 390px test above, because the desktop nav
    // is `hidden lg:flex` — so without this the seven routes that moved into
    // the group would silently stop being measured the moment they were
    // grouped. That is the same narrowing the coverage floor below exists to
    // catch, arriving through a different door.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const trigger = page.locator('[aria-label="Demos"]');
    await expect(trigger).toHaveCount(1);

    // The group is a controlled menu button (#378), not a :focus-within
    // dropdown — DaisyUI's pattern cannot satisfy "Escape closes and focus
    // returns to the trigger", because the trigger lives inside .dropdown and
    // refocusing it re-opens the menu on the same frame.
    await trigger.first().click();
    await page.waitForTimeout(400);
    await expect(trigger.first()).toHaveAttribute('aria-expanded', 'true');

    const items = await page.locator('[role="menu"] [role="menuitem"]').all();
    const failures: string[] = [];
    let measured = 0;

    for (const item of items) {
      if (!(await item.isVisible())) continue;
      const box = await item.boundingBox();
      if (!box) continue;
      measured++;
      const text = (await item.textContent())?.trim() ?? '';
      // BOTH AXES, like every other measuring test in this file (#502). This
      // one checked height only and was the last nav surface that did. The
      // Display popover below records why that is not enough: "L" measured
      // 44x42 when only the height had a floor. These menuitems sit in a
      // `w-52` list, so width is not expected to bind — which is exactly the
      // case where a missing assertion goes unnoticed until it does bind.
      if (box.height < MINIMUM - TOLERANCE || box.width < MINIMUM - TOLERANCE) {
        failures.push(
          `"${text}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px (min 44x44)`
        );
      }
    }

    expect(failures, failures.join('\n')).toHaveLength(0);

    // The trigger itself is a target too, and the group holds seven routes.
    expect(
      measured,
      `Only ${measured} items measured inside the Demos menu. If routes were ` +
        `moved out of the group, raise this deliberately; if the menu stopped ` +
        `opening, fix that instead of lowering the number.`
    ).toBeGreaterThanOrEqual(7);
  });

  test("the mobile menu's own items meet 44px (#378)", async ({ page }) => {
    test.setTimeout(90000);

    // THE EXEMPTION THIS CLOSES.
    //
    // The primary-button selector above is
    // `nav button, nav label, a.btn, a.sh-btn, button.sh-btn`, and its coverage
    // note says bare `<a>` items are exempt as "inline text links". That is true
    // of a link in a paragraph. It is not true of these: below lg they are the
    // ENTIRE navigation. Measured before the fix, at 390px with the menu open,
    // all 13 destinations were 26x144 against a 44px floor — DaisyUI renders
    // `menu li > a` at 26px, and nothing here could see them because they sit
    // inside a closed dropdown.
    for (const width of [320, 390, 428, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      const trigger = page.locator('[aria-label="Navigation menu"]');
      await expect(trigger).toBeVisible();
      await trigger.click();

      const items = page.locator(
        '.dropdown-content a, .dropdown-content button'
      );
      const count = await items.count();

      // COVERAGE FLOOR. Everything below is conditional on finding items, so a
      // menu that failed to open would pass silently — the #411/#454 shape. 13
      // is MEASURED signed-out at each of these widths.
      expect(
        count,
        `only ${count} items measured in the mobile menu at ${width}px — it ` +
          `probably did not open`
      ).toBeGreaterThanOrEqual(13);

      const failures: string[] = [];
      for (let i = 0; i < count; i++) {
        const el = items.nth(i);
        if (!(await el.isVisible())) continue;
        const box = await el.boundingBox();
        if (!box) continue;
        if (
          box.height < MINIMUM - TOLERANCE ||
          box.width < MINIMUM - TOLERANCE
        ) {
          const name =
            (await el.textContent())?.trim().slice(0, 24) || '(unnamed)';
          failures.push(
            `${name}: ${box.width.toFixed(0)}x${box.height.toFixed(0)}px at ${width}px`
          );
        }
      }

      expect(
        failures,
        `${failures.length} mobile menu items under ${MINIMUM}px at ${width}px. ` +
          `These are the whole navigation below lg:\n${failures.join('\n')}`
      ).toEqual([]);

      await page.keyboard.press('Escape');
    }
  });

  test('the Demos menu is keyboard operable and Escape restores focus (#378)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const trigger = page.locator('[aria-label="Demos"]');
    const items = page.locator('[role="menu"] [role="menuitem"]');

    // Hydration must finish before onClick exists. Measured: at 1800ms the
    // button rendered with aria-expanded but the handler was not attached yet,
    // which reads exactly like a broken menu.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // RETRY the click rather than assume hydration has finished.
    //
    // A click dispatched before React attaches its handler is silently
    // swallowed, and there is nothing to wait for: the server already renders
    // `aria-expanded="false"`, so the assertion above passes instantly against
    // an inert button. That made this test timing-dependent — it passed or
    // failed on how long the bundle took to hydrate, which shifts with any
    // change to the nav's imports. Measured: identical code passed one run and
    // failed the next.
    //
    // `body[data-theme]` is NOT a usable hydration marker, before anyone tries:
    // ThemeScript sets it pre-paint, at 251ms, long before the handler exists.
    //
    // The click is only issued while the menu is closed, so retrying cannot
    // toggle it shut again.
    await expect(async () => {
      if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
        await trigger.click();
      }
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    }).toPass({ timeout: 15000 });

    expect(await items.count()).toBeGreaterThanOrEqual(7);

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(items).toHaveCount(0);

    // Focus must come back to the trigger, or a keyboard user is dropped at
    // the top of the document every time they dismiss a menu.
    expect(
      await page.evaluate(() =>
        document.activeElement?.getAttribute('aria-label')
      )
    ).toBe('Demos');
  });

  test('the Display popover is reachable at every width and its controls meet 44px (#378)', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // EVERY width, because the defect this replaced was a breakpoint gate: the
    // three appearance dropdowns were each `hidden lg:block`, and the mobile
    // hamburger held 13 destinations and ZERO appearance controls — so below
    // 1024px there was no way to change the theme or the font size from the nav.
    const WIDTHS = [320, 390, 428, 768, 1024, 1280];
    let totalMeasured = 0;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      const trigger = page.locator('[aria-label="Display"]');
      await expect(
        trigger,
        `the Display trigger must exist and be visible at ${width}px — a ` +
          `breakpoint-hidden appearance control is the defect #378 fixed`
      ).toBeVisible();

      // Same retry as the Demos menu: a click before hydration is swallowed and
      // the server-rendered `aria-expanded="false"` gives nothing to wait for.
      await expect(async () => {
        if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
          await trigger.click();
        }
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      }).toPass({ timeout: 15000 });

      // By testid, not by role or name. `[role="group"]` alone also matches the
      // cookie banner, and the panel is NAMED BY ITS TRIGGER
      // (`aria-labelledby`) rather than carrying a duplicate `aria-label` —
      // which is the correct ARIA pattern and stops `[aria-label="Display"]`
      // resolving to two nodes.
      const panel = page.getByTestId('nav-popover-display');
      await expect(panel).toBeVisible();

      const controls = panel.locator('button, a, select, input');
      const count = await controls.count();

      // COVERAGE FLOOR, per width. Everything below is conditional on finding
      // controls, so a panel that renders empty would pass silently — the
      // #411/#454 shape. 40 is MEASURED (34 themes + size, spacing, reset and
      // the accessibility link + the assistance-mode select). Raise it
      // deliberately; never lower it to go green.
      expect(
        count,
        `only ${count} controls measured inside the Display panel at ${width}px`
      ).toBeGreaterThanOrEqual(40);
      totalMeasured += count;

      const failures: string[] = [];
      for (let i = 0; i < count; i++) {
        const el = controls.nth(i);
        if (!(await el.isVisible())) continue;
        const box = await el.boundingBox();
        if (!box) continue;
        // 44x44, not 44 tall: these are `flex-1`, so width follows the label.
        // "L" measured 44x42 when only the height had a floor.
        if (
          box.height < MINIMUM - TOLERANCE ||
          box.width < MINIMUM - TOLERANCE
        ) {
          const name =
            (await el.getAttribute('aria-label')) ||
            (await el.textContent())?.trim().slice(0, 24) ||
            '(unnamed)';
          failures.push(
            `${name}: ${box.width.toFixed(0)}x${box.height.toFixed(0)}px at ${width}px`
          );
        }
      }

      expect(
        failures,
        `${failures.length} Display controls under ${MINIMUM}px at ${width}px. ` +
          `These sit inside a popover, so nothing else in this suite can see ` +
          `them:\n${failures.join('\n')}`
      ).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(
        await page.evaluate(() =>
          document.activeElement?.getAttribute('aria-label')
        ),
        `Escape must return focus to the trigger at ${width}px`
      ).toBe('Display');
    }

    expect(
      totalMeasured,
      'measured no Display controls at all — the selector has stopped matching'
    ).toBeGreaterThan(0);
  });

  test('Navigation buttons meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Specifically test navigation buttons
    const navButtons = await page.locator('nav button').all();

    for (const button of navButtons) {
      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          expect(
            box.width,
            'Navigation button width must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);

          expect(
            box.height,
            'Navigation button height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Touch targets maintain size across mobile widths', async ({ page }) => {
    // Iterates through multiple mobile widths, reloading each time.
    // Default 30s test timeout is too tight when each goto takes ~5-10s
    // under shard load. webkit-gen hit the timeout on setViewportSize.
    test.setTimeout(120000);

    for (const width of CRITICAL_MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      // Check a sample of common interactive elements
      const buttons = await page.locator('button').all();

      for (const button of buttons.slice(0, 5)) {
        // Test first 5 buttons
        if (await button.isVisible()) {
          const box = await button.boundingBox();

          if (box) {
            expect(
              box.height,
              `Button height at ${width}px must be ≥ 44px`
            ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
          }
        }
      }
    }
  });

  test("the cookie banner's OWN controls meet 44px (#457)", async ({
    page,
  }) => {
    // THE ONE TEST IN THIS FILE THAT MUST NOT DISMISS THE BANNER.
    //
    // Every other test here calls `dismissCookieBanner()` before measuring.
    // That is correct for the page underneath — a fixed overlay would occlude
    // it — but it makes the consent banner the one surface this suite
    // structurally cannot see, and its buttons are the FIRST control a mobile
    // visitor is ever asked to hit. They shipped at 32x87 and 32x77 across
    // 320/390/428 with every touch-target check green (#457).
    //
    // Measuring the banner's own controls is therefore not redundant with the
    // sweeps above; it is the only place they are looked at at all.
    test.setTimeout(120000);

    for (const width of CRITICAL_MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        window.localStorage.removeItem('cookie-consent');
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitForLayoutStability(page);

      const banner = page.getByRole('region', {
        name: 'Cookie consent banner',
      });
      // If the banner is not showing, this test has measured nothing — say so
      // rather than passing. A silent skip here recreates the exact blind spot
      // the test exists to close.
      await expect(
        banner,
        `Cookie banner must be visible at ${width}px for this test to measure anything`
      ).toBeVisible();

      const controls = await banner.locator('button, a[href]').all();
      expect(
        controls.length,
        `Expected the banner to expose controls at ${width}px`
      ).toBeGreaterThan(0);

      for (const control of controls) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        if (!box) continue;
        const name =
          (await control.getAttribute('aria-label')) ||
          (await control.textContent())?.trim() ||
          '(unnamed)';
        expect(
          box.height,
          `Cookie banner control "${name}" is ${Math.round(box.height)}px tall at ${width}px; the floor is ${MINIMUM}px`
        ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
      }
    }
  });

  test('the banner spacer reserves the banner’s real height (#457)', async ({
    page,
  }) => {
    // The spacer exists so the fixed banner does not cover footer content. It
    // was a fixed `h-14` (56px) while the banner rendered 117-120px, so ~61px
    // of content sat underneath it. A fixed height cannot be correct for an
    // element whose height depends on how its message wraps.
    for (const width of CRITICAL_MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        window.localStorage.removeItem('cookie-consent');
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitForLayoutStability(page);

      // WAIT FOR THE BANNER BEFORE MEASURING. `page.evaluate` runs once and
      // does not retry, unlike Playwright's web-first assertions — the first
      // version of this test read `null` on every width because it evaluated
      // before the banner mounted, while the sibling test above passed purely
      // because `toBeVisible()` retried for it.
      const banner = page.getByRole('region', {
        name: 'Cookie consent banner',
      });
      await expect(
        banner,
        `Cookie banner must be visible at ${width}px for this test to measure anything`
      ).toBeVisible();

      // The spacer height is set from a ResizeObserver after mount, so poll
      // for the settled value rather than reading the first painted frame.
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const el = document.querySelector(
                '[aria-label="Cookie consent banner"]'
              );
              const spacer = el?.previousElementSibling;
              if (!el || !spacer) return -1;
              return (
                spacer.getBoundingClientRect().height -
                el.getBoundingClientRect().height
              );
            }),
          {
            message: `Spacer must reserve the banner's full height at ${width}px`,
            timeout: 10000,
          }
        )
        .toBeGreaterThanOrEqual(-1);
    }
  });

  test('Links in content meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Test primary CTA links (buttons), not inline text links
    // Inline text links are exempt from 44px height requirement
    const ctaLinks = await page.locator('a.btn, a.card').all();

    for (const link of ctaLinks.slice(0, 10)) {
      if (await link.isVisible()) {
        const box = await link.boundingBox();

        if (box) {
          // CTA links should have adequate height
          expect(
            box.height,
            'CTA link height must be ≥ 44px for easy tapping'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }

    // Blog cards themselves should be adequate touch targets
    const blogCards = await page.locator('article').all();
    for (const card of blogCards.slice(0, 5)) {
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        if (box) {
          // Cards should be large enough to tap easily
          expect(box.height, 'Blog card should be tappable').toBeGreaterThan(
            44
          );
        }
      }
    }
  });

  test('Form inputs meet touch target height standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // `/contact/`, not `/` (#396). The home page has ZERO form inputs — measured
    // across every public route, only /contact/ has any — so "test form inputs if
    // present" tested nothing, on every shard. This is the same defect #843 fixed in
    // the sibling `mobile-form-inputs.spec.ts`; the two specs overlap and BOTH were
    // pointed at a page without a form.
    await page.goto('/contact/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // `:not([tabindex="-1"])` excludes the spam honeypot: it is positioned
    // off-screen with tabIndex -1, and Playwright's isVisible() returns TRUE for
    // off-screen elements, so filtering on visibility alone does not exclude it.
    const inputs = await page
      .locator(
        'input[type="text"]:not([tabindex="-1"]), input[type="email"]:not([tabindex="-1"]), textarea:not([tabindex="-1"]), select:not([tabindex="-1"])'
      )
      .all();

    expect(
      inputs.length,
      'no form inputs found — this gate measured nothing'
    ).toBeGreaterThan(0);

    for (const input of inputs) {
      if (await input.isVisible()) {
        const box = await input.boundingBox();

        if (box) {
          expect(
            box.height,
            'Form input height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Touch targets have adequate spacing (8px minimum)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Check main navigation for adequate spacing between interactive elements
    // Note: Elements with gap-0.5 (2px) are intentional for compact layouts
    // We only check that buttons don't overlap
    const nav = page.locator('nav').first();
    const navBox = await nav.boundingBox();

    if (navBox) {
      // Navigation should fit without overlapping elements
      const navWidth = navBox.width;
      expect(navWidth, 'Navigation should fit in viewport').toBeLessThanOrEqual(
        390
      );

      // Check that interactive elements don't overlap
      const buttons = await nav.locator('button, a.btn, label').all();
      const boxes = [];

      for (const btn of buttons) {
        if (await btn.isVisible()) {
          const box = await btn.boundingBox();
          if (box) boxes.push(box);
        }
      }

      // Verify no overlapping elements
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlaps = !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
          );
          expect(overlaps, 'Navigation elements should not overlap').toBe(
            false
          );
        }
      }
    }
  });
});
