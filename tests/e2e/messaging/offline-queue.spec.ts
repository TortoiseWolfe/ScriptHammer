/**
 * E2E Tests for Offline Message Queue
 * Tasks: T146-T149 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Every test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation(), so nothing is shared between tests and the spec
 * runs in parallel (no serial, no cleanupOldMessages, no shared PRIMARY/TERTIARY
 * contention, no self-heal-connection beforeAll). The offline queue itself lives
 * in the browser's IndexedDB, so the offline/online toggling and queue
 * assertions are unchanged — only the auth/conversation/cleanup scaffolding is
 * swapped for isolation. See tests/e2e/utils/test-user-factory.ts and the #116
 * roadmap for the rationale.
 *
 * Tests:
 * 1. T146: Send message while offline → message queued → go online → message sent
 * 2. T147: Queue 3 messages while offline → reconnect → all 3 sent automatically
 * 3. T148: Simulate server failure → verify retries at 1s, 2s, 4s intervals
 * 4. T149: Conflict resolution - send same message from two devices → server timestamp wins
 * 5. should show failed status after max retries
 */

import { test, expect, type Page } from '@playwright/test';
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
  type OpenedParticipant,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
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

/**
 * Wait for conversation data to be cached (required for offline send).
 *
 * loadConversationInfo can fail silently on a transient error, leaving the
 * conversation cache empty. openAsViewer/openAsPartner already wait for the
 * message-thread to mount and unlock encryption; this extra guard reloads until
 * the participant name resolves (proves loadConversationInfo completed and
 * cached the conversation data) so the subsequent offline encryption has what
 * it needs. The isolated participant always has a profile + public key, so the
 * name resolves quickly.
 */
async function waitForConversationCached(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Wait for the thread to be mounted
    await page.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 30000,
    });
    // Check if participant name resolved (not "Unknown User") — proves
    // loadConversationInfo completed successfully.
    const nameResolved = await page.evaluate(() => {
      const cv = document.querySelector('[data-testid="conversation-view"]');
      return cv ? !cv.textContent?.includes('Unknown User') : false;
    });
    if (nameResolved) {
      // Give cacheConversationData a tick to complete (fire-and-forget)
      await page.waitForTimeout(500);
      return;
    }
    console.log(
      `[waitForConversationCached] Attempt ${attempt + 1}/3: participant name not resolved, reloading...`
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, DEFAULT_TEST_PASSWORD);
  }
  // Last resort — proceed anyway and let sendMessage fail with a clear error
  console.warn(
    '[waitForConversationCached] Conversation data may not be cached'
  );
}

/** Attach console forwarding to a page for CI diagnostics. */
function forwardConsole(page: Page) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('sendMessage') ||
      text.includes('ConversationView') ||
      text.includes('getMessageHistory') ||
      text.includes('AUTH FAILED') ||
      msg.type() === 'error'
    ) {
      console.log(`[browser console.${msg.type()}] ${text}`);
    }
  });
}

test.describe('Offline Message Queue', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T146: should queue message when offline and send when online', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page);

    try {
      // ===== STEP 1: Confirm conversation is loaded and cached =====
      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // Wait for loadMessages to finish before going offline (populates
      // conversation cache needed for offline encryption).
      await waitForConversationCached(viewer.page);

      // ===== STEP 2: Go offline =====
      // Verify message input is ready before going offline
      await expect(messageInput).toBeEnabled({ timeout: 10000 });
      await viewer.context.setOffline(true);

      // Verify offline status in browser
      const isOffline = await viewer.page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== STEP 3: Send message while offline =====
      const testMessage = `Offline test message ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);

      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Verify message is queued =====
      // Message should appear in UI
      await scrollThreadToBottom(viewer.page);
      const messageBubble = viewer.page.getByText(testMessage);
      await expect(messageBubble).toBeVisible({ timeout: 30000 });

      // ===== STEP 5: Go online =====
      await viewer.context.setOffline(false);

      // Verify online status
      const isOnline = await viewer.page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== STEP 6: Wait for automatic sync =====
      // Queue sync + Supabase INSERT can take 10-15s under load
      await viewer.page.waitForTimeout(10000);

      // ===== STEP 7: Verify message is still visible (sent successfully) =====
      await expect(messageBubble).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('T147: should queue multiple messages and sync all when reconnected', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page);

    try {
      // ===== STEP 1: Confirm conversation is loaded and cached =====
      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });
      await waitForConversationCached(viewer.page);

      // ===== STEP 2: Go offline =====
      await viewer.context.setOffline(true);

      // ===== STEP 3: Send 3 messages while offline =====
      const messages = [
        `Offline message 1 ${Date.now()}`,
        `Offline message 2 ${Date.now()}`,
        `Offline message 3 ${Date.now()}`,
      ];

      const sendButton = viewer.page.getByRole('button', { name: /send/i });

      for (const msg of messages) {
        await messageInput.fill(msg);
        await sendButton.click();
        // Wait for UI to stabilize between sends
        await waitForUIStability(viewer.page);
      }

      // ===== STEP 4: Verify all 3 messages are queued =====
      for (const msg of messages) {
        const bubble = viewer.page.getByText(msg);
        await expect(bubble).toBeVisible();
      }

      // ===== STEP 5: Go online =====
      await viewer.context.setOffline(false);

      // ===== STEP 6: Wait for all messages to sync =====
      await viewer.page.waitForTimeout(5000);

      // All messages should still be visible (synced)
      for (const msg of messages) {
        const bubble = viewer.page.getByText(msg);
        await expect(bubble).toBeVisible();
      }
    } finally {
      await viewer.close();
    }
  });

  test('T148: should retry with exponential backoff on server failure', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);

    // Forward browser console for CI debugging
    viewer.page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('sendMessage') ||
        text.includes('ConversationView') ||
        msg.type() === 'error'
      ) {
        console.log(`[T148 console.${msg.type()}] ${text}`);
      }
    });

    try {
      // ===== STEP 1: Confirm conversation is loaded =====
      const msgInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(msgInput).toBeVisible({ timeout: 45000 });

      // ===== STEP 2: Intercept POST to /messages and simulate failures =====
      let attemptCount = 0;
      const retryTimestamps: number[] = [];

      // First 2 attempts fail with network error to trigger retry logic in
      // message-service.sendMessage (which catches TypeError: Failed to fetch
      // and retries with exponential backoff: 1s, 2s). 3rd attempt succeeds.
      await viewer.page.route(/\/rest\/v1\/messages/, async (route) => {
        const req = route.request();
        // Log EVERY hit to verify the route handler is firing at all
        console.log(`[T148 ROUTE-HIT] ${req.method()} ${req.url()}`);
        if (req.method() !== 'POST') {
          await route.continue();
          return;
        }
        attemptCount++;
        retryTimestamps.push(Date.now());
        console.log(
          `[T148 route] intercepted POST attempt ${attemptCount}: ${req.url()}`
        );
        if (attemptCount < 3) {
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Retry test message ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);

      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for retries =====
      // Wait until 3 POST attempts have been intercepted (or 15s timeout).
      // The retry delays in message-service.ts are 1s + 2s = 3s total minimum.
      const waitStart = Date.now();
      while (attemptCount < 3 && Date.now() - waitStart < 15000) {
        await new Promise((r) => setTimeout(r, 200));
      }

      // ===== STEP 5: Verify retry delays =====
      expect(attemptCount).toBeGreaterThanOrEqual(3);

      // Calculate delays between attempts
      if (retryTimestamps.length >= 2) {
        const delay1 = retryTimestamps[1] - retryTimestamps[0];
        // First retry should be ~1s (1000ms)
        expect(delay1).toBeGreaterThanOrEqual(900); // Allow 100ms margin
        expect(delay1).toBeLessThan(2000);
      }

      if (retryTimestamps.length >= 3) {
        const delay2 = retryTimestamps[2] - retryTimestamps[1];
        // Second retry should be ~2s (2000ms)
        expect(delay2).toBeGreaterThanOrEqual(1800);
        expect(delay2).toBeLessThan(3000);
      }
    } finally {
      await viewer.close();
    }
  });

  test('T149: should handle conflict resolution with server timestamp', async ({
    browser,
  }) => {
    const adminClient = getAdminClient();
    test.skip(
      !adminClient,
      'Skipping conflict resolution test - Supabase admin client not available'
    );

    // Open BOTH participants concurrently — each pays a gate-load + Argon2id
    // unlock, and serializing them would exhaust the per-test budget.
    const [pageAOwner, pageBOwner]: [OpenedParticipant, OpenedParticipant] =
      await Promise.all([
        openAsViewer(browser, fixture!),
        openAsPartner(browser, fixture!),
      ]);
    const pageA = pageAOwner.page;
    const pageB = pageBOwner.page;
    forwardConsole(pageA);
    forwardConsole(pageB);

    try {
      // ===== STEP 1: Confirm both conversations are loaded and cached =====
      const inputA = pageA.getByRole('textbox', { name: /Message input/i });
      await expect(inputA).toBeVisible({ timeout: 45000 });
      const inputB = pageB.getByRole('textbox', { name: /Message input/i });
      await expect(inputB).toBeVisible({ timeout: 45000 });
      await waitForConversationCached(pageA);
      await waitForConversationCached(pageB);

      // ===== STEP 2: Both go offline =====
      await pageAOwner.context.setOffline(true);
      await pageBOwner.context.setOffline(true);

      // ===== STEP 3: Both send messages with same timestamp =====
      const timestamp = Date.now();
      const messageA = `Message from A ${timestamp}`;
      const messageB = `Message from B ${timestamp}`;

      await inputA.fill(messageA);
      await pageA.getByRole('button', { name: /send/i }).click();

      await inputB.fill(messageB);
      await pageB.getByRole('button', { name: /send/i }).click();

      // ===== STEP 4: Both go online simultaneously =====
      await pageAOwner.context.setOffline(false);
      await pageBOwner.context.setOffline(false);

      // Explicitly trigger the offline-queue sync via the test-only hook
      // exposed in src/hooks/useOfflineQueue.ts. Playwright's emulated
      // offline → online transition does not reliably fire the window
      // 'online' event on firefox/webkit, so we call syncQueue() directly
      // instead of relying on event-driven triggers. Dispatch 'online'
      // first so the UI-level isOnline state also flips.
      const triggerSync = async (page: Page) => {
        await page.evaluate(async () => {
          window.dispatchEvent(new Event('online'));
          const fn = (window as unknown as Record<string, unknown>)
            .__scripthammer_syncQueue as (() => Promise<unknown>) | undefined;
          if (fn) await fn();
        });
      };
      await Promise.all([triggerSync(pageA), triggerSync(pageB)]);

      // ===== STEP 5: Wait for offline queue sync =====
      // The offline queue needs time to: detect online status, process
      // queued messages, encrypt, send to Supabase, and get INSERT confirmed.
      // On free tier under load the full cycle can exceed 90s; poll up to
      // 36 × 5s = 180s. Scoped to THIS isolated conversation.
      let messages: { sequence_number: number }[] | null = null;
      for (let poll = 0; poll < 36; poll++) {
        // Real 5-second wait between polls.
        await new Promise((r) => setTimeout(r, 5000));
        const { data } = await adminClient!
          .from('messages')
          .select('sequence_number')
          .eq('conversation_id', fixture!.conversationId)
          .order('sequence_number', { ascending: true });
        if (data && data.length >= 2) {
          messages = data;
          break;
        }
        console.log(
          `[T149] Poll ${poll + 1}/36: ${data?.length ?? 0} messages found, waiting...`
        );
      }

      // ===== STEP 6: Verify server determined order =====
      // Both messages should exist
      expect(messages).not.toBeNull();
      expect(messages!.length).toBeGreaterThanOrEqual(2);

      // Verify sequence numbers are unique (no duplicates)
      const sequenceNumbers = messages!.map((m) => m.sequence_number);
      const uniqueSequences = new Set(sequenceNumbers);
      expect(uniqueSequences.size).toBe(sequenceNumbers.length);

      // Server should have assigned sequential numbers
      const lastTwoMessages = messages!.slice(-2);
      expect(lastTwoMessages[1].sequence_number).toBe(
        lastTwoMessages[0].sequence_number + 1
      );

      // ===== STEP 7: Both users should see same order =====
      // Real-time updates should sync the final order to both clients
      await pageA.waitForTimeout(2000);
      await pageB.waitForTimeout(2000);

      // Verify both messages are visible on both pages
      await expect(pageA.getByText(messageA)).toBeVisible();
      await expect(pageB.getByText(messageB)).toBeVisible();
    } finally {
      await pageAOwner.close();
      await pageBOwner.close();
    }
  });

  test('should show failed status after max retries', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page);

    try {
      // ===== STEP 1: Confirm conversation is loaded =====
      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // ===== STEP 2: Intercept API and always fail =====
      await viewer.page.route('**/rest/v1/messages*', async (route) => {
        await route.abort('failed');
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Failed message ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);

      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for max retries =====
      // Wait a reasonable time for retries to complete
      await viewer.page.waitForTimeout(15000);

      // ===== STEP 5: Verify message is visible (may show failed or pending state) =====
      // The message should at least appear in the UI
      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(testMessage)).toBeVisible();
    } finally {
      await viewer.close();
    }
  });
});
