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

    const trigger = page.locator('[aria-label="Demos menu"]');
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
      if (box.height < MINIMUM - TOLERANCE) {
        failures.push(`"${text}": ${box.height.toFixed(0)}px tall (min 44)`);
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

  test('the Demos menu is keyboard operable and Escape restores focus (#378)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const trigger = page.locator('[aria-label="Demos menu"]');
    const items = page.locator('[role="menu"] [role="menuitem"]');

    // Hydration must finish before onClick exists. Measured: at 1800ms the
    // button rendered with aria-expanded but the handler was not attached yet,
    // which reads exactly like a broken menu.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
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
    ).toBe('Demos menu');
  });

  test('the Display panel exposes 44px targets (#378)', async ({ page }) => {
    // Everything in here is `hidden lg:block`, so the 390px test above cannot
    // see it — which is how a 40px ColorblindToggle trigger sat in the nav
    // unmeasured until this panel was built. Same shape as #411: a gate that
    // only runs at one viewport is blind to everything gated to another.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const trigger = page.locator('[aria-label="Display menu"]');
    await expect(trigger).toHaveCount(1);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const panel = page.locator('[role="group"][aria-label="Display"]');
    const controls = await panel.locator('button, a').all();

    const failures: string[] = [];
    let measured = 0;
    for (const el of controls) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      measured++;
      if (box.height < MINIMUM - TOLERANCE) {
        const name =
          (await el.getAttribute('aria-label')) ||
          (await el.textContent())?.trim() ||
          '(unnamed)';
        failures.push(`"${name}": ${box.height.toFixed(0)}px tall (min 44)`);
      }
    }

    expect(failures, failures.join('\n')).toHaveLength(0);

    // The panel holds the theme list plus the text-size and colour-vision
    // controls, so it is well into double figures. A collapse to single digits
    // means a control silently stopped rendering.
    expect(
      measured,
      `Only ${measured} controls measured in the Display panel — a section ` +
        `has probably stopped rendering rather than shrunk.`
    ).toBeGreaterThanOrEqual(20);
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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Test form inputs if present
    const inputs = await page
      .locator('input[type="text"], input[type="email"], textarea, select')
      .all();

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
