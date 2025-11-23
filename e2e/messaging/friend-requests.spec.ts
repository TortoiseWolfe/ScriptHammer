/**
 * E2E Test: Friend Request Flow
 * Task: T014
 *
 * Scenario:
 * 1. User A sends friend request to User B
 * 2. User B receives and accepts the request
 * 3. Verify connection status is 'accepted' for both users
 *
 * Prerequisites:
 * - Two test users exist in Supabase
 * - /messages/connections page exists
 * - UserSearch component exists
 * - ConnectionManager component exists
 */

import { test, expect } from '@playwright/test';

// Test users (must exist in Supabase - created via seed script)
const USER_A = {
  email: 'friend-request-tester-a@example.com',
  password: 'TestPassword123!',
};

const USER_B = {
  email: 'friend-request-tester-b@example.com',
  password: 'TestPassword123!',
};

test.describe('Friend Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clean up any existing connections between test users
    // (This would require a test cleanup API endpoint or direct DB access)
    // TODO: Implement cleanup endpoint at /api/test/cleanup-connections
  });

  test('User A sends friend request and User B accepts', async ({
    browser,
  }) => {
    // Create two browser contexts (two separate users)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ===== STEP 1: User A signs in =====
      await pageA.goto('/sign-in');
      await pageA.fill('input[name="email"]', USER_A.email);
      await pageA.fill('input[name="password"]', USER_A.password);
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL('/'); // Wait for redirect after sign-in

      // ===== STEP 2: User A navigates to connections page =====
      await pageA.goto('/messages/connections');
      await expect(pageA).toHaveURL('/messages/connections');

      // ===== STEP 3: User A searches for User B =====
      const searchInput = pageA.locator('input[placeholder*="Search"]').first();
      await searchInput.fill(USER_B.email);

      const searchButton = pageA.getByRole('button', { name: /search/i });
      await searchButton.click();

      // Wait for search results
      await pageA.waitForSelector('[data-testid="search-results"]', {
        timeout: 5000,
      });

      // ===== STEP 4: User A sends friend request =====
      const sendRequestButton = pageA.getByRole('button', {
        name: /send request/i,
      });
      await expect(sendRequestButton).toBeVisible();
      await expect(sendRequestButton).toBeEnabled();
      await sendRequestButton.click();

      // Wait for success message
      await expect(pageA.getByText(/friend request sent/i)).toBeVisible({
        timeout: 3000,
      });

      // Verify button is now disabled or changed
      await expect(sendRequestButton).toBeDisabled();

      // ===== STEP 5: User B signs in =====
      await pageB.goto('/sign-in');
      await pageB.fill('input[name="email"]', USER_B.email);
      await pageB.fill('input[name="password"]', USER_B.password);
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL('/');

      // ===== STEP 6: User B navigates to connections page =====
      await pageB.goto('/messages/connections');

      // ===== STEP 7: User B sees pending request in "Received" tab =====
      const receivedTab = pageB.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click();

      // Wait for request to appear
      await pageB.waitForSelector(`[data-testid*="connection-request"]`, {
        timeout: 5000,
      });

      // Verify User A's request is visible
      const requestItem = pageB
        .locator('[data-testid*="connection-request"]')
        .filter({ hasText: USER_A.email });
      await expect(requestItem).toBeVisible();

      // ===== STEP 8: User B accepts the request =====
      const acceptButton = requestItem.getByRole('button', {
        name: /accept/i,
      });
      await expect(acceptButton).toBeVisible();
      await expect(acceptButton).toBeEnabled();
      await acceptButton.click();

      // Wait for success message
      await expect(
        pageB.getByText(/connection accepted|request accepted/i)
      ).toBeVisible({ timeout: 3000 });

      // ===== STEP 9: Verify connection appears in "Accepted" tab for User B =====
      const acceptedTab = pageB.getByRole('tab', { name: /accepted/i });
      await acceptedTab.click();

      await pageB.waitForSelector(`[data-testid*="connection"]`, {
        timeout: 5000,
      });

      const acceptedConnection = pageB
        .locator('[data-testid*="connection"]')
        .filter({ hasText: USER_A.email });
      await expect(acceptedConnection).toBeVisible();

      // ===== STEP 10: Verify connection appears in User A's "Accepted" tab =====
      await pageA.reload(); // Refresh to see updated status
      const acceptedTabA = pageA.getByRole('tab', { name: /accepted/i });
      await acceptedTabA.click();

      await pageA.waitForSelector(`[data-testid*="connection"]`, {
        timeout: 5000,
      });

      const acceptedConnectionA = pageA
        .locator('[data-testid*="connection"]')
        .filter({ hasText: USER_B.email });
      await expect(acceptedConnectionA).toBeVisible();
    } finally {
      // Clean up: close contexts
      await contextA.close();
      await contextB.close();
    }
  });

  test('User A can decline a friend request from User B', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User B sends request to User A
      await pageB.goto('/sign-in');
      await pageB.fill('input[name="email"]', USER_B.email);
      await pageB.fill('input[name="password"]', USER_B.password);
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL('/');

      await pageB.goto('/messages/connections');
      const searchInput = pageB.locator('input[placeholder*="Search"]').first();
      await searchInput.fill(USER_A.email);
      await pageB.getByRole('button', { name: /search/i }).click();
      await pageB.waitForSelector('[data-testid="search-results"]');
      await pageB.getByRole('button', { name: /send request/i }).click();
      await expect(pageB.getByText(/friend request sent/i)).toBeVisible();

      // User A signs in and declines
      await pageA.goto('/sign-in');
      await pageA.fill('input[name="email"]', USER_A.email);
      await pageA.fill('input[name="password"]', USER_A.password);
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL('/');

      await pageA.goto('/messages/connections');
      const receivedTab = pageA.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click();

      const requestItem = pageA
        .locator('[data-testid*="connection-request"]')
        .filter({ hasText: USER_B.email });
      await expect(requestItem).toBeVisible();

      // Decline the request
      const declineButton = requestItem.getByRole('button', {
        name: /decline/i,
      });
      await declineButton.click();

      // Verify request disappears from received tab
      await expect(requestItem).not.toBeVisible({ timeout: 3000 });

      // Verify it doesn't appear in accepted tab
      const acceptedTab = pageA.getByRole('tab', { name: /accepted/i });
      await acceptedTab.click();
      await expect(requestItem).not.toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('User A can cancel a sent pending request', async ({ page }) => {
    // Sign in as User A
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Send friend request to User B
    await page.goto('/messages/connections');
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(USER_B.email);
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForSelector('[data-testid="search-results"]');
    await page.getByRole('button', { name: /send request/i }).click();
    await expect(page.getByText(/friend request sent/i)).toBeVisible();

    // Go to "Sent" tab
    const sentTab = page.getByRole('tab', { name: /pending sent|sent/i });
    await sentTab.click();

    // Find the pending request
    const requestItem = page
      .locator('[data-testid*="connection-request"]')
      .filter({ hasText: USER_B.email });
    await expect(requestItem).toBeVisible();

    // Cancel the request
    const cancelButton = requestItem.getByRole('button', {
      name: /cancel|delete/i,
    });
    await cancelButton.click();

    // Verify request disappears
    await expect(requestItem).not.toBeVisible({ timeout: 3000 });
  });

  test('User cannot send duplicate requests', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/messages/connections');

    // Send first request
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(USER_B.email);
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForSelector('[data-testid="search-results"]');

    const sendRequestButton = page.getByRole('button', {
      name: /send request/i,
    });
    await sendRequestButton.click();
    await expect(page.getByText(/friend request sent/i)).toBeVisible();

    // Try to send again (button should be disabled)
    await expect(sendRequestButton).toBeDisabled();

    // Or if searching again, button should show "Already sent" or be disabled
    await searchInput.fill('');
    await searchInput.fill(USER_B.email);
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForSelector('[data-testid="search-results"]');

    const requestButtonAfter = page
      .getByRole('button', { name: /send request/i })
      .first();
    await expect(requestButtonAfter).toBeDisabled();
  });
});

test.describe('Accessibility', () => {
  test('connections page meets WCAG standards', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/messages/connections');

    // Verify keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();

    // Verify ARIA labels
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toHaveAttribute('aria-label', /.+/);

    // Verify buttons have proper labels
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  test('tab navigation works correctly', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/messages/connections');

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
