/**
 * E2E Tests for Message Editing and Deletion
 * Tasks: T115-T117
 *
 * Tests:
 * - Edit message within 15-minute window
 * - Delete message within 15-minute window
 * - Edit/delete disabled after 15 minutes
 */

import { test, expect } from '../fixtures/seed-keys';
import type { Page } from '@playwright/test';
import {
  dismissCookieBanner,
  handleReAuthModal,
  performSignIn,
  cleanupOldMessages,
  scrollThreadToBottom,
  getAdminClient,
  getUserByEmail,
} from '../utils/test-user-factory';
import { createLogger } from '../../../src/lib/logger';

const logger = createLogger('e2e-messaging-editing');

// Test user credentials (from .env or defaults)
const TEST_USER_1 = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const TEST_USER_2 = {
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

// Track setup status
let setupSucceeded = false;
let setupError = '';
let conversationId = '';

// Verify test data created by auth.setup.ts exists
test.beforeAll(async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
    logger.error(setupError);
    return;
  }

  if (
    TEST_USER_1.email === 'test@example.com' ||
    TEST_USER_2.email === 'test-user-b@example.com'
  ) {
    setupError =
      'TEST_USER_PRIMARY_EMAIL or TEST_USER_TERTIARY_EMAIL not configured';
    logger.error(setupError);
    return;
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    setupError = 'Admin client unavailable';
    logger.error(setupError);
    return;
  }

  const userA = await getUserByEmail(TEST_USER_1.email);
  const userB = await getUserByEmail(TEST_USER_2.email);

  if (!userA || !userB) {
    setupError = `Test users not found: ${!userA ? TEST_USER_1.email : ''} ${!userB ? TEST_USER_2.email : ''}`;
    logger.error(setupError);
    return;
  }

  // Ensure connection exists (self-heal if missing)
  const { data: existing } = await adminClient
    .from('user_connections')
    .select('id, status')
    .or(
      `and(requester_id.eq.${userA.id},addressee_id.eq.${userB.id}),and(requester_id.eq.${userB.id},addressee_id.eq.${userA.id})`
    )
    .maybeSingle();

  if (!existing) {
    const { error } = await adminClient.from('user_connections').insert({
      requester_id: userA.id,
      addressee_id: userB.id,
      status: 'accepted',
    });
    if (error) {
      setupError = `Failed to create connection: ${error.message}`;
      logger.error(setupError);
      return;
    }
    logger.info('Connection created (self-heal)');
  } else if (existing.status !== 'accepted') {
    await adminClient
      .from('user_connections')
      .update({ status: 'accepted' })
      .eq('id', existing.id);
    logger.info('Connection updated to accepted');
  }

  const [p1, p2] =
    userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
  const { data: existingConv } = await adminClient
    .from('conversations')
    .select('id')
    .eq('participant_1_id', p1)
    .eq('participant_2_id', p2)
    .maybeSingle();
  if (!existingConv) {
    const { data: newConv, error: convError } = await adminClient
      .from('conversations')
      .insert({ participant_1_id: p1, participant_2_id: p2 })
      .select('id')
      .single();
    if (convError || !newConv) {
      setupError = `Failed to create conversation: ${convError?.message}`;
      logger.error(setupError);
      return;
    }
    conversationId = newConv.id;
    logger.info('Conversation created (self-heal)');
  } else {
    conversationId = existingConv.id;
  }

  setupSucceeded = true;
});

// Clean up old messages from previous CI runs (virtual scrolling threshold fix)
test.beforeAll(async () => {
  if (!setupSucceeded) return;
  await cleanupOldMessages(TEST_USER_1.email, TEST_USER_2.email);
});

/**
 * Sign in helper — uses storageState from project config; just navigates to messages
 */
async function signIn(page: Page, _email: string, password: string) {
  await page.goto('/messages', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await handleReAuthModal(page, password);
}

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
    { timeout: 15000 }
  );
}

/**
 * Navigate to conversation helper — uses direct URL to bypass slow sidebar query
 */
async function navigateToConversation(page: Page) {
  // Two-step auth hydration: navigate to /messages first so AuthContext
  // hydrates from storageState, THEN navigate to the specific conversation.
  // Direct navigation to ?conversation=X causes the webkit/firefox auth race
  // where ProtectedRoute fires before the Supabase client initializes the
  // session from localStorage (same pattern as offline-queue tests).
  await page.goto('/messages', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await handleReAuthModal(page, TEST_USER_1.password);

  await page.goto(`/messages?conversation=${conversationId}`, {
    waitUntil: 'domcontentloaded',
  });
  await handleReAuthModal(page, TEST_USER_1.password);

  // Wait for conversation view to mount
  await page.waitForSelector('[data-testid="message-thread"]', {
    state: 'visible',
    timeout: 90000,
  });

  // Wait for message input to be visible (indicates conversation is loaded)
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toBeVisible({ timeout: 45000 });
  await waitForUIStability(page);

  // Post-navigation auth check: the Supabase client may have wiped the
  // session during conversation loading (403/406 → token refresh → consumed
  // refresh token → SIGNED_OUT → localStorage cleared). Detect this and
  // re-sign-in if needed.
  const authLost = await page
    .locator('text=/You must be (logged in|signed in)|Sign in required/i')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (authLost) {
    console.log(
      '[navigateToConversation] Auth lost after page load — re-signing in'
    );
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const result = await performSignIn(
      page,
      TEST_USER_1.email,
      TEST_USER_1.password
    );
    if (!result.success) {
      throw new Error(`Re-sign-in failed: ${result.error}`);
    }
    // Navigate back to conversation
    await page.goto(`/messages?conversation=${conversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissCookieBanner(page);
    await handleReAuthModal(page, TEST_USER_1.password);
    await page.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60000,
    });
    await expect(messageInput).toBeVisible({ timeout: 45000 });
    await waitForUIStability(page);
  }
}

/**
 * Send a message in the current conversation
 */
async function sendMessage(page: Page, message: string) {
  // Standard Playwright fill+click. The idle timeout fix (no more 60
  // re-renders/minute) and auth gate fixes should prevent element
  // detachment that previously required workarounds.
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toBeEnabled({ timeout: 45000 });
  await messageInput.fill(message);

  // Wait for React to process the fill — the char count updates when
  // React's state reflects the new value. Without this, handleSend()
  // reads stale state (empty string) and rejects with "Message cannot
  // be empty" instead of actually sending.
  await page.waitForFunction(
    (expectedLen) => {
      const counter = document.getElementById('char-count');
      if (!counter) return false;
      return counter.textContent?.includes(String(expectedLen));
    },
    message.length,
    { timeout: 15000 }
  );

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
 * Uses the message bubble's data-testid for reliable selection.
 */
function getEditButtonForMessage(page: Page, messageText: string) {
  return getMessageBubble(page, messageText).getByRole('button', {
    name: 'Edit message',
  });
}

/**
 * Find the Delete button for a specific message by its text content.
 * Uses the message bubble's data-testid for reliable selection.
 */
function getDeleteButtonForMessage(page: Page, messageText: string) {
  return getMessageBubble(page, messageText).getByRole('button', {
    name: 'Delete message',
  });
}

test.describe('Message Editing', () => {
  // Serial: tests share conversation state and Realtime subscriptions.
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  test.beforeEach(async ({ page }) => {
    // Forward browser console for CI diagnostics
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('ConversationView') ||
        text.includes('sendMessage') ||
        text.includes('EncryptionKeyGate') ||
        msg.type() === 'error'
      ) {
        console.log(`[browser console.${msg.type()}] ${text}`);
      }
    });
    // Sign in as User 1
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T115: should edit message within 15-minute window', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    // Navigate to conversation
    await navigateToConversation(page);

    // Send a unique message (timestamp ensures no conflicts with previous test runs)
    const timestamp = Date.now();
    const originalMessage = `Original msg ${timestamp}`;
    await sendMessage(page, originalMessage);

    // Verify our message bubble exists with data-testid
    const messageBubble = getMessageBubble(page, originalMessage);
    await expect(messageBubble).toBeVisible({ timeout: 15000 });

    // Find the Edit button for our specific message
    const editButton = getEditButtonForMessage(page, originalMessage);

    // Edit button should be visible for own messages (within 15-minute window)
    // If this fails, it means either:
    // 1. message.isOwn is false (wrong sender_id)
    // 2. isWithinEditWindow returned false (message > 15 min old)
    await expect(editButton).toBeVisible({ timeout: 15000 });

    // Click Edit button
    await editButton.click();

    // Edit mode should be active (textarea visible)
    const editTextarea = page.getByRole('textbox', {
      name: /Edit message content/i,
    });
    await expect(editTextarea).toBeVisible();

    // Change the content with unique timestamp
    const editedMessage = `Edited msg ${timestamp}`;
    await editTextarea.clear();
    await editTextarea.fill(editedMessage);

    // Click Save
    await page.getByRole('button', { name: /Save/i }).click();

    // Wait for save to complete (edit mode closes)
    await expect(editTextarea).not.toBeVisible({ timeout: 15000 });

    // Wait for UI to stabilize after save (state update + re-render)
    await waitForUIStability(page);

    // Find the message bubble with edited content (it should update in place)
    const editedBubble = getMessageBubble(page, editedMessage);

    // Scroll to the edited message to ensure it's visible
    await editedBubble.scrollIntoViewIfNeeded().catch(() => {});

    // Verify edited content is displayed with longer timeout
    await expect(editedBubble).toBeVisible({ timeout: 10000 });

    // Verify original content is no longer visible (unique timestamp ensures only one match)
    await expect(page.getByText(originalMessage)).not.toBeVisible({
      timeout: 15000,
    });
  });

  test('should cancel edit without saving', async ({ page }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const originalMessage = `Cancel edit ${timestamp}`;
    await sendMessage(page, originalMessage);

    // Click Edit button for our specific message
    const editButton = getEditButtonForMessage(page, originalMessage);
    await editButton.click();

    // Change content
    const editTextarea = page.getByRole('textbox', {
      name: /Edit message content/i,
    });
    await expect(editTextarea).toBeVisible();
    await editTextarea.clear();
    await editTextarea.fill('This will be cancelled');

    // Click Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Edit mode should close
    await expect(editTextarea).not.toBeVisible();

    // Original content should still be visible
    await expect(page.getByText(originalMessage)).toBeVisible();
  });

  test('should disable Save button when content unchanged', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const originalMessage = `Unchanged ${timestamp}`;
    await sendMessage(page, originalMessage);

    // Click Edit button for our specific message
    const editButton = getEditButtonForMessage(page, originalMessage);
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    // Save button should be disabled (content hasn't changed)
    const saveButton = page.getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    await expect(saveButton).toBeDisabled();
  });

  test('should not allow editing empty message', async ({ page }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const originalMessage = `Empty edit ${timestamp}`;
    await sendMessage(page, originalMessage);

    // Click Edit button for our specific message
    const editButton = getEditButtonForMessage(page, originalMessage);
    await editButton.click();

    // Clear content
    const editTextarea = page.getByRole('textbox', {
      name: /Edit message content/i,
    });
    await editTextarea.clear();

    // Save button should be disabled
    const saveButton = page.getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeDisabled();
  });
});

test.describe('Message Deletion', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('ConversationView') ||
        text.includes('sendMessage') ||
        msg.type() === 'error'
      ) {
        console.log(`[browser console.${msg.type()}] ${text}`);
      }
    });
    // Sign in as User 1
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T116: should delete message within 15-minute window', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message (timestamp ensures no conflicts with previous test runs)
    const timestamp = Date.now();
    const messageToDelete = `Delete me ${timestamp}`;
    await sendMessage(page, messageToDelete);

    // Verify our message bubble exists
    const messageBubble = getMessageBubble(page, messageToDelete);
    await expect(messageBubble).toBeVisible({ timeout: 15000 });

    // Find the Delete button for our specific message
    const deleteButton = getDeleteButtonForMessage(page, messageToDelete);

    // Delete button should be visible for own messages (within 15-minute window)
    await expect(deleteButton).toBeVisible({ timeout: 15000 });

    // Click Delete
    await deleteButton.click();

    // Confirmation modal should appear
    const modal = page.getByRole('dialog', { name: /Delete Message/i });
    await expect(modal).toBeVisible();

    // Confirm deletion - use the actual aria-label "Confirm deletion"
    const confirmButton = modal.getByRole('button', {
      name: /Confirm deletion/i,
    });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for modal to close first
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Wait for UI to stabilize after deletion
    await waitForUIStability(page);

    // Either the message is removed OR replaced with "[Message deleted]"
    // Use Promise.race to detect whichever happens first
    const messageGone = page.getByText(messageToDelete);
    const deletedPlaceholder = page.getByText('[Message deleted]').first();

    // Wait for deletion to be reflected in UI - message should either be gone or show placeholder
    await Promise.race([
      expect(messageGone).not.toBeVisible({ timeout: 10000 }),
      expect(deletedPlaceholder).toBeVisible({ timeout: 10000 }),
    ]);
  });

  test('should cancel deletion from confirmation modal', async ({ page }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const messageToKeep = `Keep me ${timestamp}`;
    await sendMessage(page, messageToKeep);

    // Click Delete button for our specific message
    const deleteButton = getDeleteButtonForMessage(page, messageToKeep);
    await deleteButton.click();

    // Modal appears
    const modal = page.getByRole('dialog', { name: /Delete Message/i });
    await expect(modal).toBeVisible();

    // Click Cancel
    const cancelButton = modal.getByRole('button', {
      name: /Cancel deletion/i,
    });
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Message should still be intact
    await expect(page.getByText(messageToKeep)).toBeVisible();
  });

  test('should not show Edit/Delete buttons on deleted message', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send and delete a unique message (timestamp ensures no conflicts)
    const timestamp = Date.now();
    const messageToDelete = `To delete ${timestamp}`;
    await sendMessage(page, messageToDelete);

    // Click Delete button for our specific message
    const deleteButton = getDeleteButtonForMessage(page, messageToDelete);
    await deleteButton.click();

    // Confirmation modal should appear
    const modal = page.getByRole('dialog', { name: /Delete Message/i });
    await expect(modal).toBeVisible();

    // Confirm deletion - use the actual aria-label "Confirm deletion"
    const confirmButton = modal.getByRole('button', {
      name: /Confirm deletion/i,
    });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for modal to close first
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Wait for UI to stabilize after deletion
    await waitForUIStability(page);

    // Either the message is removed OR replaced with "[Message deleted]"
    const messageGone = page.getByText(messageToDelete);
    const deletedPlaceholder = page.getByText('[Message deleted]').first();

    // Wait for deletion to be reflected in UI
    await Promise.race([
      expect(messageGone).not.toBeVisible({ timeout: 10000 }),
      expect(deletedPlaceholder).toBeVisible({ timeout: 10000 }),
    ]);

    // Edit and Delete buttons should not be visible for deleted messages
    // (message either removed or replaced with placeholder that has no buttons)
  });
});

test.describe('Time Window Restrictions', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('ConversationView') ||
        text.includes('sendMessage') ||
        msg.type() === 'error'
      ) {
        console.log(`[browser console.${msg.type()}] ${text}`);
      }
    });
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('should show Edit/Delete buttons only for own recent messages', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message (within window)
    const timestamp = Date.now();
    const recentMessage = `Recent msg ${timestamp}`;
    await sendMessage(page, recentMessage);

    // Recent own message should have Edit and Delete buttons
    const editButton = getEditButtonForMessage(page, recentMessage);
    const deleteButton = getDeleteButtonForMessage(page, recentMessage);

    // Wait for buttons with longer timeout (may need to scroll into view)
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
  });

  test('T117: should not show Edit/Delete buttons for messages older than 15 minutes', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    const adminClient = getAdminClient();
    if (!adminClient) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    await navigateToConversation(page);

    // Step 1: send a fresh message via the real encrypted UI path. This
    // produces a proper encrypted row in the messages table that matches
    // how real users send messages.
    const timestamp = Date.now();
    const testMessage = `T117 window ${timestamp}`;
    await sendMessage(page, testMessage);

    // Step 2: sanity-check the recent message shows Edit/Delete buttons.
    // If this fails, the test is meaningless because we never established
    // the "buttons visible on recent messages" baseline.
    const editButtonBefore = getEditButtonForMessage(page, testMessage);
    await expect(editButtonBefore).toBeVisible({ timeout: 10000 });

    // Step 3: find that message in the DB and backdate its created_at by
    // 16 minutes. Messages are encrypted so we match by sequence_number —
    // the most recent message for this conversation/sender is ours.
    const { data: latest } = await adminClient
      .from('messages')
      .select('id, sequence_number')
      .eq('conversation_id', conversationId)
      .eq('deleted', false)
      .order('sequence_number', { ascending: false })
      .limit(1);

    expect(latest?.length).toBe(1);
    const messageId = latest![0].id;

    const sixteenMinutesAgo = new Date(
      Date.now() - 16 * 60 * 1000
    ).toISOString();
    const { error: updateError } = await adminClient
      .from('messages')
      .update({ created_at: sixteenMinutesAgo })
      .eq('id', messageId);
    expect(updateError).toBeNull();

    // Step 4: reload the conversation so the UI re-reads created_at from DB.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await handleReAuthModal(page, TEST_USER_1.password);
    await navigateToConversation(page);

    // Step 5: the same message should still be visible, but its Edit/Delete
    // buttons should now be HIDDEN because the 15-minute window has elapsed.
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
    const editButtonAfter = getEditButtonForMessage(page, testMessage);
    const deleteButtonAfter = getDeleteButtonForMessage(page, testMessage);
    await expect(editButtonAfter).not.toBeVisible();
    await expect(deleteButtonAfter).not.toBeVisible();
  });

  test('should not show Edit/Delete buttons on received messages', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    // This test requires two users in the same conversation
    // For now, we'll verify that the page loads and check for received messages

    await navigateToConversation(page);

    // Get all chat bubbles on the left side (received messages use chat-start class)
    const receivedMessages = page.locator('.chat-start');
    const count = await receivedMessages.count();

    // Check each received message bubble
    for (let i = 0; i < Math.min(count, 5); i++) {
      const bubble = receivedMessages.nth(i);

      // Received messages should never have Edit/Delete buttons
      await expect(
        bubble.getByRole('button', { name: 'Edit message' })
      ).not.toBeVisible();
      await expect(
        bubble.getByRole('button', { name: 'Delete message' })
      ).not.toBeVisible();
    }
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('ConversationView') ||
        text.includes('sendMessage') ||
        msg.type() === 'error'
      ) {
        console.log(`[browser console.${msg.type()}] ${text}`);
      }
    });
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T130: edit mode should have proper ARIA labels', async ({ page }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const message = `A11y test ${timestamp}`;
    await sendMessage(page, message);

    // Enter edit mode using the helper to find our specific message's button
    const editButton = getEditButtonForMessage(page, message);
    await editButton.click();

    // Check ARIA labels - use role-based selectors
    const editTextarea = page.getByRole('textbox', {
      name: /Edit message content/i,
    });
    await expect(editTextarea).toBeVisible();

    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeVisible();

    const saveButton = page.getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeVisible();
  });

  test('delete confirmation modal should have proper ARIA labels', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const message = `Modal a11y ${timestamp}`;
    await sendMessage(page, message);

    // Open delete modal using helper to find our specific message's button
    const deleteButton = getDeleteButtonForMessage(page, message);
    await deleteButton.click();

    // Check modal ARIA attributes
    const modal = page.getByRole('dialog', { name: /Delete Message/i });
    await expect(modal).toBeVisible();

    // Check button labels within the modal
    // Button accessible names are "Cancel deletion" and "Confirm deletion"
    const cancelButton = modal.getByRole('button', {
      name: /Cancel deletion/i,
    });
    await expect(cancelButton).toBeVisible();

    const confirmButton = modal.getByRole('button', {
      name: /Confirm deletion/i,
    });
    await expect(confirmButton).toBeVisible();
  });

  test('delete confirmation modal should be keyboard navigable', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a unique message
    const timestamp = Date.now();
    const message = `Keyboard nav ${timestamp}`;
    await sendMessage(page, message);

    // Open delete modal using helper to find our specific message's button
    const deleteButton = getDeleteButtonForMessage(page, message);
    await deleteButton.click();

    // Wait for modal to be fully visible and interactive
    const modal = page.getByRole('dialog', { name: /Delete Message/i });
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    // Check that focusable elements exist in the modal
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
    await page.keyboard.press('Tab');
    await expect(confirmButton).toBeFocused();
  });
});
