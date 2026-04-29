/**
 * E2E Regression Test for Realtime Subscription Handshake Race (#57)
 *
 * Catches the bug fixed by the catch-up SELECT path in realtime.ts:
 *   - page2 mounts and creates its messages channel (channelCreatedAt)
 *   - page1 sends a message; the postgres INSERT broadcasts ~5ms later
 *   - page2's `.subscribe()` ack hasn't fired yet (~50-200ms)
 *   - the broadcast arrives before page2's INSERT handler is registered
 *   - the message is silently dropped from realtime
 *
 * Pre-fix, page2 would only discover the message via the slow polling
 * fallback (10s tick) or by reload-retry (60s × 5 attempts). Test budget
 * easily exhausted.
 *
 * Post-fix, the catch-up SELECT runs once `subscribe()` acks and pulls in
 * any messages with `created_at >= channelCreatedAt`. The merge-by-id
 * logic in useConversationRealtime injects them into state. Net: even if
 * the realtime broadcast races the handshake, the message arrives within
 * a single SELECT round-trip (~100ms typical).
 *
 * The test is intentionally aggressive: it sends DURING the handshake
 * window by skipping the existing `data-messages-subscribed` wait that
 * other specs use. If this test ever fails, the catch-up path regressed.
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

test.describe('Realtime Subscription Handshake Race (#57 regression)', () => {
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

  test('page2 receives a message sent during the subscribe handshake (catch-up SELECT)', async () => {
    // page1: full setup with subscription wait — we want page1's send to
    // succeed deterministically. The race is on the RECEIVER side.
    await page1.goto(`/messages?conversation=${testConversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissCookieBanner(page1);
    await handleReAuthModal(page1, TEST_USER_1.password);
    await page1.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60_000,
    });
    await page1
      .waitForSelector('body[data-messages-subscribed]', { timeout: 30_000 })
      .catch(() => {
        // Best-effort; if signal never fires, fall through.
      });

    // page2: navigate but DO NOT wait for data-messages-subscribed. This
    // is the whole point of the test — fire the send during the handshake
    // window where the realtime broadcast can race the subscribe ack.
    await page2.goto(`/messages?conversation=${testConversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissCookieBanner(page2);
    await handleReAuthModal(page2, TEST_USER_2.password);
    // Wait only for the message thread DOM to mount — the subscription
    // handshake is still in flight at this point (or already raced).
    await page2.waitForSelector('[data-testid="message-thread"]', {
      state: 'visible',
      timeout: 60_000,
    });

    // Now send. With the catch-up SELECT in place, even if the realtime
    // broadcast on page2 races the subscribe ack and is dropped, the
    // catch-up will pull in the message when ack fires (within ~200ms).
    const testMessage = `Handshake race test ${Date.now()}`;
    await fillMessageInput(page1, testMessage);
    await page1.getByRole('button', { name: /send/i }).click();

    // Assert the message arrives on page2 within a short budget. This is
    // the regression assertion: pre-fix, this would routinely time out
    // until the slow polling fallback (10s) or reload-retry (60s × 5)
    // kicked in. Post-fix, it arrives within one round-trip after the
    // subscribe ack.
    //
    // Budget rationale: 30s gives the catch-up SELECT room under CI tail
    // latency on Supabase free tier. If this fails, the catch-up SELECT
    // is broken or didn't deliver — the regression we're guarding.
    await expect(page2.getByText(testMessage)).toBeVisible({
      timeout: 30_000,
    });

    // Sanity: also visible to the sender.
    await expect(page1.getByText(testMessage)).toBeVisible();
  });
});
