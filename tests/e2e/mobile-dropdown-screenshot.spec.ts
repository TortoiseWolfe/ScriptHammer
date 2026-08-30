import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './utils/test-user-factory';

test.describe('Mobile Dropdown Menu Screenshots', () => {
  test('should capture dropdown menu on mobile', async ({ page }) => {
    // Set mobile viewport — hamburger menu is visible below lg (1024px)
    await page.setViewportSize({ width: 390, height: 844 });

    // Navigate to the home page
    await page.goto('/');
    await dismissCookieBanner(page);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Capture the closed state first, for comparison against the open one.
    await page.screenshot({
      path: 'screenshots/mobile-dropdown-closed.png',
      fullPage: false,
    });

    // The hamburger is a real button since #1018, so it is clicked like one.
    const menuTrigger = page.getByRole('button', { name: 'Navigation menu' });
    await expect(menuTrigger).toBeVisible();

    // Retried. The panel is React state, so a click landing before React attaches
    // its handler is silently swallowed — the hazard measured and written up in
    // mobile-touch-targets.spec.ts. The idempotent guard means a retry after a
    // successful open cannot toggle it shut again.
    await expect(async () => {
      if ((await menuTrigger.getAttribute('aria-expanded')) !== 'true') {
        await menuTrigger.click();
      }
      await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15000 });

    // This file used to force the menu open by adding DaisyUI's `.dropdown-open`
    // class to a `.dropdown` ancestor, because `<label>` focus semantics differed
    // across headless browsers. Both the class and the `<label>` are gone; a real
    // gesture is now both possible and more honest about what it proves.
    const panel = page.getByTestId('nav-popover-navigation');
    await expect(panel).toBeVisible();

    await page.waitForTimeout(500); // let the panel settle before the capture

    await page.screenshot({
      path: 'screenshots/mobile-dropdown-open.png',
      fullPage: false,
    });

    // MEASURES SOMETHING, rather than merely running. This spec used to carry a
    // single assertion and two screenshots nobody diffs; `ZERO_ASSERTION_GATE_MODE`
    // is `block` on the required lane, so one assertion was the difference between
    // "not zero" and "checked anything". The link floor is what makes the capture
    // meaningful — a screenshot of an empty panel would have satisfied the old one.
    const links = panel.locator('a');
    expect(
      await links.count(),
      'the mobile menu opened but exposed no destinations'
    ).toBeGreaterThanOrEqual(13);
  });
});
