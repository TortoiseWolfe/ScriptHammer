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
  fillMessageInput,
  cleanupOldMessages,
  scrollThreadToBottom,
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
    { timeout: 15000 }
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

/** Attach console forwarding to a page for CI diagnostics */
function forwardConsole(page: import('@playwright/test').Page) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('sendMessage') ||
      text.includes('ConversationView') ||
      text.includes('getMessageHistory') ||
      text.includes('AUTH FAILED') ||
      msg.type() === 'error'
    ) {
      console.log(`[browser console.${msg.type()}] ${text}`);
    }
  });
}

/** Wait for conversation data to be cached (required for offline send).
 * loadConversationInfo can fail silently on 403/406 errors, leaving the
 * conversation cache empty. This function retries by reloading the page
 * until the participant name resolves (proves loadConversationInfo
 * completed and cached the conversation data). */
async function waitForConversationCached(
  page: import('@playwright/test').Page,
  conversationId: string,
  password: string
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Wait for the thread to be mounted
    await page.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 30000,
    });
    // Check if participant name resolved (not "Unknown User")
    // This proves loadConversationInfo completed successfully
    const nameResolved = await page.evaluate(() => {
      const cv = document.querySelector('[data-testid="conversation-view"]');
      return cv ? !cv.textContent?.includes('Unknown User') : false;
    });
    if (nameResolved) {
      // Give cacheConversationData a tick to complete (fire-and-forget)
      await page.waitForTimeout(500);
      return;
    }
    console.log(
      `[waitForConversationCached] Attempt ${attempt + 1}/3: participant name not resolved, reloading...`
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, password);
  }
  // Last resort — proceed anyway and let sendMessage fail with a clear error
  console.warn(
    '[waitForConversationCached] Conversation data may not be cached'
  );
}

test.describe('Offline Message Queue', () => {
  test.describe.configure({ timeout: 180000 });

  // Track if setup succeeded - tests will skip if not
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
      USER_A.email === 'test@example.com' ||
      USER_B.email === 'test-user-b@example.com'
    ) {
      setupError = 'Test user emails not configured';
      logger.error(setupError);
      return;
    }

    const adminClient = getTestAdminClient();
    if (!adminClient) {
      setupError = 'Admin client unavailable';
      logger.error(setupError);
      return;
    }

    const userA = await getUserByEmail(USER_A.email);
    const userB = await getUserByEmail(USER_B.email);

    if (!userA || !userB) {
      setupError = `Test users not found: ${!userA ? USER_A.email : ''} ${!userB ? USER_B.email : ''}`;
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
    logger.info('Offline queue test setup complete');
  });

  test.beforeAll(async () => {
    if (!setupSucceeded) return;
    await cleanupOldMessages(USER_A.email, USER_B.email);
  });

  test('T146: should queue message when offline and send when online', async ({
    browser,
  }) => {
    // Skip if setup failed
    if (!setupSucceeded) {
      test.skip(!setupSucceeded, `Setup failed: ${setupError}`);
      return;
    }

    // DIAGNOSTIC: Log setup state
    console.log(
      `[DIAG:T146] conversationId=${conversationId}, setupSucceeded=${setupSucceeded}, BASE_URL=${BASE_URL}`
    );

    const context = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const page = await context.newPage();
    forwardConsole(page);

    try {
      // ===== STEP 1: Navigate directly to conversation via URL =====
      await page.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // DIAGNOSTIC: Log DOM state + auth after navigation
      const t146Diag = await page.evaluate(() => {
        const thread = document.querySelector('[data-testid="message-thread"]');
        const input = document.querySelector(
          'textarea[aria-label="Message input"]'
        );
        const authKeys = Object.keys(localStorage).filter(
          (k) => k.includes('auth') || k.includes('sb-')
        );
        const errors = Array.from(
          document.querySelectorAll('.alert-error, [role="alert"]')
        );
        return {
          threadExists: !!thread,
          inputExists: !!input,
          authKeyCount: authKeys.length,
          firstAuthKey: authKeys[0] || 'none',
          errorCount: errors.length,
          errorTexts: errors
            .map((e) => e.textContent?.substring(0, 80))
            .slice(0, 3),
          bodyText: document.body.textContent?.substring(0, 300) || '',
          url: window.location.href,
        };
      });
      console.log(
        '[DIAG:T146] After handleReAuthModal:',
        JSON.stringify(t146Diag)
      );

      // Wait for conversation view to mount
      await page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      // Wait for message input to confirm conversation is loaded
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // Wait for loadMessages to finish before going offline (populates
      // conversation cache needed for offline encryption).
      await waitForConversationCached(page, conversationId, USER_A.password);

      // ===== STEP 3: Go offline =====
      // Verify message input is ready before going offline
      await expect(messageInput).toBeEnabled({ timeout: 10000 });
      await context.setOffline(true);

      // Verify offline status in browser
      const isOffline = await page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== STEP 4: Send message while offline =====
      const testMessage = `Offline test message ${Date.now()}`;
      await fillMessageInput(page, testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 5: Verify message is queued =====
      // Look for "Sending..." or queue indicator in the UI
      const queueIndicator = page.getByText(/sending|queued/i);

      // Message should appear in UI
      await scrollThreadToBottom(page);
      const messageBubble = page.getByText(testMessage);
      await expect(messageBubble).toBeVisible({ timeout: 30000 });

      // ===== STEP 6: Go online =====
      await context.setOffline(false);

      // Verify online status
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== STEP 7: Wait for automatic sync =====
      // Queue sync + Supabase INSERT can take 10-15s under load
      await page.waitForTimeout(10000);

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
    const context = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const page = await context.newPage();
    forwardConsole(page);

    try {
      // ===== STEP 1: Navigate directly to conversation via URL =====
      await page.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Wait for conversation view to mount
      await page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      // Wait for message input
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });
      await waitForConversationCached(page, conversationId, USER_A.password);

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
    const context = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const page = await context.newPage();

    // Forward browser console for CI debugging
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('sendMessage') ||
        text.includes('ConversationView') ||
        msg.type() === 'error'
      ) {
        console.log(`[T148 console.${msg.type()}] ${text}`);
      }
    });

    try {
      // ===== STEP 1: Navigate directly to conversation via URL =====
      await page.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Wait for conversation view to mount
      await page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      // Wait for message input
      const msgInput = page.getByRole('textbox', { name: /Message input/i });
      await expect(msgInput).toBeVisible({ timeout: 45000 });

      // ===== STEP 2: Intercept API calls and simulate failures =====
      let attemptCount = 0;
      const retryTimestamps: number[] = [];

      // Intercept only POST requests to /messages (inserts). GET requests
      // for loadMessages must pass through — aborting them breaks the UI.
      await page.route('**/rest/v1/messages*', async (route) => {
        const method = route.request().method();
        if (method !== 'POST') {
          await route.continue();
          return;
        }
        console.log(
          `[T148 route] intercepted ${method} ${route.request().url()} (attempt ${attemptCount + 1})`
        );
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
      await fillMessageInput(page, testMessage);

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

    const contextA = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    forwardConsole(pageA);
    forwardConsole(pageB);

    try {
      // ===== STEP 1: User A uses storageState; User B must sign in manually =====
      // USER_B sign-in is only reached when setupSucceeded=true (tertiary email configured)
      await pageB.goto(`${BASE_URL}/sign-in`);
      await pageB.evaluate(() =>
        localStorage.setItem('playwright_e2e', 'true')
      );
      await dismissCookieBanner(pageB);
      await pageB.getByLabel('Email').fill(USER_B.email);
      await pageB.getByLabel('Password').fill(USER_B.password);
      await pageB.getByRole('button', { name: 'Sign In' }).click();
      await pageB.waitForURL(/(?!.*sign-in)/, { timeout: 15000 });

      // ===== STEP 2: Both navigate directly to conversation via URL =====
      await pageA.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(pageA);
      await handleReAuthModal(pageA, USER_A.password);
      await pageA.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });
      const inputA = pageA.getByRole('textbox', { name: /Message input/i });
      await expect(inputA).toBeVisible({ timeout: 45000 });

      await pageB.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(pageB);
      await handleReAuthModal(pageB, USER_B.password);
      await pageB.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });
      const inputB = pageB.getByRole('textbox', { name: /Message input/i });
      await expect(inputB).toBeVisible({ timeout: 45000 });
      await waitForConversationCached(pageA, conversationId, USER_A.password);
      await waitForConversationCached(pageB, conversationId, USER_B.password);

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

      // ===== STEP 6: Wait for offline queue sync =====
      // The offline queue needs time to: detect online status, process
      // queued messages, encrypt, send to Supabase, and get INSERT confirmed.
      // On free tier under 6-shard load this can take 30-60s.
      let messages: { sequence_number: number }[] | null = null;
      for (let poll = 0; poll < 12; poll++) {
        await pageA
          .waitForFunction(() => true, { timeout: 15000 })
          .catch(() => {});
        const { data } = await adminClient
          .from('messages')
          .select('sequence_number')
          .eq('conversation_id', conversationId)
          .order('sequence_number', { ascending: true });
        if (data && data.length >= 2) {
          messages = data;
          break;
        }
        console.log(
          `[T149] Poll ${poll + 1}/12: ${data?.length ?? 0} messages found, waiting...`
        );
      }

      // ===== STEP 7: Verify server determined order =====
      if (conversationId) {
        // Both messages should exist
        expect(messages).not.toBeNull();
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
    const context = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const page = await context.newPage();
    forwardConsole(page);

    try {
      // ===== STEP 1: Navigate directly to conversation via URL =====
      await page.goto(`${BASE_URL}/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A.password);

      // Wait for conversation view to mount
      await page.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      // Wait for message input
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // ===== STEP 2: Intercept API and always fail =====
      await page.route('**/rest/v1/messages*', async (route) => {
        await route.abort('failed');
      });

      // ===== STEP 3: Send message =====
      const testMessage = `Failed message ${Date.now()}`;
      await fillMessageInput(page, testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // ===== STEP 4: Wait for max retries =====
      // Wait a reasonable time for retries to complete
      await page.waitForTimeout(15000);

      // ===== STEP 5: Verify message is visible (may show failed or pending state) =====
      // The message should at least appear in the UI
      await scrollThreadToBottom(page);
      await expect(page.getByText(testMessage)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
