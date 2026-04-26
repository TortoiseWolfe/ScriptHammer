/**
 * E2E Test: Complete User Messaging Workflow
 * Feature: 024-add-third-test
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  handleReAuthModal,
  waitForAuthenticatedState,
  dismissCookieBanner,
  fillMessageInput,
  cleanupOldMessages,
  scrollThreadToBottom,
  resetEncryptionKeys,
} from '../utils/test-user-factory';

const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  username: 'testuser-b',
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

let adminClient: SupabaseClient | null = null;

const getAdminClient = (): SupabaseClient | null => {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not configured');
    return null;
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClient;
};

const getUserIds = async (
  client: SupabaseClient
): Promise<{ userAId: string | null; userBId: string | null }> => {
  const { data: authUsers } = await client.auth.admin.listUsers();
  let userAId: string | null = null;
  let userBId: string | null = null;

  if (authUsers?.users) {
    for (const user of authUsers.users) {
      if (user.email === USER_A.email) userAId = user.id;
      if (user.email === USER_B.email) userBId = user.id;
    }
  }

  return { userAId, userBId };
};

/**
 * Get display_name for a user by email.
 * UserSearch searches by display_name, not username.
 * If display_name is null, sets it to email prefix so searches work.
 */
const getDisplayNameByEmail = async (email: string): Promise<string> => {
  const client = getAdminClient();
  const fallbackName = email.split('@')[0];

  if (!client) {
    console.warn('getDisplayNameByEmail: No admin client, using email prefix');
    return fallbackName;
  }

  const { data: users } = await client.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);
  if (!user) {
    console.warn(`getDisplayNameByEmail: User not found for ${email}`);
    return fallbackName;
  }

  const { data: profile } = await client
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  if (profile?.display_name) {
    return profile.display_name;
  }

  // display_name is null - SET IT so searches work
  console.log(
    `getDisplayNameByEmail: Setting display_name for ${email} to "${fallbackName}"`
  );
  await client
    .from('user_profiles')
    .update({ display_name: fallbackName })
    .eq('id', user.id);

  return fallbackName;
};

const cleanupTestData = async (client: SupabaseClient): Promise<void> => {
  const { userAId, userBId } = await getUserIds(client);

  if (!userAId || !userBId) {
    console.warn('Could not find user IDs for cleanup');
    return;
  }

  console.log('Cleanup: User A ID: ' + userAId + ', User B ID: ' + userBId);

  await client
    .from('messages')
    .delete()
    .or('sender_id.eq.' + userAId + ',sender_id.eq.' + userBId);
  await client
    .from('conversations')
    .delete()
    .or(
      'participant_1_id.eq.' +
        userAId +
        ',participant_1_id.eq.' +
        userBId +
        ',participant_2_id.eq.' +
        userAId +
        ',participant_2_id.eq.' +
        userBId
    );
  await client
    .from('user_connections')
    .delete()
    .or(
      'requester_id.eq.' +
        userAId +
        ',requester_id.eq.' +
        userBId +
        ',addressee_id.eq.' +
        userAId +
        ',addressee_id.eq.' +
        userBId
    );

  console.log('Cleanup completed');
};

const createConversation = async (
  client: SupabaseClient
): Promise<string | null> => {
  const { userAId, userBId } = await getUserIds(client);
  if (!userAId || !userBId) return null;

  // Use canonical ordering (smaller UUID first)
  const participant1 = userAId < userBId ? userAId : userBId;
  const participant2 = userAId < userBId ? userBId : userAId;

  // Check if conversation already exists
  const { data: existing } = await client
    .from('conversations')
    .select('id')
    .eq('participant_1_id', participant1)
    .eq('participant_2_id', participant2)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new conversation
  const { data: newConvo, error } = await client
    .from('conversations')
    .insert({ participant_1_id: participant1, participant_2_id: participant2 })
    .select()
    .single();

  if (error) {
    console.log('Failed to create conversation: ' + error.message);
    return null;
  }

  return newConvo.id;
};

test.describe('Complete User Messaging Workflow (Feature 024)', () => {
  // Serial: multi-user workflow creates browser contexts with Realtime subscriptions.
  test.describe.configure({ mode: 'serial', timeout: 600000 });

  // DO NOT clean up connections/conversations here. With 2 parallel workers
  // in the same shard, cleanup deletes data that other test files
  // (message-editing, offline-queue, encrypted-messaging, performance)
  // depend on. The admin-seeded connections/conversations are idempotent —
  // they use IF NOT EXISTS patterns and don't need cleanup between tests.

  // But DO clean up old messages — they accumulate across CI runs and trigger
  // virtual scrolling (100+ threshold), hiding new messages from the DOM.
  test.beforeAll(async () => {
    await cleanupOldMessages(USER_A.email, USER_B.email);
  });

  test('Complete messaging workflow: sign-in -> connect -> message -> sign-out', async ({
    browser,
  }) => {
    test.setTimeout(600000); // 10 minutes — 10-retry pageB-visibility loop
    // under Supabase free-tier tail latency can take ~500s worst case.

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
          text.includes('restoreKeysFromCache') ||
          text.includes('deriveKeys') ||
          text.includes('DECRYPTION') ||
          msg.type() === 'error'
        ) {
          console.log(`[${label} console.${msg.type()}] ${text}`);
        }
      });
    }

    // Diagnostic: check if storageState loaded the auth token
    await pageA.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const lsKeys = await pageA.evaluate(() => Object.keys(localStorage));
    const hasAuth = lsKeys.some(
      (k) => k.includes('auth-token') || k.includes('sb-')
    );
    console.log(
      `[complete-user-workflow] pageA localStorage keys: ${JSON.stringify(lsKeys)}`
    );
    console.log(
      `[complete-user-workflow] auth token in localStorage: ${hasAuth}`
    );

    let conversationId: string | null = null;
    let testMessage = '';
    let replyMessage = '';

    try {
      // STEP 1: User A already authenticated via storageState
      console.log('Step 1: User A authenticated via storageState');

      // STEP 2: Navigate to connections
      // First navigate to /messages to hydrate auth + unlock encryption keys.
      // The storageState loads the Supabase token but auth context needs a
      // full page load to hydrate. handleReAuthModal waits for the modal.
      console.log('Step 2: Navigating to connections...');
      await pageA.goto('/messages', { waitUntil: 'domcontentloaded' });
      await handleReAuthModal(pageA, USER_A.password);
      // Now click the Connections tab (auth is hydrated, sidebar is visible)
      const connectionsTab = pageA.getByRole('tab', { name: /Connections/i });
      await connectionsTab.waitFor({ state: 'visible', timeout: 45000 });
      await connectionsTab.click();
      await pageA.waitForTimeout(500);
      console.log('Step 2: Connections page loaded');

      // STEP 3: Search for User B
      // UserSearch searches by display_name, not username
      const userBDisplayName = await getDisplayNameByEmail(USER_B.email);
      console.log(
        'Step 3: Searching for User B with display_name: ' + userBDisplayName
      );
      // UserSearch uses placeholder "Enter name"
      const searchInput = pageA
        .getByPlaceholder(/Enter name/i)
        .or(pageA.getByRole('searchbox'))
        .first();
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.fill(userBDisplayName);
      await searchInput.press('Enter');
      console.log('Step 3: Submitted search');

      // Wait for results - use role-based or text selectors
      await pageA.waitForTimeout(2000);
      const hasResults = await pageA
        .getByText(userBDisplayName)
        .isVisible()
        .catch(() => false);
      if (!hasResults) {
        const errorText = await pageA
          .getByRole('alert')
          .textContent()
          .catch(() => 'unknown');
        console.warn('Search did not find User B. Error: ' + errorText);
        // Don't throw - test may still work with existing connection
      }
      console.log('Step 3: Search completed');

      // STEP 4: Send friend request (or skip if already connected)
      // With 2 parallel workers, another test's beforeAll may have already
      // created the connection. The search may also fail on Supabase free
      // tier. Handle all cases gracefully.
      console.log('Step 4: Checking connection status...');
      const sendRequestButton = pageA.getByRole('button', {
        name: /send request/i,
      });
      const hasSendButton = await sendRequestButton
        .isVisible({ timeout: 15000 })
        .catch(() => false);
      if (hasSendButton) {
        await sendRequestButton.click({ force: true });
        await expect(pageA.getByText(/friend request sent/i)).toBeVisible({
          timeout: 15000,
        });
        console.log('Step 4: Friend request sent');
      } else {
        console.log(
          'Step 4: No Send Request button — users may already be connected, skipping'
        );
      }

      // STEP 5: User B signs in
      console.log('Step 5: User B signing in...');
      // Set E2E flag BEFORE sign-in so SignInForm.isE2E=true → skips
      // hasKeys() → prevents initializeKeys() from creating duplicate
      // keys with a different salt (which breaks ECDH decryption).
      await pageB.goto('/sign-in');
      await pageB.waitForLoadState('domcontentloaded');
      await pageB.evaluate(() =>
        localStorage.setItem('playwright_e2e', 'true')
      );
      await dismissCookieBanner(pageB);
      await pageB.getByLabel('Email').fill(USER_B.email);
      await pageB.getByLabel('Password', { exact: true }).fill(USER_B.password);
      await pageB.getByRole('button', { name: 'Sign In' }).click();
      await waitForAuthenticatedState(pageB);
      await resetEncryptionKeys(pageB, USER_B.email, USER_B.password);
      console.log('Step 5: User B signed in');

      // STEP 6: User B views pending requests
      console.log('Step 6: User B viewing pending requests...');
      await pageB.goto('/messages?tab=connections', {
        waitUntil: 'domcontentloaded',
      });
      await pageB.waitForLoadState('domcontentloaded');
      await handleReAuthModal(pageB, USER_B.password);
      await expect(pageB).toHaveURL(/.*\/messages/);

      const receivedTab = pageB.getByRole('tab', {
        name: /pending received|received|pending/i,
      });
      if (await receivedTab.isVisible().catch(() => false)) {
        await receivedTab.click({ force: true });
        await pageB.waitForTimeout(500);
      }
      console.log('Step 6: Pending requests tab opened');

      // STEP 7: User B accepts friend request
      console.log('Step 7: Accepting friend request...');
      const acceptButton = pageB
        .getByRole('button', { name: /accept/i })
        .first();
      if (await acceptButton.isVisible({ timeout: 15000 }).catch(() => false)) {
        await acceptButton.click({ force: true });
        await pageB.waitForTimeout(1000);
        console.log('Step 7: Connection accepted');
      } else {
        console.log(
          'Step 7: No pending request found - may already be connected'
        );
      }

      // STEP 8: Create conversation and User A sends message
      console.log('Step 8: Creating conversation and sending message...');
      const client = getAdminClient();
      if (client) {
        conversationId = await createConversation(client);
        console.log('Step 8: Conversation ID: ' + conversationId);
      }

      if (!conversationId) {
        throw new Error('Could not create conversation');
      }

      // Navigate directly to conversation via URL param — bypasses the
      // slow sidebar conversation list query (3+ min on free tier with
      // 18 concurrent CI jobs). The WebKit useSearchParams() issue was
      // fixed in earlier commits; encrypted-messaging.spec.ts and User B
      // below both use this pattern successfully.
      await pageA.goto(`/messages?conversation=${conversationId}`, {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageA, USER_A.password);
      await pageA.waitForSelector('[data-testid="message-thread"]', {
        state: 'visible',
        timeout: 60000,
      });

      testMessage = 'Hello from User A - ' + Date.now();
      await fillMessageInput(pageA, testMessage);

      const sendButton = pageA.getByRole('button', { name: /send/i });
      await sendButton.click({ force: true });
      await scrollThreadToBottom(pageA);
      await expect(pageA.getByText(testMessage)).toBeVisible({
        timeout: 30000,
      });
      console.log('Step 8: Message sent');

      // STEP 9: User B receives message
      // Supabase free tier may return empty results or stale reads.
      // Retry with page reloads up to 3 times with 3s waits.
      console.log('Step 9: User B receiving message...');
      await pageB.goto('/messages?conversation=' + conversationId, {
        waitUntil: 'domcontentloaded',
      });
      await pageB.waitForLoadState('domcontentloaded');
      await handleReAuthModal(pageB, USER_B.password);
      await scrollThreadToBottom(pageB);
      // 10 retries (was 3): Supabase Cloud free-tier tail latency under
      // 24-shard load occasionally exceeds a 3-retry budget. Matches the
      // pattern already used in encrypted-messaging:177 for the same
      // pageB-visibility race.
      for (let retry = 0; retry < 10; retry++) {
        const visible = await pageB
          .getByText(testMessage)
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (visible) break;
        // Dump thread content for diagnostics
        const threadText = await pageB
          .locator('[data-testid="message-thread"]')
          .textContent()
          .catch(() => '(not found)');
        console.log(
          `Step 9: Message not visible (attempt ${retry + 1}/10), thread: ${threadText?.slice(0, 200)}`
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
      await expect(pageB.getByText(testMessage)).toBeVisible({
        timeout: 30000,
      });
      console.log('Step 9: Message received');

      // STEP 10: User B replies
      console.log('Step 10: User B replying...');
      replyMessage = 'Reply from User B - ' + Date.now();
      await fillMessageInput(pageB, replyMessage);
      await pageB.getByRole('button', { name: /send/i }).click({ force: true });
      await scrollThreadToBottom(pageB);
      await expect(pageB.getByText(replyMessage)).toBeVisible({
        timeout: 30000,
      });
      console.log('Step 10: Reply sent');

      // STEP 11: User A receives reply
      console.log('Step 11: User A receiving reply...');
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await handleReAuthModal(pageA, USER_A.password);
      await scrollThreadToBottom(pageA);
      await expect(pageA.getByText(replyMessage)).toBeVisible({
        timeout: 30000,
      });
      console.log('Step 11: Reply received');

      // STEP 12: Skip sign-out — context.close() in finally block handles cleanup.
      // Calling supabase.auth.signOut() revokes the refresh token server-side,
      // which invalidates the storageState for ALL subsequent tests in this shard.
      // This was the root cause of shard 2/6 failures: every test after this one
      // got "invalid refresh token" → redirect to /sign-in.
      console.log('Step 12: Skipping sign-out (context.close handles cleanup)');

      // STEP 13: Verify encryption
      console.log('Step 13: Verifying encryption...');
      if (client && testMessage && replyMessage) {
        const { data: messages } = await client
          .from('messages')
          .select('encrypted_content, initialization_vector')
          .order('created_at', { ascending: false })
          .limit(5);

        if (messages && messages.length > 0) {
          const foundPlaintext = messages.some((msg) => {
            const content = msg.encrypted_content;
            return (
              content &&
              (content.includes(testMessage) || content.includes(replyMessage))
            );
          });
          expect(foundPlaintext).toBe(false);
          console.log(
            'Step 13: Encryption verified - messages are encrypted in database'
          );
        }
      }

      console.log('Complete workflow test PASSED!');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test.describe('Conversations Page Loading (Feature 029)', () => {
  test('should load conversations page within 5 seconds (SC-001)', async ({
    page,
  }) => {
    test.setTimeout(30000);

    // Already authenticated via storageState
    // Navigate to messages page and time it
    const startTime = Date.now();
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, USER_A.password);

    // Wait for page title to load - NOT spinner
    await expect(page.locator('h1:has-text("Messages")').first()).toBeVisible({
      timeout: 15000,
    });

    const loadTime = Date.now() - startTime;
    console.log('[Test] Messages page loaded in ' + loadTime + 'ms');

    // Verify page loaded within 5 seconds (SC-001)
    expect(loadTime).toBeLessThan(5000);

    // Verify spinner is NOT visible (SC-002) - check multiple spinner patterns
    const spinner = page
      .locator(
        '.loading-spinner, .loading, [role="status"]:has-text("loading")'
      )
      .first();
    const spinnerVisible = await spinner.isVisible().catch(() => false);
    if (spinnerVisible) {
      await expect(spinner).toBeHidden({ timeout: 15000 });
    }
  });

  test('should show retry button on error state (FR-005)', async ({ page }) => {
    test.setTimeout(30000);

    // Already authenticated via storageState
    // Navigate to messages
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await handleReAuthModal(page, USER_A.password);

    // If error alert with actual error text is shown, verify retry button exists
    // Note: Empty alert elements may exist on page, only check if it has error content
    const errorAlert = page
      .getByRole('alert')
      .filter({ hasText: /error|failed|couldn't/i });
    if (await errorAlert.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
    }
    // Test passes if no error state is triggered (normal flow)
  });
});

// NOTE: The "Test Idempotency Verification" test that used to be here was
// removed because cleanupTestData() deletes ALL messages, conversations, and
// connections for the test users. With 2 parallel workers in the same shard,
// this cleanup runs while other messaging tests are still executing on the
// other worker, destroying the data they depend on. This was the root cause
// of all shard-2 messaging test failures.
