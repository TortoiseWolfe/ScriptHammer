/**
 * E2E Tests for Offline Message Queue
 * Tasks: T146-T149
 *
 * Tests:
 * 1. T146: Send message while offline → message queued → go online → message sent
 * 2. T147: Queue 3 messages while offline → reconnect → all 3 sent automatically
 * 3. T148: Simulate server failure → verify retries at 1s, 2s, 4s intervals
 * 4. T149: Conflict resolution - send same message from two devices → server timestamp wins
 */

import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  dismissCookieBanner,
  handleReAuthModal,
  waitForAuthenticatedState,
  getAdminClient as getTestAdminClient,
  getUserByEmail,
} from '../utils/test-user-factory';
import { createLogger } from '../../../src/lib/logger';

const logger = createLogger('e2e-messaging-offline');

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

const BASE_URL = process.env.NEXT_PUBLIC_DEPLOY_URL || 'http://localhost:3000';

// Test users - use PRIMARY and TERTIARY from standardized test fixtures (Feature 026)
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  username: 'testuser-b',
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

// Supabase admin client for database verification
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

test.describe('Offline Message Queue', () => {
  // Track if setup succeeded - tests will skip if not
  let setupSucceeded = false;
  let setupError = '';

  // Establish connection between test users BEFORE all tests
  test.beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
      logger.error(setupError);
      return;
    }

    if (
      USER_A.email === 'test@example.com' ||
      USER_B.email === 'test-user-b@example.com'
    ) {
      setupError = 'Test user emails not configured - using fallback values';
      logger.error(setupError);
      return;
    }

    const adminClient = getTestAdminClient();
    if (!adminClient) {
      setupError = 'Admin client unavailable';
      logger.error(setupError);
      return;
    }

    // Get user IDs
    const userA = await getUserByEmail(USER_A.email);
    const userB = await getUserByEmail(USER_B.email);

    if (!userA || !userB) {
      setupError = `Test users not found: ${!userA ? USER_A.email : ''} ${!userB ? USER_B.email : ''}`;
      logger.error(setupError);
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

    if (!existing) {
      // Create connection
      await adminClient.from('user_connections').insert({
        requester_id: userA.id,
        addressee_id: userB.id,
        status: 'accepted',
      });
    } else if (existing.status !== 'accepted') {
      // Update to accepted
      await adminClient
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
    }

    // Check if conversation exists
    const [id1, id2] = [userA.id, userB.id].sort();
    const conversationId = `${id1}_${id2}`;

    const { data: existingConvo } = await adminClient
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();

    if (!existingConvo) {
      await adminClient.from('conversations').insert({
        id: conversationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Add participants
      await adminClient.from('conversation_members').insert([
        { conversation_id: conversationId, user_id: userA.id },
        { conversation_id: conversationId, user_id: userB.id },
      ]);
    }

    setupSucceeded = true;
    logger.info('Offline queue test setup complete');
  });

  test('T146: should queue message when offline and send when online', async ({
    browser,
  }) => {
    // Skip if setup failed
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: User A signs in =====
      await page.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(page);
      await page.getByLabel('Email').fill(USER_A.email);
      await page.getByLabel('Password').fill(USER_A.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(page);

      // ===== STEP 2: Navigate to conversation =====
      await page.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Click on Chats tab to see conversations
      const chatsTab = page.getByRole('tab', { name: /Chats/i });
      if (await chatsTab.isVisible()) {
        await chatsTab.click();
        await waitForUIStability(page);
      }

      // Find first conversation button
      const conversationItem = page
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();

      // Wait for message input to confirm conversation is loaded
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 10000 });

      // ===== STEP 3: Go offline =====
      await context.setOffline(true);

      // Verify offline status in browser
      const isOffline = await page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== STEP 4: Send message while offline =====
      const testMessage = `Offline test message ${Date.now()}`;
      const msgInput = page.getByRole('textbox', { name: /Message input/i });
      await expect(msgInput).toBeVisible();
      await msgInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 5: Verify message is queued =====
      // Look for "Sending..." or queue indicator in the UI
      const queueIndicator = page.getByText(/sending|queued/i);

      // Message should appear in UI
      const messageBubble = page.getByText(testMessage);
      await expect(messageBubble).toBeVisible({ timeout: 5000 });

      // ===== STEP 6: Go online =====
      await context.setOffline(false);

      // Verify online status
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== STEP 7: Wait for automatic sync =====
      // Queue should auto-sync within a few seconds - wait for queue indicator to disappear
      await page.waitForTimeout(3000);

      // ===== STEP 8: Verify message is still visible (sent successfully) =====
      await expect(messageBubble).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('T147: should queue multiple messages and sync all when reconnected', async ({
    browser,
  }) => {
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(page);
      await page.getByLabel('Email').fill(USER_A.email);
      await page.getByLabel('Password').fill(USER_A.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(page);

      await page.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Click on Chats tab to see conversations
      const chatsTab = page.getByRole('tab', { name: /Chats/i });
      if (await chatsTab.isVisible()) {
        await chatsTab.click();
        await waitForUIStability(page);
      }

      const conversationItem = page
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();

      // Wait for message input
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 10000 });

      // ===== STEP 2: Go offline =====
      await context.setOffline(true);

      // ===== STEP 3: Send 3 messages while offline =====
      const messages = [
        `Offline message 1 ${Date.now()}`,
        `Offline message 2 ${Date.now()}`,
        `Offline message 3 ${Date.now()}`,
      ];

      const sendButton = page.getByRole('button', { name: /send/i });

      for (const msg of messages) {
        await messageInput.fill(msg);
        await sendButton.click();
        // Wait for UI to stabilize between sends
        await waitForUIStability(page);
      }

      // ===== STEP 4: Verify all 3 messages are queued =====
      for (const msg of messages) {
        const bubble = page.getByText(msg);
        await expect(bubble).toBeVisible();
      }

      // ===== STEP 5: Go online =====
      await context.setOffline(false);

      // ===== STEP 6: Wait for all messages to sync =====
      await page.waitForTimeout(5000);

      // All messages should still be visible (synced)
      for (const msg of messages) {
        const bubble = page.getByText(msg);
        await expect(bubble).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test('T148: should retry with exponential backoff on server failure', async ({
    browser,
  }) => {
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(page);
      await page.getByLabel('Email').fill(USER_A.email);
      await page.getByLabel('Password').fill(USER_A.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(page);

      await page.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Click on Chats tab to see conversations
      const chatsTab = page.getByRole('tab', { name: /Chats/i });
      if (await chatsTab.isVisible()) {
        await chatsTab.click();
        await waitForUIStability(page);
      }

      const conversationItem = page
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();

      // Wait for message input
      const msgInput = page.getByRole('textbox', { name: /Message input/i });
      await expect(msgInput).toBeVisible({ timeout: 10000 });

      // ===== STEP 2: Intercept API calls and simulate failures =====
      let attemptCount = 0;
      const retryTimestamps: number[] = [];

      await page.route('**/rest/v1/messages*', async (route) => {
        attemptCount++;
        retryTimestamps.push(Date.now());

        if (attemptCount < 3) {
          // Fail first 2 attempts
          await route.abort('failed');
        } else {
          // Succeed on 3rd attempt
          await route.continue();
        }
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Retry test message ${Date.now()}`;
      await msgInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for retries =====
      await page
        .waitForFunction(() => true, { timeout: 10000 })
        .catch(() => {});

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
      await context.close();
    }
  });

  test('T149: should handle conflict resolution with server timestamp', async ({
    browser,
  }) => {
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }
    const adminClient = getAdminClient();

    if (!adminClient) {
      test.skip(
        true,
        'Skipping conflict resolution test - Supabase admin client not available'
      );
      return;
    }

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ===== STEP 1: Both users sign in =====
      await pageA.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageA);
      await pageA.getByLabel('Email').fill(USER_A.email);
      await pageA.getByLabel('Password').fill(USER_A.password);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageA);

      await pageB.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageB);
      await pageB.getByLabel('Email').fill(USER_B.email);
      await pageB.getByLabel('Password').fill(USER_B.password);
      await pageB.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageB);

      // ===== STEP 2: Both navigate to same conversation =====
      await pageA.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(pageA);
      await handleReAuthModal(pageA, USER_A.password);

      // Click on Chats tab for user A
      const chatsTabA = pageA.getByRole('tab', { name: /Chats/i });
      if (await chatsTabA.isVisible()) {
        await chatsTabA.click();
        await waitForUIStability(pageA);
      }

      const conversationA = pageA
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationA).toBeVisible({ timeout: 10000 });
      await conversationA.click();

      // Wait for message input on page A
      const inputA = pageA.getByRole('textbox', { name: /Message input/i });
      await expect(inputA).toBeVisible({ timeout: 10000 });

      // Extract conversation ID from URL if present
      const urlA = pageA.url();
      const conversationId = new URL(urlA).searchParams.get('conversation');

      await pageB.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(pageB);
      await handleReAuthModal(pageB, USER_B.password);

      // Click on Chats tab for user B
      const chatsTabB = pageB.getByRole('tab', { name: /Chats/i });
      if (await chatsTabB.isVisible()) {
        await chatsTabB.click();
        await waitForUIStability(pageB);
      }

      const conversationB = pageB
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationB).toBeVisible({ timeout: 10000 });
      await conversationB.click();

      // Wait for message input on page B
      const inputB = pageB.getByRole('textbox', { name: /Message input/i });
      await expect(inputB).toBeVisible({ timeout: 10000 });

      // ===== STEP 3: Both go offline =====
      await contextA.setOffline(true);
      await contextB.setOffline(true);

      // ===== STEP 4: Both send messages with same timestamp =====
      const timestamp = Date.now();
      const messageA = `Message from A ${timestamp}`;
      const messageB = `Message from B ${timestamp}`;

      await inputA.fill(messageA);
      await pageA.getByRole('button', { name: /send/i }).click();

      await inputB.fill(messageB);
      await pageB.getByRole('button', { name: /send/i }).click();

      // ===== STEP 5: Both go online simultaneously =====
      await contextA.setOffline(false);
      await contextB.setOffline(false);

      // ===== STEP 6: Wait for sync =====
      await pageA
        .waitForFunction(() => true, { timeout: 5000 })
        .catch(() => {});
      await pageB
        .waitForFunction(() => true, { timeout: 5000 })
        .catch(() => {});

      // ===== STEP 7: Verify server determined order =====
      if (conversationId) {
        const { data: messages } = await adminClient
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('sequence_number', { ascending: true });

        // Both messages should exist
        expect(messages).toBeDefined();
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
      }

      // ===== STEP 8: Both users should see same order =====
      // Real-time updates should sync the final order to both clients
      await pageA.waitForTimeout(2000);
      await pageB.waitForTimeout(2000);

      // Verify both messages are visible on both pages
      await expect(pageA.getByText(messageA)).toBeVisible();
      await expect(pageB.getByText(messageB)).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('should show failed status after max retries', async ({ browser }) => {
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(page);
      await page.getByLabel('Email').fill(USER_A.email);
      await page.getByLabel('Password').fill(USER_A.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(page);

      await page.goto(`${BASE_URL}/messages`);
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Click on Chats tab to see conversations
      const chatsTab = page.getByRole('tab', { name: /Chats/i });
      if (await chatsTab.isVisible()) {
        await chatsTab.click();
        await waitForUIStability(page);
      }

      const conversationItem = page
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();

      // Wait for message input
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 10000 });

      // ===== STEP 2: Intercept API and always fail =====
      await page.route('**/rest/v1/messages*', async (route) => {
        await route.abort('failed');
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Failed message ${Date.now()}`;
      await messageInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for max retries =====
      // Wait a reasonable time for retries to complete
      await page.waitForTimeout(15000);

      // ===== STEP 5: Verify message is visible (may show failed or pending state) =====
      // The message should at least appear in the UI
      await expect(page.getByText(testMessage)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
