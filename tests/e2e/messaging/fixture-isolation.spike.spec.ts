/**
 * SPIKE (#116 Phase 2) — per-test fixture isolation → workers>1.
 *
 * Each test seeds its OWN throwaway viewer + partner + conversation via
 * seedIsolatedConversation(), injects the viewer's session into the browser, and
 * tears everything down in afterEach. Nothing is shared between tests, so this
 * spec runs `fullyParallel` (no `serial`) and is the substrate for measuring
 * workers=1 vs workers>1.
 *
 * This is a THROWAWAY spike artifact — delete or promote after the GO/NO-GO
 * decision. It does NOT touch encrypted-messaging.spec.ts.
 *
 * RESULT (local sandbox, 2026-06-03) — GO:
 *   workers=1: 35.4s | workers=2: 21.5s (-39%) | workers=4: ~15.0s (-58%)
 *   0 flakes across 3× workers=4 runs; 0 orphan users (clean parallel teardown).
 *   → Per-test isolation lets messaging E2E run workers>1 reliably. Scales.
 * EMAIL-DOMAIN NOTE: locally these throwaway users land on @example.com (the
 *   local .env sets test@example.com, accepted by local GoTrue's autoconfirm).
 *   Against CLOUD CI this is already handled: generateTestEmail() reads
 *   TEST_EMAIL_DOMAIN and emits valid gmail +alias addresses when CI's secret is
 *   set — so the same fixtures produce cloud-valid emails with no code change.
 *
 * Run locally (after `pnpm run dev:local`):
 *   docker compose exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     scripthammer pnpm exec playwright test \
 *     tests/e2e/messaging/fixture-isolation.spike.spec.ts \
 *     --project=chromium-msg --workers=4 --reporter=list
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  handleReAuthModal,
  dismissCookieBanner,
  fillMessageInput,
  scrollThreadToBottom,
  DEFAULT_TEST_PASSWORD,
  type IsolatedConversation,
} from '../utils/test-user-factory';

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Parallelism is the whole point of this spike — NOT serial.
test.describe.configure({ mode: 'parallel' });

/**
 * Open a fresh browser context authenticated as the fixture's throwaway viewer
 * by injecting its session into localStorage (the post-#121 pattern). Returns a
 * page already on /messages for the isolated conversation.
 */
async function openAsViewer(
  browser: import('@playwright/test').Browser,
  fx: IsolatedConversation
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  // Inject the viewer session. Storage key derives from the BROWSER URL.
  const browserUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_ADMIN_URL ||
    '';
  const supabaseHost = new URL(browserUrl).hostname.split('.')[0];
  const sbStorageKey = `sb-${supabaseHost}-auth-token`;

  await page.goto(`${BP}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    ({ key, s }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: 3600,
          token_type: 'bearer',
          user: s.user,
        })
      );
    },
    { key: sbStorageKey, s: fx.viewerSession }
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Navigate to the isolated conversation and unlock encryption keys.
  await page.goto(`${BP}/messages?conversation=${fx.conversationId}`, {
    waitUntil: 'domcontentloaded',
  });
  await dismissCookieBanner(page);
  await handleReAuthModal(page, DEFAULT_TEST_PASSWORD);
  await page.waitForSelector('[data-testid="message-thread"]', {
    state: 'visible',
    timeout: 60000,
  });

  return { page, close: () => context.close() };
}

test.describe('Fixture-isolation spike (workers>1)', () => {
  // Local-only: needs a local Docker Supabase (pnpm run dev:local). The
  // throwaway @example.com users are accepted by local GoTrue but rejected by
  // cloud, so skip in CI. This is a spike artifact, not a CI gate.
  test.skip(!!process.env.CI, 'Spike — requires local Docker Supabase');

  let fixture: IsolatedConversation | null = null;

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('viewer sees its isolated pre-seeded history', async ({ browser }) => {
    fixture = await seedIsolatedConversation(6, {
      viewerPrefix: 'spike-hist-v',
      partnerPrefix: 'spike-hist-p',
    });
    test.skip(!fixture, 'isolation seed failed (no admin client?)');
    const { page, close } = await openAsViewer(browser, fixture!);
    try {
      await scrollThreadToBottom(page);
      // 6 placeholder messages were seeded; the thread should render bubbles.
      const bubbles = page.locator('[data-testid="message-bubble"]');
      await expect(bubbles.first()).toBeVisible({ timeout: 30000 });
      expect(await bubbles.count()).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  test('viewer sends a message into its isolated conversation', async ({
    browser,
  }) => {
    fixture = await seedIsolatedConversation(0, {
      viewerPrefix: 'spike-send-v',
      partnerPrefix: 'spike-send-p',
    });
    test.skip(!fixture, 'isolation seed failed (no admin client?)');
    const { page, close } = await openAsViewer(browser, fixture!);
    try {
      const msg = `spike message ${Date.now()}`;
      await fillMessageInput(page, msg);
      await page.getByRole('button', { name: /send/i }).click();
      await scrollThreadToBottom(page);
      await expect(page.getByText(msg)).toBeVisible({ timeout: 60000 });
    } finally {
      await close();
    }
  });

  test('second isolated conversation is independent of the first', async ({
    browser,
  }) => {
    // Proves cross-test isolation: this test's users/conversation are entirely
    // its own; a parallel test's data never appears here.
    fixture = await seedIsolatedConversation(3, {
      viewerPrefix: 'spike-iso2-v',
      partnerPrefix: 'spike-iso2-p',
    });
    test.skip(!fixture, 'isolation seed failed (no admin client?)');
    const { page, close } = await openAsViewer(browser, fixture!);
    try {
      await scrollThreadToBottom(page);
      const bubbles = page.locator('[data-testid="message-bubble"]');
      await expect(bubbles.first()).toBeVisible({ timeout: 30000 });
      // Exactly the 3 we seeded — no leakage from any parallel test.
      expect(await bubbles.count()).toBe(3);
    } finally {
      await close();
    }
  });
});
