/**
 * E2E Test: Message Delete Placeholder
 *
 * Verifies that a soft-deleted message renders a "[Message deleted]" placeholder
 * instead of disappearing. Adjacent messages must remain visible and in order
 * so the sequence gap is preserved.
 *
 * Uses the Docker DNS proxy + API session injection pattern so it runs inside
 * the Docker E2E container with the default seed users.
 *
 * Requires: local Supabase with seed-test-user.sql and seed-test-user-b.sql applied.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     sh-b-scripthammer-1 npx playwright test tests/e2e/messaging/message-delete-placeholder.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as http from 'http';
import {
  dismissCookieBanner,
  handleReAuthModal,
  handleEncryptionSetup,
  fillMessageInput,
  cleanupOldMessages,
  scrollThreadToBottom,
} from '../utils/test-user-factory';

const USER_A_EMAIL = process.env.TEST_USER_PRIMARY_EMAIL!;
const USER_A_PASSWORD = process.env.TEST_USER_PRIMARY_PASSWORD!;
const USER_B_EMAIL = process.env.TEST_USER_TERTIARY_EMAIL!;
const USER_B_PASSWORD = process.env.TEST_USER_TERTIARY_PASSWORD!;
// Messaging password MUST match what auth.setup.ts uses to create encryption keys
const MESSAGING_PASSWORD = process.env.TEST_USER_PRIMARY_PASSWORD!;

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

const SUPABASE_DOCKER_HOST =
  process.env.SUPABASE_DOCKER_HOST || 'scripthammer-supabase-kong-1';
// In CI, use the cloud Supabase URL. Locally, use the Docker URL.
const SUPABASE_URL = process.env.CI
  ? process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  : `http://${SUPABASE_DOCKER_HOST}:8000`;
const SUPABASE_DOCKER_URL = SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const PROXY_PORT = 8002;

// --host-resolver-rules is Chromium-only (crashes WebKit/Firefox).
// Only needed locally for Docker DNS; CI uses cloud Supabase.
test.use({
  launchOptions: {
    args: process.env.CI
      ? []
      : [`--host-resolver-rules=MAP ${SUPABASE_DOCKER_HOST} 127.0.0.1`],
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAndInjectSession(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  const supabase = createClient(SUPABASE_DOCKER_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(
      `Supabase sign-in failed for ${email}: ${error?.message ?? 'no session'}`
    );
  }

  await page.goto(`${BP}/`);
  await page.waitForLoadState('domcontentloaded');

  const session = data.session;
  const supabaseHost = new URL(SUPABASE_DOCKER_URL).hostname.split('.')[0];
  const sbStorageKey = `sb-${supabaseHost}-auth-token`;
  await page.evaluate(
    ({ key, accessToken, refreshToken, expiresAt, user: u }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          expires_in: 3600,
          token_type: 'bearer',
          user: u,
        })
      );
    },
    {
      key: sbStorageKey,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      user: session.user,
    }
  );

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate to /messages, handle encryption setup or re-auth.
 * If re-auth fails (wrong password from a previous test run), clear
 * encryption keys and retry so fresh keys are created with MESSAGING_PASSWORD.
 */
async function setupEncryptionViaUI(
  page: import('@playwright/test').Page,
  email: string,
  password: string = MESSAGING_PASSWORD
) {
  await page.goto(`${BP}/messages`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await dismissCookieBanner(page);

  // Try encryption setup (first-time user) or re-auth (returning user)
  await handleEncryptionSetup(page, password);

  // Check if re-auth modal appeared
  const modal = page.locator('[role="dialog"]').first();
  const modalVisible = await modal
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!modalVisible) return;

  // Fill password and submit
  const passwordInput = modal.locator('input[type="password"]').first();
  await passwordInput.fill(password);
  const submitBtn = modal.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait briefly then check for "Incorrect password" error
  await page.waitForTimeout(2000);
  const errorVisible = await page
    .getByText(/Incorrect password/i)
    .isVisible()
    .catch(() => false);

  if (errorVisible) {
    // Keys were set up with a different password — wait and retry.
    // Do NOT delete encryption keys from the DB — auth.setup.ts creates
    // them fresh each CI run via ensureEncryptionKeys(), and deleting them
    // here would break other messaging tests running in parallel.
    await page.waitForTimeout(3000);
    await handleReAuthModal(page, password);
  } else {
    // Password accepted — wait for modal to close
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }
}

/**
 * Navigate to /messages, handle re-auth, open the first conversation.
 */
async function openConversation(page: import('@playwright/test').Page) {
  await page.goto(`${BP}/messages`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await dismissCookieBanner(page);
  await handleReAuthModal(page, MESSAGING_PASSWORD);

  const chatsTab = page.getByRole('tab', { name: /Chats/i });
  await chatsTab.waitFor({ state: 'visible', timeout: 30000 });
  await chatsTab.click();
  await page.waitForSelector('[role="tabpanel"]', { state: 'visible' });

  const conversationItem = page
    .getByRole('button', { name: /Conversation with/i })
    .first();
  await expect(conversationItem).toBeVisible({ timeout: 45000 });
  await conversationItem.click();

  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toBeVisible({ timeout: 45000 });
}

/**
 * Type a message and click Send. Only waits for the input to clear
 * (confirming the send was dispatched).
 */
async function typeAndSend(
  page: import('@playwright/test').Page,
  text: string
) {
  await fillMessageInput(page, text);

  const sendButton = page.getByRole('button', { name: /Send message/i });
  await sendButton.click();

  // Wait for input to clear — confirms the handler fired
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toHaveValue('', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Message Delete Placeholder E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let proxyServer: http.Server;
  let adminClient: SupabaseClient;
  let setupSucceeded = false;
  let setupError = '';
  let conversationId = '';

  test.beforeAll(async () => {
    proxyServer = http.createServer((req, res) => {
      const options: http.RequestOptions = {
        hostname: SUPABASE_DOCKER_HOST,
        port: 8000,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${SUPABASE_DOCKER_HOST}:8000` },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode!, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(proxyReq);
    });
    await new Promise<void>((resolve, reject) => {
      proxyServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          proxyServer = undefined as unknown as http.Server;
          resolve();
        } else {
          reject(err);
        }
      });
      proxyServer.listen(PROXY_PORT, '127.0.0.1', resolve);
    });

    if (!SUPABASE_SERVICE_KEY) {
      setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
      return;
    }

    adminClient = createClient(SUPABASE_DOCKER_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const userA = usersData?.users?.find((u) => u.email === USER_A_EMAIL);
    const userB = usersData?.users?.find((u) => u.email === USER_B_EMAIL);

    if (!userA || !userB) {
      setupError =
        `Test users not found: ${!userA ? USER_A_EMAIL : ''} ${!userB ? USER_B_EMAIL : ''}`.trim();
      return;
    }

    // Ensure accepted connection
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

    // Ensure conversation and save its ID
    const [p1, p2] =
      userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
    const { data: existingConv } = await adminClient
      .from('conversations')
      .select('id')
      .eq('participant_1_id', p1)
      .eq('participant_2_id', p2)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convError } = await adminClient
        .from('conversations')
        .insert({ participant_1_id: p1, participant_2_id: p2 })
        .select('id')
        .single();
      if (convError || !newConv) {
        setupError = `Failed to create conversation: ${convError?.message}`;
        return;
      }
      conversationId = newConv.id;
    }

    // Clean up ALL previous messages in the conversation so the test
    // starts from a clean slate (no scroll/pagination issues, no stale
    // placeholders). Service role bypasses RLS.
    await adminClient
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    setupSucceeded = true;
  });

  test.beforeAll(async () => {
    if (!setupSucceeded) return;
    await cleanupOldMessages(USER_A_EMAIL, USER_B_EMAIL);
  });

  test.afterAll(async () => {
    proxyServer?.close();
  });

  test('should show [Message deleted] placeholder and preserve adjacent messages', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    test.skip(!setupSucceeded, `Setup failed: ${setupError}`);

    // Set up encryption for User B in a temporary context
    const tempCtx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const tempPage = await tempCtx.newPage();
    try {
      await signInAndInjectSession(tempPage, USER_B_EMAIL, USER_B_PASSWORD);
      await setupEncryptionViaUI(tempPage, USER_B_EMAIL, USER_B_PASSWORD);
    } finally {
      await tempCtx.close();
    }

    // Sign in as User A, set up encryption, navigate to conversation
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    // Force Supabase REST responses to bypass browser HTTP cache for the
    // whole test. Both chromium and firefox under shard load occasionally
    // served stale /rest/v1/messages responses — msg-1 missing after
    // typeAndSend (read-after-write lag masked by cached earlier reads)
    // and msg-2 still rendering after soft-delete (stale cache served
    // pre-PATCH data). Routing via Playwright's Node-side fetch sidesteps
    // the browser cache entirely.
    //
    // Explicitly pull body + status + headers and fulfill fresh rather
    // than passing the Response object through. WebKit appeared to still
    // serve the old body in some cases when we passed `response` through
    // route.fulfill, even with headers rewritten.
    await context.route('**/rest/v1/messages**', async (route) => {
      const response = await route.fetch();
      const body = await response.body();
      const headers = { ...response.headers() };
      headers['cache-control'] = 'no-store, no-cache, must-revalidate';
      headers['pragma'] = 'no-cache';
      headers['expires'] = '0';
      await route.fulfill({
        status: response.status(),
        headers,
        body,
      });
    });

    let page = await context.newPage();
    try {
      await signInAndInjectSession(page, USER_A_EMAIL, USER_A_PASSWORD);
      await setupEncryptionViaUI(page, USER_A_EMAIL, USER_A_PASSWORD);
      await openConversation(page);

      const ts = Date.now();
      const msg1 = `msg-1-${ts}`;
      const msg2 = `msg-2-${ts}`;
      const msg3 = `msg-3-${ts}`;

      // Send 3 messages and wait for EACH to land in the DB before moving
      // on. typeAndSend only waits for the input to clear (handler fired);
      // on Supabase free-tier under 24-shard load, the INSERT round-trip
      // can outlast the next typeAndSend, and the server stores 2 of 3 by
      // the time we read — breaking the later msg1/msg2/msg3 visibility
      // assertions non-deterministically.
      //
      // We can't use a fixed pre-send baseline because the test runs on
      // chromium-msg, firefox-msg, and webkit-msg shards CONCURRENTLY
      // against the same user pair & conversation, and each shard's
      // beforeAll calls `messages.delete()` — which concurrently shrinks
      // the row count out from under the other shards and caused the
      // "-2 new messages landed" flake on firefox-msg.
      //
      // Instead: snapshot the count immediately before each send, then
      // poll for strict >= baseline + 1. Concurrent deletions can only
      // increase our baseline (we re-snapshot), never decrease it below
      // our just-sent message.
      const waitForOneNewMessage = async () => {
        const { count: baseline } = await adminClient
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);
        return async () => {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            const { count } = await adminClient
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', conversationId);
            if ((count ?? 0) > (baseline ?? 0)) return;
            await new Promise((r) => setTimeout(r, 500));
          }
          throw new Error(
            `New message never landed within 30s (baseline=${baseline}, ` +
              `last=${0})`
          );
        };
      };

      const wait1 = await waitForOneNewMessage();
      await typeAndSend(page, msg1);
      await wait1();
      const wait2 = await waitForOneNewMessage();
      await typeAndSend(page, msg2);
      await wait2();
      const wait3 = await waitForOneNewMessage();
      await typeAndSend(page, msg3);
      await wait3();

      // Reload + re-open conversation to fetch messages from DB
      await openConversation(page);

      // All 3 should now be visible
      await expect(page.getByText(msg1)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(msg2)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(msg3)).toBeVisible({ timeout: 15000 });

      // --- Soft-delete the middle message via admin client ---
      // Messages are encrypted so we can't query by content. Instead find
      // the 3 most recent messages in this conversation sent by User A and
      // delete the middle one (by sequence_number order).
      const { data: recentMsgs } = await adminClient
        .from('messages')
        .select('id, sequence_number')
        .eq('conversation_id', conversationId)
        .eq('deleted', false)
        .order('sequence_number', { ascending: false })
        .limit(3);

      // recentMsgs are newest-first; sort ascending to get [msg1, msg2, msg3]
      const sorted = (recentMsgs ?? []).sort(
        (a, b) => a.sequence_number - b.sequence_number
      );

      expect(sorted.length).toBe(3);

      const middleMessageId = sorted[1].id;

      // Soft-delete the middle message from WITHIN the browser.
      // This uses the browser's own Supabase session, going through the
      // same proxy + PostgREST path that loadMessages() uses.
      const patchStatus = await page.evaluate(
        async ({ msgId, anonKey, supabaseUrl }) => {
          // Grab token from localStorage
          const keys = Object.keys(localStorage).filter((k) =>
            k.startsWith('sb-')
          );
          const sessionKey = keys[0];
          if (!sessionKey) return { status: -1, error: 'no session key' };

          const sessionJson = localStorage.getItem(sessionKey);
          if (!sessionJson) return { status: -2, error: 'no session data' };

          const session = JSON.parse(sessionJson);
          const token = session.access_token;

          const res = await fetch(
            `${supabaseUrl}/rest/v1/messages?id=eq.${msgId}`,
            {
              method: 'PATCH',
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({ deleted: true }),
            }
          );
          const body = await res.json().catch(() => null);
          return { status: res.status, body };
        },
        {
          msgId: middleMessageId,
          anonKey: SUPABASE_ANON_KEY,
          supabaseUrl: SUPABASE_URL,
        }
      );

      console.log(`PATCH from browser: ${JSON.stringify(patchStatus)}`);

      // The PWA service worker uses a Cache-first default strategy which
      // caches PostgREST responses. We need the next loadMessages() to hit
      // the DB (not a cached response) so the deleted=true flag is observed.
      //
      // Earlier attempts:
      //   1. caches.delete + sw.unregister — insufficient: the current
      //      document still has an SW controller until navigation.
      //   2. Add page.reload + waitForFunction(!controller) — improved
      //      chromium but firefox still served msg-2 from somewhere
      //      (HTTP cache / in-flight activating SW).
      //
      // Most reliable: wipe caches, unregister SWs, CLOSE the page entirely,
      // and open a fresh one on the same context. A fresh page starts with
      // no SW controller; PWAInstall will re-register, but the caches are
      // gone, so its first loadMessages fetch hits the DB.
      await page.evaluate(async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      });
      await page.close();
      page = await context.newPage();

      // context.route above already forces no-store on every
      // /rest/v1/messages response for the whole context, so the new
      // page's loadMessages gets fresh data from Supabase.

      // Reload conversation to pick up the deleted state
      await openConversation(page);

      // Hard assert: placeholder MUST render
      const placeholder = page.getByText('[Message deleted]');
      await expect(placeholder).toBeVisible({ timeout: 10000 });

      // Original msg-2 text must be gone
      await expect(page.getByText(msg2)).not.toBeVisible({ timeout: 15000 });

      // Adjacent messages must still be visible
      await expect(page.getByText(msg1)).toBeVisible();
      await expect(page.getByText(msg3)).toBeVisible();

      // Verify sequence integrity: collect all message bubbles in DOM order
      // and confirm msg-1, [Message deleted], msg-3 appear in that order
      const allBubbles = page.locator('[data-testid="message-bubble"]');
      const count = await allBubbles.count();
      const bubbleTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await allBubbles.nth(i).innerText();
        bubbleTexts.push(text);
      }

      // Find indices containing our markers
      const idx1 = bubbleTexts.findIndex((t) => t.includes(msg1));
      const idxDel = bubbleTexts.findIndex((t) =>
        t.includes('[Message deleted]')
      );
      const idx3 = bubbleTexts.findIndex((t) => t.includes(msg3));

      expect(idx1).toBeGreaterThanOrEqual(0);
      expect(idxDel).toBeGreaterThanOrEqual(0);
      expect(idx3).toBeGreaterThanOrEqual(0);

      // In a chat UI messages render top-to-bottom chronologically.
      // msg-1 should precede the placeholder, which should precede msg-3.
      expect(idx1).toBeLessThan(idxDel);
      expect(idxDel).toBeLessThan(idx3);
    } finally {
      await context.close();
    }
  });
});
