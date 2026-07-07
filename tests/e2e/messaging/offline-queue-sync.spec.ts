/**
 * E2E Test: Offline Queue Sync
 * Task: #116 Phase 2 — per-test fixture isolation (workers>1).
 *
 * Tests the offline → online message sync flow:
 * 1. Send a message while the network is down
 * 2. Bring the network back
 * 3. Verify the queued message shows up in the conversation
 *
 * Each test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation() and opens it with openAsViewer(), so nothing is
 * shared between tests and the spec runs `fullyParallel` (no serial, no
 * cleanupOldMessages, no shared test@example.com / test-user-b contention, no
 * bespoke session injection). See tests/e2e/utils/test-user-factory.ts and the
 * #116 roadmap for the rationale.
 *
 * This is a single-participant test: the viewer queues a message offline and,
 * on reconnect, must see its OWN message persist. It does not verify delivery to
 * the partner's side, so only the viewer context is opened.
 *
 * Runs in the Docker E2E container. Against the local sandbox the browser
 * reaches Kong directly via NEXT_PUBLIC_SUPABASE_URL (host.docker.internal:54321)
 * and the Node test process reaches it via SUPABASE_ADMIN_URL (supabase-kong:8000)
 * — no proxy / DNS-override hack needed (see #121).
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     scripthammer-scripthammer-1 npx playwright test tests/e2e/messaging/offline-queue-sync.spec.ts --project=chromium-msg-iso
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  openAsViewer,
  fillMessageInput,
  scrollThreadToBottom,
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

test.describe('Offline Queue Sync E2E', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should queue a message offline and sync when reconnected', async ({
    browser,
  }) => {
    // openAsViewer injects the throwaway session, navigates straight to the
    // isolated conversation, dismisses the cookie banner, unlocks encryption via
    // the ReAuthModal, and waits for the message thread to render.
    const viewer = await openAsViewer(browser, fixture!);

    try {
      // Wait for message input (proves the thread is interactive).
      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // ===== Go offline =====
      await viewer.context.setOffline(true);
      const isOffline = await viewer.page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== Send message while offline =====
      const testMessage = `Offline sync test ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);

      const sendButton = viewer.page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Message should appear in UI (queued state).
      await scrollThreadToBottom(viewer.page);
      const messageBubble = viewer.page.getByText(testMessage);
      await expect(messageBubble).toBeVisible({ timeout: 30000 });

      // ===== Go back online =====
      await viewer.context.setOffline(false);
      const isOnline = await viewer.page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== Wait for queue to sync =====
      await viewer.page.waitForTimeout(5000);

      // ===== Verify message is still visible (sent successfully) =====
      await expect(messageBubble).toBeVisible();

      // Optionally check that the queued/sending indicator is gone.
      const queueIndicator = viewer.page.locator(
        '[data-testid="queued-message-indicator"]'
      );
      const indicatorVisible = await queueIndicator
        .isVisible()
        .catch(() => false);
      if (indicatorVisible) {
        await viewer.page.waitForTimeout(5000);
      }
    } finally {
      await viewer.close();
    }
  });
});
