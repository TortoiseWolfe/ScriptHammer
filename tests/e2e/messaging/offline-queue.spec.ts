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

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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
  test('T146: should queue message when offline and send when online', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: User A signs in =====
      await page.goto(`${BASE_URL}/sign-in`);
      await page.fill('#email', USER_A.email);
      await page.fill('#password', USER_A.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // ===== STEP 2: Navigate to conversation =====
      await page.goto(`${BASE_URL}/conversations`);
      const conversationItem = page
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();
      await page.waitForURL(/.*\/messages\?conversation=.*/);

      // ===== STEP 3: Go offline =====
      await context.setOffline(true);

      // Verify offline status in browser
      const isOffline = await page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== STEP 4: Send message while offline =====
      const testMessage = `Offline test message ${Date.now()}`;
      const messageInput = page.locator('textarea[aria-label="Message input"]');
      await expect(messageInput).toBeVisible();
      await messageInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 5: Verify message is queued =====
      // Look for "Sending..." or queue indicator
      const queueIndicator = page
        .locator('[data-testid="queue-status"]')
        .or(page.getByText(/sending|queued/i));
      await expect(queueIndicator).toBeVisible({ timeout: 5000 });

      // Message should appear in UI but marked as queued
      const messageBubble = page.getByText(testMessage);
      await expect(messageBubble).toBeVisible();

      // ===== STEP 6: Go online =====
      await context.setOffline(false);

      // Verify online status
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== STEP 7: Wait for automatic sync =====
      // Queue should auto-sync within a few seconds
      await expect(queueIndicator).not.toBeVisible({ timeout: 10000 });

      // ===== STEP 8: Verify message sent successfully =====
      // Look for "Delivered" or checkmark indicator
      const deliveryIndicator = page
        .locator('[data-testid*="delivered"]')
        .or(page.getByRole('img', { name: /delivered|checkmark/i }));

      await expect(deliveryIndicator).toBeVisible({ timeout: 5000 });
    } finally {
      await context.close();
    }
  });

  test('T147: should queue multiple messages and sync all when reconnected', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await page.fill('#email', USER_A.email);
      await page.fill('#password', USER_A.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      await page.goto(`${BASE_URL}/conversations`);
      const conversationItem = page
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();
      await page.waitForURL(/.*\/messages\?conversation=.*/);

      // ===== STEP 2: Go offline =====
      await context.setOffline(true);

      // ===== STEP 3: Send 3 messages while offline =====
      const messages = [
        `Offline message 1 ${Date.now()}`,
        `Offline message 2 ${Date.now()}`,
        `Offline message 3 ${Date.now()}`,
      ];

      const messageInput = page.locator('textarea[aria-label="Message input"]');
      const sendButton = page.getByRole('button', { name: /send/i });

      for (const msg of messages) {
        await messageInput.fill(msg);
        await sendButton.click();
        await page.waitForTimeout(500); // Small delay between sends
      }

      // ===== STEP 4: Verify all 3 messages are queued =====
      for (const msg of messages) {
        const bubble = page.getByText(msg);
        await expect(bubble).toBeVisible();
      }

      // Check queue count (if displayed in UI)
      const queueCount = page.locator('[data-testid="queue-count"]');
      if (await queueCount.isVisible()) {
        const count = await queueCount.textContent();
        expect(count).toContain('3');
      }

      // ===== STEP 5: Go online =====
      await context.setOffline(false);

      // ===== STEP 6: Wait for all messages to sync =====
      // All messages should show delivered status
      await page.waitForTimeout(5000); // Give time for automatic sync

      // Verify no more queue indicators
      const queueIndicator = page.locator('[data-testid="queue-status"]');
      await expect(queueIndicator).not.toBeVisible({ timeout: 10000 });
    } finally {
      await context.close();
    }
  });

  test('T148: should retry with exponential backoff on server failure', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await page.fill('#email', USER_A.email);
      await page.fill('#password', USER_A.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      await page.goto(`${BASE_URL}/conversations`);
      const conversationItem = page
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();
      await page.waitForURL(/.*\/messages\?conversation=.*/);

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
      const messageInput = page.locator('textarea[aria-label="Message input"]');
      await messageInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for retries =====
      await page.waitForTimeout(10000); // Wait for retries

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
      await pageA.fill('#email', USER_A.email);
      await pageA.fill('#password', USER_A.password);
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL('/');

      await pageB.goto(`${BASE_URL}/sign-in`);
      await pageB.fill('#email', USER_B.email);
      await pageB.fill('#password', USER_B.password);
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL('/');

      // ===== STEP 2: Both navigate to same conversation =====
      await pageA.goto(`${BASE_URL}/conversations`);
      const conversationA = pageA
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationA).toBeVisible({ timeout: 10000 });
      await conversationA.click();
      await pageA.waitForURL(/.*\/messages\?conversation=.*/);

      // Extract conversation ID from URL
      const urlA = pageA.url();
      const conversationId = new URL(urlA).searchParams.get('conversation');

      await pageB.goto(`${BASE_URL}/conversations`);
      const conversationB = pageB
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationB).toBeVisible({ timeout: 10000 });
      await conversationB.click();
      await pageB.waitForURL(/.*\/messages\?conversation=.*/);

      // ===== STEP 3: Both go offline =====
      await contextA.setOffline(true);
      await contextB.setOffline(true);

      // ===== STEP 4: Both send messages with same timestamp =====
      const timestamp = Date.now();
      const messageA = `Message from A ${timestamp}`;
      const messageB = `Message from B ${timestamp}`;

      const inputA = pageA.locator('textarea[aria-label="Message input"]');
      await inputA.fill(messageA);
      await pageA.getByRole('button', { name: /send/i }).click();

      const inputB = pageB.locator('textarea[aria-label="Message input"]');
      await inputB.fill(messageB);
      await pageB.getByRole('button', { name: /send/i }).click();

      // ===== STEP 5: Both go online simultaneously =====
      await contextA.setOffline(false);
      await contextB.setOffline(false);

      // ===== STEP 6: Wait for sync =====
      await pageA.waitForTimeout(5000);
      await pageB.waitForTimeout(5000);

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

      const messagesA = await pageA.locator('[data-testid*="message"]').all();
      const messagesB = await pageB.locator('[data-testid*="message"]').all();

      // Both should see the same number of messages
      expect(messagesA.length).toBe(messagesB.length);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('should show failed status after max retries', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ===== STEP 1: Sign in and navigate to conversation =====
      await page.goto(`${BASE_URL}/sign-in`);
      await page.fill('#email', USER_A.email);
      await page.fill('#password', USER_A.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      await page.goto(`${BASE_URL}/conversations`);
      const conversationItem = page
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();
      await page.waitForURL(/.*\/messages\?conversation=.*/);

      // ===== STEP 2: Intercept API and always fail =====
      await page.route('**/rest/v1/messages*', async (route) => {
        await route.abort('failed');
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Failed message ${Date.now()}`;
      const messageInput = page.locator('textarea[aria-label="Message input"]');
      await messageInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for max retries (5 attempts with exponential backoff) =====
      // 1s + 2s + 4s + 8s + 16s = 31s total
      await page.waitForTimeout(35000);

      // ===== STEP 5: Verify "Failed to send" status =====
      const failedIndicator = page
        .locator('[data-testid="failed-status"]')
        .or(page.getByText(/failed to send|retry/i));

      await expect(failedIndicator).toBeVisible({ timeout: 5000 });

      // ===== STEP 6: Verify retry button exists =====
      const retryButton = page.getByRole('button', { name: /retry/i });
      await expect(retryButton).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
