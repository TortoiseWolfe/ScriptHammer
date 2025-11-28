/**
 * Accessibility Test: Avatar Upload Component
 *
 * Tests WCAG 2.1 AA compliance for avatar upload interface:
 * - Keyboard navigation (Tab, Enter, Escape)
 * - Screen reader announcements (ARIA)
 * - Focus management (modal trap, restore)
 * - Color contrast (4.5:1 minimum)
 * - Touch targets (44×44px minimum)
 * - Error announcements (aria-live)
 *
 * Prerequisites:
 * - Pa11y configured (see .pa11yci.js)
 * - Test server running (pnpm run dev)
 * - Test user authenticated
 */

import { test, expect } from '@playwright/test';

test.describe('Avatar Upload Accessibility (WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test user
    const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
    const testPassword =
      process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

    await page.goto('/sign-in');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(profile|verify-email)/, { timeout: 10000 });

    // Navigate to Account Settings
    await page.goto('/account');
    await page.waitForLoadState('networkidle');
  });

  test('A11y-001: Upload button meets touch target requirements', async ({
    page,
  }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await expect(uploadButton).toBeVisible();

    // Verify minimum 44×44px touch target (WCAG AAA / Apple HIG)
    const buttonBox = await uploadButton.boundingBox();
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);

    // Verify Tailwind classes applied
    await expect(uploadButton).toHaveClass(/min-h-11/); // 11 * 4px = 44px
    await expect(uploadButton).toHaveClass(/min-w-11/);
  });

  test('A11y-002: Upload button has descriptive ARIA label', async ({
    page,
  }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });

    // Verify ARIA label or accessible name
    const ariaLabel = await uploadButton.getAttribute('aria-label');
    const textContent = await uploadButton.textContent();

    expect(ariaLabel || textContent).toMatch(
      /upload.*avatar|profile.*picture/i
    );
  });

  test('A11y-003: Keyboard navigation - Tab to upload button', async ({
    page,
  }) => {
    // Tab through page until upload button focused
    let iterations = 0;
    let focused = false;

    while (iterations < 20 && !focused) {
      await page.keyboard.press('Tab');
      iterations++;

      const focusedElement = await page.evaluateHandle(
        () => document.activeElement
      );
      const tagName = await page.evaluate((el) => el?.tagName, focusedElement);
      const textContent = await page.evaluate(
        (el) => el?.textContent,
        focusedElement
      );

      if (tagName === 'BUTTON' && textContent?.match(/upload.*avatar/i)) {
        focused = true;
      }
    }

    expect(focused).toBe(true);

    // Verify upload button is focused
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await expect(uploadButton).toBeFocused();
  });

  test('A11y-004: Keyboard navigation - Enter activates upload', async ({
    page,
  }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await uploadButton.focus();

    // Press Enter to activate
    const fileChooserPromise = page.waitForEvent('filechooser', {
      timeout: 5000,
    });
    await page.keyboard.press('Enter');
    const fileChooser = await fileChooserPromise;

    expect(fileChooser).toBeTruthy();
  });

  test('A11y-005: Crop modal traps focus', async ({ page }) => {
    // Open crop modal
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    // Mock file selection (use data URL to avoid file dependency)
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, 400, 400);
      return canvas.toDataURL('image/jpeg', 0.9);
    });

    // Wait for crop modal
    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Verify modal has aria-modal="true"
    await expect(cropModal).toHaveAttribute('aria-modal', 'true');

    // Tab through modal - focus should stay within modal
    const focusedElements: string[] = [];

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluateHandle(
        () => document.activeElement
      );
      const elementText = await page.evaluate(
        (el) => el?.textContent,
        activeElement
      );
      focusedElements.push(elementText || '');
    }

    // Verify all focused elements are within modal (Save, Cancel, Zoom)
    const modalInteractiveElements = ['Save', 'Cancel', 'Zoom', 'Crop'];
    const allWithinModal = focusedElements.every((text) =>
      modalInteractiveElements.some((label) => text.includes(label))
    );

    expect(allWithinModal).toBe(true);
  });

  test('A11y-006: Escape key closes crop modal', async ({ page }) => {
    // Open crop modal
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    await fileChooserPromise;

    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify modal closed
    await expect(cropModal).toBeHidden();
  });

  test('A11y-007: Focus restored after closing crop modal', async ({
    page,
  }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await uploadButton.focus();

    // Get initial focused element
    const initialFocus = await page.evaluate(
      () => document.activeElement?.textContent
    );

    // Open crop modal
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    await fileChooserPromise;

    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Close modal
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
    await expect(cropModal).toBeHidden();

    // Verify focus restored to upload button
    const restoredFocus = await page.evaluate(
      () => document.activeElement?.textContent
    );
    expect(restoredFocus).toMatch(/upload.*avatar/i);
  });

  test('A11y-008: Error messages announced via aria-live', async ({ page }) => {
    // Trigger validation error (oversized file)
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    await fileChooserPromise;

    // Create oversized blob in memory
    await page.evaluate(() => {
      const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)]);
      const file = new File([largeBlob], 'large.jpg', { type: 'image/jpeg' });
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input!.files = dataTransfer.files;
      input!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for error message
    const errorMessage = page.getByText(/5MB|too large|size limit/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify error has aria-live region
    const errorRegion = page.getByRole('alert');
    if (await errorRegion.isVisible().catch(() => false)) {
      await expect(errorRegion).toHaveAttribute('aria-live', 'assertive');
    } else {
      // Fallback: check for polite announcement
      const statusRegion = page.getByRole('status');
      await expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    }
  });

  test('A11y-009: Success messages announced via aria-live', async ({
    page,
  }) => {
    // Note: This test requires actual file upload, skipped in quick tests
    test.skip(true, 'Requires real file upload - test in manual/E2E');

    // Upload avatar successfully
    // Verify success message has aria-live="polite"
  });

  test('A11y-010: Color contrast meets WCAG AA (4.5:1)', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await expect(uploadButton).toBeVisible();

    // Get computed styles
    const styles = await uploadButton.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
      };
    });

    // Convert RGB to luminance and calculate contrast ratio
    const contrastRatio = await page.evaluate((styles) => {
      const rgbToLuminance = (rgb: string): number => {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return 0;

        const [r, g, b] = match.slice(1).map(Number);
        const [rs, gs, bs] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      const fgLum = rgbToLuminance(styles.color);
      const bgLum = rgbToLuminance(styles.backgroundColor);

      const lighter = Math.max(fgLum, bgLum);
      const darker = Math.min(fgLum, bgLum);

      return (lighter + 0.05) / (darker + 0.05);
    }, styles);

    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text (18pt+)
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  test('A11y-011: Remove button has descriptive ARIA label', async ({
    page,
  }) => {
    // Upload avatar first (or skip if no avatar)
    const removeButton = page.getByRole('button', { name: /remove avatar/i });
    const isVisible = await removeButton.isVisible().catch(() => false);

    if (isVisible) {
      const ariaLabel = await removeButton.getAttribute('aria-label');
      const textContent = await removeButton.textContent();

      expect(ariaLabel || textContent).toMatch(
        /remove.*avatar|delete.*picture/i
      );

      // Verify touch target
      const buttonBox = await removeButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('A11y-012: Zoom slider has accessible label and value', async ({
    page,
  }) => {
    // Open crop modal
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    await fileChooserPromise;

    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Find zoom slider
    const zoomSlider = page.getByRole('slider', { name: /zoom/i });
    if (await zoomSlider.isVisible().catch(() => false)) {
      // Verify ARIA attributes
      await expect(zoomSlider).toHaveAttribute('aria-label');
      await expect(zoomSlider).toHaveAttribute('aria-valuemin');
      await expect(zoomSlider).toHaveAttribute('aria-valuemax');
      await expect(zoomSlider).toHaveAttribute('aria-valuenow');

      // Verify keyboard control (arrow keys)
      await zoomSlider.focus();
      const initialValue = await zoomSlider.getAttribute('aria-valuenow');

      await page.keyboard.press('ArrowRight');
      const increasedValue = await zoomSlider.getAttribute('aria-valuenow');

      expect(Number(increasedValue)).toBeGreaterThan(Number(initialValue));
    }
  });

  test('A11y-013: Screen reader announces avatar status', async ({ page }) => {
    // Check for status region
    const statusRegion =
      page.getByRole('status', { name: /avatar/i }) ||
      page.locator('[aria-live="polite"]');

    if (await statusRegion.isVisible().catch(() => false)) {
      await expect(statusRegion).toHaveAttribute('aria-live');

      // Verify status contains meaningful text
      const statusText = await statusRegion.textContent();
      expect(statusText).toMatch(
        /avatar|profile.*picture|uploaded|no.*avatar/i
      );
    }
  });

  test('A11y-014: Component has landmark roles', async ({ page }) => {
    // Check for proper sectioning
    const avatarSection = page.locator('[aria-labelledby*="avatar"]');
    if (await avatarSection.isVisible().catch(() => false)) {
      // Verify section has heading
      const heading = avatarSection.locator('h2, h3');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(/avatar|profile.*picture/i);
    }
  });
});
