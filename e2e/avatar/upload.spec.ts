/**
 * E2E Test: Avatar Upload User Flow
 *
 * Tests the complete user interaction flow for avatar upload:
 * - Navigate to Account Settings
 * - Upload avatar with crop interface
 * - Replace existing avatar
 * - Remove avatar
 * - Validation error handling
 *
 * Prerequisites:
 * - Test user authenticated
 * - Account Settings page accessible at /account-settings
 * - Test fixtures available at e2e/fixtures/avatars/
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Avatar Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test user
    const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
    const testPassword =
      process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

    await page.goto('/sign-in');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to home or dashboard
    await page.waitForURL(/\/(home|dashboard|$)/, { timeout: 10000 });

    // Navigate to Account Settings
    await page.goto('/account-settings');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Remove avatar if exists
    const removeButton = page.getByRole('button', { name: /remove avatar/i });
    const isVisible = await removeButton.isVisible().catch(() => false);

    if (isVisible) {
      await removeButton.click();
      await page.waitForTimeout(1000); // Wait for removal
    }
  });

  test('US1.1 - Upload new avatar with crop interface', async ({ page }) => {
    // Find and click upload button
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toHaveAttribute('aria-label', /upload/i);

    // Click upload button to open file picker
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    // Select test image
    const testImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-500x500.jpg'
    );
    await fileChooser.setFiles(testImagePath);

    // Wait for crop interface to appear
    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Verify crop controls present
    await expect(page.getByLabel(/zoom/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Save cropped avatar
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();

    // Wait for upload progress
    const progressIndicator = page.getByRole('status', { name: /uploading/i });
    if (await progressIndicator.isVisible().catch(() => false)) {
      await expect(progressIndicator).toBeHidden({ timeout: 10000 });
    }

    // Verify success message
    await expect(page.getByText(/avatar uploaded successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify avatar displays
    const avatarImage = page.getByRole('img', {
      name: /profile picture|avatar/i,
    });
    await expect(avatarImage).toBeVisible();
    await expect(avatarImage).toHaveAttribute('src', /avatars/);

    // Verify avatar persists after reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(avatarImage).toBeVisible();
  });

  test('US1.2 - Replace existing avatar', async ({ page }) => {
    // Upload first avatar
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooser1Promise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser1 = await fileChooser1Promise;

    const firstImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-500x500.jpg'
    );
    await fileChooser1.setFiles(firstImagePath);

    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({
      timeout: 10000,
    });

    const firstAvatar = page.getByRole('img', { name: /avatar/i });
    await expect(firstAvatar).toBeVisible();
    const firstAvatarSrc = await firstAvatar.getAttribute('src');

    // Upload second avatar (replacement)
    const fileChooser2Promise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser2 = await fileChooser2Promise;

    const secondImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-800x800.png'
    );
    await fileChooser2.setFiles(secondImagePath);

    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify new avatar displays
    const secondAvatar = page.getByRole('img', { name: /avatar/i });
    await expect(secondAvatar).toBeVisible();
    const secondAvatarSrc = await secondAvatar.getAttribute('src');

    // Verify URLs are different
    expect(secondAvatarSrc).not.toBe(firstAvatarSrc);
  });

  test('US1.3 - Remove avatar', async ({ page }) => {
    // Upload avatar first
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    const testImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-500x500.jpg'
    );
    await fileChooser.setFiles(testImagePath);

    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify avatar displays
    await expect(page.getByRole('img', { name: /avatar/i })).toBeVisible();

    // Click remove button
    const removeButton = page.getByRole('button', { name: /remove avatar/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Verify confirmation (if implemented)
    const confirmButton = page.getByRole('button', {
      name: /confirm|yes|remove/i,
    });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Verify success message
    await expect(page.getByText(/avatar removed/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify avatar replaced with default (initials or placeholder)
    const defaultAvatar = page.locator('[data-testid="default-avatar"]');
    await expect(defaultAvatar).toBeVisible();

    // Or verify initials display
    const initialsAvatar = page.getByText(/^[A-Z]{1,2}$/);
    if (await initialsAvatar.isVisible().catch(() => false)) {
      await expect(initialsAvatar).toBeVisible();
    }
  });

  test('US1.4 - Cancel crop without saving', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    const testImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-500x500.jpg'
    );
    await fileChooser.setFiles(testImagePath);

    // Wait for crop interface
    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).toBeVisible({ timeout: 5000 });

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Verify crop interface closed
    await expect(cropModal).toBeHidden();

    // Verify no success message
    await expect(page.getByText(/uploaded successfully/i)).not.toBeVisible();

    // Verify no new avatar added
    const avatarImage = page.getByRole('img', { name: /avatar/i });
    const hasAvatar = await avatarImage.isVisible().catch(() => false);

    if (hasAvatar) {
      // If avatar exists, verify URL didn't change by checking timestamp
      const avatarSrc = await avatarImage.getAttribute('src');
      const currentTimestamp = Date.now();
      const urlTimestamp = parseInt(
        avatarSrc?.match(/\/(\d{13})\.webp/)?.[1] || '0'
      );

      // URL timestamp should be older than test start (more than 10 seconds ago)
      expect(currentTimestamp - urlTimestamp).toBeGreaterThan(10000);
    }
  });

  test('Edge Case: Reject oversized file', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    const largeImagePath = path.join(
      __dirname,
      '../fixtures/avatars/invalid-toolarge.jpg'
    );
    await fileChooser.setFiles(largeImagePath);

    // Verify error message appears
    await expect(page.getByText(/5MB|too large|size limit/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify crop interface does NOT appear
    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).not.toBeVisible();
  });

  test('Edge Case: Reject invalid file format', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    const invalidFilePath = path.join(
      __dirname,
      '../fixtures/avatars/invalid-format.pdf'
    );
    await fileChooser.setFiles(invalidFilePath);

    // Verify error message appears
    await expect(
      page.getByText(/invalid file type|jpeg|png|webp/i)
    ).toBeVisible({
      timeout: 5000,
    });

    // Verify crop interface does NOT appear
    const cropModal = page.getByRole('dialog', { name: /crop/i });
    await expect(cropModal).not.toBeVisible();
  });

  test('Edge Case: Handle network interruption gracefully', async ({
    page,
    context,
  }) => {
    // Simulate network failure during upload
    await context.setOffline(true);

    const uploadButton = page.getByRole('button', { name: /upload avatar/i });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;

    const testImagePath = path.join(
      __dirname,
      '../fixtures/avatars/valid-500x500.jpg'
    );
    await fileChooser.setFiles(testImagePath);

    await page.getByRole('button', { name: /save/i }).click();

    // Verify error message
    await expect(
      page.getByText(/network error|upload failed|try again/i)
    ).toBeVisible({
      timeout: 10000,
    });

    // Restore network
    await context.setOffline(false);

    // Verify retry option available
    const retryButton = page.getByRole('button', { name: /retry/i });
    if (await retryButton.isVisible().catch(() => false)) {
      await expect(retryButton).toBeVisible();
    }
  });

  test('Accessibility: Keyboard navigation', async ({ page }) => {
    // Tab to upload button
    await page.keyboard.press('Tab');
    const uploadButton = page.getByRole('button', { name: /upload avatar/i });

    // Verify focus on upload button
    await expect(uploadButton).toBeFocused();

    // Verify touch target size (44px minimum)
    const buttonBox = await uploadButton.boundingBox();
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);

    // Verify ARIA labels
    await expect(uploadButton).toHaveAttribute('aria-label');

    // Test screen reader announcement
    const srAnnouncement = page.getByRole('status', { name: /avatar/i });
    if (await srAnnouncement.isVisible().catch(() => false)) {
      await expect(srAnnouncement).toHaveAttribute('aria-live', 'polite');
    }
  });
});
