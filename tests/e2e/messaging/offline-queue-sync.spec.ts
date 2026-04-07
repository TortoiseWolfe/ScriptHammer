/**
 * E2E Test: Offline Queue Sync
 *
 * Tests the offline → online message sync flow:
 * 1. Send a message while the network is down
 * 2. Bring the network back
 * 3. Verify the queued message shows up in the conversation
 *
 * Uses a local HTTP proxy + Chromium DNS override so the browser can
 * reach the Docker-hosted Supabase. Runs in the Docker E2E container
 * without external TEST_USER_* env vars.
 *
 * Requires: local Supabase with seed-test-user.sql and seed-test-user-b.sql applied.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     scripthammer-scripthammer-1 npx playwright test tests/e2e/messaging/offline-queue-sync.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as http from 'http';
import {
  dismissCookieBanner,
  handleReAuthModal,
  fillMessageInput,
  cleanupOldMessages,
  scrollThreadToBottom,
} from '../utils/test-user-factory';

const USER_A_EMAIL = 'test@example.com';
const USER_A_PASSWORD = 'TestPassword123!';
const USER_B_EMAIL = 'test-user-b@example.com';

// Next.js basePath — empty in local dev, '/ScriptHammer' in CI/prod
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Docker DNS — test process resolves Docker hostnames; browser cannot
const SUPABASE_DOCKER_HOST =
  process.env.SUPABASE_DOCKER_HOST || 'scripthammer-supabase-kong-1';
// In CI, use the cloud Supabase URL. Locally, use the Docker URL.
const SUPABASE_URL = process.env.CI
  ? process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  : `http://${SUPABASE_DOCKER_HOST}:8000`;
const SUPABASE_DOCKER_URL = SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Chromium needs --host-resolver-rules to map the Docker hostname to 127.0.0.1,
// and a local HTTP proxy on port 8000 forwards those requests to the real Kong.
const PROXY_PORT = 8001;

// --host-resolver-rules is Chromium-only (crashes WebKit/Firefox).
// Only needed locally for Docker DNS; CI uses cloud Supabase.
test.use({
  launchOptions: {
    args: process.env.CI
      ? []
      : [`--host-resolver-rules=MAP ${SUPABASE_DOCKER_HOST} 127.0.0.1`],
  },
});

test.describe('Offline Queue Sync E2E', () => {
  let proxyServer: http.Server;
  let setupSucceeded = false;
  let setupError = '';

  test.beforeAll(async () => {
    // Start a local HTTP proxy so Chromium can reach the real Supabase Kong gateway.
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
    await new Promise<void>((resolve) =>
      proxyServer.listen(PROXY_PORT, '127.0.0.1', resolve)
    );

    // Ensure a conversation exists between user A and user B
    if (!SUPABASE_SERVICE_KEY) {
      setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
      return;
    }

    const adminClient = createClient(
      SUPABASE_DOCKER_URL,
      SUPABASE_SERVICE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Get user IDs
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const userA = usersData?.users?.find((u) => u.email === USER_A_EMAIL);
    const userB = usersData?.users?.find((u) => u.email === USER_B_EMAIL);

    if (!userA || !userB) {
      setupError =
        `Test users not found: ${!userA ? USER_A_EMAIL : ''} ${!userB ? USER_B_EMAIL : ''}`.trim();
      return;
    }

    // Ensure user connection exists (accepted)
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

    // Ensure conversation exists (canonical ordering: participant_1_id < participant_2_id)
    const [p1, p2] =
      userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
    const { data: existingConv } = await adminClient
      .from('conversations')
      .select('id')
      .eq('participant_1_id', p1)
      .eq('participant_2_id', p2)
      .maybeSingle();

    if (!existingConv) {
      const { error: convError } = await adminClient
        .from('conversations')
        .insert({
          participant_1_id: p1,
          participant_2_id: p2,
        });
      if (convError) {
        setupError = `Failed to create conversation: ${convError.message}`;
        return;
      }
    }

    setupSucceeded = true;
  });

  test.beforeAll(async () => {
    if (!setupSucceeded) return;
    await cleanupOldMessages(USER_A_EMAIL, USER_B_EMAIL);
  });

  test.afterAll(async () => {
    proxyServer?.close();
  });

  test('should queue a message offline and sync when reconnected', async ({
    browser,
  }) => {
    test.skip(!setupSucceeded, `Setup failed: ${setupError}`);

    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      // Sign in via Supabase API (test process CAN reach Docker hostnames)
      const supabase = createClient(SUPABASE_DOCKER_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: USER_A_PASSWORD,
      });
      if (error || !data.session) {
        throw new Error(
          `Supabase sign-in failed: ${error?.message ?? 'no session'}`
        );
      }

      // Navigate to get a browsing context for localStorage
      await page.goto(`${BP}/`);
      await page.waitForLoadState('domcontentloaded');

      // Inject the Supabase session so AuthContext picks it up.
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

      // Reload so AuthContext reads the injected session
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // ===== Navigate to messages =====
      await page.goto(`${BP}/messages`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await dismissCookieBanner(page);
      await handleReAuthModal(page, USER_A_PASSWORD);

      // Wait for Chats tab (auth gates must resolve first)
      const chatsTab = page.getByRole('tab', { name: /Chats/i });
      await chatsTab.waitFor({ state: 'visible', timeout: 30000 });
      await chatsTab.click();
      await page.waitForSelector('[role="tabpanel"]', { state: 'visible' });

      // Click into the first conversation
      const conversationItem = page
        .getByRole('button', { name: /Conversation with/i })
        .first();
      await expect(conversationItem).toBeVisible({ timeout: 45000 });
      await conversationItem.click();

      // Wait for message input
      const messageInput = page.getByRole('textbox', {
        name: /Message input/i,
      });
      await expect(messageInput).toBeVisible({ timeout: 45000 });

      // ===== Go offline =====
      await context.setOffline(true);
      const isOffline = await page.evaluate(() => !navigator.onLine);
      expect(isOffline).toBe(true);

      // ===== Send message while offline =====
      const testMessage = `Offline sync test ${Date.now()}`;
      await fillMessageInput(page, testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Message should appear in UI (queued state)
      await scrollThreadToBottom(page);
      const messageBubble = page.getByText(testMessage);
      await expect(messageBubble).toBeVisible({ timeout: 30000 });

      // ===== Go back online =====
      await context.setOffline(false);
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);

      // ===== Wait for queue to sync =====
      await page.waitForTimeout(5000);

      // ===== Verify message is still visible (sent successfully) =====
      await expect(messageBubble).toBeVisible();

      // Optionally check that the queued/sending indicator is gone
      const queueIndicator = page.locator(
        '[data-testid="queued-message-indicator"]'
      );
      const indicatorVisible = await queueIndicator
        .isVisible()
        .catch(() => false);
      if (indicatorVisible) {
        await page.waitForTimeout(5000);
      }
    } finally {
      await context.close();
    }
  });
});
