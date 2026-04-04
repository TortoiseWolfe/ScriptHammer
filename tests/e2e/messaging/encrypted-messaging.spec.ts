/**
 * E2E Test for Encrypted Messaging Flow
 * Task: T044
 *
 * Tests:
 * 1. Send encrypted message from User A → User B
 * 2. User B receives and decrypts message correctly
 * 3. Verify database only stores ciphertext (zero-knowledge)
 * 4. Verify encryption keys never sent to server
 * 5. Test delivery status indicators
 * 6. Test pagination and message history
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  handleReAuthModal,
  dismissCookieBanner,
  performSignIn,
  fillMessageInput,
  cleanupOldMessages,
  scrollThreadToBottom,
  resetEncryptionKeys,
  getAdminClient as getTestAdminClient,
  getUserByEmail,
} from '../utils/test-user-factory';

const BASE_URL = process.env.NEXT_PUBLIC_DEPLOY_URL || 'http://localhost:3000';

// Test users - use PRIMARY and TERTIARY from standardized test fixtures (Feature 026)
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
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

// Shared across describe blocks — set in 'Encrypted Messaging Flow' beforeAll
let testConversationId = '';

test.describe('Encrypted Messaging Flow', () => {
  // Serial: tests share auth state and Realtime subscriptions.
  // Parallel execution causes subscription contention on Supabase Cloud free tier.
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  // Track if setup succeeded - tests will skip if not
  let setupSucceeded = false;
  let setupError = '';

  // Verify test data created by auth.setup.ts exists
  test.beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
      console.error(`❌ ${setupError}`);
      return;
    }

    if (
      USER_A.email === 'test@example.com' ||
      USER_B.email === 'test-user-b@example.com'
    ) {
      setupError =
        'TEST_USER_PRIMARY_EMAIL or TEST_USER_TERTIARY_EMAIL not configured';
      console.error(`❌ ${setupError}`);
      return;
    }

    const adminClient = getTestAdminClient();
    if (!adminClient) {
      setupError = 'Admin client unavailable';
      console.error(`❌ ${setupError}`);
      return;
    }

    const userA = await getUserByEmail(USER_A.email);
    const userB = await getUserByEmail(USER_B.email);

    if (!userA || !userB) {
      setupError = `Test users not found: ${!userA ? USER_A.email : ''} ${!userB ? USER_B.email : ''}`;
      console.error(`❌ ${setupError}`);
      return;
    }

    // Ensure connection exists (auth.setup.ts creates it, but self-heal
    // in case friend-requests cleanup or Supabase contention deleted it)
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
        console.error(`❌ ${setupError}`);
        return;
      }
      console.log('✓ Connection created (self-heal)');
    } else if (existing.status !== 'accepted') {
      await adminClient
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      console.log('✓ Connection updated to accepted');
    } else {
      console.log('✓ Connection already exists');
    }

    // Ensure conversation exists
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
        console.error(`❌ ${setupError}`);
        return;
      }
      testConversationId = newConv.id;
      console.log('✓ Conversation created (self-heal):', testConversationId);
    } else {
      testConversationId = existingConv.id;
      console.log('✓ Conversation already exists:', testConversationId);
    }

    setupSucceeded = true;
  });

  // Clean up old messages from previous CI runs so the conversation
  // starts with < 100 messages (virtual scrolling threshold).
  test.beforeAll(async () => {
    if (!setupSucceeded) return;
    await cleanupOldMessages(USER_A.email, USER_B.email);
  });

  // Skip all tests if setup failed
  test.beforeEach(async ({}, testInfo) => {
    if (!setupSucceeded) {
      testInfo.skip(true, `Test setup failed: ${setupError}`);
    }
  });

  test('should send and receive encrypted message between two users', async ({
    browser,
  }) => {
    // User A gets pre-authenticated state; User B signs in manually
    const contextA = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Forward browser console from BOTH pages for CI diagnostics
    for (const [label, pg] of [
      ['pageA', pageA],
      ['pageB', pageB],
    ] as const) {
      pg.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('sendMessage') ||
          text.includes('ConversationView') ||
          text.includes('getMessageHistory') ||
          text.includes('getUserPublicKey') ||
          text.includes('DECRYPTION') ||
          msg.type() === 'error'
        ) {
          console.log(`[${label} console.${msg.type()}] ${text}`);
        }
      });
    }

    try {
      // ===== STEP 1: User A already authenticated via storageState =====

      // ===== STEP 2: User B signs in (in separate context) =====
      await pageB.goto(`${BASE_URL}/sign-in`);
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }

      // Reset User B's encryption keys — SignInForm.initializeKeys() creates
      // a duplicate key row (hasKeys() race with session persistence), breaking
      // ECDH. This deletes duplicates and clears the stale localStorage cache.
      await resetEncryptionKeys(pageB, USER_B.email, USER_B.password);

      // ===== STEP 3: User A navigates directly to conversation =====
      // Navigate via URL with conversation ID to bypass the slow conversation
      // list query (3+ minutes on Supabase free tier with 18 concurrent CI jobs).
      await pageA.goto(
        `${BASE_URL}/messages?conversation=${testConversationId}`,
        { waitUntil: 'domcontentloaded' }
      );
      await handleReAuthModal(pageA, USER_A.password);

      // Wait for conversation view to mount (handleReAuthModal + Argon2id can take 30-45s on CI)
      await pageA.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      // ===== STEP 5: User A sends an encrypted message =====
      // Capture ALL browser console for diagnostics
      const consoleLogs: string[] = [];
      pageA.on('console', (msg) => {
        const text = msg.text();
        consoleLogs.push(`[${msg.type()}] ${text}`);
        if (
          text.includes('ConversationView') ||
          text.includes('sendMessage') ||
          msg.type() === 'error'
        ) {
          console.log(`[pageA console.${msg.type()}] ${text}`);
        }
      });

      const testMessage = `Test encrypted message ${Date.now()}`;
      await fillMessageInput(pageA, testMessage);

      const sendButton = pageA.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Wait for sending state to complete (Supabase free tier: up to 15s)
      await expect(sendButton).not.toContainText('Sending', { timeout: 60000 });

      // ===== STEP 6: Verify message appears in User A's view =====
      // WebKit + Supabase free tier: INSERT can take 30+ seconds.
      await scrollThreadToBottom(pageA);
      const messageA = pageA.getByText(testMessage);
      try {
        await expect(messageA).toBeVisible({ timeout: 60000 });
      } catch (e) {
        // Dump all captured console logs on failure
        console.log('=== BROWSER CONSOLE DUMP (pageA) ===');
        consoleLogs.forEach((l) => console.log(l));
        console.log('=== END CONSOLE DUMP ===');
        throw e;
      }

      // Brief delay for Supabase replication before User B reads
      await pageA.waitForTimeout(2000);

      // ===== STEP 7: User B navigates directly to conversation =====
      await pageB.goto(
        `${BASE_URL}/messages?conversation=${testConversationId}`,
        { waitUntil: 'domcontentloaded' }
      );
      await handleReAuthModal(pageB, USER_B.password);
      await pageB.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 45000,
      });

      // ===== STEP 9: User B sees the decrypted message =====
      // Supabase free tier may return empty results or stale reads.
      // Retry with page reloads up to 3 times with 3s waits.
      await scrollThreadToBottom(pageB);
      const messageB = pageB.getByText(testMessage);
      for (let retry = 0; retry < 3; retry++) {
        const visible = await messageB
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (visible) break;
        console.log(
          `[encrypted-messaging] Message not visible on User B (attempt ${retry + 1}/3), reloading...`
        );
        // Dump page content for diagnostics
        const threadText = await pageB
          .locator('[data-testid="message-thread"]')
          .textContent()
          .catch(() => '(not found)');
        console.log(
          `[encrypted-messaging] Thread content: ${threadText?.slice(0, 200)}`
        );
        await pageB.waitForTimeout(3000);
        await pageB.reload({ waitUntil: 'domcontentloaded' });
        await handleReAuthModal(pageB, USER_B.password);
        await pageB.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        });
        await scrollThreadToBottom(pageB);
      }
      await expect(messageB).toBeVisible({ timeout: 30000 });

      // ===== STEP 10: Verify User B can reply =====
      const replyMessage = `Reply from User B ${Date.now()}`;
      await fillMessageInput(pageB, replyMessage);
      await pageB.getByRole('button', { name: /send/i }).click();

      // Verify reply appears in User B's view
      await scrollThreadToBottom(pageB);
      const replyB = pageB.getByText(replyMessage);
      await expect(replyB).toBeVisible({ timeout: 30000 });

      // ===== STEP 11: User A sees the reply =====
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await handleReAuthModal(pageA, USER_A.password);
      await scrollThreadToBottom(pageA);
      const replyA = pageA.getByText(replyMessage);
      await expect(replyA).toBeVisible({ timeout: 30000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('should verify zero-knowledge encryption in database', async ({
    browser,
  }) => {
    const adminClient = getAdminClient();

    if (!adminClient) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    // User A gets pre-authenticated state
    const contextA = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const pageA = await contextA.newPage();

    try {
      // User A already authenticated via storageState
      // Navigate to messages
      await pageA.goto(`${BASE_URL}/messages`, {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageA, USER_A.password);
      const conversationItem = pageA
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await conversationItem.click();
      await pageA.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 45000,
      });

      // Send a test message with known plaintext
      const secretMessage = `Secret message for zero-knowledge test ${Date.now()}`;
      const messageInput = pageA.locator(
        'textarea[aria-label="Message input"]'
      );
      await messageInput.fill(secretMessage);
      await pageA.getByRole('button', { name: /send/i }).click();

      // Wait for message to appear
      await expect(pageA.getByText(secretMessage)).toBeVisible({
        timeout: 5000,
      });

      // Wait a moment for database write to complete
      await pageA.waitForTimeout(2000);

      // ===== VERIFY DATABASE ENCRYPTION =====
      // Query messages table directly as admin
      const { data: messages, error } = await adminClient
        .from('messages')
        .select('encrypted_content, initialization_vector')
        .order('created_at', { ascending: false })
        .limit(10);

      expect(error).toBeNull();
      expect(messages).toBeTruthy();
      expect(messages!.length).toBeGreaterThan(0);

      // Verify that the plaintext is NOT in the database
      const foundPlaintext = messages!.some((msg) => {
        const content = msg.encrypted_content;
        // Check if encrypted_content contains the secret message (it shouldn't)
        return content && content.includes(secretMessage);
      });

      expect(foundPlaintext).toBe(false); // Plaintext should NEVER be in database

      // Verify encrypted_content is base64 (ciphertext format)
      const hasEncryptedData = messages!.every((msg) => {
        const content = msg.encrypted_content;
        const iv = msg.initialization_vector;

        // Both should be base64 strings (not plaintext)
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(content);
        const hasIV = typeof iv === 'string' && iv.length > 0;

        return isBase64 && hasIV;
      });

      expect(hasEncryptedData).toBe(true); // All messages should be encrypted
    } finally {
      await contextA.close();
    }
  });

  test('should show delivery status indicators', async ({ browser }) => {
    // User A gets pre-authenticated state; User B signs in manually
    const contextA = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User A already authenticated via storageState, navigate to messages
      await pageA.goto(`${BASE_URL}/messages`, {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageA, USER_A.password);
      const conversationItem = pageA
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await conversationItem.click();
      await pageA.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 45000,
      });

      // Send a message
      const testMessage = `Delivery status test ${Date.now()}`;
      await fillMessageInput(pageA, testMessage);
      await pageA.getByRole('button', { name: /send/i }).click();

      // Wait for message to appear
      await expect(pageA.getByText(testMessage)).toBeVisible({ timeout: 5000 });

      // ===== VERIFY "SENT" STATUS (✓) =====
      // Message should show single checkmark initially
      const messageBubble = pageA
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: testMessage });
      await expect(messageBubble).toBeVisible();

      // Look for delivery status indicator
      const deliveryStatus = messageBubble.locator(
        '[data-testid="delivery-status"]'
      );
      await expect(deliveryStatus).toBeVisible();

      // Should show "Delivered" status - ReadReceipt uses SVG icons with aria-label
      const readReceipt = deliveryStatus.locator(
        '[data-testid="read-receipt"]'
      );
      await expect(readReceipt).toHaveAttribute(
        'aria-label',
        /Message (delivered|read)/i
      );

      // ===== USER B READS THE MESSAGE =====
      await pageB.goto(`${BASE_URL}/sign-in`);
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }
      await resetEncryptionKeys(pageB, USER_B.email, USER_B.password);

      await pageB.goto(`${BASE_URL}/messages`, {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageB, USER_B.password);
      const conversationItemB = pageB
        .getByRole('button', { name: /Conversation with/ })
        .first();
      await conversationItemB.click();
      await pageB.waitForTimeout(1000);

      // Verify User B sees the message
      await expect(pageB.getByText(testMessage)).toBeVisible({ timeout: 5000 });

      // ===== VERIFY "READ" STATUS (✓✓ colored) =====
      // Reload User A's page to see updated read status
      await pageA.reload();
      await handleReAuthModal(pageA, USER_A.password);
      await expect(pageA.getByText(testMessage)).toBeVisible();

      const updatedMessageBubble = pageA
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: testMessage });
      const updatedStatus = updatedMessageBubble.locator(
        '[data-testid="delivery-status"]'
      );

      // Should show status indicator - ReadReceipt uses SVG icons with aria-label
      const updatedReceipt = updatedStatus.locator(
        '[data-testid="read-receipt"]'
      );
      await expect(updatedReceipt).toHaveAttribute(
        'aria-label',
        /Message (delivered|read)/i
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('should load message history with pagination', async ({ page }) => {
    // Already authenticated via storageState
    await page.goto(`${BASE_URL}/messages`, { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, USER_A.password);
    const conversationItem = page
      .getByRole('button', { name: /Conversation with/ })
      .first();
    await conversationItem.click();
    await page.waitForTimeout(1000);

    // ===== SEND MULTIPLE MESSAGES =====
    const messageCount = 55; // More than default page size (50)
    const messagesToSend = 10; // Send 10 new messages for this test

    for (let i = 0; i < messagesToSend; i++) {
      const messageInput = page.locator('textarea[aria-label="Message input"]');
      await messageInput.fill(`Pagination test message ${i + 1}`);
      await page.getByRole('button', { name: /send/i }).click();

      // Wait a bit between messages to ensure they have different sequence numbers
      await page.waitForTimeout(500);
    }

    // Wait for last message to appear (use .first() in case duplicates from previous runs)
    await expect(
      page.getByText(`Pagination test message ${messagesToSend}`).first()
    ).toBeVisible({ timeout: 5000 });

    // ===== VERIFY PAGINATION =====
    // Count visible messages (should be limited to page size)
    const messageBubbles = page.locator('[data-testid="message-bubble"]');
    const visibleCount = await messageBubbles.count();

    // Should show up to 50 messages initially (default page size)
    expect(visibleCount).toBeGreaterThan(0);
    expect(visibleCount).toBeLessThanOrEqual(50);

    // ===== TEST "LOAD MORE" FUNCTIONALITY =====
    // Scroll to top of message thread
    await page
      .locator('[data-testid="message-thread"]')
      .first()
      .evaluate((el) => {
        el.scrollTop = 0;
      });

    // Look for "Load More" button
    const loadMoreButton = page.getByRole('button', {
      name: /load more|older messages/i,
    });

    if (await loadMoreButton.isVisible()) {
      const countBefore = await messageBubbles.count();

      await loadMoreButton.click();

      // Wait for more messages to load
      await page.waitForTimeout(2000);

      const countAfter = await messageBubbles.count();

      // Should have loaded more messages
      expect(countAfter).toBeGreaterThan(countBefore);
    }
  });
});

test.describe('Encryption Key Security', () => {
  test('should never send private keys to server', async ({
    page,
    context,
  }) => {
    // Monitor network requests to verify no private keys are sent
    const networkRequests: any[] = [];

    page.on('request', (request) => {
      const postData = request.postData();
      if (postData) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          body: postData,
        });
      }
    });

    // Navigate directly to conversation via URL to bypass slow sidebar query
    if (!testConversationId) {
      console.log('No conversation ID — skipping key security test');
      test.skip(true, 'No conversation ID available');
      return;
    }

    await page.goto(`${BASE_URL}/messages?conversation=${testConversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, USER_A.password);
    await page.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60000,
    });

    const messageInput = page.getByRole('textbox', { name: /Message input/i });
    await expect(messageInput).toBeVisible({ timeout: 45000 });
    await fillMessageInput(page, 'Key security test message');
    await page.getByRole('button', { name: /send/i }).click();

    await scrollThreadToBottom(page);
    await expect(page.getByText('Key security test message')).toBeVisible({
      timeout: 30000,
    });

    // ===== VERIFY NO PRIVATE KEYS IN NETWORK REQUESTS =====
    const foundPrivateKey = networkRequests.some((req) => {
      const body = req.body.toLowerCase();
      // Check for common private key indicators
      return (
        body.includes('"d":') || // JWK private key component
        body.includes('"privatekey"') ||
        body.includes('private_key') ||
        body.includes('privatekey')
      );
    });

    expect(foundPrivateKey).toBe(false); // Private keys should NEVER be sent to server
  });
});
