/**
 * E2E Test: Message Delete Placeholder
 * Task: #116 Phase 2 — per-test fixture isolation (workers>1).
 *
 * Verifies that a soft-deleted message renders a "[Message deleted]" placeholder
 * instead of disappearing. Adjacent messages must remain visible and in order
 * so the sequence gap is preserved — and the placeholder must render for BOTH
 * the message author (viewer) and the other participant (partner).
 *
 * Every test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation(), so nothing is shared between tests. That removes
 * the cross-shard `messages.delete()` race the previous version fought with
 * created_at filters, service-worker cache busting, and serial mode — the
 * soft-delete can now go straight through the admin client, scoped to THIS
 * conversation. See tests/e2e/utils/test-user-factory.ts and the #116 roadmap.
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
 * Reload the conversation and poll for the `[Message deleted]` placeholder.
 *
 * ConversationView polls loadMessages() (~10s) but a reload forces a fresh
 * fetch immediately. Each isolated conversation is tiny so this converges fast.
 */
async function waitForDeletedPlaceholder(
  page: import('@playwright/test').Page,
  attempts = 5
): Promise<void> {
  const placeholder = page.getByText('[Message deleted]');
  for (let i = 0; i < attempts; i++) {
    await scrollThreadToBottom(page);
    if (await placeholder.isVisible({ timeout: 12000 }).catch(() => false))
      return;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 30000,
    });
  }
  // Final assertion — surfaces a real failure if it never rendered.
  await scrollThreadToBottom(page);
  await expect(placeholder).toBeVisible({ timeout: 30000 });
}

test.describe('Message Delete Placeholder E2E', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should show [Message deleted] placeholder and preserve adjacent messages', async ({
    browser,
  }) => {
    const adminClient = getAdminClient();
    test.skip(!adminClient, 'admin client not configured');

    // Open BOTH participants concurrently — each pays a gate-load + Argon2id
    // unlock, and serializing them nearly exhausts the per-test budget. The
    // viewer authors the 3 messages; the partner verifies the placeholder
    // renders cross-user (not just for the author).
    const [viewer, partner] = await Promise.all([
      openAsViewer(browser, fixture!),
      openAsPartner(browser, fixture!),
    ]);

    try {
      const ts = Date.now();
      const msg1 = `msg-1-${ts}`;
      const msg2 = `msg-2-${ts}`;
      const msg3 = `msg-3-${ts}`;

      // Send 3 messages from the viewer, waiting for the input to clear between
      // each (confirms the send handler fired) so they keep their order.
      for (const msg of [msg1, msg2, msg3]) {
        await fillMessageInput(viewer.page, msg);
        await viewer.page
          .getByRole('button', { name: /Send message/i })
          .click();
        await expect(
          viewer.page.getByRole('textbox', { name: /Message input/i })
        ).toHaveValue('', { timeout: 15000 });
      }

      // Wait for all 3 messages to land in the DB before mutating any of them.
      // The optimistic UI render can precede the Supabase INSERT commit; poll
      // the admin query (scoped to THIS conversation) until all 3 rows exist.
      let ourMsgs: { id: string; sequence_number: number }[] = [];
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const { data } = await adminClient!
          .from('messages')
          .select('id, sequence_number')
          .eq('conversation_id', fixture!.conversationId)
          .eq('deleted', false)
          .order('sequence_number', { ascending: true });
        ourMsgs = data ?? [];
        if (ourMsgs.length >= 3) break;
        await viewer.page.waitForTimeout(500);
      }
      expect(ourMsgs.length).toBe(3);

      // All 3 should be visible on the viewer before we delete one.
      await scrollThreadToBottom(viewer.page);
      await expect(viewer.page.getByText(msg1)).toBeVisible({ timeout: 15000 });
      await expect(viewer.page.getByText(msg2)).toBeVisible({ timeout: 15000 });
      await expect(viewer.page.getByText(msg3)).toBeVisible({ timeout: 15000 });

      // --- Soft-delete the MIDDLE message via the admin client ---
      // Messages are encrypted so we can't query by content; identify the
      // middle one by sequence_number order within THIS conversation. With
      // per-test isolation nothing else writes to this conversation, so a plain
      // admin PATCH is safe (no cross-shard race to guard against).
      const middleMessageId = ourMsgs[1].id;
      const { error: deleteError } = await adminClient!
        .from('messages')
        .update({ deleted: true })
        .eq('id', middleMessageId)
        .eq('conversation_id', fixture!.conversationId);
      expect(deleteError).toBeNull();

      // ===== Author (viewer) sees the placeholder where msg-2 was =====
      await waitForDeletedPlaceholder(viewer.page);

      // Original msg-2 text must be gone.
      await expect(viewer.page.getByText(msg2)).not.toBeVisible({
        timeout: 15000,
      });

      // Adjacent messages must still be visible.
      await expect(viewer.page.getByText(msg1)).toBeVisible();
      await expect(viewer.page.getByText(msg3)).toBeVisible();

      // Verify sequence integrity: collect all message bubbles in DOM order and
      // confirm msg-1, [Message deleted], msg-3 appear in that order.
      const allBubbles = viewer.page.locator('[data-testid="message-bubble"]');
      const count = await allBubbles.count();
      const bubbleTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        bubbleTexts.push(await allBubbles.nth(i).innerText());
      }

      const idx1 = bubbleTexts.findIndex((t) => t.includes(msg1));
      const idxDel = bubbleTexts.findIndex((t) =>
        t.includes('[Message deleted]')
      );
      const idx3 = bubbleTexts.findIndex((t) => t.includes(msg3));

      expect(idx1).toBeGreaterThanOrEqual(0);
      expect(idxDel).toBeGreaterThanOrEqual(0);
      expect(idx3).toBeGreaterThanOrEqual(0);

      // In a chat UI messages render top-to-bottom chronologically.
      // msg-1 precedes the placeholder, which precedes msg-3.
      expect(idx1).toBeLessThan(idxDel);
      expect(idxDel).toBeLessThan(idx3);

      // ===== Partner (other participant) ALSO sees the placeholder =====
      // The soft-delete must hide the content for both sides, not just the
      // author. Reload the partner's thread and confirm the same placeholder.
      await waitForDeletedPlaceholder(partner.page);
      await expect(partner.page.getByText(msg2)).not.toBeVisible({
        timeout: 15000,
      });
      await expect(partner.page.getByText(msg1)).toBeVisible();
      await expect(partner.page.getByText(msg3)).toBeVisible();
    } finally {
      await viewer.close();
      await partner.close();
    }
  });
});
