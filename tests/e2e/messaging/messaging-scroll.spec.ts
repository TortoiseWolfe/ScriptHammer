import { test, expect, Page } from '@playwright/test';
import {
  dismissCookieBanner,
  handleReAuthModal,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

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
 * Messaging Scroll E2E Tests
 * Feature: 005-fix-messaging-scroll
 *
 * Tests CSS Grid layout fix for ChatWindow ensuring:
 * - Message input is visible at bottom on all viewports
 * - Scroll is constrained to message thread
 * - Jump-to-bottom button works correctly
 */

// Test configuration for viewports
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

/**
 * Click the first available conversation button to open a chat
 */
async function clickFirstConversation(page: Page): Promise<boolean> {
  const conversationButton = page
    .getByRole('button', { name: /Conversation with/ })
    .first();
  if (await conversationButton.isVisible({ timeout: 3000 })) {
    await conversationButton.click();
    await page.waitForSelector('[data-testid="chat-window"]', {
      timeout: 5000,
    });
    await waitForUIStability(page);
    return true;
  }
  return false;
}

// Helper to check if element is in viewport
async function isElementInViewport(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  const isVisible = await element.isVisible();
  if (!isVisible) return false;

  const box = await element.boundingBox();
  if (!box) return false;

  const viewport = page.viewportSize();
  if (!viewport) return false;

  return (
    box.y >= 0 &&
    box.y + box.height <= viewport.height &&
    box.x >= 0 &&
    box.x + box.width <= viewport.width
  );
}

test.describe('Messaging Scroll - User Story 1: View Message Input', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page
      .getByLabel('Email')
      .fill(process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com');
    await page
      .getByLabel('Password')
      .fill(process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);
  });

  test('T003: Message input visible on mobile viewport (375x667)', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/messages');
    await handleReAuthModal(page);

    // Wait for page to load
    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    // Click on a conversation to open chat
    await clickFirstConversation(page);

    // Check message input is visible
    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    // Verify it's actually in viewport (not just in DOM)
    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });

  test('T004: Message input visible on tablet viewport (768x1024)', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/messages');
    await handleReAuthModal(page);

    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    await clickFirstConversation(page);

    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });

  test('T005: Message input visible on desktop viewport (1280x800)', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/messages');
    await handleReAuthModal(page);

    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    await clickFirstConversation(page);

    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });
});

test.describe('Messaging Scroll - User Story 2: Scroll Through Messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page
      .getByLabel('Email')
      .fill(process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com');
    await page
      .getByLabel('Password')
      .fill(process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);
  });

  test('T006: Scroll container constrained to MessageThread', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/messages');
    await handleReAuthModal(page);

    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    await clickFirstConversation(page);

    // Get message thread element
    const messageThread = page.locator('[data-testid="message-thread"]');
    await expect(messageThread).toBeVisible();

    // Get initial input position
    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    const initialInputBox = await messageInput.boundingBox();

    // Scroll up in the message thread
    await messageThread.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Wait for scroll to complete
    await waitForUIStability(page);

    // Get input position after scroll
    const afterScrollInputBox = await messageInput.boundingBox();

    // Input should remain in the same position (header and input fixed)
    expect(afterScrollInputBox?.y).toBe(initialInputBox?.y);
  });
});

test.describe('Messaging Scroll - User Story 3: Jump to Bottom Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page
      .getByLabel('Email')
      .fill(process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com');
    await page
      .getByLabel('Password')
      .fill(process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);
  });

  test('T007-T008: Jump button appears when scrolled and does not overlap input', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/messages');
    await handleReAuthModal(page);

    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    await clickFirstConversation(page);

    const messageThread = page.locator('[data-testid="message-thread"]');

    // Scroll up more than 500px to trigger button
    await messageThread.evaluate((el) => {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - 600);
    });

    await waitForUIStability(page);

    // Check if jump button appears
    const jumpButton = page.locator('[data-testid="jump-to-bottom"]');

    // Button should appear when scrolled 500px+ from bottom
    const scrollInfo = await messageThread.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      distanceFromBottom: el.scrollHeight - (el.scrollTop + el.clientHeight),
    }));

    if (scrollInfo.distanceFromBottom > 500) {
      await expect(jumpButton).toBeVisible();

      // Verify button doesn't overlap message input
      const buttonBox = await jumpButton.boundingBox();
      const messageInput = page.locator(
        'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
      );
      const inputBox = await messageInput.boundingBox();

      if (buttonBox && inputBox) {
        // Button bottom should be above input top
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(inputBox.y);
      }
    }
  });

  test('T009: Jump button click scrolls to bottom', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/messages');
    await handleReAuthModal(page);

    await page.waitForSelector(
      '[data-testid="chat-window"], [data-testid="message-thread"]',
      {
        timeout: 10000,
      }
    );

    await clickFirstConversation(page);

    const messageThread = page.locator('[data-testid="message-thread"]');

    // Scroll up to trigger button
    await messageThread.evaluate((el) => {
      el.scrollTop = 0;
    });

    await waitForUIStability(page);

    const jumpButton = page.locator('[data-testid="jump-to-bottom"]');

    if (await jumpButton.isVisible()) {
      await jumpButton.click();

      // Wait for smooth scroll animation to complete
      await waitForUIStability(page);

      // Check we're at the bottom
      const scrollInfo = await messageThread.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));

      const distanceFromBottom =
        scrollInfo.scrollHeight -
        (scrollInfo.scrollTop + scrollInfo.clientHeight);
      expect(distanceFromBottom).toBeLessThan(100);

      // Button should be hidden after reaching bottom
      await expect(jumpButton).not.toBeVisible();
    }
  });
});
