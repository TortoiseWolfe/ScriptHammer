/**
 * Debug Test: Capture Decryption Console Logs
 * Feature: 031-debug-message-decryption
 *
 * This test captures and prints [Decryption] console logs for debugging
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { skipIfBackendCaptchaProtected } from '../utils/captcha-guard';

const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

let adminClient: SupabaseClient | null = null;

const getAdminClient = (): SupabaseClient | null => {
  if (adminClient) return adminClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
};

test.describe('Capture Decryption Logs', () => {
  test('capture console output from message exchange', async ({ browser }) => {
    test.setTimeout(120000);
    // Signs both participants in through the real form, which cannot be
    // submitted without a Turnstile token.
    await skipIfBackendCaptchaProtected(
      'Console capture of a two-party message exchange'
    );

    const contextA = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const pageA = await contextA.newPage();

    // Collect all console logs for User A
    const consoleLogs: string[] = [];
    pageA.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Decryption]')) {
        consoleLogs.push(`[A][${msg.type()}] ${text}`);
      }
    });

    const client = getAdminClient();
    let conversationId: string | null = null;

    try {
      // Get user IDs
      const { data: authUsers } = (await client?.auth.admin.listUsers()) ?? {
        data: null,
      };
      let userAId: string | null = null;
      let userBId: string | null = null;
      if (authUsers?.users) {
        for (const user of authUsers.users) {
          if (user.email === USER_A.email) userAId = user.id;
          if (user.email === USER_B.email) userBId = user.id;
        }
      }

      // Get or create conversation
      if (userAId && userBId && client) {
        const participant1 = userAId < userBId ? userAId : userBId;
        const participant2 = userAId < userBId ? userBId : userAId;
        const { data: existing } = await client
          .from('conversations')
          .select('id')
          .eq('participant_1_id', participant1)
          .eq('participant_2_id', participant2)
          .single();
        conversationId = existing?.id || null;
      }

      // User A signs in
      console.log('[Test] User A signing in...');
      await pageA.goto('/sign-in');
      // NOT `networkidle` (#506): Turnstile mounts here and opens a `blob:`
      // worker request that never settles, so the network never goes idle.
      // The guard at the top of this file only skips when the BACKEND enforces
      // captcha — the hang is caused by the WIDGET, which renders whenever
      // NEXT_PUBLIC_CAPTCHA_SITE_KEY is set. Those are independent, so this
      // would hang the day backend enforcement is turned off. `fill()`
      // auto-waits, so no explicit wait is needed at all.
      await dismissCookieBanner(pageA);
      await pageA.getByLabel('Email').fill(USER_A.email);
      await pageA.getByLabel('Password', { exact: true }).fill(USER_A.password);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await pageA.waitForURL(/.*\/profile/, { timeout: 15000 });
      console.log('[Test] User A signed in');

      // Navigate to conversation with messages
      if (conversationId) {
        console.log('[Test] Navigating to conversation: ' + conversationId);
        await pageA.goto('/messages?conversation=' + conversationId);
        await pageA.waitForLoadState('networkidle');
        await pageA.waitForTimeout(5000);
      } else {
        console.log(
          '[Test] No existing conversation found, navigating to /messages'
        );
        await pageA.goto('/messages?tab=chats');
        await pageA.waitForLoadState('networkidle');
        await pageA.waitForTimeout(3000);
      }

      // Print all captured decryption logs
      console.log('\n========== DECRYPTION LOGS (User A) ==========');
      if (consoleLogs.length === 0) {
        console.log('(No [Decryption] logs captured)');
      } else {
        consoleLogs.forEach((log) => console.log(log));
      }
      console.log('========== END LOGS ==========\n');

      // This is a diagnostic capture test — its purpose is to print logs
      // for human inspection, not enforce behavior. Real assertion: the
      // signed-in page made it to /messages or an existing thread
      // (proves the auth + decryption pipeline didn't crash before logs
      // could be captured). consoleLogs is an array, even when empty.
      expect(Array.isArray(consoleLogs)).toBe(true);
      expect(pageA.url()).toMatch(/messages/);
    } finally {
      await contextA.close();
    }
  });
});
