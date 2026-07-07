/**
 * E2E Test: Friend Request Flow
 * Task: T014 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * Every test seeds its OWN isolated requester + addressee (throwaway users) via
 * seedIsolatedConnection(status), so nothing is shared and the spec runs
 * `fullyParallel`. This replaces the old cleanupConnections / restoreAccepted
 * boilerplate, which existed solely to protect the SHARED PRIMARY↔TERTIARY
 * connection that downstream specs depended on — that coupling is gone now that
 * each test owns its connection. UserSearch searches by display_name, which the
 * helper exposes as requesterDisplayName / addresseeDisplayName.
 *
 * Scenarios:
 * 1. Requester sends a friend request; addressee accepts.
 * 2. Addressee can decline a request.
 * 3. Requester can cancel a sent pending request.
 * 4. Duplicate requests are prevented.
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConnection,
  deleteIsolatedConnection,
  openAuthedPage,
  handleReAuthModal,
  dismissCookieBanner,
  DEFAULT_TEST_PASSWORD,
  type IsolatedConnection,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-connection race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Open the connections tab authenticated as `session` (no thread to unlock). */
async function openConnectionsTab(
  browser: import('@playwright/test').Browser,
  session: IsolatedConnection['requesterSession']
) {
  const opened = await openAuthedPage(browser, session);
  await opened.page.goto(`${BP}/messages?tab=connections`, {
    waitUntil: 'domcontentloaded',
  });
  await dismissCookieBanner(opened.page);
  await handleReAuthModal(opened.page, DEFAULT_TEST_PASSWORD);
  return opened;
}

/** Search the connections page for `displayName` and wait for results. */
async function searchFor(
  page: import('@playwright/test').Page,
  displayName: string
) {
  const searchInput = page.locator('#user-search-input');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill(displayName);
  await searchInput.press('Enter');
  await page.waitForSelector('[data-testid="search-results"], .alert-error', {
    timeout: 30000,
  });
}

test.describe('Friend Request Flow', () => {
  let fixture: IsolatedConnection | null = null;

  test.afterEach(async () => {
    await deleteIsolatedConnection(fixture);
    fixture = null;
  });

  test('requester sends friend request and addressee accepts', async ({
    browser,
  }) => {
    // Start with NO connection — the requester sends it via the UI.
    fixture = await seedIsolatedConnection('none');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const [requester, addressee] = await Promise.all([
      openConnectionsTab(browser, fixture!.requesterSession),
      openConnectionsTab(browser, fixture!.addresseeSession),
    ]);

    try {
      // ===== Requester searches for addressee and sends a request =====
      await searchFor(requester.page, fixture!.addresseeDisplayName);
      const sendRequestButton = requester.page.getByRole('button', {
        name: /send request/i,
      });
      await expect(sendRequestButton.first()).toBeVisible({ timeout: 15000 });
      await sendRequestButton.first().click({ force: true });
      await expect(
        requester.page.getByText(/friend request sent/i)
      ).toBeVisible({ timeout: 15000 });

      // ===== Addressee sees the pending request in "Received" and accepts =====
      await addressee.page.reload({ waitUntil: 'domcontentloaded' });
      await handleReAuthModal(addressee.page, DEFAULT_TEST_PASSWORD);
      const receivedTab = addressee.page.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });
      await addressee.page.waitForSelector(
        '[data-testid="connection-request"]',
        { timeout: 15000 }
      );
      const acceptButton = addressee.page
        .getByRole('button', { name: /accept/i })
        .first();
      await expect(acceptButton).toBeVisible();
      await acceptButton.click({ force: true });

      const pendingRequest = addressee.page.locator(
        '[data-testid="connection-request"]'
      );
      try {
        await expect(pendingRequest).toBeHidden({ timeout: 30000 });
      } catch {
        await addressee.page.reload();
        await handleReAuthModal(addressee.page, DEFAULT_TEST_PASSWORD);
        await expect(pendingRequest).toBeHidden({ timeout: 15000 });
      }

      // ===== Connection appears in the addressee's "Accepted" tab =====
      const acceptedTab = addressee.page.getByRole('tab', {
        name: /accepted/i,
      });
      await acceptedTab.click({ force: true });
      await expect(
        addressee.page.locator('[data-testid="connection-request"]').first()
      ).toBeVisible({ timeout: 10000 });

      // ===== ...and in the requester's "Accepted" tab =====
      await requester.page.reload();
      await handleReAuthModal(requester.page, DEFAULT_TEST_PASSWORD);
      const acceptedTabR = requester.page.getByRole('tab', {
        name: /accepted/i,
      });
      await acceptedTabR.click({ force: true });
      await expect(
        requester.page.locator('[data-testid="connection-request"]').first()
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await requester.close();
      await addressee.close();
    }
  });

  test('addressee can decline a friend request', async ({ browser }) => {
    // Seed a pending request FROM requester TO addressee; addressee declines.
    fixture = await seedIsolatedConnection('pending');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const addressee = await openConnectionsTab(
      browser,
      fixture!.addresseeSession
    );
    try {
      const receivedTab = addressee.page.getByRole('tab', {
        name: /pending received|received/i,
      });
      await receivedTab.click({ force: true });
      await addressee.page.waitForSelector(
        '[data-testid="connection-request"]',
        { timeout: 15000 }
      );

      const declineButton = addressee.page
        .getByRole('button', { name: /decline/i })
        .first();
      await declineButton.click({ force: true });

      await expect(
        addressee.page.locator('[data-testid="connection-request"]')
      ).toBeHidden({ timeout: 15000 });
    } finally {
      await addressee.close();
    }
  });

  test('requester can cancel a sent pending request', async ({ browser }) => {
    // Seed a pending request; the requester cancels it from the "Sent" tab.
    fixture = await seedIsolatedConnection('pending');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const requester = await openConnectionsTab(
      browser,
      fixture!.requesterSession
    );
    try {
      const sentTab = requester.page.getByRole('tab', {
        name: /pending sent|sent/i,
      });
      await sentTab.click({ force: true });
      await requester.page.waitForSelector(
        '[data-testid="connection-request"]',
        { timeout: 15000 }
      );

      const cancelButton = requester.page
        .getByRole('button', { name: /cancel|delete/i })
        .first();
      await cancelButton.click({ force: true });

      await expect(
        requester.page.locator('[data-testid="connection-request"]')
      ).toBeHidden({ timeout: 15000 });
    } finally {
      await requester.close();
    }
  });

  test('duplicate requests are prevented', async ({ browser }) => {
    // A pending request already exists; searching again must NOT offer a fresh
    // "Send Request" — the button is gone/disabled or shows a pending state.
    fixture = await seedIsolatedConnection('pending');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const requester = await openConnectionsTab(
      browser,
      fixture!.requesterSession
    );
    try {
      await searchFor(requester.page, fixture!.addresseeDisplayName);

      const sendRequestButton = requester.page
        .getByRole('button', { name: /send request/i })
        .first();
      const isPending = await requester.page
        .getByRole('button', { name: /pending|requested|cancel request/i })
        .first()
        .isVisible()
        .catch(() => false);
      const sendVisible = await sendRequestButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const isDisabled = sendVisible
        ? await sendRequestButton.isDisabled().catch(() => true)
        : true;

      // Duplicate prevention is in effect when there is no enabled Send button.
      expect(isPending || isDisabled).toBe(true);
    } finally {
      await requester.close();
    }
  });
});

test.describe('Accessibility', () => {
  let fixture: IsolatedConnection | null = null;

  test.afterEach(async () => {
    await deleteIsolatedConnection(fixture);
    fixture = null;
  });

  test('connections page meets WCAG standards', async ({ browser }) => {
    fixture = await seedIsolatedConnection('none');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const viewer = await openConnectionsTab(browser, fixture!.requesterSession);
    try {
      // Keyboard navigation reaches a visible focused element.
      await viewer.page.keyboard.press('Tab');
      await expect(viewer.page.locator(':focus').first()).toBeVisible();

      // Search input has an accessible name.
      await expect(viewer.page.locator('#user-search-input')).toHaveAttribute(
        'aria-label',
        /.+/
      );

      // Visible buttons have accessible labels.
      const buttons = viewer.page.locator('button:visible');
      const count = await buttons.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        expect(ariaLabel || text).toBeTruthy();
      }
    } finally {
      await viewer.close();
    }
  });

  test('tab navigation works correctly', async ({ browser }) => {
    fixture = await seedIsolatedConnection('none');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');

    const viewer = await openConnectionsTab(browser, fixture!.requesterSession);
    try {
      await viewer.page.waitForLoadState('domcontentloaded');

      const receivedTab = viewer.page.getByRole('tab', {
        name: /pending received|received/i,
      });
      const sentTab = viewer.page.getByRole('tab', {
        name: /pending sent|sent/i,
      });
      const acceptedTab = viewer.page.getByRole('tab', { name: /accepted/i });

      await receivedTab.focus();
      await expect(receivedTab).toBeFocused();

      await sentTab.click();
      await expect(sentTab).toHaveClass(/tab-active/);

      await acceptedTab.click();
      await expect(acceptedTab).toHaveClass(/tab-active/);
    } finally {
      await viewer.close();
    }
  });
});
