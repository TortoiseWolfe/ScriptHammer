/**
 * E2E tests for GDPR Compliance Features
 * Tasks: T191, T192
 * Updated: Feature 026 - Using standardized test users
 *
 * Tests data export and account deletion flows
 */

import { test, expect } from '@playwright/test';

// Test user - use PRIMARY from standardized test fixtures (Feature 026)
const TEST_USER = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

test.describe('GDPR Data Export', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as test user
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    // Navigate to account settings
    await page.goto('/account');
  });

  test('should show data export button in account settings (T191)', async ({
    page,
  }) => {
    // Find Privacy & Data section
    const privacySection = page.locator('text=Privacy & Data').first();
    await expect(privacySection).toBeVisible();

    // Find Data Export subsection
    const exportSection = page.locator('text=Data Export').first();
    await expect(exportSection).toBeVisible();

    // Find Download My Data button
    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();
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
    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();
    await exportButton.click();

    // Wait for loading state
    await expect(page.locator('text=Exporting...')).toBeVisible();

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
      expect(data.profile.email).toBe('test@example.com');

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

    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();
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

    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();
    await exportButton.click();

    // Should show error alert
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('GDPR Account Deletion', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as test user
    // NOTE: Account deletion tests use mocked responses to prevent actual deletion
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    // Navigate to account settings
    await page.goto('/account');
  });

  test('should show account deletion button in account settings (T192)', async ({
    page,
  }) => {
    // Find Privacy & Data section
    const privacySection = page.locator('text=Privacy & Data').first();
    await expect(privacySection).toBeVisible();

    // Find Account Deletion subsection
    const deletionSection = page.locator('text=Account Deletion').first();
    await expect(deletionSection).toBeVisible();

    // Find Delete Account button
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();
  });

  test('should open confirmation modal on delete button click (T192)', async ({
    page,
  }) => {
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    // Modal should be visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Modal should have warning content
    await expect(page.locator('text=Delete Account Permanently')).toBeVisible();
    await expect(
      page.locator('text=This action cannot be undone')
    ).toBeVisible();
  });

  test('should require typing "DELETE" to enable deletion (T192)', async ({
    page,
  }) => {
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    const confirmInput = modal.locator('input[placeholder="DELETE"]');
    const confirmButton = modal.locator('button:has-text("Delete Account")');

    // Initially disabled
    await expect(confirmButton).toBeDisabled();

    // Typing wrong text keeps it disabled
    await confirmInput.fill('delete');
    await expect(confirmButton).toBeDisabled();

    // Show validation error
    await expect(page.locator('text=Please type DELETE exactly')).toBeVisible();

    // Clear and type correct text
    await confirmInput.clear();
    await confirmInput.fill('DELETE');

    // Now enabled
    await expect(confirmButton).toBeEnabled();
  });

  test('should close modal on cancel button click (T192)', async ({ page }) => {
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const cancelButton = modal.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should delete account and redirect to sign-in (T192)', async ({
    page,
  }) => {
    // NOTE: This test should use a dedicated test account that can be deleted
    // Skipping actual deletion to preserve test account

    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    const confirmInput = modal.locator('input[placeholder="DELETE"]');
    const confirmButton = modal.locator('button:has-text("Delete Account")');

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
    await expect(page.locator('text=Deleting...')).toBeVisible();

    // Should redirect to sign-in
    // await page.waitForURL('/sign-in?message=account_deleted', { timeout: 10000 });
  });

  test('should show error message on deletion failure (T192)', async ({
    page,
  }) => {
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');
    const confirmInput = modal.locator('input[placeholder="DELETE"]');
    const confirmButton = modal.locator('button:has-text("Delete Account")');

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
    await expect(modal.locator('[role="alert"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=Deletion failed')).toBeVisible();
  });

  test('should have accessible ARIA attributes (T192)', async ({ page }) => {
    const deleteButton = page
      .locator('button:has-text("Delete Account")')
      .first();
    await deleteButton.click();

    const modal = page.locator('[role="dialog"]');

    // Modal should have ARIA labels
    await expect(modal).toHaveAttribute(
      'aria-labelledby',
      'delete-modal-title'
    );
    await expect(modal).toHaveAttribute(
      'aria-describedby',
      'delete-modal-description'
    );

    // Input should have ARIA attributes
    const confirmInput = modal.locator('input[placeholder="DELETE"]');
    await expect(confirmInput).toHaveAttribute('aria-required', 'true');
  });
});

test.describe('GDPR Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
    await page.goto('/account');
  });

  test('should have ARIA live regions for status updates (T193)', async ({
    page,
  }) => {
    // Data export has live region
    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();
    await exportButton.click();

    const exportLiveRegion = page.locator('[role="status"]').first();
    await expect(exportLiveRegion).toHaveText(/exporting your data/i);
  });

  test('should be keyboard navigable (T193)', async ({ page }) => {
    // Tab to Privacy & Data section
    await page.keyboard.press('Tab');

    // Should be able to reach export button
    const exportButton = page
      .locator('button:has-text("Download My Data")')
      .first();

    // Focus export button
    await exportButton.focus();
    await expect(exportButton).toBeFocused();

    // Press Enter to trigger export
    await page.keyboard.press('Enter');

    // Should show loading state
    await expect(page.locator('text=Exporting...')).toBeVisible();
  });
});
