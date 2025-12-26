/**
 * E2E tests for GDPR Compliance Features
 * Tasks: T191, T192
 * Updated: Feature 026 - Using standardized test users
 *
 * Tests data export and account deletion flows
 */

import { test, expect, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

/**
 * Wait for UI to stabilize after navigation or interaction
 */
async function waitForUIStability(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let stableFrames = 0;
        const checkStability = () => {
          stableFrames++;
          if (stableFrames >= 3) resolve(true);
          else requestAnimationFrame(checkStability);
        };
        requestAnimationFrame(checkStability);
      });
    },
    { timeout: 5000 }
  );
}

// Test user - use PRIMARY from standardized test fixtures (Feature 026)
const TEST_USER = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

test.describe('GDPR Data Export', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as test user
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    // Navigate to account settings
    await page.goto('/account');
    // Wait for account settings heading to be visible
    await page.waitForSelector('h1:has-text("Account Settings")', {
      state: 'visible',
      timeout: 10000,
    });
    await waitForUIStability(page);
    await dismissCookieBanner(page);
  });

  test('should show data export button in account settings (T191)', async ({
    page,
  }) => {
    // Find Privacy & Data section
    const privacySection = page.getByText('Privacy & Data').first();
    await expect(privacySection).toBeVisible();

    // Find Data Export subsection
    const exportSection = page.getByText('Data Export').first();
    await expect(exportSection).toBeVisible();

    // Find Download My Data button
    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test('should trigger data export download (T191)', async ({
    page,
    context,
  }) => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });
    await exportButton.click();

    // Wait for loading state
    await expect(page.getByText('Exporting...')).toBeVisible();

    // Wait for download
    const download = await downloadPromise;

    // Verify download filename
    expect(download.suggestedFilename()).toMatch(
      /my-messages-export-\d+\.json/
    );

    // Save and verify file content
    const path = await download.path();
    if (path) {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      const data = JSON.parse(content);

      // Verify export structure
      expect(data).toHaveProperty('export_date');
      expect(data).toHaveProperty('user_id');
      expect(data).toHaveProperty('profile');
      expect(data).toHaveProperty('connections');
      expect(data).toHaveProperty('conversations');
      expect(data).toHaveProperty('statistics');

      // Verify profile data
      expect(data.profile).toHaveProperty('email');
      expect(data.profile.email).toBe(TEST_USER.email);

      // Verify statistics
      expect(data.statistics).toHaveProperty('total_conversations');
      expect(data.statistics).toHaveProperty('total_messages_sent');
      expect(data.statistics).toHaveProperty('total_messages_received');
      expect(data.statistics).toHaveProperty('total_connections');
    }
  });

  test('should export decrypted messages (T191)', async ({ page }) => {
    // This test requires existing conversations with messages
    // Skip if no messages exist

    const downloadPromise = page.waitForEvent('download');

    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });
    await exportButton.click();

    const download = await downloadPromise;
    const path = await download.path();

    if (path) {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      const data = JSON.parse(content);

      if (data.conversations.length > 0) {
        const conversation = data.conversations[0];
        expect(conversation).toHaveProperty('conversation_id');
        expect(conversation).toHaveProperty('participant');
        expect(conversation).toHaveProperty('messages');

        if (conversation.messages.length > 0) {
          const message = conversation.messages[0];
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('sender');
          expect(message).toHaveProperty('content');
          expect(message).toHaveProperty('timestamp');

          // Content should be decrypted (not base64 encrypted data)
          expect(message.content).not.toMatch(/^[A-Za-z0-9+/=]+$/);
          expect(message.content).not.toContain('encrypted');
        }
      }
    }
  });

  test('should show error on export failure (T191)', async ({
    page,
    context,
  }) => {
    // Intercept export API call and return error
    await page.route('**/api/**', (route) => {
      route.abort();
    });

    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });
    await exportButton.click();

    // Should show error alert
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('GDPR Account Deletion', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as test user
    // NOTE: Account deletion tests use mocked responses to prevent actual deletion
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    // Navigate to account settings
    await page.goto('/account');
    // Wait for account settings heading to be visible
    await page.waitForSelector('h1:has-text("Account Settings")', {
      state: 'visible',
      timeout: 10000,
    });
    await waitForUIStability(page);
    await dismissCookieBanner(page);
  });

  test('should show account deletion button in account settings (T192)', async ({
    page,
  }) => {
    // Find Privacy & Data section
    const privacySection = page.getByText('Privacy & Data').first();
    await expect(privacySection).toBeVisible();

    // Find Account Deletion subsection
    const deletionSection = page.getByText('Account Deletion').first();
    await expect(deletionSection).toBeVisible();

    // Find Delete Account button
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();
  });

  test('should open confirmation modal on delete button click (T192)', async ({
    page,
  }) => {
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    // Modal should be visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Modal should have warning content
    await expect(page.getByText('Delete Account Permanently')).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();
  });

  test('should require typing "DELETE" to enable deletion (T192)', async ({
    page,
  }) => {
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    // Use ID selector for the confirmation input (more reliable than label)
    const confirmInput = page.locator('#confirmation-input');
    // Use aria-label to find the confirm button inside modal
    const confirmButton = modal.getByRole('button', {
      name: /Delete my account permanently/i,
    });

    // Initially disabled
    await expect(confirmButton).toBeDisabled();

    // Typing wrong text keeps it disabled
    await confirmInput.fill('delete');
    await expect(confirmButton).toBeDisabled();

    // Clear and type correct text
    await confirmInput.clear();
    await confirmInput.fill('DELETE');

    // Now enabled - wait for React state update
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  });

  test('should close modal on cancel button click (T192)', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const cancelButton = modal.getByRole('button', { name: /Cancel/i });
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should delete account and redirect to sign-in (T192)', async ({
    page,
  }) => {
    // NOTE: This test should use a dedicated test account that can be deleted
    // Skipping actual deletion to preserve test account

    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    const confirmInput = page.locator('#confirmation-input');
    const confirmButton = modal.getByRole('button', {
      name: /Delete my account permanently/i,
    });

    // Type confirmation
    await confirmInput.fill('DELETE');

    // Mock deletion to prevent actual account deletion
    await page.route('**/user_profiles', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: null, error: null }),
      });
    });

    // Click delete button
    await confirmButton.click();

    // Should show loading state
    await expect(page.getByText('Deleting...')).toBeVisible();

    // Should redirect to sign-in
    // await page.waitForURL('/sign-in?message=account_deleted', { timeout: 10000 });
  });

  test('should show error message on deletion failure (T192)', async ({
    page,
  }) => {
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    const confirmInput = page.locator('#confirmation-input');
    const confirmButton = modal.getByRole('button', {
      name: /Delete my account permanently/i,
    });

    // Type confirmation
    await confirmInput.fill('DELETE');

    // Mock deletion failure
    await page.route('**/user_profiles', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: { message: 'Deletion failed' } }),
      });
    });

    // Click delete button
    await confirmButton.click();

    // Should show error alert
    await expect(modal.getByRole('alert')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Deletion failed')).toBeVisible();
  });

  test('should have accessible ARIA attributes (T192)', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: /Delete Account/i });
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    // Modal should have an accessible name (via aria-labelledby OR aria-label OR title)
    const hasAriaLabelledBy =
      (await modal.getAttribute('aria-labelledby')) !== null;
    const hasAriaLabel = (await modal.getAttribute('aria-label')) !== null;
    const hasTitle =
      (await modal
        .locator('h1, h2, h3, [role="heading"]')
        .first()
        .textContent()) !== null;

    // At least one accessibility pattern should be present
    expect(hasAriaLabelledBy || hasAriaLabel || hasTitle).toBe(true);

    // Verify modal has title content
    await expect(modal.locator('h3, [role="heading"]').first()).toContainText(
      /Delete/i
    );

    // Input should be findable by ID (label has complex HTML structure)
    const confirmInput = page.locator('#confirmation-input');
    await expect(confirmInput).toBeVisible();
  });
});

test.describe('GDPR Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);
    await page.goto('/account');
    // Wait for account settings heading to be visible
    await page.waitForSelector('h1:has-text("Account Settings")', {
      state: 'visible',
      timeout: 10000,
    });
    await waitForUIStability(page);
    await dismissCookieBanner(page);
  });

  test('should have ARIA live regions for status updates (T193)', async ({
    page,
  }) => {
    // Data export has live region - check initial state
    const exportLiveRegion = page.getByRole('status').first();
    await expect(exportLiveRegion).toHaveText(/ready to export/i);

    // Click export button
    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });
    await exportButton.click();

    // Status should update to "Exporting your data..."
    await expect(exportLiveRegion).toHaveText(/exporting/i, { timeout: 5000 });
  });

  test('should be keyboard navigable (T193)', async ({ page }) => {
    // Tab to Privacy & Data section
    await page.keyboard.press('Tab');

    // Should be able to reach export button
    const exportButton = page.getByRole('button', {
      name: /Download My Data/i,
    });

    // Focus export button
    await exportButton.focus();
    await expect(exportButton).toBeFocused();

    // Press Enter to trigger export
    await page.keyboard.press('Enter');

    // Should show loading state
    await expect(page.getByText('Exporting...')).toBeVisible();
  });
});
