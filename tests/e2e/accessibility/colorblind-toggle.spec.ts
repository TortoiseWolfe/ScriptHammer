import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * E2E Test: colour-vision controls inside the nav's `Display ▾` popover
 *
 * Moved from unit tests because popover behaviour and focus management require a
 * real browser DOM.
 *
 * Original locations:
 * - ColorblindToggle.accessibility.test.tsx:95-106 (focus management)
 * - ColorblindToggle.test.tsx:213-236 (click outside to close)
 *
 * RETARGETED for #378. These drove a standalone "Color Vision" trigger in the
 * nav, which no longer exists: theme, text settings and colour vision were three
 * separate popovers, each `hidden lg:block`, and are now one `Display ▾` reachable
 * at every width. The controls themselves are unchanged and keep their accessible
 * names, so only the opening step moved — every assertion about the select, the
 * pattern toggle and persistence is the coverage it always was.
 *
 * It is also no longer a DaisyUI `:focus-within` dropdown. `NavPopover` owns its
 * open state in React, which is what lets Escape close it AND restore focus to
 * the trigger; the `:focus-within` pattern cannot do that, because the trigger
 * lives inside the dropdown and refocusing it reopens the panel.
 */
/**
 * Open the appearance popover that hosts the colour-vision controls.
 *
 * The click is RETRIED rather than issued once: a click dispatched before React
 * attaches its handler is silently swallowed, and the server already renders
 * `aria-expanded="false"`, so there is no state to wait for. Only clicks while
 * the panel is closed, so retrying cannot toggle it shut.
 */
async function openDisplay(page: import('@playwright/test').Page) {
  const trigger = page.getByRole('button', { name: 'Display' });
  await expect(trigger).toBeVisible();
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  }).toPass({ timeout: 15000 });
  return trigger;
}

test.describe('Colour vision controls (Display popover) - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Home page; the Display popover lives in the nav at every width (#378).
    await page.goto('/');
    // Dismiss cookie banner to prevent it from intercepting clicks
    await dismissCookieBanner(page);
  });

  test('should maintain focus management in dropdown', async ({ page }) => {
    await openDisplay(page);

    // Check that dropdown content is visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Select element should be accessible
    const select = page.getByRole('combobox');
    await expect(select).toBeVisible();

    // Verify dropdown can receive focus via keyboard
    await select.focus();
    await expect(select).toBeFocused();
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    await openDisplay(page);

    // Verify dropdown is visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Press outside the panel at a fixed point rather than `page.click('main')`.
    // Playwright scrolls an element into view before clicking it, and `main` is
    // taller than the viewport, so scrolling to its centre can bring the panel
    // — `absolute end-0` inside a `sticky` header — over the click point, which
    // times out waiting for it to be actionable. The panel is on the right, so
    // the left margin is unambiguously outside it.
    //
    // `mousedown` is the event that matters: NavPopover's outside-dismiss is a
    // document mousedown listener.
    const box = page.viewportSize();
    await page.mouse.click(12, Math.floor((box?.height ?? 800) / 2));

    // Verify dropdown is now hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('should support keyboard navigation in dropdown', async ({ page }) => {
    // Keyboard path: focus the trigger and press Enter. It is a real
    // <button>, so Enter activates it — the old `<label tabIndex={0}>` had no
    // such guarantee.
    const toggleButton = page.getByRole('button', { name: 'Display' });
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Dropdown should be visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Click on select element to focus it (keyboard tab may go to different elements)
    const select = page.getByRole('combobox');
    await select.click();
    await expect(select).toBeFocused();

    // Should be able to change mode with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Dropdown should still be visible after mode change
    await expect(dropdown).toBeVisible();
  });

  test('should close dropdown with Escape key', async ({ page }) => {
    const toggleButton = await openDisplay(page);

    // Verify dropdown is visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Hidden, AND focus back on the trigger. The second half is the point of
    // NavPopover: a DaisyUI :focus-within dropdown cannot do it, because the
    // trigger lives inside the dropdown and refocusing it reopens the panel.
    await expect(dropdown).not.toBeVisible();
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    await expect(toggleButton).toBeFocused();
  });

  test('should show pattern toggle when colorblind mode is active', async ({
    page,
  }) => {
    await openDisplay(page);

    // Select a colorblind mode (not "No Correction Needed")
    const select = page.getByRole('combobox');
    await select.selectOption({ label: 'Protanopia (Red-Blind) Correction' });

    // Wait for UI update
    await page.waitForTimeout(200);

    // Pattern toggle should now be visible
    const patternToggle = page.getByRole('checkbox', { name: /pattern/i });
    await expect(patternToggle).toBeVisible();

    // Verify it's interactive
    await patternToggle.check();
    await expect(patternToggle).toBeChecked();
  });

  test('should persist selected mode across page navigation', async ({
    page,
  }) => {
    await openDisplay(page);

    let select = page.getByRole('combobox');
    await select.selectOption({
      label: 'Deuteranopia (Green-Blind) Correction',
    });
    await page.waitForTimeout(300);

    // `/blog/`, a route that exists. This said `/about`, which this app has never
    // had — so "navigate to another page" navigated to the 404 template, and the
    // persistence this test claims to prove was only ever proven across an error
    // page (#396's "an E2E test that lands on the 404 route" class).
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');

    // Return to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Re-open after navigation.
    await openDisplay(page);

    // Re-query for select after navigation
    select = page.getByRole('combobox');

    // Verify mode is still selected
    const selectedOption = await select.inputValue();
    expect(selectedOption).toContain('deuteranopia');
  });
});
