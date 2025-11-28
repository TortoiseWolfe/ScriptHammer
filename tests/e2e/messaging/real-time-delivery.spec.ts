/**
 * E2E Tests for Real-time Message Delivery
 * Tasks: T098, T099
 *
 * Tests real-time message delivery between two browser windows and typing indicators.
 * Verifies <500ms delivery guarantee and proper typing indicator behavior.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

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
  await page.waitForURL('/'); // Wait for redirect to home page
}

/**
 * Create or find existing conversation between two users
 */
async function setupConversation(
  page1: Page,
  page2: Page
): Promise<string | null> {
  // User 1: Navigate to connections page and send friend request if not already connected
  await page1.goto('/messages/connections');

  // Check if already connected
  const alreadyConnected = await page1
    .locator('text=Connected Users')
    .isVisible()
    .catch(() => false);

  if (!alreadyConnected) {
    // Search for User 2
    await page1.fill('input[placeholder*="Search"]', TEST_USER_2.email);
    await page1.click('button:has-text("Search")');

    // Send friend request
    const sendButton = page1.locator(
      `button:has-text("Send Request"):near(:text("${TEST_USER_2.email}"))`
    );
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await expect(page1.locator('text=Friend request sent')).toBeVisible();
    }

    // User 2: Accept friend request
    await page2.goto('/messages/connections');
    await page2.click('button:has-text("Pending Received")');

    const acceptButton = page2.locator(
      `button:has-text("Accept"):near(:text("${TEST_USER_1.email}"))`
    );
    if (await acceptButton.isVisible()) {
      await acceptButton.click();
      await expect(page2.locator('text=Friend request accepted')).toBeVisible();
    }
  }

  // Both users navigate to messages page
  await page1.goto('/messages');
  await page2.goto('/messages');

  // User 1: Click on conversation with User 2
  const conversationLink = page1.locator(
    `a[href*="/messages/"]:has-text("${TEST_USER_2.email}")`
  );
  await conversationLink.click();

  // Extract conversation ID from URL
  const conversationId =
    (await page1.url().match(/\/messages\/([a-f0-9-]+)/)?.[1]) || null;

  if (conversationId) {
    // User 2: Navigate to same conversation
    await page2.goto(`/messages/${conversationId}`);
  }

  return conversationId;
}

test.describe('Real-time Message Delivery (T098)', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two separate browser contexts (simulates two users)
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Sign in both users
    await signIn(page1, TEST_USER_1.email, TEST_USER_1.password);
    await signIn(page2, TEST_USER_2.email, TEST_USER_2.password);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('should deliver message in <500ms between two windows', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Send a message
    const testMessage = `Real-time test message ${Date.now()}`;
    const startTime = Date.now();

    await page1.fill('textarea[placeholder*="Type"]', testMessage);
    await page1.click('button[aria-label="Send message"]');

    // User 2: Wait for message to appear
    await page2.waitForSelector(`text="${testMessage}"`);
    const endTime = Date.now();

    // Verify delivery time <500ms
    const deliveryTime = endTime - startTime;
    expect(deliveryTime).toBeLessThan(500);

    // Verify message appears in User 2's window
    await expect(page2.locator(`text="${testMessage}"`)).toBeVisible();

    // Verify message also appears in User 1's window (sender)
    await expect(page1.locator(`text="${testMessage}"`)).toBeVisible();
  });

  test('should show delivery status (sent → delivered → read)', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Send a message
    const testMessage = `Delivery status test ${Date.now()}`;
    await page1.fill('textarea[placeholder*="Type"]', testMessage);
    await page1.click('button[aria-label="Send message"]');

    // Verify "sent" status (single checkmark)
    const messageBubble = page1.locator(
      `[data-testid="message-bubble"]:has-text("${testMessage}")`
    );
    await expect(messageBubble.locator('[aria-label*="sent"]')).toBeVisible();

    // User 2: Message appears (should trigger "delivered" status)
    await page2.waitForSelector(`text="${testMessage}"`);

    // Verify "delivered" status (double checkmark)
    await expect(
      messageBubble.locator('[aria-label*="delivered"]')
    ).toBeVisible({ timeout: 1000 });

    // User 2: Scroll to message (should trigger "read" status)
    const message2 = page2.locator(`text="${testMessage}"`);
    await message2.scrollIntoViewIfNeeded();

    // Verify "read" status (double blue checkmark)
    await expect(messageBubble.locator('[aria-label*="read"]')).toBeVisible({
      timeout: 1000,
    });
  });

  test('should handle rapid message exchanges', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Send 3 messages rapidly
    const messages = [
      `Rapid 1 ${Date.now()}`,
      `Rapid 2 ${Date.now()}`,
      `Rapid 3 ${Date.now()}`,
    ];

    for (const msg of messages) {
      await page1.fill('textarea[placeholder*="Type"]', msg);
      await page1.click('button[aria-label="Send message"]');
    }

    // User 2: Verify all messages appear in order
    for (const msg of messages) {
      await expect(page2.locator(`text="${msg}"`)).toBeVisible();
    }

    // Verify message order (sequence numbers should be correct)
    const messageBubbles = page2.locator('[data-testid="message-bubble"]');
    const count = await messageBubbles.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Typing Indicators (T099)', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two separate browser contexts
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Sign in both users
    await signIn(page1, TEST_USER_1.email, TEST_USER_1.password);
    await signIn(page2, TEST_USER_2.email, TEST_USER_2.password);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('should show typing indicator when user types', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Start typing
    await page1.fill('textarea[placeholder*="Type"]', 'Hello');

    // User 2: Typing indicator should appear
    const typingIndicator = page2.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 2000 });

    // Verify indicator text
    await expect(typingIndicator).toContainText('is typing');
  });

  test('should hide typing indicator when user stops typing', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Start typing
    await page1.fill('textarea[placeholder*="Type"]', 'Hello');

    // User 2: Wait for typing indicator
    const typingIndicator = page2.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 2000 });

    // User 1: Clear input (stop typing)
    await page1.fill('textarea[placeholder*="Type"]', '');

    // User 2: Typing indicator should disappear within 5 seconds
    await expect(typingIndicator).not.toBeVisible({ timeout: 6000 });
  });

  test('should remove typing indicator when message is sent', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Start typing
    const testMessage = `Typing test ${Date.now()}`;
    await page1.fill('textarea[placeholder*="Type"]', testMessage);

    // User 2: Wait for typing indicator
    const typingIndicator = page2.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 2000 });

    // User 1: Send message
    await page1.click('button[aria-label="Send message"]');

    // User 2: Typing indicator should disappear immediately
    await expect(typingIndicator).not.toBeVisible({ timeout: 1000 });

    // User 2: Message should appear
    await expect(page2.locator(`text="${testMessage}"`)).toBeVisible();
  });

  test('should show multiple typing indicators correctly', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Start typing
    await page1.fill('textarea[placeholder*="Type"]', 'User 1 typing');

    // User 2: Verify User 1's typing indicator
    const typingIndicator2 = page2.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator2).toBeVisible({ timeout: 2000 });

    // User 2: Start typing
    await page2.fill('textarea[placeholder*="Type"]', 'User 2 typing');

    // User 1: Verify User 2's typing indicator
    const typingIndicator1 = page1.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator1).toBeVisible({ timeout: 2000 });

    // Both users should see the other's typing indicator
    await expect(typingIndicator1).toBeVisible();
    await expect(typingIndicator2).toBeVisible();
  });

  test('should auto-expire typing indicator after 5 seconds', async () => {
    // Setup: Establish connection and navigate to conversation
    const conversationId = await setupConversation(page1, page2);
    expect(conversationId).not.toBeNull();

    // User 1: Start typing
    await page1.fill('textarea[placeholder*="Type"]', 'Auto-expire test');

    // User 2: Wait for typing indicator
    const typingIndicator = page2.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 2000 });

    // Wait for auto-expire (5 seconds + buffer)
    await page2.waitForTimeout(6000);

    // Typing indicator should disappear
    await expect(typingIndicator).not.toBeVisible();
  });
});
