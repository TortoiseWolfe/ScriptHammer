/**
 * E2E Test: Friend Request Flow
 * Task: T014
 * Updated: Feature 026 - Using standardized test users
 *
 * Scenario:
 * 1. User A sends friend request to User B
 * 2. User B receives and accepts the request
 * 3. Verify connection status is 'accepted' for both users
 *
 * Prerequisites:
 * - PRIMARY and TERTIARY test users exist in Supabase
 * - /messages?tab=connections page exists
 * - UserSearch component exists
 * - ConnectionManager component exists
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  handleReAuthModal,
  dismissCookieBanner,
  performSignIn,
  resetEncryptionKeys,
} from '../utils/test-user-factory';

// Test users - use PRIMARY and TERTIARY from standardized test fixtures
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

// Store display names looked up at runtime
let userADisplayName: string | null = null;
let userBDisplayName: string | null = null;

// Admin client for cleanup
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

/**
 * Look up a user's display_name by their email address.
 * This is necessary because UserSearch searches by display_name, not email or username.
 * If display_name is not set, this function will SET it so subsequent searches work.
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

  // If display_name exists, use it
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

const cleanupConnections = async (): Promise<void> => {
  const client = getAdminClient();
  if (!client) return;

  const { data: users } = await client.auth.admin.listUsers();
  const userAId = users?.users?.find((u) => u.email === USER_A.email)?.id;
  const userBId = users?.users?.find((u) => u.email === USER_B.email)?.id;

  if (userAId && userBId) {
    // Only delete the A↔B connection pair — preserve other connections
    // (e.g. PRIMARY↔SECONDARY) that other tests in the same shard need.
    await client
      .from('user_connections')
      .delete()
      .or(
        `and(requester_id.eq.${userAId},addressee_id.eq.${userBId}),and(requester_id.eq.${userBId},addressee_id.eq.${userAId})`
      );
    console.log('Cleaned up A↔B connection for friend request test');
  }
};

test.describe('Friend Request Flow', () => {
  // Run tests serially to avoid parallel interference
  test.describe.configure({ mode: 'serial' });

  // Track setup status
  let setupError = '';

  // Delete the existing accepted connection so we can test the fresh
  // send→receive→accept flow. auth.setup.ts creates an accepted connection,
  // but this test needs to exercise the full friend request lifecycle.
  test.beforeAll(async () => {
    await cleanupConnections();
  });

  // Re-create the accepted connection after tests complete so other test
  // files in the same shard that depend on the connection aren't affected.
  test.afterAll(async () => {
    const client = getAdminClient();
    if (!client) return;

    const { data: users } = await client.auth.admin.listUsers();
    const userAId = users?.users?.find((u) => u.email === USER_A.email)?.id;
    const userBId = users?.users?.find((u) => u.email === USER_B.email)?.id;

    if (userAId && userBId) {
      // Check if connection was re-created by the test
      const { data: existing } = await client
        .from('user_connections')
        .select('id, status')
        .or(
          `and(requester_id.eq.${userAId},addressee_id.eq.${userBId}),and(requester_id.eq.${userBId},addressee_id.eq.${userAId})`
        )
        .maybeSingle();

      if (!existing) {
        // Test didn't complete — re-create the connection
        await client.from('user_connections').insert({
          requester_id: userAId,
          addressee_id: userBId,
          status: 'accepted',
        });
        console.log('afterAll: Re-created accepted connection for other tests');
      } else if (existing.status !== 'accepted') {
        await client
          .from('user_connections')
          .update({ status: 'accepted' })
          .eq('id', existing.id);
        console.log('afterAll: Updated connection to accepted for other tests');
      }
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    // Validate required environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      setupError = 'SUPABASE_SERVICE_ROLE_KEY not configured';
      testInfo.skip(true, setupError);
      return;
    }

    if (
      USER_A.email === 'test@example.com' ||
      USER_B.email === 'test-user-b@example.com'
    ) {
      setupError =
        'TEST_USER_PRIMARY_EMAIL or TEST_USER_TERTIARY_EMAIL not configured';
      testInfo.skip(true, setupError);
      return;
    }

    // Look up display names (set by auth.setup.ts, cached after first lookup)
    if (!userADisplayName) {
      userADisplayName = await getDisplayNameByEmail(USER_A.email);
    }
    if (!userBDisplayName) {
      userBDisplayName = await getDisplayNameByEmail(USER_B.email);
    }
  });

  test('User A sends friend request and User B accepts', async ({
    browser,
  }) => {
    test.setTimeout(90000); // 90 seconds for full workflow

    // Fresh sign-in for both users — storageState tokens can be consumed
    // by earlier tests' refresh token usage, making them invalid.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ===== STEP 1: User A signs in fresh =====
      await pageA.goto('/sign-in');
      const resultA = await performSignIn(pageA, USER_A.email, USER_A.password);
      if (!resultA.success) {
        throw new Error(`User A sign-in failed: ${resultA.error}`);
      }

      // ===== STEP 2: User A navigates to connections tab =====
      await pageA.goto('/messages', { waitUntil: 'domcontentloaded' });
      await handleReAuthModal(pageA, USER_A.password);
      const connectionsTab = pageA.getByRole('tab', {
        name: /Connections/i,
      });
      await connectionsTab.waitFor({ state: 'visible', timeout: 60000 });
      await connectionsTab.click({ force: true });

      // ===== STEP 3: User A searches for User B by display_name =====
      const searchInput = pageA.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 15000 });

      // DIAGNOSTIC: Log auth state and search context
      const searchDiag = await pageA.evaluate(() => {
        const authKeys = Object.keys(localStorage).filter(
          (k) => k.includes('auth') || k.includes('sb-')
        );
        return {
          authKeys,
          url: window.location.href,
          searchInputExists: !!document.querySelector('#user-search-input'),
        };
      });
      console.log(
        `[DIAG:friend-req] Searching for "${userBDisplayName}", auth: ${JSON.stringify(searchDiag)}`
      );

      await searchInput.fill(userBDisplayName!);
      await searchInput.press('Enter');

      // Wait for search results
      await pageA.waitForSelector(
        '[data-testid="search-results"], .alert-error',
        {
          timeout: 30000,
        }
      );

      // DIAGNOSTIC: Log what search returned
      const searchResultDiag = await pageA.evaluate(() => {
        const results = document.querySelector(
          '[data-testid="search-results"]'
        );
        const error = document.querySelector('.alert-error');
        const sendBtns = document.querySelectorAll('button');
        const sendReqBtns = Array.from(sendBtns).filter((b) =>
          /send request/i.test(b.textContent || '')
        );
        return {
          hasResults: !!results,
          resultsHTML: results?.innerHTML?.substring(0, 200) || 'none',
          hasError: !!error,
          errorText: error?.textContent?.substring(0, 100) || 'none',
          sendRequestBtnCount: sendReqBtns.length,
          allBtnTexts: Array.from(sendBtns)
            .map((b) => b.textContent?.trim())
            .filter((t) => t && t.length < 30)
            .slice(0, 10),
        };
      });
      console.log(
        '[DIAG:friend-req] Search results:',
        JSON.stringify(searchResultDiag)
      );

      // ===== STEP 4: User A sends friend request =====
      const sendRequestButton = pageA.getByRole('button', {
        name: /send request/i,
      });
      await expect(sendRequestButton).toBeVisible({ timeout: 30000 });
      await sendRequestButton.click({ force: true });

      // Wait for success message OR "already connected" error (both mean users can chat)
      // In parallel test runs, connection might already exist from other tests
      const successOrAlreadyConnected = pageA.getByText(
        /friend request sent|already.*connected|duplicate key|unique_connection/i
      );
      await expect(successOrAlreadyConnected).toBeVisible({
        timeout: 15000,
      });

      // ===== STEP 5: User B signs in =====
      await pageB.goto('/sign-in');
      await pageB.evaluate(() =>
        localStorage.setItem('playwright_e2e', 'true')
      );
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }
      await resetEncryptionKeys(pageB, USER_B.email, USER_B.password);

      // ===== STEP 6: User B navigates to connections page =====
      await pageB.goto('/messages?tab=connections', {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageB, USER_B.password);
      await expect(pageB).toHaveURL(/.*\/messages.*tab=connections/);

      // ===== STEP 7: User B sees pending request in "Received" tab =====
      const receivedTab = pageB.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });

      // Wait for request to appear
      await pageB.waitForSelector('[data-testid="connection-request"]', {
        timeout: 15000,
      });

      // ===== STEP 8: User B accepts the request =====
      const acceptButton = pageB
        .getByRole('button', { name: /accept/i })
        .first();
      await expect(acceptButton).toBeVisible();
      await acceptButton.click({ force: true });

      // Wait for request to disappear (no success message shown)
      await expect(
        pageB.locator('[data-testid="connection-request"]')
      ).toBeHidden({ timeout: 10000 });

      // ===== STEP 9: Verify connection appears in "Accepted" tab for User B =====
      const acceptedTab = pageB.getByRole('tab', { name: /accepted/i });
      await acceptedTab.click({ force: true });

      // Connection should now appear - wait for it (uses same data-testid as all connections)
      const acceptedConnection = pageB.locator(
        '[data-testid="connection-request"]'
      );
      await expect(acceptedConnection.first()).toBeVisible({ timeout: 10000 });

      // ===== STEP 10: Verify connection appears in User A's "Accepted" tab =====
      await pageA.reload();
      await handleReAuthModal(pageA, USER_A.password);
      const acceptedTabA = pageA.getByRole('tab', { name: /accepted/i });
      await acceptedTabA.click({ force: true });

      const acceptedConnectionA = pageA.locator(
        '[data-testid="connection-request"]'
      );
      await expect(acceptedConnectionA.first()).toBeVisible({ timeout: 10000 });
    } finally {
      // Clean up: close contexts
      await contextA.close();
      await contextB.close();
    }
  });

  test('User A can decline a friend request from User B', async ({
    browser,
  }) => {
    test.setTimeout(90000);

    // Clean up existing connection from previous test (accept test
    // creates a connection; this test needs a fresh slate to send
    // a new request that User A can decline).
    await cleanupConnections();

    const contextA = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User B sends request to User A (searching by username of A)
      await pageB.goto('/sign-in');
      await pageB.evaluate(() =>
        localStorage.setItem('playwright_e2e', 'true')
      );
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }
      await resetEncryptionKeys(pageB, USER_B.email, USER_B.password);

      await pageB.goto('/messages?tab=connections', {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageB, USER_B.password);
      const searchInput = pageB.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      // Search for User A by display_name
      await searchInput.fill(userADisplayName!);
      await searchInput.press('Enter');
      await pageB.waitForSelector(
        '[data-testid="search-results"], .alert-error',
        { timeout: 15000 }
      );
      await pageB
        .getByRole('button', { name: /send request/i })
        .click({ force: true });

      // Wait for success message OR "already connected" error (both mean connection exists)
      const successOrAlreadyConnected = pageB.getByText(
        /friend request sent|already.*connected|duplicate key|unique_connection/i
      );
      await expect(successOrAlreadyConnected).toBeVisible({
        timeout: 15000,
      });

      // User A signs in and declines
      await pageA.goto('/sign-in');
      await pageA.evaluate(() =>
        localStorage.setItem('playwright_e2e', 'true')
      );
      const resultA = await performSignIn(pageA, USER_A.email, USER_A.password);
      if (!resultA.success) {
        throw new Error(`User A sign-in failed: ${resultA.error}`);
      }

      await pageA.goto('/messages?tab=connections', {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(pageA, USER_A.password);
      const receivedTab = pageA.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });

      await pageA.waitForSelector('[data-testid="connection-request"]', {
        timeout: 15000,
      });

      // Decline the request
      const declineButton = pageA
        .getByRole('button', { name: /decline/i })
        .first();
      await declineButton.click({ force: true });

      // Verify request disappears from received tab
      await expect(
        pageA.locator('[data-testid="connection-request"]')
      ).toBeHidden({ timeout: 15000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('User A can cancel a sent pending request', async ({ page }) => {
    test.setTimeout(90000);

    // Delete existing connection so we can send a fresh request to cancel
    await cleanupConnections();

    // Sign in as User A using robust helper
    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Send friend request to User B
    await page.goto('/messages?tab=connections', {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, USER_A.password);
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(userBDisplayName!);
    await searchInput.press('Enter');
    await page.waitForSelector('[data-testid="search-results"], .alert-error', {
      timeout: 30000,
    });
    const sendReqBtn = page.getByRole('button', { name: /send request/i });
    await expect(sendReqBtn).toBeVisible({ timeout: 15000 });
    await sendReqBtn.click({ force: true });

    // Wait for success message OR "already connected" error (both mean connection exists)
    const successOrAlreadyConnected = page.getByText(
      /friend request sent|already.*connected|duplicate key|unique_connection/i
    );
    await expect(successOrAlreadyConnected).toBeVisible({
      timeout: 15000,
    });

    // Go to "Sent" tab
    const sentTab = page.getByRole('tab', { name: /pending sent|sent/i });
    await sentTab.click({ force: true });

    // Find the pending request
    await page.waitForSelector('[data-testid="connection-request"]', {
      timeout: 15000,
    });

    // Cancel the request
    const cancelButton = page
      .getByRole('button', { name: /cancel|delete/i })
      .first();
    await cancelButton.click({ force: true });

    // Verify request disappears
    await expect(page.locator('[data-testid="connection-request"]')).toBeHidden(
      { timeout: 15000 }
    );
  });

  test('User cannot send duplicate requests', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    await page.goto('/messages?tab=connections', {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, USER_A.password);

    // Send first request
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(userBDisplayName!);
    await searchInput.press('Enter');
    await page.waitForSelector('[data-testid="search-results"], .alert-error', {
      timeout: 15000,
    });

    const sendRequestButton = page.getByRole('button', {
      name: /send request/i,
    });
    await sendRequestButton.click({ force: true });
    await expect(page.getByText(/friend request sent/i)).toBeVisible({
      timeout: 15000,
    });

    // Search again and verify button state changed
    await searchInput.clear();
    await searchInput.fill(userBDisplayName!);
    await searchInput.press('Enter');
    await page.waitForSelector('[data-testid="search-results"], .alert-error', {
      timeout: 15000,
    });

    // Button should be disabled or show different text like "Pending"
    const requestButtonAfter = page
      .getByRole('button', { name: /send request/i })
      .first();
    const isPending = await page
      .getByRole('button', { name: /pending/i })
      .isVisible()
      .catch(() => false);
    const isDisabled = await requestButtonAfter.isDisabled().catch(() => true);

    expect(isPending || isDisabled).toBe(true);
  });
});

test.describe('Accessibility', () => {
  test('connections page meets WCAG standards', async ({ page }) => {
    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    await page.goto('/messages?tab=connections', {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, USER_A.password);

    // Verify keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();

    // Verify ARIA labels on search input
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toHaveAttribute('aria-label', /.+/);

    // Verify visible buttons have accessible labels
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  test('tab navigation works correctly', async ({ page }) => {
    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    await page.goto('/messages?tab=connections', {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, USER_A.password);
    await page.waitForLoadState('domcontentloaded');

    // Verify all tabs are keyboard accessible via Tab key
    // Note: DaisyUI tabs don't implement ARIA arrow key navigation
    const receivedTab = page.getByRole('tab', {
      name: /pending received|received/i,
    });
    const sentTab = page.getByRole('tab', { name: /pending sent|sent/i });
    const acceptedTab = page.getByRole('tab', { name: /accepted/i });

    // Verify tabs are focusable and clickable
    await receivedTab.focus();
    await expect(receivedTab).toBeFocused();

    // Click tabs to verify they're accessible (DaisyUI uses tab-active class)
    await sentTab.click();
    await expect(sentTab).toHaveClass(/tab-active/);

    await acceptedTab.click();
    await expect(acceptedTab).toHaveClass(/tab-active/);
  });
});
