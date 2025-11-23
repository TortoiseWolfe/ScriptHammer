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

// Test user credentials (from .env or defaults)
const TEST_USER_1 = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const TEST_USER_2 = {
  email: process.env.TEST_USER_SECONDARY_EMAIL || 'test2@example.com',
  password: process.env.TEST_USER_SECONDARY_PASSWORD || 'TestPassword123!',
};

/**
 * Sign in helper function
 */
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/**
 * Navigate to conversation helper
 */
async function navigateToConversation(page: Page) {
  await page.goto('/messages/connections');

  // Find first accepted connection and click to open conversation
  const firstConnection = page
    .locator('[data-testid="connection-item"]')
    .first();
  await firstConnection.click();

  // Wait for conversation to load
  await page.waitForSelector('[data-testid="message-bubble"]', {
    timeout: 5000,
  });
}

test.describe('Message Editing', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as User 1
    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
  });

  test('T115: should edit message within 15-minute window', async ({
    page,
  }) => {
    // Navigate to conversation
    await navigateToConversation(page);

    // Send a message
    const originalMessage = 'Original message content';
    await page.fill('[data-testid="message-input"]', originalMessage);
    await page.click('[data-testid="send-button"]');

    // Wait for message to appear
    await page.waitForSelector(`text=${originalMessage}`, { timeout: 5000 });

    // Find the Edit button for our message
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    const editButton = messageBubble.locator('button', { hasText: 'Edit' });

    // Edit button should be visible for own messages
    await expect(editButton).toBeVisible();

    // Click Edit button
    await editButton.click();

    // Edit mode should be active (textarea visible)
    const editTextarea = messageBubble.locator(
      'textarea[aria-label="Edit message content"]'
    );
    await expect(editTextarea).toBeVisible();

    // Change the content
    const editedMessage = 'Edited message content';
    await editTextarea.clear();
    await editTextarea.fill(editedMessage);

    // Click Save
    await messageBubble.locator('button', { hasText: 'Save' }).click();

    // Wait for save to complete (edit mode closes)
    await expect(editTextarea).not.toBeVisible({ timeout: 5000 });

    // Verify edited content is displayed
    await expect(messageBubble.locator('p')).toContainText(editedMessage);

    // Verify "Edited" indicator is shown
    await expect(messageBubble.locator('text=/Edited/')).toBeVisible();

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
    await navigateToConversation(page);

    // Send a message
    const message = 'Test keyboard navigation';
    await page.fill('[data-testid="message-input"]', message);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });

    // Open delete modal
    const messageBubble = page.locator('[data-testid="message-bubble"]').last();
    await messageBubble.locator('button[aria-label="Delete message"]').click();

    // Tab through modal buttons
    await page.keyboard.press('Tab');
    await expect(
      page.locator('button[aria-label="Cancel deletion"]')
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.locator('button[aria-label="Confirm deletion"]')
    ).toBeFocused();

    // Press Escape to close (if implemented)
    // await page.keyboard.press('Escape');
    // await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
