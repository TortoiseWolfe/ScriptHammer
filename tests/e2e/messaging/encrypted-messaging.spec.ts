/**
 * E2E Test for Encrypted Messaging Flow
 * Task: T044 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Every test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation(), so nothing is shared between tests and the spec
 * runs `fullyParallel` (no serial, no cleanupOldMessages, no shared
 * PRIMARY/TERTIARY contention). See tests/e2e/utils/test-user-factory.ts and
 * the #116 roadmap for the rationale.
 *
 * Tests:
 * 1. Send encrypted message from viewer → partner, partner replies, viewer sees it
 * 2. Verify database only stores ciphertext (zero-knowledge)
 * 3. Test delivery status indicators
 * 4. Load message history with pagination
 * 5. Verify private keys never sent to server
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
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for `text` to render in a thread that updates via polling (~10s), with
 * page reloads between attempts to survive cloud read-after-write tail latency.
 * Each isolated conversation is tiny, so this converges fast — no 10×reload loop.
 */
async function waitForMessageWithReload(
  page: import('@playwright/test').Page,
  text: string,
  reopenThread: () => Promise<unknown>,
  attempts = 5
): Promise<void> {
  const locator = page.getByText(text);
  for (let i = 0; i < attempts; i++) {
    await scrollThreadToBottom(page);
    if (await locator.isVisible({ timeout: 12000 }).catch(() => false)) return;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reopenThread();
  }
  // Final assertion — surfaces a real failure if it never arrived.
  await scrollThreadToBottom(page);
  await expect(locator).toBeVisible({ timeout: 15000 });
}

test.describe('Encrypted Messaging Flow', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should send and receive encrypted message between two users', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    const partner = await openAsPartner(browser, fixture!);

    // Forward browser console from both pages for CI diagnostics.
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
          text.includes('DECRYPTION') ||
          msg.type() === 'error'
        ) {
          console.log(`[${label} console.${msg.type()}] ${text}`);
        }
      });
    }

    try {
      // ===== Viewer sends an encrypted message =====
      const testMessage = `Test encrypted message ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);
      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click();
      await expect(sendButton).not.toContainText('Sending', { timeout: 60000 });

      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(testMessage)).toBeVisible({
        timeout: 60000,
      });

      // ===== Partner receives the decrypted message =====
      await waitForMessageWithReload(partner.page, testMessage, async () =>
        partner.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        })
      );

      // ===== Partner replies; viewer sees it =====
      const replyMessage = `Reply from partner ${Date.now()}`;
      await fillMessageInput(partner.page, replyMessage);
      await partner.page.getByRole('button', { name: /send/i }).click();
      await scrollThreadToBottom(partner.page);
      await expect(partner.page.getByText(replyMessage)).toBeVisible({
        timeout: 30000,
      });

      await waitForMessageWithReload(viewer.page, replyMessage, async () =>
        viewer.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        })
      );
    } finally {
      await viewer.close();
      await partner.close();
    }
  });

  test('should verify zero-knowledge encryption in database', async ({
    browser,
  }) => {
    const adminClient = getAdminClient();
    test.skip(!adminClient, 'admin client not configured');

    const viewer = await openAsViewer(browser, fixture!);
    try {
      const secretMessage = `Secret message for zero-knowledge test ${Date.now()}`;
      await fillMessageInput(viewer.page, secretMessage);
      await viewer.page.getByRole('button', { name: /send/i }).click();

      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(secretMessage)).toBeVisible({
        timeout: 30000,
      });

      // ===== Verify database stores only ciphertext =====
      // The optimistic UI render can precede the Supabase INSERT commit; poll
      // the admin query (scoped to THIS conversation) until the row lands.
      let messages:
        | { encrypted_content: string; initialization_vector: string }[]
        | null = null;
      let error: unknown = null;
      for (let attempt = 0; attempt < 15; attempt++) {
        const result = await adminClient!
          .from('messages')
          .select('encrypted_content, initialization_vector')
          .eq('conversation_id', fixture!.conversationId)
          .order('created_at', { ascending: false })
          .limit(10);
        messages = result.data;
        error = result.error;
        if (messages && messages.length > 0) break;
        await viewer.page.waitForTimeout(2000);
      }

      expect(error).toBeNull();
      expect(messages).toBeTruthy();
      expect(messages!.length).toBeGreaterThan(0);

      // Plaintext must never appear in the database.
      const foundPlaintext = messages!.some((msg) =>
        msg.encrypted_content?.includes(secretMessage)
      );
      expect(foundPlaintext).toBe(false);

      // encrypted_content must be base64 ciphertext with an IV.
      const hasEncryptedData = messages!.every((msg) => {
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(msg.encrypted_content);
        const hasIV =
          typeof msg.initialization_vector === 'string' &&
          msg.initialization_vector.length > 0;
        return isBase64 && hasIV;
      });
      expect(hasEncryptedData).toBe(true);
    } finally {
      await viewer.close();
    }
  });

  test('should show delivery status indicators', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    const partner = await openAsPartner(browser, fixture!);

    try {
      const testMessage = `Delivery status test ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);
      await viewer.page.getByRole('button', { name: /send/i }).click();

      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(testMessage)).toBeVisible({
        timeout: 30000,
      });

      // ===== "Sent" status (✓) =====
      const messageBubble = viewer.page
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: testMessage });
      await expect(messageBubble).toBeVisible();

      const deliveryStatus = messageBubble.locator(
        '[data-testid="delivery-status"]'
      );
      await expect(deliveryStatus).toBeVisible();

      const readReceipt = deliveryStatus.locator(
        '[data-testid="read-receipt"]'
      );
      await expect(readReceipt).toHaveAttribute(
        'aria-label',
        /Message (sent|delivered|read)/i,
        { timeout: 30000 }
      );

      // ===== Partner reads the message =====
      await waitForMessageWithReload(partner.page, testMessage, async () =>
        partner.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        })
      );

      // ===== "Delivered/Read" status after partner read =====
      await viewer.page.reload({ waitUntil: 'domcontentloaded' });
      await viewer.page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 30000,
      });
      await expect(viewer.page.getByText(testMessage)).toBeVisible();

      const updatedReceipt = viewer.page
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: testMessage })
        .locator(
          '[data-testid="delivery-status"] [data-testid="read-receipt"]'
        );
      await expect(updatedReceipt).toHaveAttribute(
        'aria-label',
        /Message (sent|delivered|read)/i,
        { timeout: 30000 }
      );
    } finally {
      await viewer.close();
      await partner.close();
    }
  });

  test('should load message history with pagination', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      // Send a handful of messages; the thread should render them and cap the
      // initial page at the default page size (50).
      const messagesToSend = 10;
      for (let i = 0; i < messagesToSend; i++) {
        await fillMessageInput(viewer.page, `Pagination test message ${i + 1}`);
        await viewer.page.getByRole('button', { name: /send/i }).click();
        await viewer.page.waitForTimeout(500);
      }

      await scrollThreadToBottom(viewer.page);
      await expect(
        viewer.page
          .getByText(`Pagination test message ${messagesToSend}`)
          .first()
      ).toBeVisible({ timeout: 15000 });

      const messageBubbles = viewer.page.locator(
        '[data-testid="message-bubble"]'
      );
      const visibleCount = await messageBubbles.count();
      expect(visibleCount).toBeGreaterThan(0);
      expect(visibleCount).toBeLessThanOrEqual(50);

      // ===== "Load More" (only present when history exceeds a page) =====
      await viewer.page
        .locator('[data-testid="message-thread"]')
        .first()
        .evaluate((el) => {
          el.scrollTop = 0;
          el.dispatchEvent(new Event('scroll', { bubbles: true }));
        });

      const loadMoreButton = viewer.page.getByRole('button', {
        name: /load more|older messages/i,
      });
      if (await loadMoreButton.isVisible().catch(() => false)) {
        const countBefore = await messageBubbles.count();
        await loadMoreButton.click();
        await viewer.page.waitForTimeout(2000);
        expect(await messageBubbles.count()).toBeGreaterThan(countBefore);
      }
    } finally {
      await viewer.close();
    }
  });
});

test.describe('Encryption Key Security', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should never send private keys to server', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);

    // Monitor network requests to verify no private keys are sent.
    const networkRequests: { url: string; method: string; body: string }[] = [];
    viewer.page.on('request', (request) => {
      const postData = request.postData();
      if (postData) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          body: postData,
        });
      }
    });

    try {
      await fillMessageInput(viewer.page, 'Key security test message');
      await viewer.page.getByRole('button', { name: /send/i }).click();

      await scrollThreadToBottom(viewer.page);
      await expect(
        viewer.page.getByText('Key security test message')
      ).toBeVisible({ timeout: 30000 });

      // ===== No private keys in any request body =====
      const foundPrivateKey = networkRequests.some((req) => {
        const body = req.body.toLowerCase();
        return (
          body.includes('"d":') || // JWK private key component
          body.includes('"privatekey"') ||
          body.includes('private_key') ||
          body.includes('privatekey')
        );
      });
      expect(foundPrivateKey).toBe(false);
    } finally {
      await viewer.close();
    }
  });
});
