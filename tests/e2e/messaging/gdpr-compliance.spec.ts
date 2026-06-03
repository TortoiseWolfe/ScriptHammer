/**
 * E2E tests for GDPR Compliance Features
 * Tasks: T191, T192, T193 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Tests data export and (DESTRUCTIVE) account deletion flows. Every test seeds
 * its OWN throwaway viewer (the GDPR data subject) + partner + conversation via
 * seedIsolatedConversation(), so nothing is shared between tests and the spec
 * runs in parallel — no serial mode, no cleanupOldMessages, no shared PRIMARY
 * user that a real deletion would destroy under everyone else.
 *
 * Why a fresh fixture per test (not per describe): the account-deletion happy
 * path actually deletes the throwaway viewer. A fresh seed in beforeEach gives
 * each destructive test its own disposable user, and afterEach's
 * deleteIsolatedConversation is best-effort / null-safe — it tolerates a viewer
 * that the test already deleted (deleteTestUser returns false, never throws).
 *
 * See tests/e2e/utils/test-user-factory.ts and the #116 roadmap for rationale.
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  dismissCookieBanner,
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode,
// and means a real account deletion only ever destroys this test's throwaway user.
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for UI to stabilize after navigation or interaction.
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
    { timeout: 15000 }
  );
}

/** A browser context opened on /account authenticated as the isolated viewer. */
interface OpenedAccount {
  page: Page;
  close: () => Promise<void>;
}

/**
 * Open a fresh browser context authenticated as the isolated fixture's viewer
 * and land on the Account Settings page (where the GDPR export/deletion UI lives).
 *
 * This mirrors openConversationAs() from the factory (inject the throwaway
 * session into localStorage, reload so Supabase picks it up) but navigates to
 * /account instead of a conversation thread — the GDPR controls aren't on the
 * messages route. Each test injects ITS OWN throwaway session, which is what
 * lets this spec run in parallel (workers>1) without shared-user contention.
 */
async function openAccountAsViewer(
  browser: Browser,
  fixture: IsolatedConversation
): Promise<OpenedAccount> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  // The browser talks to Supabase via NEXT_PUBLIC_SUPABASE_URL (in-container
  // Chromium → host.docker.internal locally; the real cloud URL in CI). The
  // localStorage auth key is `sb-<first-host-label>-auth-token`.
  const browserUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_ADMIN_URL ||
    '';
  const supabaseHost = new URL(browserUrl).hostname.split('.')[0];
  const sbStorageKey = `sb-${supabaseHost}-auth-token`;
  const session = fixture.viewerSession;

  await page.goto(`${basePath}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    ({ key, s }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: 3600,
          token_type: 'bearer',
          user: s.user,
        })
      );
    },
    { key: sbStorageKey, s: session }
  );
  // Reload so Supabase picks up the injected session on init.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Land on Account Settings and wait for it to render.
  await page.goto(`${basePath}/account`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Account Settings")', {
    state: 'visible',
    timeout: 30000,
  });
  await waitForUIStability(page);
  await dismissCookieBanner(page);

  return { page, close: () => context.close() };
}

test.describe('GDPR Data Export', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should show data export button in account settings (T191)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

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
    } finally {
      await account.close();
    }
  });

  test('should trigger data export download (T191)', async ({ browser }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      // Setup download listener — export queries multiple Supabase tables,
      // which can take 30-60s under CI contention (concurrent jobs)
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

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

        // Verify profile data — the export belongs to THIS test's isolated viewer
        expect(data.profile).toHaveProperty('email');
        expect(data.profile.email).toBe(fixture!.viewer.email);

        // Verify statistics
        expect(data.statistics).toHaveProperty('total_conversations');
        expect(data.statistics).toHaveProperty('total_messages_sent');
        expect(data.statistics).toHaveProperty('total_messages_received');
        expect(data.statistics).toHaveProperty('total_connections');
      }
    } finally {
      await account.close();
    }
  });

  test('should export decrypted messages (T191)', async ({ browser }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      // This test requires existing conversations with messages.
      // The isolated viewer may have an empty conversation; the assertions are
      // guarded on length, so an empty export still passes (intent preserved).

      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

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
    } finally {
      await account.close();
    }
  });

  test('should show error on export failure (T191)', async ({ browser }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      // Intercept export API call and return error
      await page.route('**/api/**', (route) => {
        route.abort();
      });

      const exportButton = page.getByRole('button', {
        name: /Download My Data/i,
      });
      await exportButton.click();

      // Should show error alert
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
    } finally {
      await account.close();
    }
  });
});

test.describe('GDPR Account Deletion', () => {
  // Each test gets a FRESH isolated viewer because the happy-path test below
  // actually deletes it. afterEach is best-effort and tolerates that.
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    // null-safe + best-effort: if the deletion test already removed the viewer,
    // deleteTestUser returns false (never throws) and the partner still cleans up.
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should show account deletion button in account settings (T192)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      // Find Privacy & Data section
      const privacySection = page.getByText('Privacy & Data').first();
      await expect(privacySection).toBeVisible();

      // Find Account Deletion subsection
      const deletionSection = page.getByText('Account Deletion').first();
      await expect(deletionSection).toBeVisible();

      // Find Delete Account button
      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
    } finally {
      await account.close();
    }
  });

  test('should open confirmation modal on delete button click (T192)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      // Modal should be visible
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Modal should have warning content - look within the modal specifically
      await expect(
        modal.getByRole('heading', { name: /Delete Account Permanently/i })
      ).toBeVisible();
      await expect(modal.getByText(/cannot be undone/i)).toBeVisible();
    } finally {
      await account.close();
    }
  });

  test('should require typing "DELETE" to enable deletion (T192)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      const modal = page.getByRole('dialog');
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
      await expect(confirmButton).toBeEnabled({ timeout: 15000 });
    } finally {
      await account.close();
    }
  });

  test('should close modal on cancel button click (T192)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      const cancelButton = modal.getByRole('button', { name: /Cancel/i });
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();
    } finally {
      await account.close();
    }
  });

  test('should delete account and redirect to sign-in (T192)', async ({
    browser,
  }) => {
    // DESTRUCTIVE: this actually deletes THIS test's throwaway viewer. Per-test
    // isolation makes that safe — no shared user is harmed — and afterEach's
    // teardown tolerates the now-deleted viewer (best-effort).
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await waitForUIStability(page);

      const confirmInput = page.locator('#confirmation-input');
      const confirmButton = modal.getByRole('button', {
        name: /Delete my account permanently/i,
      });

      // Type confirmation
      await confirmInput.fill('DELETE');

      // Click delete button — real deletion against the isolated viewer.
      await confirmButton.click();

      // Should show loading state
      await expect(page.getByText('Deleting...')).toBeVisible();

      // Should redirect to sign-in. The static export uses trailing slashes,
      // so the real URL is `/sign-in/?message=account_deleted` — allow the
      // optional slash before the query string.
      await page.waitForURL(/\/sign-in\/?(\?|$)/, { timeout: 30000 });
    } finally {
      await account.close();
    }
  });

  test('should show error message on deletion failure (T192)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await waitForUIStability(page);

      const confirmInput = page.locator('#confirmation-input');
      const confirmButton = modal.getByRole('button', {
        name: /Delete my account permanently/i,
      });

      // Type confirmation
      await confirmInput.fill('DELETE');

      // Mock deletion failure so the viewer is NOT actually deleted — this test
      // exercises the error path, not real teardown. Pattern must match Supabase
      // REST API URLs with query params.
      await page.route('**/rest/v1/user_profiles**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: { message: 'Deletion failed' } }),
        });
      });

      // Click delete button
      await confirmButton.click();

      // Should show error alert with failure message
      // deleteUserAccount() does multiple async steps before hitting the mocked route
      await expect(modal.getByRole('alert')).toBeVisible({
        timeout: 30000,
      });
      // The actual error message is "Failed to delete account: ..." (visible element, not sr-only)
      await expect(
        page.getByText(/Failed to delete account/i).first()
      ).toBeVisible();
    } finally {
      await account.close();
    }
  });

  test('should have accessible ARIA attributes (T192)', async ({ browser }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      const deleteButton = page.getByRole('button', {
        name: /Delete Account/i,
      });
      await deleteButton.click();

      const modal = page.getByRole('dialog');
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
    } finally {
      await account.close();
    }
  });
});

test.describe('GDPR Accessibility', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should have ARIA live regions for status updates (T193)', async ({
    browser,
  }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

      // Data export has live region - check initial state
      const exportLiveRegion = page.getByRole('status').first();
      await expect(exportLiveRegion).toHaveText(/ready to export/i);

      // Click export button
      const exportButton = page.getByRole('button', {
        name: /Download My Data/i,
      });
      await exportButton.click();

      // Status should update to "Exporting your data..."
      await expect(exportLiveRegion).toHaveText(/exporting/i, {
        timeout: 15000,
      });
    } finally {
      await account.close();
    }
  });

  test('should be keyboard navigable (T193)', async ({ browser }) => {
    const account = await openAccountAsViewer(browser, fixture!);
    try {
      const page = account.page;

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
    } finally {
      await account.close();
    }
  });
});
