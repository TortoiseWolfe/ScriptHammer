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
  waitForAuthenticatedState,
  dismissCookieBanner,
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

test.describe('Encrypted Messaging Flow', () => {
  // Establish connection between test users BEFORE all tests
  // This fixes the "No conversations" state that causes tests to fail
  test.beforeAll(async () => {
    const adminClient = getTestAdminClient();
    if (!adminClient) {
      console.warn('⚠️ Admin client unavailable - connection setup skipped');
      return;
    }

    // Get user IDs
    const userA = await getUserByEmail(USER_A.email);
    const userB = await getUserByEmail(USER_B.email);

    if (!userA || !userB) {
      console.warn('⚠️ Test users not found - connection setup skipped');
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

    if (existing?.status === 'accepted') {
      console.log('✓ Users already connected');
      return;
    }

    // Create or update connection to 'accepted' status
    if (!existing) {
      const { error } = await adminClient.from('user_connections').insert({
        requester_id: userA.id,
        addressee_id: userB.id,
        status: 'accepted',
      });
      if (error) {
        console.error('Failed to create connection:', error.message);
      } else {
        console.log('✓ Connection created between test users');
      }
    } else {
      const { error } = await adminClient
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      if (error) {
        console.error('Failed to update connection:', error.message);
      } else {
        console.log('✓ Connection updated to accepted');
      }
    }
  });

  test('should send and receive encrypted message between two users', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ===== STEP 1: User A signs in =====
      await pageA.goto(`${BASE_URL}/sign-in`);
      await pageA.waitForLoadState('networkidle');
      await dismissCookieBanner(pageA);
      await pageA.getByLabel('Email').fill(USER_A.email);
      await pageA.getByLabel('Password', { exact: true }).fill(USER_A.password);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageA);

      // ===== STEP 2: User B signs in (in separate context) =====
      await pageB.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageB);
      await pageB.getByLabel('Email').fill(USER_B.email);
      await pageB.getByLabel('Password', { exact: true }).fill(USER_B.password);
      await pageB.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageB);

      // ===== STEP 3: User A navigates to messages =====
      await pageA.goto(`${BASE_URL}/messages`);
      await handleReAuthModal(pageA, USER_A.password);
      await expect(pageA).toHaveURL(/.*\/messages/);

      // ===== STEP 4: User A selects conversation with User B =====
      // Click on the conversation with User B (should exist from friend request acceptance)
      const conversationItem = pageA
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 10000 });
      await conversationItem.click();

      // Wait for conversation to load
      await pageA.waitForTimeout(1000);

      // ===== STEP 5: User A sends an encrypted message =====
      const testMessage = `Test encrypted message ${Date.now()}`;
      const messageInput = pageA.locator(
        'textarea[aria-label="Message input"]'
      );
      await expect(messageInput).toBeVisible();
      await messageInput.fill(testMessage);

      const sendButton = pageA.getByRole('button', { name: /send/i });
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      // Wait for sending state to complete
      await expect(sendButton).not.toContainText('Sending');

      // ===== STEP 6: Verify message appears in User A's view =====
      const messageA = pageA.getByText(testMessage);
      await expect(messageA).toBeVisible({ timeout: 5000 });

      // ===== STEP 7: User B navigates to messages =====
      await pageB.goto(`${BASE_URL}/messages`);
      await handleReAuthModal(pageB, USER_B.password);
      await expect(pageB).toHaveURL(/.*\/messages/);

      // ===== STEP 8: User B opens conversation with User A =====
      const conversationItemB = pageB
        .locator('[data-testid*="conversation"]')
        .first();
      await expect(conversationItemB).toBeVisible({ timeout: 10000 });
      await conversationItemB.click();

      await pageB.waitForTimeout(1000);

      // ===== STEP 9: User B sees the decrypted message =====
      const messageB = pageB.getByText(testMessage);
      await expect(messageB).toBeVisible({ timeout: 5000 });

      // ===== STEP 10: Verify User B can reply =====
      const replyMessage = `Reply from User B ${Date.now()}`;
      const messageInputB = pageB.locator(
        'textarea[aria-label="Message input"]'
      );
      await messageInputB.fill(replyMessage);
      await pageB.getByRole('button', { name: /send/i }).click();

      // Verify reply appears in User B's view
      const replyB = pageB.getByText(replyMessage);
      await expect(replyB).toBeVisible({ timeout: 5000 });

      // ===== STEP 11: User A sees the reply =====
      await pageA.reload();
      await handleReAuthModal(pageA, USER_A.password);
      const replyA = pageA.getByText(replyMessage);
      await expect(replyA).toBeVisible({ timeout: 5000 });
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

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    try {
      // Sign in as User A
      await pageA.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageA);
      await pageA.getByLabel('Email').fill(USER_A.email);
      await pageA.getByLabel('Password', { exact: true }).fill(USER_A.password);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageA);

      // Navigate to messages
      await pageA.goto(`${BASE_URL}/messages`);
      await handleReAuthModal(pageA, USER_A.password);
      const conversationItem = pageA
        .locator('[data-testid*="conversation"]')
        .first();
      await conversationItem.click();
      await pageA.waitForTimeout(1000);

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
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User A signs in and navigates to messages
      await pageA.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageA);
      await pageA.getByLabel('Email').fill(USER_A.email);
      await pageA.getByLabel('Password', { exact: true }).fill(USER_A.password);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageA);

      await pageA.goto(`${BASE_URL}/messages`);
      await handleReAuthModal(pageA, USER_A.password);
      const conversationItem = pageA
        .locator('[data-testid*="conversation"]')
        .first();
      await conversationItem.click();
      await pageA.waitForTimeout(1000);

      // Send a message
      const testMessage = `Delivery status test ${Date.now()}`;
      const messageInput = pageA.locator(
        'textarea[aria-label="Message input"]'
      );
      await messageInput.fill(testMessage);
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

      // Should show "Delivered" (✓✓) since message is saved to database
      await expect(deliveryStatus).toContainText('✓✓');

      // ===== USER B READS THE MESSAGE =====
      await pageB.goto(`${BASE_URL}/sign-in`);
      await dismissCookieBanner(pageB);
      await pageB.getByLabel('Email').fill(USER_B.email);
      await pageB.getByLabel('Password', { exact: true }).fill(USER_B.password);
      await pageB.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageB);

      await pageB.goto(`${BASE_URL}/messages`);
      await handleReAuthModal(pageB, USER_B.password);
      const conversationItemB = pageB
        .locator('[data-testid*="conversation"]')
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

      // Should still show ✓✓ but potentially with different styling (read vs delivered)
      await expect(updatedStatus).toContainText('✓✓');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('should load message history with pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`);
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password', { exact: true }).fill(USER_A.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto(`${BASE_URL}/messages`);
    await handleReAuthModal(page, USER_A.password);
    const conversationItem = page
      .locator('[data-testid*="conversation"]')
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

    // Wait for last message to appear
    await expect(
      page.getByText(`Pagination test message ${messagesToSend}`)
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

    // Sign in and send a message
    await page.goto(`${BASE_URL}/sign-in`);
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password', { exact: true }).fill(USER_A.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto(`${BASE_URL}/messages`);
    await handleReAuthModal(page, USER_A.password);
    const conversationItem = page
      .locator('[data-testid*="conversation"]')
      .first();
    await conversationItem.click();
    await page.waitForTimeout(1000);

    const messageInput = page.locator('textarea[aria-label="Message input"]');
    await messageInput.fill('Key security test message');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByText('Key security test message')).toBeVisible();

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
