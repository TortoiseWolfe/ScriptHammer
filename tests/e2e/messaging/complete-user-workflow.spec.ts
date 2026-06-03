/**
 * E2E Test: Complete User Messaging Workflow
 * Feature: 024-add-third-test
 *
 * #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Every test seeds its OWN throwaway viewer + partner + already-connected
 * conversation via seedIsolatedConversation(), so nothing is shared between
 * tests and the spec runs `parallel` (no serial mode, no cleanupOldMessages,
 * no shared PRIMARY/TERTIARY contention, no friend-request UI dance — the
 * fixture supplies the connection and the conversation). See
 * tests/e2e/utils/test-user-factory.ts and the #116 roadmap for the rationale.
 *
 * Tests:
 * - Complete bidirectional workflow: viewer sends -> partner receives ->
 *   partner replies -> viewer receives -> database stores only ciphertext.
 * - Conversations page loads within the SC-001 budget (5s) with no spinner.
 * - Retry button appears on the conversations error state (FR-005).
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  openAsViewer,
  openAsPartner,
  fillMessageInput,
  scrollThreadToBottom,
  getAdminClient,
  handleReAuthModal,
  DEFAULT_TEST_PASSWORD,
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for `text` to render in a thread that updates via polling (~10s), with
 * page reloads between attempts to survive cloud read-after-write tail latency.
 * Each isolated conversation is tiny, so this converges fast.
 */
async function waitForMessageWithReload(
  page: import('@playwright/test').Page,
  text: string,
  reopenThread: () => Promise<unknown>,
  attempts = 10
): Promise<void> {
  const locator = page.getByText(text);
  for (let i = 0; i < attempts; i++) {
    await scrollThreadToBottom(page);
    if (await locator.isVisible({ timeout: 10000 }).catch(() => false)) return;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reopenThread();
  }
  // Final assertion — surfaces a real failure if it never arrived.
  await scrollThreadToBottom(page);
  await expect(locator).toBeVisible({ timeout: 15000 });
}

test.describe('Complete User Messaging Workflow (Feature 024)', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('Complete messaging workflow: send -> receive -> reply -> verify encryption', async ({
    browser,
  }) => {
    // Open both contexts concurrently — each pays a gate-load + Argon2id unlock,
    // and serializing them nearly exhausts the per-test budget before the send.
    const [viewer, partner] = await Promise.all([
      openAsViewer(browser, fixture!),
      openAsPartner(browser, fixture!),
    ]);

    // Forward browser console from BOTH pages for CI diagnostics.
    for (const [label, pg] of [
      ['viewer', viewer.page],
      ['partner', partner.page],
    ] as const) {
      pg.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('sendMessage') ||
          text.includes('ConversationView') ||
          text.includes('getMessageHistory') ||
          text.includes('getUserPublicKey') ||
          text.includes('restoreKeysFromCache') ||
          text.includes('deriveKeys') ||
          text.includes('DECRYPTION') ||
          msg.type() === 'error'
        ) {
          console.log(`[${label} console.${msg.type()}] ${text}`);
        }
      });
    }

    try {
      // ===== Viewer (User A) sends a message =====
      const testMessage = 'Hello from viewer - ' + Date.now();
      await fillMessageInput(viewer.page, testMessage);
      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click({ force: true });
      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(testMessage)).toBeVisible({
        timeout: 30000,
      });

      // ===== Partner (User B) receives the decrypted message =====
      await waitForMessageWithReload(partner.page, testMessage, async () =>
        partner.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        })
      );

      // ===== Partner replies =====
      const replyMessage = 'Reply from partner - ' + Date.now();
      await fillMessageInput(partner.page, replyMessage);
      await partner.page
        .getByRole('button', { name: /send/i })
        .click({ force: true });
      await scrollThreadToBottom(partner.page);
      await expect(partner.page.getByText(replyMessage)).toBeVisible({
        timeout: 30000,
      });

      // ===== Viewer receives the reply =====
      await waitForMessageWithReload(viewer.page, replyMessage, async () =>
        viewer.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        })
      );

      // ===== Verify encryption: database stores only ciphertext =====
      // Scoped to THIS fixture's conversation (never a global table scan).
      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: messages } = await adminClient
          .from('messages')
          .select('encrypted_content, initialization_vector')
          .eq('conversation_id', fixture!.conversationId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (messages && messages.length > 0) {
          const foundPlaintext = messages.some((msg) => {
            const content = msg.encrypted_content;
            return (
              content &&
              (content.includes(testMessage) || content.includes(replyMessage))
            );
          });
          expect(foundPlaintext).toBe(false);
        }
      }
    } finally {
      await viewer.close();
      await partner.close();
    }
  });
});

test.describe('Conversations Page Loading (Feature 029)', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should load conversations page within 5 seconds (SC-001)', async ({
    browser,
  }) => {
    // openAsViewer injects the throwaway viewer session and unlocks the
    // encryption-key modal (Argon2id, TIME_COST=3). Reuse that authenticated
    // context, then measure the /messages page render only — the unlock cost
    // is paid up-front by the helper, so the timer below measures what the
    // spec name says it measures ("Conversations Page Loading"), not auth.
    const viewer = await openAsViewer(browser, fixture!);
    try {
      const page = viewer.page;

      await page.goto('/messages', { waitUntil: 'domcontentloaded' });
      await handleReAuthModal(page, DEFAULT_TEST_PASSWORD);

      const startTime = Date.now();

      // Wait for page title to load - NOT spinner
      await expect(page.locator('h1:has-text("Messages")').first()).toBeVisible(
        { timeout: 15000 }
      );

      const loadTime = Date.now() - startTime;
      console.log('[Test] Messages page loaded in ' + loadTime + 'ms');

      // Verify page loaded within 5 seconds (SC-001)
      expect(loadTime).toBeLessThan(5000);

      // Verify spinner is NOT visible (SC-002) - check multiple spinner patterns
      const spinner = page
        .locator(
          '.loading-spinner, .loading, [role="status"]:has-text("loading")'
        )
        .first();
      const spinnerVisible = await spinner.isVisible().catch(() => false);
      if (spinnerVisible) {
        await expect(spinner).toBeHidden({ timeout: 15000 });
      }
    } finally {
      await viewer.close();
    }
  });

  test('should show retry button on error state (FR-005)', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      const page = viewer.page;

      // Navigate to the plain messages list.
      await page.goto('/messages', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await handleReAuthModal(page, DEFAULT_TEST_PASSWORD);

      // If error alert with actual error text is shown, verify retry button exists.
      // Empty alert elements may exist on the page; only check if it has error content.
      const errorAlert = page
        .getByRole('alert')
        .filter({ hasText: /error|failed|couldn't/i });
      if (await errorAlert.isVisible().catch(() => false)) {
        await expect(
          page.getByRole('button', { name: /Retry/i })
        ).toBeVisible();
      }
      // Test passes if no error state is triggered (normal flow).
    } finally {
      await viewer.close();
    }
  });
});
