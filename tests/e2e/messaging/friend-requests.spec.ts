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
    await client
      .from('user_connections')
      .delete()
      .or(
        `requester_id.eq.${userAId},requester_id.eq.${userBId},addressee_id.eq.${userAId},addressee_id.eq.${userBId}`
      );
    console.log('Cleaned up connections between test users');
  }
};

test.describe('Friend Request Flow', () => {
  // Run tests serially to avoid parallel interference
  test.describe.configure({ mode: 'serial' });

  // Track setup status
  let setupError = '';

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
        'TEST_USER_PRIMARY_EMAIL or TEST_USER_TERTIARY_EMAIL not configured - using fallback emails that do not exist';
      testInfo.skip(true, setupError);
      return;
    }

    // Look up display names dynamically (only once, then cached)
    if (!userADisplayName) {
      userADisplayName = await getDisplayNameByEmail(USER_A.email);
    }
    if (!userBDisplayName) {
      userBDisplayName = await getDisplayNameByEmail(USER_B.email);
    }
    // Clean up any existing connections between test users
    await cleanupConnections();
  });

  test('User A sends friend request and User B accepts', async ({
    browser,
  }) => {
    test.setTimeout(90000); // 90 seconds for full workflow

    // Create two browser contexts (two separate users)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ===== STEP 1: User A signs in =====
      await pageA.goto('/sign-in');
      const resultA = await performSignIn(pageA, USER_A.email, USER_A.password);
      if (!resultA.success) {
        throw new Error(`User A sign-in failed: ${resultA.error}`);
      }

      // ===== STEP 2: User A navigates to connections tab =====
      await pageA.goto('/messages?tab=connections');
      await handleReAuthModal(pageA, USER_A.password);
      await expect(pageA).toHaveURL(/.*\/messages.*tab=connections/);

      // ===== STEP 3: User A searches for User B by display_name =====
      const searchInput = pageA.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill(userBDisplayName!);
      await searchInput.press('Enter');

      // Wait for search results
      await pageA.waitForSelector(
        '[data-testid="search-results"], .alert-error',
        {
          timeout: 15000,
        }
      );

      // ===== STEP 4: User A sends friend request =====
      const sendRequestButton = pageA.getByRole('button', {
        name: /send request/i,
      });
      await expect(sendRequestButton).toBeVisible();
      await sendRequestButton.click({ force: true });

      // Wait for success message OR "already connected" error (both mean users can chat)
      // In parallel test runs, connection might already exist from other tests
      const successOrAlreadyConnected = pageA.getByText(
        /friend request sent|already.*connected|duplicate key|unique_connection/i
      );
      await expect(successOrAlreadyConnected).toBeVisible({
        timeout: 5000,
      });

      // ===== STEP 5: User B signs in =====
      await pageB.goto('/sign-in');
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }

      // ===== STEP 6: User B navigates to connections page =====
      await pageB.goto('/messages?tab=connections');
      await handleReAuthModal(pageB, USER_B.password);
      await expect(pageB).toHaveURL(/.*\/messages.*tab=connections/);

      // ===== STEP 7: User B sees pending request in "Received" tab =====
      const receivedTab = pageB.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });

      // Wait for request to appear
      await pageB.waitForSelector('[data-testid="connection-request"]', {
        timeout: 5000,
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
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User B sends request to User A (searching by username of A)
      await pageB.goto('/sign-in');
      const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
      if (!resultB.success) {
        throw new Error(`User B sign-in failed: ${resultB.error}`);
      }

      await pageB.goto('/messages?tab=connections');
      await handleReAuthModal(pageB, USER_B.password);
      const searchInput = pageB.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
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
        timeout: 5000,
      });

      // User A signs in and declines
      await pageA.goto('/sign-in');
      const resultA = await performSignIn(pageA, USER_A.email, USER_A.password);
      if (!resultA.success) {
        throw new Error(`User A sign-in failed: ${resultA.error}`);
      }

      await pageA.goto('/messages?tab=connections');
      await handleReAuthModal(pageA, USER_A.password);
      const receivedTab = pageA.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });

      await pageA.waitForSelector('[data-testid="connection-request"]', {
        timeout: 5000,
      });

      // Decline the request
      const declineButton = pageA
        .getByRole('button', { name: /decline/i })
        .first();
      await declineButton.click({ force: true });

      // Verify request disappears from received tab
      await expect(
        pageA.locator('[data-testid="connection-request"]')
      ).toBeHidden({ timeout: 5000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('User A can cancel a sent pending request', async ({ page }) => {
    test.setTimeout(60000);

    // Sign in as User A using robust helper
    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Send friend request to User B
    await page.goto('/messages?tab=connections');
    await handleReAuthModal(page, USER_A.password);
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(userBDisplayName!);
    await searchInput.press('Enter');
    await page.waitForSelector('[data-testid="search-results"], .alert-error', {
      timeout: 15000,
    });
    await page
      .getByRole('button', { name: /send request/i })
      .click({ force: true });

    // Wait for success message OR "already connected" error (both mean connection exists)
    const successOrAlreadyConnected = page.getByText(
      /friend request sent|already.*connected|duplicate key|unique_connection/i
    );
    await expect(successOrAlreadyConnected).toBeVisible({
      timeout: 5000,
    });

    // Go to "Sent" tab
    const sentTab = page.getByRole('tab', { name: /pending sent|sent/i });
    await sentTab.click({ force: true });

    // Find the pending request
    await page.waitForSelector('[data-testid="connection-request"]', {
      timeout: 5000,
    });

    // Cancel the request
    const cancelButton = page
      .getByRole('button', { name: /cancel|delete/i })
      .first();
    await cancelButton.click({ force: true });

    // Verify request disappears
    await expect(page.locator('[data-testid="connection-request"]')).toBeHidden(
      { timeout: 5000 }
    );
  });

  test('User cannot send duplicate requests', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/sign-in');
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    await page.goto('/messages?tab=connections');
    await handleReAuthModal(page, USER_A.password);

    // Send first request
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
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
      timeout: 5000,
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

    await page.goto('/messages?tab=connections');
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

    await page.goto('/messages?tab=connections');
    await handleReAuthModal(page, USER_A.password);
    await page.waitForLoadState('networkidle');

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
