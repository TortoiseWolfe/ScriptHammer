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
 * - /messages/connections page exists
 * - UserSearch component exists
 * - ConnectionManager component exists
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test users - use PRIMARY and TERTIARY from standardized test fixtures
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  username: 'testuser-b', // Search uses username, not email
  email: process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com',
  password: process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!',
};

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
  test.beforeEach(async () => {
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
      await pageA.waitForLoadState('networkidle');
      await pageA.fill('#email', USER_A.email);
      await pageA.fill('#password', USER_A.password);
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL(/.*\/profile/, { timeout: 15000 });

      // ===== STEP 2: User A navigates to connections page =====
      await pageA.goto('/messages/connections');
      await expect(pageA).toHaveURL(/.*\/messages\/connections/);

      // ===== STEP 3: User A searches for User B by username =====
      const searchInput = pageA.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill(USER_B.username);
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

      // Wait for success message
      await expect(pageA.getByText(/friend request sent/i)).toBeVisible({
        timeout: 5000,
      });

      // ===== STEP 5: User B signs in =====
      await pageB.goto('/sign-in');
      await pageB.waitForLoadState('networkidle');
      await pageB.fill('#email', USER_B.email);
      await pageB.fill('#password', USER_B.password);
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL(/.*\/profile/, { timeout: 15000 });

      // ===== STEP 6: User B navigates to connections page =====
      await pageB.goto('/messages/connections');
      await expect(pageB).toHaveURL(/.*\/messages\/connections/);

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
      await pageB.waitForTimeout(1000);

      // Connection should now appear
      const acceptedConnection = pageB.locator(
        '[data-testid="accepted-connection"]'
      );
      await expect(acceptedConnection.first()).toBeVisible({ timeout: 5000 });

      // ===== STEP 10: Verify connection appears in User A's "Accepted" tab =====
      await pageA.reload();
      const acceptedTabA = pageA.getByRole('tab', { name: /accepted/i });
      await acceptedTabA.click({ force: true });
      await pageA.waitForTimeout(1000);

      const acceptedConnectionA = pageA.locator(
        '[data-testid="accepted-connection"]'
      );
      await expect(acceptedConnectionA.first()).toBeVisible({ timeout: 5000 });
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
      await pageB.waitForLoadState('networkidle');
      await pageB.fill('#email', USER_B.email);
      await pageB.fill('#password', USER_B.password);
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL(/.*\/profile/, { timeout: 15000 });

      await pageB.goto('/messages/connections');
      const searchInput = pageB.locator('#user-search-input');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      // Search for User A by username (testuser which is PRIMARY user's username)
      await searchInput.fill('testuser');
      await searchInput.press('Enter');
      await pageB.waitForSelector(
        '[data-testid="search-results"], .alert-error',
        { timeout: 15000 }
      );
      await pageB
        .getByRole('button', { name: /send request/i })
        .click({ force: true });
      await expect(pageB.getByText(/friend request sent/i)).toBeVisible({
        timeout: 5000,
      });

      // User A signs in and declines
      await pageA.goto('/sign-in');
      await pageA.waitForLoadState('networkidle');
      await pageA.fill('#email', USER_A.email);
      await pageA.fill('#password', USER_A.password);
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL(/.*\/profile/, { timeout: 15000 });

      await pageA.goto('/messages/connections');
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

    // Sign in as User A
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', USER_A.email);
    await page.fill('#password', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    // Send friend request to User B
    await page.goto('/messages/connections');
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(USER_B.username);
    await searchInput.press('Enter');
    await page.waitForSelector('[data-testid="search-results"], .alert-error', {
      timeout: 15000,
    });
    await page
      .getByRole('button', { name: /send request/i })
      .click({ force: true });
    await expect(page.getByText(/friend request sent/i)).toBeVisible({
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
    await page.waitForLoadState('networkidle');
    await page.fill('#email', USER_A.email);
    await page.fill('#password', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    await page.goto('/messages/connections');

    // Send first request
    const searchInput = page.locator('#user-search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(USER_B.username);
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
    await searchInput.fill(USER_B.username);
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
    await page.waitForLoadState('networkidle');
    await page.fill('#email', USER_A.email);
    await page.fill('#password', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    await page.goto('/messages/connections');

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
    await page.waitForLoadState('networkidle');
    await page.fill('#email', USER_A.email);
    await page.fill('#password', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/profile/, { timeout: 15000 });

    await page.goto('/messages/connections');
    await page.waitForLoadState('networkidle');

    // Verify all tabs are keyboard accessible
    const sentTab = page.getByRole('tab', { name: /pending sent|sent/i });
    const receivedTab = page.getByRole('tab', {
      name: /pending received|received/i,
    });
    const acceptedTab = page.getByRole('tab', { name: /accepted/i });

    await sentTab.focus();
    await expect(sentTab).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(receivedTab).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(acceptedTab).toBeFocused();
  });
});
