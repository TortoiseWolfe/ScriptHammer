import { test, expect } from '@playwright/test';

/**
 * E2E Test: ColorblindToggle Accessibility
 *
 * Moved from unit tests because DaisyUI dropdown behavior and focus management
 * require real browser DOM with CSS :focus-within pseudo-class support.
 *
 * Original locations:
 * - ColorblindToggle.accessibility.test.tsx:95-106 (focus management)
 * - ColorblindToggle.test.tsx:213-236 (click outside to close)
 */
test.describe('ColorblindToggle - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page where ColorblindToggle is in navigation
    await page.goto('/');
  });

  test('should maintain focus management in dropdown', async ({ page }) => {
    // Find and click the Color Vision toggle button
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(200);

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
    // Open the dropdown
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await toggleButton.click();

    // Wait for dropdown to open
    await page.waitForTimeout(200);

    // Verify dropdown is visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown (on main content)
    await page.click('main');

    // Wait for DaisyUI's CSS transition
    await page.waitForTimeout(300);

    // Verify dropdown is now hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('should support keyboard navigation in dropdown', async ({ page }) => {
    // Open dropdown with keyboard
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();

    // Press Enter to open
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Dropdown should be visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Tab to select element
    await page.keyboard.press('Tab');
    const select = page.getByRole('combobox');
    await expect(select).toBeFocused();

    // Should be able to change mode with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Dropdown should still be visible after mode change
    await expect(dropdown).toBeVisible();
  });

  test('should close dropdown with Escape key', async ({ page }) => {
    // Open dropdown
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await toggleButton.click();
    await page.waitForTimeout(200);

    // Verify dropdown is visible
    const dropdown = page.getByText('Color Vision Assistance');
    await expect(dropdown).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('should show pattern toggle when colorblind mode is active', async ({
    page,
  }) => {
    // Open dropdown
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await toggleButton.click();
    await page.waitForTimeout(200);

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
    // Open dropdown and select a mode
    const toggleButton = page.getByRole('button', { name: /color vision/i });
    await toggleButton.click();
    await page.waitForTimeout(200);

    const select = page.getByRole('combobox');
    await select.selectOption({
      label: 'Deuteranopia (Green-Blind) Correction',
    });
    await page.waitForTimeout(300);

    // Navigate to another page
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // Return to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open dropdown again
    await toggleButton.click();
    await page.waitForTimeout(200);

    // Verify mode is still selected
    const selectedOption = await select.inputValue();
    expect(selectedOption).toContain('deuteranopia');
  });
});
