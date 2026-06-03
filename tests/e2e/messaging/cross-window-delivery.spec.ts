/**
 * E2E Regression Test for Cross-Window Message Delivery (#57)
 *
 * History: this issue was originally framed as "Supabase Realtime handshake
 * race — page2's subscribe ack arrives after page1's INSERT broadcast, the
 * event is dropped." That framing was wrong. Investigation on PR #65 showed
 * the production app does NOT subscribe to Supabase Realtime at all —
 * `useConversationRealtime` and `realtimeService.subscribeToMessages` were
 * vestigial dead code that nothing rendered. The "9 rounds of mitigation"
 * mentioned in past handoff docs were progressive reverts of realtime usage
 * in favor of polling.
 *
 * The actual mechanism: ConversationView (`src/components/organisms/...`)
 * fetches via messageService.getMessageHistory() on mount, and a 10s polling
 * effect re-fetches while the tab is visible. Cross-window delivery latency
 * is bounded by the poll interval, not by realtime broadcast speed.
 *
 * What this test exercises:
 *   1. viewer sends a message via the UI
 *   2. partner (already mounted on the same conversation) waits passively
 *   3. The polling effect on partner re-fetches messages within ~10s and the
 *      new message renders
 *
 * Failure modes this test catches:
 *   - Polling effect removed or broken (partner stays stale forever)
 *   - getMessageHistory regression (auth/RLS/decryption broken)
 *   - ConversationView doesn't re-render when messages array changes
 *
 * #116 Phase 2: per-test fixture isolation. Each test seeds its OWN throwaway
 * viewer + partner + conversation via seedIsolatedConversation(), so nothing is
 * shared between tests. This removes the shared PRIMARY/TERTIARY data race that
 * forced serial mode + cleanupOldMessages, and lets the spec run in parallel.
 * Both browser contexts are opened concurrently with Promise.all so the per-test
 * budget isn't eaten by two serialized Argon2id ReAuth unlocks. See
 * tests/e2e/utils/test-user-factory.ts and the #116 roadmap for rationale.
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  openAsViewer,
  openAsPartner,
  fillMessageInput,
  scrollThreadToBottom,
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

test.describe('Cross-Window Message Delivery (#57 regression)', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('partner receives a message viewer sends, via the polling effect', async ({
    browser,
  }) => {
    // Open both contexts concurrently. openAsViewer/openAsPartner each inject a
    // throwaway session, navigate to /messages?conversation=<id>, handle the
    // ReAuthModal, and wait for [data-testid="message-thread"] to mount.
    // ConversationView's mount effect on the partner page calls loadMessages()
    // and starts the 10s polling interval that drives this test.
    const [viewer, partner] = await Promise.all([
      openAsViewer(browser, fixture!),
      openAsPartner(browser, fixture!),
    ]);

    try {
      // viewer sends. The new row is INSERTed; partner's polling effect will
      // re-fetch on its next tick (~10s) and the message will render.
      const testMessage = `Cross-window delivery test ${Date.now()}`;
      await fillMessageInput(viewer.page, testMessage);
      await viewer.page.getByRole('button', { name: /send/i }).click();

      // Assert the message arrives on partner within 30s. Polling tick is 10s;
      // the budget covers one missed tick + tail latency on Supabase free tier
      // under shard load. If this fails, polling is broken or getMessageHistory
      // regressed.
      await scrollThreadToBottom(partner.page);
      await expect(partner.page.getByText(testMessage)).toBeVisible({
        timeout: 30_000,
      });

      // Sanity: also visible to the sender (optimistic UI).
      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(testMessage)).toBeVisible();
    } finally {
      await viewer.close();
      await partner.close();
    }
  });
});
