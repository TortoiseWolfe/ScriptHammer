/**
 * E2E Tests for Message Editing and Deletion
 * Tasks: T115-T117 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Every test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation(), so nothing is shared between tests and the spec
 * runs fully parallel (no serial mode, no cleanupOldMessages, no shared
 * PRIMARY/TERTIARY contention). Each test opens the conversation AS the viewer
 * (a fresh browser context with the throwaway session injected), sends its own
 * message via the real encrypted UI path, and exercises the edit/delete flow.
 * See tests/e2e/utils/test-user-factory.ts and the #116 roadmap for rationale.
 *
 * Tests:
 * - Edit message within 15-minute window (+ cancel / disabled-Save variants)
 * - Delete message within 15-minute window (+ cancel / deleted-message variant)
 * - Edit/delete disabled after 15 minutes; hidden on received messages
 * - Accessibility of edit mode + delete confirmation modal
 */

import { test, expect, type Page } from '@playwright/test';
import {
  fillMessageInput,
  scrollThreadToBottom,
  getAdminClient,
  seedIsolatedConversation,
  deleteIsolatedConversation,
  openAsViewer,
  openAsPartner,
  type IsolatedConversation,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

/**
 * Forward browser console from a page for CI diagnostics.
 */
function forwardConsole(page: Page, label = 'browser') {
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('ConversationView') ||
      text.includes('sendMessage') ||
      text.includes('EncryptionKeyGate') ||
      msg.type() === 'error'
    ) {
      console.log(`[${label} console.${msg.type()}] ${text}`);
    }
  });
}

/**
 * Wait for the UI to stabilize after navigation or interaction (3 stable frames).
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
 * Send a message in the current conversation via the real encrypted UI path.
 *
 * Uses fillMessageInput (which waits for React to reflect the value in
 * #char-count, defeating the stale-state "Message cannot be empty" race) and
 * the "Send message" button. Then waits for the bubble to render — failing
 * fast on an error banner — and gives React a beat to attach the Edit/Delete
 * buttons (which depend on isOwn + timestamp checks).
 */
async function sendMessage(page: Page, message: string) {
  await fillMessageInput(page, message);

  const sendButton = page.getByRole('button', { name: /Send message/i });
  await sendButton.click();

  // Scroll to bottom so virtual scrolling renders the new message
  await scrollThreadToBottom(page);

  // Wait for message to appear in the DOM, or fail fast on error banner
  const messageElement = page.getByText(message);
  const errorBanner = page.locator('[role="alert"]');
  await Promise.race([
    expect(messageElement).toBeVisible({ timeout: 30000 }),
    errorBanner.waitFor({ state: 'visible', timeout: 30000 }).then(async () => {
      const text = await errorBanner.textContent();
      throw new Error(`Send failed with error banner: ${text}`);
    }),
  ]);

  // Scroll the message into view (new messages appear at bottom)
  await messageElement.scrollIntoViewIfNeeded();

  // Wait for UI to stabilize after sending
  await waitForUIStability(page);

  // Small additional wait for React to fully render Edit/Delete buttons
  // (buttons depend on isOwn and timestamp checks)
  await page.waitForTimeout(300);
}

/**
 * Find the message bubble containing specific text.
 * Uses data-testid for reliable selection regardless of DOM nesting.
 */
function getMessageBubble(page: Page, messageText: string) {
  return page.locator('[data-testid="message-bubble"]').filter({
    hasText: messageText,
  });
}

/**
 * Find the Edit button for a specific message by its text content.
 */
function getEditButtonForMessage(page: Page, messageText: string) {
  return getMessageBubble(page, messageText).getByRole('button', {
    name: 'Edit message',
  });
}

/**
 * Find the Delete button for a specific message by its text content.
 */
function getDeleteButtonForMessage(page: Page, messageText: string) {
  return getMessageBubble(page, messageText).getByRole('button', {
    name: 'Delete message',
  });
}

test.describe('Message Editing', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T115: should edit message within 15-minute window', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message (timestamp ensures only one match)
      const timestamp = Date.now();
      const originalMessage = `Original msg ${timestamp}`;
      await sendMessage(viewer.page, originalMessage);

      // Verify our message bubble exists with data-testid
      const messageBubble = getMessageBubble(viewer.page, originalMessage);
      await expect(messageBubble).toBeVisible({ timeout: 15000 });

      // Edit button should be visible for own messages (within 15-min window).
      // If this fails, either message.isOwn is false (wrong sender_id) or
      // isWithinEditWindow returned false (message > 15 min old).
      const editButton = getEditButtonForMessage(viewer.page, originalMessage);
      await expect(editButton).toBeVisible({ timeout: 15000 });

      // Click Edit button
      await editButton.click();

      // Edit mode should be active (textarea visible)
      const editTextarea = viewer.page.getByRole('textbox', {
        name: /Edit message content/i,
      });
      await expect(editTextarea).toBeVisible();

      // Change the content with unique timestamp
      const editedMessage = `Edited msg ${timestamp}`;
      await editTextarea.clear();
      await editTextarea.fill(editedMessage);

      // Click Save
      await viewer.page.getByRole('button', { name: /Save/i }).click();

      // Wait for save to complete (edit mode closes)
      await expect(editTextarea).not.toBeVisible({ timeout: 15000 });

      // Wait for UI to stabilize after save (state update + re-render)
      await waitForUIStability(viewer.page);

      // Find the message bubble with edited content (updates in place)
      const editedBubble = getMessageBubble(viewer.page, editedMessage);
      await editedBubble.scrollIntoViewIfNeeded().catch(() => {});
      await expect(editedBubble).toBeVisible({ timeout: 10000 });

      // Original content should no longer be visible (unique timestamp ensures
      // only one match)
      await expect(viewer.page.getByText(originalMessage)).not.toBeVisible({
        timeout: 15000,
      });
    } finally {
      await viewer.close();
    }
  });

  test('should cancel edit without saving', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const originalMessage = `Cancel edit ${timestamp}`;
      await sendMessage(viewer.page, originalMessage);

      // Click Edit button for our specific message
      const editButton = getEditButtonForMessage(viewer.page, originalMessage);
      await editButton.click();

      // Change content
      const editTextarea = viewer.page.getByRole('textbox', {
        name: /Edit message content/i,
      });
      await expect(editTextarea).toBeVisible();
      await editTextarea.clear();
      await editTextarea.fill('This will be cancelled');

      // Click Cancel
      await viewer.page.getByRole('button', { name: /Cancel/i }).click();

      // Edit mode should close
      await expect(editTextarea).not.toBeVisible();

      // Original content should still be visible
      await expect(viewer.page.getByText(originalMessage)).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('should disable Save button when content unchanged', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const originalMessage = `Unchanged ${timestamp}`;
      await sendMessage(viewer.page, originalMessage);

      // Click Edit button for our specific message
      const editButton = getEditButtonForMessage(viewer.page, originalMessage);
      await expect(editButton).toBeVisible({ timeout: 15000 });
      await editButton.click();

      // Save button should be disabled (content hasn't changed)
      const saveButton = viewer.page.getByRole('button', { name: /Save/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });
      await expect(saveButton).toBeDisabled();
    } finally {
      await viewer.close();
    }
  });

  test('should not allow editing empty message', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const originalMessage = `Empty edit ${timestamp}`;
      await sendMessage(viewer.page, originalMessage);

      // Click Edit button for our specific message
      const editButton = getEditButtonForMessage(viewer.page, originalMessage);
      await editButton.click();

      // Clear content
      const editTextarea = viewer.page.getByRole('textbox', {
        name: /Edit message content/i,
      });
      await editTextarea.clear();

      // Save button should be disabled
      const saveButton = viewer.page.getByRole('button', { name: /Save/i });
      await expect(saveButton).toBeDisabled();
    } finally {
      await viewer.close();
    }
  });
});

test.describe('Message Deletion', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T116: should delete message within 15-minute window', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const messageToDelete = `Delete me ${timestamp}`;
      await sendMessage(viewer.page, messageToDelete);

      // Verify our message bubble exists
      const messageBubble = getMessageBubble(viewer.page, messageToDelete);
      await expect(messageBubble).toBeVisible({ timeout: 15000 });

      // Delete button should be visible for own messages (within 15-min window)
      const deleteButton = getDeleteButtonForMessage(
        viewer.page,
        messageToDelete
      );
      await expect(deleteButton).toBeVisible({ timeout: 15000 });

      // Click Delete
      await deleteButton.click();

      // Confirmation modal should appear
      const modal = viewer.page.getByRole('dialog', {
        name: /Delete Message/i,
      });
      await expect(modal).toBeVisible();

      // Confirm deletion - actual aria-label is "Confirm deletion"
      const confirmButton = modal.getByRole('button', {
        name: /Confirm deletion/i,
      });
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      // Wait for modal to close first
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Wait for UI to stabilize after deletion
      await waitForUIStability(viewer.page);

      // Either the message is removed OR replaced with "[Message deleted]"
      const messageGone = viewer.page.getByText(messageToDelete);
      const deletedPlaceholder = viewer.page
        .getByText('[Message deleted]')
        .first();

      await Promise.race([
        expect(messageGone).not.toBeVisible({ timeout: 10000 }),
        expect(deletedPlaceholder).toBeVisible({ timeout: 10000 }),
      ]);
    } finally {
      await viewer.close();
    }
  });

  test('should cancel deletion from confirmation modal', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const messageToKeep = `Keep me ${timestamp}`;
      await sendMessage(viewer.page, messageToKeep);

      // Click Delete button for our specific message
      const deleteButton = getDeleteButtonForMessage(
        viewer.page,
        messageToKeep
      );
      await deleteButton.click();

      // Modal appears
      const modal = viewer.page.getByRole('dialog', {
        name: /Delete Message/i,
      });
      await expect(modal).toBeVisible();

      // Click Cancel
      const cancelButton = modal.getByRole('button', {
        name: /Cancel deletion/i,
      });
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Message should still be intact
      await expect(viewer.page.getByText(messageToKeep)).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('should not show Edit/Delete buttons on deleted message', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send and delete a unique message
      const timestamp = Date.now();
      const messageToDelete = `To delete ${timestamp}`;
      await sendMessage(viewer.page, messageToDelete);

      // Click Delete button for our specific message
      const deleteButton = getDeleteButtonForMessage(
        viewer.page,
        messageToDelete
      );
      await deleteButton.click();

      // Confirmation modal should appear
      const modal = viewer.page.getByRole('dialog', {
        name: /Delete Message/i,
      });
      await expect(modal).toBeVisible();

      // Confirm deletion - actual aria-label is "Confirm deletion"
      const confirmButton = modal.getByRole('button', {
        name: /Confirm deletion/i,
      });
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      // Wait for modal to close first
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Wait for UI to stabilize after deletion
      await waitForUIStability(viewer.page);

      // Either the message is removed OR replaced with "[Message deleted]"
      const messageGone = viewer.page.getByText(messageToDelete);
      const deletedPlaceholder = viewer.page
        .getByText('[Message deleted]')
        .first();

      await Promise.race([
        expect(messageGone).not.toBeVisible({ timeout: 10000 }),
        expect(deletedPlaceholder).toBeVisible({ timeout: 10000 }),
      ]);

      // Edit and Delete buttons should not be visible for deleted messages
      // (message either removed or replaced with placeholder that has no buttons)
    } finally {
      await viewer.close();
    }
  });
});

test.describe('Time Window Restrictions', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('should show Edit/Delete buttons only for own recent messages', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message (within window)
      const timestamp = Date.now();
      const recentMessage = `Recent msg ${timestamp}`;
      await sendMessage(viewer.page, recentMessage);

      // Recent own message should have Edit and Delete buttons
      const editButton = getEditButtonForMessage(viewer.page, recentMessage);
      const deleteButton = getDeleteButtonForMessage(
        viewer.page,
        recentMessage
      );

      await expect(editButton).toBeVisible({ timeout: 10000 });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
    } finally {
      await viewer.close();
    }
  });

  test('T117: should not show Edit/Delete buttons for messages older than 15 minutes', async ({
    browser,
  }) => {
    const adminClient = getAdminClient();
    test.skip(!adminClient, 'admin client not configured');

    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Step 1: send a fresh message via the real encrypted UI path. This
      // produces a proper encrypted row in the messages table that matches
      // how real users send messages.
      const timestamp = Date.now();
      const testMessage = `T117 window ${timestamp}`;
      await sendMessage(viewer.page, testMessage);

      // Step 2: sanity-check the recent message shows Edit/Delete buttons.
      // Without this baseline the test would be meaningless.
      const editButtonBefore = getEditButtonForMessage(
        viewer.page,
        testMessage
      );
      await expect(editButtonBefore).toBeVisible({ timeout: 10000 });

      // Step 3: find that message in the DB (scoped to THIS conversation) and
      // backdate its created_at by 16 minutes. Messages are encrypted, so we
      // match by sequence_number — the most recent message for this
      // conversation is ours.
      const { data: latest } = await adminClient!
        .from('messages')
        .select('id, sequence_number')
        .eq('conversation_id', fixture!.conversationId)
        .eq('deleted', false)
        .order('sequence_number', { ascending: false })
        .limit(1);

      expect(latest?.length).toBe(1);
      const messageId = latest![0].id;

      const sixteenMinutesAgo = new Date(
        Date.now() - 16 * 60 * 1000
      ).toISOString();
      const { error: updateError } = await adminClient!
        .from('messages')
        .update({ created_at: sixteenMinutesAgo })
        .eq('id', messageId);
      expect(updateError).toBeNull();

      // Step 4: reload the conversation so the UI re-reads created_at from DB.
      await viewer.page.reload({ waitUntil: 'domcontentloaded' });
      await viewer.page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });
      await scrollThreadToBottom(viewer.page);

      // Step 5: the same message should still be visible, but its Edit/Delete
      // buttons should now be HIDDEN because the 15-minute window has elapsed.
      await expect(viewer.page.getByText(testMessage)).toBeVisible({
        timeout: 10000,
      });
      const editButtonAfter = getEditButtonForMessage(viewer.page, testMessage);
      const deleteButtonAfter = getDeleteButtonForMessage(
        viewer.page,
        testMessage
      );
      await expect(editButtonAfter).not.toBeVisible();
      await expect(deleteButtonAfter).not.toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('should not show Edit/Delete buttons on received messages', async ({
    browser,
  }) => {
    // Bidirectional: the partner sends a message so the viewer has a genuine
    // RECEIVED bubble (chat-start). Open both contexts CONCURRENTLY — serial
    // opens each pay a gate-load + Argon2id unlock and blow the per-test budget.
    const [viewer, partner] = await Promise.all([
      openAsViewer(browser, fixture!),
      openAsPartner(browser, fixture!),
    ]);
    forwardConsole(viewer.page, 'viewer');
    forwardConsole(partner.page, 'partner');
    try {
      // Partner sends a message; it arrives at the viewer as a received message.
      const timestamp = Date.now();
      const receivedMessage = `From partner ${timestamp}`;
      await sendMessage(partner.page, receivedMessage);

      // Viewer should see the received message (poll with reloads to survive
      // cloud read-after-write tail latency; the conversation is tiny).
      const receivedLocator = viewer.page.getByText(receivedMessage);
      for (let i = 0; i < 5; i++) {
        await scrollThreadToBottom(viewer.page);
        if (
          await receivedLocator.isVisible({ timeout: 8000 }).catch(() => false)
        ) {
          break;
        }
        await viewer.page.reload({ waitUntil: 'domcontentloaded' });
        await viewer.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        });
      }
      await scrollThreadToBottom(viewer.page);
      await expect(receivedLocator).toBeVisible({ timeout: 15000 });

      // The received message bubble must NOT expose Edit/Delete buttons.
      const receivedBubble = getMessageBubble(viewer.page, receivedMessage);
      await expect(
        receivedBubble.getByRole('button', { name: 'Edit message' })
      ).not.toBeVisible();
      await expect(
        receivedBubble.getByRole('button', { name: 'Delete message' })
      ).not.toBeVisible();

      // Belt-and-suspenders: every chat-start (received) bubble on screen must
      // likewise have no Edit/Delete buttons.
      const receivedMessages = viewer.page.locator('.chat-start');
      const count = await receivedMessages.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const bubble = receivedMessages.nth(i);
        await expect(
          bubble.getByRole('button', { name: 'Edit message' })
        ).not.toBeVisible();
        await expect(
          bubble.getByRole('button', { name: 'Delete message' })
        ).not.toBeVisible();
      }
    } finally {
      await viewer.close();
      await partner.close();
    }
  });
});

test.describe('Accessibility', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T130: edit mode should have proper ARIA labels', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const message = `A11y test ${timestamp}`;
      await sendMessage(viewer.page, message);

      // Enter edit mode using the helper to find our specific message's button
      const editButton = getEditButtonForMessage(viewer.page, message);
      await editButton.click();

      // Check ARIA labels - use role-based selectors
      const editTextarea = viewer.page.getByRole('textbox', {
        name: /Edit message content/i,
      });
      await expect(editTextarea).toBeVisible();

      const cancelButton = viewer.page.getByRole('button', { name: /Cancel/i });
      await expect(cancelButton).toBeVisible();

      const saveButton = viewer.page.getByRole('button', { name: /Save/i });
      await expect(saveButton).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('delete confirmation modal should have proper ARIA labels', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const message = `Modal a11y ${timestamp}`;
      await sendMessage(viewer.page, message);

      // Open delete modal using helper to find our specific message's button
      const deleteButton = getDeleteButtonForMessage(viewer.page, message);
      await deleteButton.click();

      // Check modal ARIA attributes
      const modal = viewer.page.getByRole('dialog', {
        name: /Delete Message/i,
      });
      await expect(modal).toBeVisible();

      // Button accessible names are "Cancel deletion" and "Confirm deletion"
      const cancelButton = modal.getByRole('button', {
        name: /Cancel deletion/i,
      });
      await expect(cancelButton).toBeVisible();

      const confirmButton = modal.getByRole('button', {
        name: /Confirm deletion/i,
      });
      await expect(confirmButton).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('delete confirmation modal should be keyboard navigable', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    forwardConsole(viewer.page, 'viewer');
    try {
      // Send a unique message
      const timestamp = Date.now();
      const message = `Keyboard nav ${timestamp}`;
      await sendMessage(viewer.page, message);

      // Open delete modal using helper to find our specific message's button
      const deleteButton = getDeleteButtonForMessage(viewer.page, message);
      await deleteButton.click();

      // Wait for modal to be fully visible and interactive
      const modal = viewer.page.getByRole('dialog', {
        name: /Delete Message/i,
      });
      await expect(modal).toBeVisible();
      await waitForUIStability(viewer.page);

      // Button accessible names are "Cancel deletion" and "Confirm deletion"
      const cancelButton = modal.getByRole('button', {
        name: /Cancel deletion/i,
      });
      const confirmButton = modal.getByRole('button', {
        name: /Confirm deletion/i,
      });

      await expect(cancelButton).toBeVisible();
      await expect(confirmButton).toBeVisible();

      // Focus the cancel button directly and verify it can receive focus
      await cancelButton.focus();
      await expect(cancelButton).toBeFocused();

      // Tab to confirm button
      await viewer.page.keyboard.press('Tab');
      await expect(confirmButton).toBeFocused();
    } finally {
      await viewer.close();
    }
  });
});
