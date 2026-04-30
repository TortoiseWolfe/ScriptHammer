/**
 * E2E Regression Test for Cross-Window Message Delivery (#57)
 *
 * History: this issue was originally framed as "Supabase Realtime handshake
 * race — page2's subscribe ack arrives after page1's INSERT broadcast, the
 * event is dropped." That framing was wrong. Investigation on PR #65 showed
 * the production app does NOT subscribe to Supabase Realtime at all —
 * `useConversationRealtime` and `realtimeService.subscribeToMessages` were
 * vestigial dead code that nothing rendered. The "9 rounds of mitigation"
 * mentioned in past handoff docs were progressive reverts of realtime usage
 * in favor of polling.
 *
 * The actual mechanism: ConversationView (`src/components/organisms/...`)
 * fetches via messageService.getMessageHistory() on mount, and a 10s polling
 * effect re-fetches while the tab is visible. Cross-window delivery latency
 * is bounded by the poll interval, not by realtime broadcast speed.
 *
 * What this test exercises:
 *   1. page1 sends a message via the UI
 *   2. page2 (already mounted on the same conversation) waits passively
 *   3. The polling effect on page2 re-fetches messages within 10s and the
 *      new message renders
 *
 * Failure modes this test catches:
 *   - Polling effect removed or broken (page2 stays stale forever)
 *   - getMessageHistory regression (auth/RLS/decryption broken)
 *   - ConversationView doesn't re-render when messages array changes
 *
 * Test budget: 30s. Polling fires every 10s; a single send-to-render cycle
 * needs at most one poll plus tail latency on Supabase free tier.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  dismissCookieBanner,
  handleReAuthModal,
  fillMessageInput,
  cleanupOldMessages,
  getAdminClient,
  getUserByEmail,
} from '../utils/test-user-factory';

let setupSucceeded = false;
let setupError = '';
let testConversationId = '';

const TEST_USER_1 = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const TEST_USER_2 = {
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

// Same self-healing setup as real-time-delivery.spec.ts. Verifies the
// connection + conversation exist; creates them if missing. Sets
// setupSucceeded + testConversationId.
test.beforeAll(async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
    return;
  }
  if (
    TEST_USER_1.email === 'test@example.com' ||
    TEST_USER_2.email === 'test-user-b@example.com'
  ) {
    setupError = 'Test user emails not configured';
    return;
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    setupError = 'Admin client unavailable';
    return;
  }

  const userA = await getUserByEmail(TEST_USER_1.email);
  const userB = await getUserByEmail(TEST_USER_2.email);
  if (!userA || !userB) {
    setupError = 'Test users not found';
    return;
  }

  // Ensure connection
  const { data: existing } = await adminClient
    .from('user_connections')
    .select('id, status')
    .or(
      `and(requester_id.eq.${userA.id},addressee_id.eq.${userB.id}),and(requester_id.eq.${userB.id},addressee_id.eq.${userA.id})`
    )
    .maybeSingle();
  if (!existing) {
    await adminClient.from('user_connections').insert({
      requester_id: userA.id,
      addressee_id: userB.id,
      status: 'accepted',
    });
  } else if (existing.status !== 'accepted') {
    await adminClient
      .from('user_connections')
      .update({ status: 'accepted' })
      .eq('id', existing.id);
  }

  // Ensure conversation
  const [p1, p2] =
    userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
  const { data: existingConv } = await adminClient
    .from('conversations')
    .select('id')
    .eq('participant_1_id', p1)
    .eq('participant_2_id', p2)
    .maybeSingle();
  if (!existingConv) {
    const { data: newConv, error } = await adminClient
      .from('conversations')
      .insert({ participant_1_id: p1, participant_2_id: p2 })
      .select('id')
      .single();
    if (error || !newConv) {
      setupError = `Failed to create conversation: ${error?.message}`;
      return;
    }
    testConversationId = newConv.id;
  } else {
    testConversationId = existingConv.id;
  }

  setupSucceeded = true;
});

test.beforeAll(async () => {
  if (!setupSucceeded) return;
  await cleanupOldMessages(TEST_USER_1.email, TEST_USER_2.email);
});

test.describe('Cross-Window Message Delivery (#57 regression)', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  // Configure: serial mode so we don't race against ourselves; long timeout
  // because cross-window setup is heavy.
  test.describe.configure({ mode: 'serial', timeout: 600_000 });

  test.beforeEach(async ({ browser }, testInfo) => {
    if (!setupSucceeded) {
      testInfo.skip(true, `Test setup failed: ${setupError}`);
      return;
    }

    context1 = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth.json',
    });
    context2 = await browser.newContext({
      storageState: './tests/e2e/fixtures/storage-state-auth-b.json',
    });
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('page2 receives a message page1 sends, via the polling effect', async () => {
    // page1: navigate, dismiss consent, complete reauth, wait for the
    // message-thread DOM to mount.
    await page1.goto(`/messages?conversation=${testConversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissCookieBanner(page1);
    await handleReAuthModal(page1, TEST_USER_1.password);
    await page1.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60_000,
    });

    // page2: same setup. ConversationView's mount effect calls loadMessages()
    // and starts the 10s polling interval that drives this test.
    await page2.goto(`/messages?conversation=${testConversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissCookieBanner(page2);
    await handleReAuthModal(page2, TEST_USER_2.password);
    await page2.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60_000,
    });

    // page1 sends. The new row is INSERTed; page2's polling effect will
    // re-fetch on its next tick (≤10s) and the message will render.
    const testMessage = `Cross-window delivery test ${Date.now()}`;
    await fillMessageInput(page1, testMessage);
    await page1.getByRole('button', { name: /send/i }).click();

    // Assert the message arrives on page2 within 30s. Polling tick is 10s;
    // the budget covers one missed tick + tail latency on Supabase free tier
    // under shard load. If this fails, polling is broken or getMessageHistory
    // regressed.
    await expect(page2.getByText(testMessage)).toBeVisible({
      timeout: 30_000,
    });

    // Sanity: also visible to the sender (optimistic UI).
    await expect(page1.getByText(testMessage)).toBeVisible();
  });
});
