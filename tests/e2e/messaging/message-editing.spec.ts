/**
 * E2E Tests for Message Editing and Deletion
 * Tasks: T115-T117
 *
 * Tests:
 * - Edit message within 15-minute window
 * - Delete message within 15-minute window
 * - Edit/delete disabled after 15 minutes
 */

import { test, expect, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  handleReAuthModal,
  waitForAuthenticatedState,
  getAdminClient,
  getUserByEmail,
} from '../utils/test-user-factory';

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

// Setup connection and conversation before all tests
test.beforeAll(async () => {
  // Validate required environment variables
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
    console.error(`❌ ${setupError}`);
    return;
  }

  if (
    TEST_USER_1.email === 'test@example.com' ||
    TEST_USER_2.email === 'test-user-b@example.com'
  ) {
    setupError =
      'TEST_USER_PRIMARY_EMAIL or TEST_USER_TERTIARY_EMAIL not configured';
    console.error(`❌ ${setupError}`);
    return;
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    setupError = 'Admin client unavailable';
    console.error(`❌ ${setupError}`);
    return;
  }

  // Get user IDs
  const userA = await getUserByEmail(TEST_USER_1.email);
  const userB = await getUserByEmail(TEST_USER_2.email);

  if (!userA || !userB) {
    setupError = `Test users not found: ${!userA ? TEST_USER_1.email : ''} ${!userB ? TEST_USER_2.email : ''}`;
    console.error(`❌ ${setupError}`);
    return;
  }

  // Check if already connected
  const { data: existing } = await adminClient
    .from('user_connections')
    .select('id, status')
    .or(
      `and(requester_id.eq.${userA.id},addressee_id.eq.${userB.id}),and(requester_id.eq.${userB.id},addressee_id.eq.${userA.id})`
    )
    .maybeSingle();

  // Create or update connection to 'accepted' status
  if (existing?.status !== 'accepted') {
    if (!existing) {
      const { error } = await adminClient.from('user_connections').insert({
        requester_id: userA.id,
        addressee_id: userB.id,
        status: 'accepted',
      });
      if (error) {
        setupError = `Failed to create connection: ${error.message}`;
        console.error(`❌ ${setupError}`);
        return;
      }
      console.log('✓ Connection created between test users');
    } else {
      const { error } = await adminClient
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      if (error) {
        setupError = `Failed to update connection: ${error.message}`;
        console.error(`❌ ${setupError}`);
        return;
      }
      console.log('✓ Connection updated to accepted');
    }
  } else {
    console.log('✓ Users already connected');
  }

  // Create conversation if it doesn't exist
  const [participant_1, participant_2] =
    userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];

  const { data: existingConv } = await adminClient
    .from('conversations')
    .select('id')
    .eq('participant_1_id', participant_1)
    .eq('participant_2_id', participant_2)
    .maybeSingle();

  if (existingConv) {
    console.log('✓ Conversation already exists:', existingConv.id);
    setupSucceeded = true;
    return;
  }

  const { data: newConv, error: convError } = await adminClient
    .from('conversations')
    .insert({
      participant_1_id: participant_1,
      participant_2_id: participant_2,
    })
    .select('id')
    .single();

  if (convError) {
    setupError = `Failed to create conversation: ${convError.message}`;
    console.error(`❌ ${setupError}`);
    return;
  }

  console.log('✓ Conversation created:', newConv.id);
  setupSucceeded = true;
});

/**
 * Sign in helper function
 */
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await dismissCookieBanner(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForAuthenticatedState(page);
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
    { timeout: 5000 }
  );
}

/**
 * Navigate to conversation helper
 */
async function navigateToConversation(page: Page) {
  await page.goto('/messages');
  await dismissCookieBanner(page);
  await handleReAuthModal(page);

  // Click on Chats tab to see conversations
  const chatsTab = page.getByRole('tab', { name: /Chats/i });
  if (await chatsTab.isVisible()) {
    await chatsTab.click();
    // Wait for tab panel to update
    await page.waitForSelector('[role="tabpanel"]', { state: 'visible' });
    await waitForUIStability(page);
  }

  // Find first conversation button by aria-label pattern
  const firstConversation = page
    .getByRole('button', { name: /Conversation with/ })
    .first();

  // Wait for conversation to be visible
  await expect(firstConversation).toBeVisible({ timeout: 5000 });
  await firstConversation.click();

  // Wait for message input to be visible (indicates conversation is loaded)
  // Use role-based selector instead of data-testid
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toBeVisible({ timeout: 10000 });
  await waitForUIStability(page);
}

/**
 * Send a message in the current conversation
 */
async function sendMessage(page: Page, message: string) {
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await messageInput.fill(message);

  const sendButton = page.getByRole('button', { name: /Send message/i });
  await sendButton.click();

  // Wait for message to appear
  await page.waitForSelector(`text=${message}`, { timeout: 5000 });
}

test.describe('Message Editing', () => {
  test.beforeEach(async ({ page }) => {
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

    // Send a message
    const originalMessage = 'Original message content';
    await sendMessage(page, originalMessage);

    // Find the Edit button for our message (last message sent by us)
    const editButton = page
      .getByRole('button', { name: 'Edit message' })
      .last();

    // Edit button should be visible for own messages
    await expect(editButton).toBeVisible();

    // Click Edit button
    await editButton.click();

    // Edit mode should be active (textarea visible)
    const editTextarea = page.getByRole('textbox', {
      name: /Edit message content/i,
    });
    await expect(editTextarea).toBeVisible();

    // Change the content
    const editedMessage = 'Edited message content';
    await editTextarea.clear();
    await editTextarea.fill(editedMessage);

    // Click Save
    await page.getByRole('button', { name: /Save/i }).click();

    // Wait for save to complete (edit mode closes)
    await expect(editTextarea).not.toBeVisible({ timeout: 5000 });

    // Verify edited content is displayed
    await expect(page.locator(`text=${editedMessage}`)).toBeVisible();

    // Verify original content is no longer visible
    await expect(page.locator(`text=${originalMessage}`)).not.toBeVisible();
  });

  test('should cancel edit without saving', async ({ page }) => {
    await navigateToConversation(page);

    // Send a message
    const originalMessage = 'Message to cancel edit';
    await page.fill('[data-testid="message-input"]', originalMessage);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${originalMessage}`, { timeout: 5000 });

    // Click Edit
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button', { hasText: 'Edit' }).click();

    // Change content
    const editTextarea = messageBubble.locator(
      'textarea[aria-label="Edit message content"]'
    );
    await editTextarea.clear();
    await editTextarea.fill('This will be cancelled');

    // Click Cancel
    await messageBubble.locator('button', { hasText: 'Cancel' }).click();

    // Edit mode should close
    await expect(editTextarea).not.toBeVisible();

    // Original content should still be visible
    await expect(messageBubble.locator('p')).toContainText(originalMessage);

    // No "Edited" indicator
    await expect(messageBubble.locator('text=/Edited/')).not.toBeVisible();
  });

  test('should disable Save button when content unchanged', async ({
    page,
  }) => {
    await navigateToConversation(page);

    // Send a message
    const originalMessage = 'Test unchanged content';
    await page.fill('[data-testid="message-input"]', originalMessage);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${originalMessage}`, { timeout: 5000 });

    // Click Edit
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button', { hasText: 'Edit' }).click();

    // Save button should be disabled (content hasn't changed)
    const saveButton = messageBubble.locator('button', { hasText: 'Save' });
    await expect(saveButton).toBeDisabled();
  });

  test('should not allow editing empty message', async ({ page }) => {
    await navigateToConversation(page);

    // Send a message
    const originalMessage = 'Test empty edit';
    await page.fill('[data-testid="message-input"]', originalMessage);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${originalMessage}`, { timeout: 5000 });

    // Click Edit
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button', { hasText: 'Edit' }).click();

    // Clear content
    const editTextarea = messageBubble.locator(
      'textarea[aria-label="Edit message content"]'
    );
    await editTextarea.clear();

    // Save button should be disabled
    const saveButton = messageBubble.locator('button', { hasText: 'Save' });
    await expect(saveButton).toBeDisabled();
  });
});

test.describe('Message Deletion', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as User 1
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T116: should delete message within 15-minute window', async ({
    page,
  }) => {
    await navigateToConversation(page);

    // Send a message
    const messageToDelete = 'Message to be deleted';
    await page.fill('[data-testid="message-input"]', messageToDelete);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${messageToDelete}`, { timeout: 5000 });

    // Find the Delete button
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    const deleteButton = messageBubble.locator('button', { hasText: 'Delete' });

    // Delete button should be visible
    await expect(deleteButton).toBeVisible();

    // Click Delete
    await deleteButton.click();

    // Confirmation modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('#delete-modal-title')).toContainText(
      'Delete Message?'
    );

    // Confirm deletion
    await page.locator('button', { hasText: 'Delete' }).last().click();

    // Wait for deletion to complete
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({
      timeout: 5000,
    });

    // Original message should be replaced with placeholder
    await expect(messageBubble.locator('p')).toContainText('[Message deleted]');

    // Original content should not be visible
    await expect(page.locator(`text=${messageToDelete}`)).not.toBeVisible();

    // Message should have reduced opacity (deleted styling)
    await expect(messageBubble.locator('.chat-bubble')).toHaveClass(
      /opacity-60/
    );
  });

  test('should cancel deletion from confirmation modal', async ({ page }) => {
    await navigateToConversation(page);

    // Send a message
    const messageToKeep = 'Message to keep';
    await page.fill('[data-testid="message-input"]', messageToKeep);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${messageToKeep}`, { timeout: 5000 });

    // Click Delete
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button', { hasText: 'Delete' }).click();

    // Modal appears
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click Cancel
    await page.locator('button[aria-label="Cancel deletion"]').click();

    // Modal should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Message should still be intact
    await expect(messageBubble.locator('p')).toContainText(messageToKeep);
    await expect(messageBubble.locator('p')).not.toContainText(
      '[Message deleted]'
    );
  });

  test('should not show Edit/Delete buttons on deleted message', async ({
    page,
  }) => {
    await navigateToConversation(page);

    // Send and delete a message
    const messageToDelete = 'Will be deleted';
    await page.fill('[data-testid="message-input"]', messageToDelete);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${messageToDelete}`, { timeout: 5000 });

    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button', { hasText: 'Delete' }).click();
    await page.locator('button', { hasText: 'Delete' }).last().click();

    // Wait for deletion
    await page.waitForSelector('text=[Message deleted]', { timeout: 5000 });

    // Edit and Delete buttons should not exist
    await expect(
      messageBubble.locator('button', { hasText: 'Edit' })
    ).not.toBeVisible();
    await expect(
      messageBubble.locator('button', { hasText: 'Delete' })
    ).not.toBeVisible();
  });
});

test.describe('Time Window Restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T117: should not show Edit/Delete buttons for messages older than 15 minutes', async ({
    page,
    context,
  }) => {
    await navigateToConversation(page);

    // For this test, we'll simulate an old message by manually setting the created_at timestamp
    // In a real scenario, we'd need to either:
    // 1. Wait 15 minutes (too slow for tests)
    // 2. Use a test fixture with pre-created old messages
    // 3. Mock the browser time

    // Mock the current time to be 16 minutes in the future
    await context.addInitScript(() => {
      const originalDateNow = Date.now;
      const originalDate = Date;

      // Override Date.now to return time 16 minutes in the future
      Date.now = () => originalDateNow() + 16 * 60 * 1000;

      // Also override new Date() to use the mocked time
      (window as any).Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(Date.now());
          } else if (args.length === 1) {
            super(args[0]);
          } else {
            super(
              args[0],
              args[1],
              args[2],
              args[3],
              args[4],
              args[5],
              args[6]
            );
          }
        }

        static override now() {
          return originalDateNow() + 16 * 60 * 1000;
        }
      };
    });

    // Reload page to apply mock
    await page.reload();
    await navigateToConversation(page);

    // Check that existing messages don't have Edit/Delete buttons
    const messageBubbles = page.locator('[data-testid="message-bubble"]');
    const count = await messageBubbles.count();

    if (count > 0) {
      // Check first message (likely oldest)
      const firstMessage = messageBubbles.first();

      // Edit and Delete buttons should not be visible
      await expect(
        firstMessage.locator('button', { hasText: 'Edit' })
      ).not.toBeVisible();
      await expect(
        firstMessage.locator('button', { hasText: 'Delete' })
      ).not.toBeVisible();
    }
  });

  test('should show Edit/Delete buttons only for own recent messages', async ({
    page,
  }) => {
    await navigateToConversation(page);

    // Send a new message (within window)
    const recentMessage = 'Recent message within 15min';
    await page.fill('[data-testid="message-input"]', recentMessage);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${recentMessage}`, { timeout: 5000 });

    const recentBubble = page.locator('[data-testid="message-bubble"]').last();

    // Recent own message should have Edit and Delete buttons
    await expect(
      recentBubble.locator('button', { hasText: 'Edit' })
    ).toBeVisible();
    await expect(
      recentBubble.locator('button', { hasText: 'Delete' })
    ).toBeVisible();
  });

  test('should not show Edit/Delete buttons on received messages', async ({
    page,
    browser,
  }) => {
    // This test requires two users in the same conversation
    // For now, we'll just verify that messages not marked as "isOwn" don't have buttons

    await navigateToConversation(page);

    // Get all message bubbles
    const messageBubbles = page.locator('[data-testid="message-bubble"]');
    const count = await messageBubbles.count();

    // Check each message bubble
    for (let i = 0; i < count; i++) {
      const bubble = messageBubbles.nth(i);

      // Check if message is from the other user (chat-start = received)
      const isReceived = (await bubble.locator('.chat-start').count()) > 0;

      if (isReceived) {
        // Received messages should never have Edit/Delete buttons
        await expect(
          bubble.locator('button', { hasText: 'Edit' })
        ).not.toBeVisible();
        await expect(
          bubble.locator('button', { hasText: 'Delete' })
        ).not.toBeVisible();
      }
    }
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T130: edit mode should have proper ARIA labels', async ({ page }) => {
    await navigateToConversation(page);

    // Send a message
    const message = 'Test accessibility';
    await page.fill('[data-testid="message-input"]', message);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });

    // Enter edit mode
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button[aria-label="Edit message"]').click();

    // Check ARIA labels
    await expect(
      messageBubble.locator('textarea[aria-label="Edit message content"]')
    ).toBeVisible();
    await expect(
      messageBubble.locator('button[aria-label="Cancel editing"]')
    ).toBeVisible();
    await expect(
      messageBubble.locator('button[aria-label="Save edited message"]')
    ).toBeVisible();
  });

  test('delete confirmation modal should have proper ARIA labels', async ({
    page,
  }) => {
    await navigateToConversation(page);

    // Send a message
    const message = 'Test delete modal accessibility';
    await page.fill('[data-testid="message-input"]', message);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });

    // Open delete modal
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button[aria-label="Delete message"]').click();

    // Check modal ARIA attributes
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute(
      'aria-labelledby',
      'delete-modal-title'
    );

    // Check modal title
    await expect(page.locator('#delete-modal-title')).toContainText(
      'Delete Message?'
    );

    // Check button labels
    await expect(
      page.locator('button[aria-label="Cancel deletion"]')
    ).toBeVisible();
    await expect(
      page.locator('button[aria-label="Confirm deletion"]')
    ).toBeVisible();
  });

  test('delete confirmation modal should be keyboard navigable', async ({
    page,
  }) => {
    // Skip if setup failed
    test.skip(!setupSucceeded, setupError);

    await navigateToConversation(page);

    // Send a message using helper
    const message = 'Test keyboard navigation';
    await sendMessage(page, message);

    // Open delete modal using role-based selector
    const deleteButton = page
      .getByRole('button', { name: 'Delete message' })
      .last();
    await deleteButton.click();

    // Wait for modal to be fully visible and interactive
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await waitForUIStability(page);

    // Check that focusable elements exist in the modal
    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    const confirmButton = page.getByRole('button', { name: /Delete/i }).last();

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
