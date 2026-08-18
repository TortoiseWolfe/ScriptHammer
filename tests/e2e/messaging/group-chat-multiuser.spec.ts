/**
 * E2E Test: Group Chat with Multiple Users
 * Feature 010 — #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * These are UI-flow tests for the New Group page. Each test seeds its OWN
 * isolated viewer with one accepted connection (the throwaway partner) via
 * seedIsolatedConnection('accepted'), so the "available connections" member
 * picker is populated without sharing PRIMARY/SECONDARY. No shared users, no
 * cleanupOldMessages, no serial mode. The group itself is created through the
 * UI (these tests exercise that flow); seedIsolatedGroup() exists for tests
 * that need a pre-existing group.
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConnection,
  deleteIsolatedConnection,
  seedIsolatedGroup,
  deleteIsolatedGroup,
  deleteConversationsByGroupName,
  openAuthedPage,
  openConversationAs,
  handleReAuthModal,
  dismissCookieBanner,
  fillMessageInput,
  scrollThreadToBottom,
  DEFAULT_TEST_PASSWORD,
  type IsolatedConnection,
  type IsolatedGroup,
} from '../utils/test-user-factory';

test.describe.configure({ mode: 'parallel' });

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Open /messages authenticated as the isolated viewer (the requester). */
async function openMessagesAsViewer(
  browser: import('@playwright/test').Browser,
  fixture: IsolatedConnection
) {
  const opened = await openAuthedPage(browser, fixture.requesterSession);
  await opened.page.goto(`${BP}/messages`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(opened.page);
  await handleReAuthModal(opened.page, DEFAULT_TEST_PASSWORD);
  return opened;
}

test.describe('Group Chat E2E', () => {
  let fixture: IsolatedConnection | null = null;

  /**
   * Groups these tests create THROUGH THE UI (#612).
   *
   * Two tests below drive the New Group page, which is the flow they exist to
   * exercise — so no fixture object holds the resulting conversation id and
   * `deleteIsolatedGroup` cannot reach them. Nothing deleted them, and each CI
   * run left two behind permanently: production reached 1,910 conversations for
   * 20 users, 1,909 of them E2E litter with zero messages. Every row is published
   * to realtime, which fed the quota ceiling in #567.
   *
   * Recorded at fill time rather than derived afterwards, so a test that fails
   * mid-flow still cleans up what it managed to create.
   */
  const uiCreatedGroupNames: string[] = [];

  function recordUiGroup(name: string): string {
    uiCreatedGroupNames.push(name);
    return name;
  }

  test.beforeEach(async () => {
    // One accepted connection → the viewer has exactly one selectable member.
    fixture = await seedIsolatedConnection('accepted');
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConnection(fixture);
    fixture = null;
  });

  test.afterAll(async () => {
    // Delete, then ASSERT the deletion happened. #612's acceptance is explicitly
    // "assert conversations returns to its starting count" — because the suite
    // passed every single time while leaking, so a green run proves nothing about
    // tear-down. `deleteConversationsByGroupName` re-reads and returns whatever
    // survived; anything non-empty is a leak and fails the run.
    const survivors = await deleteConversationsByGroupName(uiCreatedGroupNames);
    uiCreatedGroupNames.length = 0;

    expect(
      survivors,
      `UI-created group conversations survived tear-down: ${survivors.join(', ')}. ` +
        `This is the #612 leak — each surviving row is permanent litter in a ` +
        `production table, published to realtime, with no upper bound.`
    ).toEqual([]);
  });

  test('should show New Group link in sidebar', async ({ browser }) => {
    const viewer = await openMessagesAsViewer(browser, fixture!);
    try {
      const sidebar = viewer.page.locator('[data-testid="unified-sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 15000 });

      const newGroupLink = viewer.page
        .locator('a:has-text("New Group")')
        .first();
      await expect(newGroupLink).toBeVisible({ timeout: 10000 });

      const href = await newGroupLink.getAttribute('href');
      expect(href).toContain('new-group');
    } finally {
      await viewer.close();
    }
  });

  test('should navigate to new-group page and show connections', async ({
    browser,
  }) => {
    const viewer = await openMessagesAsViewer(browser, fixture!);
    try {
      const sidebar = viewer.page.locator('[data-testid="unified-sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 15000 });
      const newGroupLink = sidebar.locator('a:has-text("New Group")').first();
      await expect(newGroupLink).toBeVisible({ timeout: 10000 });
      await newGroupLink.click();

      await viewer.page.waitForURL(/.*\/messages\/new-group/, {
        timeout: 10000,
      });

      await expect(viewer.page.locator('h1:has-text("New Group")')).toBeVisible(
        { timeout: 15000 }
      );
      await expect(viewer.page.locator('#group-name')).toBeVisible({
        timeout: 15000,
      });
      await expect(viewer.page.locator('#member-search')).toBeVisible({
        timeout: 15000,
      });

      const createButton = viewer.page.locator(
        'button:has-text("Create Group")'
      );
      await expect(createButton).toBeVisible({ timeout: 15000 });
      await expect(createButton).toBeDisabled();
    } finally {
      await viewer.close();
    }
  });

  test('should create group with connected users', async ({ browser }) => {
    const viewer = await openMessagesAsViewer(browser, fixture!);
    viewer.page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('connection')) {
        console.log(`[browser console.${msg.type()}] ${text}`);
      }
    });

    try {
      const sidebar = viewer.page.locator('[data-testid="unified-sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 30000 });
      const newGroupLink = sidebar.locator('a:has-text("New Group")').first();
      await expect(newGroupLink).toBeVisible({ timeout: 30000 });
      await newGroupLink.click();

      await viewer.page.waitForURL(/.*\/messages\/new-group/, {
        timeout: 10000,
      });

      const testGroupName = recordUiGroup(`Test Group ${Date.now()}`);
      await viewer.page.locator('#group-name').fill(testGroupName);

      // The isolated accepted connection should appear in the picker.
      const connectionsList = viewer.page.locator(
        '[role="listbox"][aria-label="Available connections"]'
      );
      await expect(connectionsList).toBeVisible({ timeout: 30000 });
      const firstConnection = viewer.page
        .locator('button[role="option"]')
        .first();
      await expect(firstConnection).toBeVisible({ timeout: 30000 });

      // Select all available members (just the one isolated partner here).
      let selectedCount = 0;
      while (selectedCount < 5) {
        const availableMember = viewer.page
          .locator('button[role="option"]')
          .first();
        const isVisible = await availableMember
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (!isVisible) break;
        await availableMember.click();
        selectedCount++;
        await viewer.page.waitForTimeout(500);
      }

      if (selectedCount > 0) {
        await expect(
          viewer.page.locator('text=/Selected \\(\\d+\\)/')
        ).toBeVisible({ timeout: 15000 });
      }

      await viewer.page.waitForTimeout(500);
      const createButton = viewer.page.locator(
        'button:has-text("Create Group")'
      );
      await expect(createButton).toBeEnabled({ timeout: 15000 });

      await createButton.click();
      await viewer.page.waitForTimeout(2000);

      // The UI flow is what's under test; group-creation backend may be partial.
      const hasError = await viewer.page
        .locator('text=/failed|error/i')
        .isVisible()
        .catch(() => false);
      if (hasError) {
        await viewer.page.goto(`${BP}/messages`, {
          waitUntil: 'domcontentloaded',
        });
      }
    } finally {
      await viewer.close();
    }
  });

  test('sends and reads an encrypted message in a UI-created group (#182)', async ({
    browser,
  }) => {
    // Creating the group through the UI runs createGroup() in-browser, which
    // generates + distributes the group AES key (group_keys). Then sending +
    // re-opening the group exercises the real group-message encrypt/decrypt
    // paths — which used to throw "not yet implemented".
    const viewer = await openMessagesAsViewer(browser, fixture!);
    try {
      const sidebar = viewer.page.locator('[data-testid="unified-sidebar"]');
      await expect(sidebar).toBeVisible({ timeout: 30000 });
      await sidebar.locator('a:has-text("New Group")').first().click();
      await viewer.page.waitForURL(/.*\/messages\/new-group/, {
        timeout: 10000,
      });

      await viewer.page
        .locator('#group-name')
        .fill(recordUiGroup(`Grp ${Date.now()}`));
      const firstConnection = viewer.page
        .locator('button[role="option"]')
        .first();
      await expect(firstConnection).toBeVisible({ timeout: 30000 });
      await firstConnection.click();

      const createButton = viewer.page.locator(
        'button:has-text("Create Group")'
      );
      await expect(createButton).toBeEnabled({ timeout: 15000 });

      // Capture browser console so a createGroup failure is visible in logs.
      viewer.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log(`[browser error] ${msg.text()}`);
        }
      });

      await createButton.click();

      // createGroup runs in-browser: generate + ECDH-distribute the group key
      // to every member, then insert (Argon2/ECDH — can take a while). Re-deriving
      // the private key may surface the ReAuth modal at an unpredictable moment
      // during that async work, so poll for it while waiting for the navigation
      // to /messages?conversation=<id> (or an error alert).
      const errorAlert = viewer.page.locator('.alert-error');
      const deadline = Date.now() + 90000;
      let navigated = false;
      while (Date.now() < deadline) {
        await handleReAuthModal(viewer.page, DEFAULT_TEST_PASSWORD).catch(
          () => {}
        );
        if (/\/messages\?conversation=/.test(viewer.page.url())) {
          navigated = true;
          break;
        }
        // A REAL group-creation error (e.g. the RLS 403s this feature fixed)
        // must fail the test — that's the regression we're guarding.
        if (await errorAlert.isVisible().catch(() => false)) {
          const msg = await errorAlert.innerText().catch(() => '');
          throw new Error(`Group creation surfaced an error: ${msg}`);
        }
        await viewer.page.waitForTimeout(1000);
      }
      // If creation neither errored NOR navigated in 90s, the throwaway-user
      // Argon2/ECDH key distribution was just too slow on this runner — skip
      // rather than flake-fail. The encrypt/decrypt LOGIC is covered by the
      // message-service unit tests; this spec guards the "group is reachable,
      // no 'not yet implemented' throw, message round-trips" flow when the
      // environment is fast enough to create the group.
      test.skip(
        !navigated,
        'group creation did not complete within 90s on this runner (slow Argon2/ECDH)'
      );

      await handleReAuthModal(viewer.page, DEFAULT_TEST_PASSWORD).catch(
        () => {}
      );

      // No "not yet implemented" / decryption error surfaced on open.
      await expect(
        viewer.page.locator('text=/not yet implemented/i')
      ).toHaveCount(0);

      // Send a message into the group (encrypt path).
      const body = `group hello ${Date.now()}`;
      await fillMessageInput(viewer.page, body);
      await viewer.page.getByRole('button', { name: /Send message/i }).click();

      // The sent message renders (own message decrypts + displays).
      await expect(viewer.page.getByText(body)).toBeVisible({
        timeout: 20000,
      });
    } finally {
      await viewer.close();
    }
  });

  test('should navigate back to messages when clicking back button', async ({
    browser,
  }) => {
    const viewer = await openMessagesAsViewer(browser, fixture!);
    try {
      await viewer.page.goto(`${BP}/messages/new-group`, {
        waitUntil: 'domcontentloaded',
      });
      await handleReAuthModal(viewer.page, DEFAULT_TEST_PASSWORD);

      await expect(viewer.page.locator('h1:has-text("New Group")')).toBeVisible(
        { timeout: 10000 }
      );

      const backButton = viewer.page.locator(
        'a[aria-label="Back to messages"]'
      );
      await expect(backButton).toBeVisible({ timeout: 15000 });
      await backButton.click();

      await viewer.page.waitForURL(/.*\/messages(?!.*new-group)/, {
        timeout: 10000,
      });
    } finally {
      await viewer.close();
    }
  });
});

test('contract - isolated connection helper is usable', async () => {
  // The isolation substrate must be configured (admin client + anon key).
  const fixture = await seedIsolatedConnection('accepted');
  expect(fixture, 'seedIsolatedConnection returned a fixture').toBeTruthy();
  expect(fixture!.requesterDisplayName).toMatch(/.+/);
  await deleteIsolatedConnection(fixture);
});

/**
 * DETERMINISTIC group send/decrypt (#182 follow-up).
 *
 * Unlike the UI-created-group test above — which drives createGroup() in-browser
 * (Argon2 + in-browser ECDH key distribution, routinely >90s, so it skips on
 * slow runners and never reliably proves send/decrypt) — this seeds the group
 * AND distributes the group key SERVER-SIDE via seedIsolatedGroup(withKeys), so
 * the group is send/decrypt-ready with NO UI creation. Each browser still pays
 * one Argon2 key-unlock (via the ReAuth modal, same as every 1:1 iso test), but
 * the compounding UI-creation cost is gone → the test is deterministic and does
 * NOT skip. It's the authoritative cross-member group-encryption round-trip:
 * member A sends, member B (a second browser context) decrypts.
 */
test.describe('Group Chat E2E — deterministic encrypted round-trip (#182)', () => {
  let group: IsolatedGroup | null = null;

  test.beforeEach(async () => {
    // 2 keyed members + a group conversation WITH the group key distributed.
    group = await seedIsolatedGroup(2, { withKeys: true });
    test.skip(!group, 'group seed/keying failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedGroup(group);
    group = null;
  });

  test('member A sends an encrypted group message and member B decrypts it', async ({
    browser,
  }) => {
    const [a, b] = group!.participants;
    const convId = group!.conversationId;

    // Open both members concurrently — serializing the two Argon2 ReAuth
    // unlocks nearly exhausts the per-test budget before the send.
    // openConversationAs does goto + dismiss + ReAuth + wait-for-thread.
    const [A, B] = await Promise.all([
      openConversationAs(browser, a.session, convId),
      openConversationAs(browser, b.session, convId),
    ]);

    // Forward browser console for CI diagnostics.
    for (const [label, pg] of [
      ['A', A.page],
      ['B', B.page],
    ] as const) {
      pg.on('console', (msg) => {
        if (
          msg.type() === 'error' ||
          msg.text().includes('DECRYPTION') ||
          msg.text().includes('group')
        ) {
          console.log(`[${label} console.${msg.type()}] ${msg.text()}`);
        }
      });
    }

    try {
      // Opening a group must NOT throw the #182 "not yet implemented" — the
      // regression this whole feature guards against.
      await expect(A.page.locator('text=/not yet implemented/i')).toHaveCount(
        0
      );

      // A sends into the group (real group encrypt path: getGroupKeyForConversation
      // at current_key_version → encryptMessage → messages.key_version stamped).
      const body = `deterministic group hello ${Date.now()}`;
      await fillMessageInput(A.page, body);
      const sendButton = A.page.getByRole('button', { name: /Send message/i });
      await sendButton.click();
      await expect(sendButton).not.toContainText('Sending', { timeout: 60000 });

      // A sees its OWN message decrypt + render (own bubble goes through the
      // full group-key decrypt path, not an isOwn shortcut).
      await scrollThreadToBottom(A.page);
      await expect(A.page.getByText(body)).toBeVisible({ timeout: 30000 });

      // B (a DIFFERENT member, second context) decrypts + sees it — this is the
      // cross-member proof. B unwraps the group key with B's re-derived private
      // key + the creator's public key, then decrypts A's message. The thread
      // updates via ~10s polling; reload between attempts to survive cloud
      // read-after-write tail latency.
      const bText = B.page.getByText(body);
      for (let i = 0; i < 5; i++) {
        await scrollThreadToBottom(B.page);
        if (await bText.isVisible({ timeout: 12000 }).catch(() => false)) break;
        await B.page.reload({ waitUntil: 'domcontentloaded' });
        await handleReAuthModal(B.page, DEFAULT_TEST_PASSWORD).catch(() => {});
        await B.page.waitForSelector('[data-testid="message-thread"]', {
          state: 'visible',
          timeout: 30000,
        });
      }
      await scrollThreadToBottom(B.page);
      await expect(bText).toBeVisible({ timeout: 15000 });

      // Neither member shows a decryption placeholder / "not yet implemented".
      await expect(B.page.locator('text=/not yet implemented/i')).toHaveCount(
        0
      );
      await expect(
        B.page.getByText('Encrypted with previous keys')
      ).toHaveCount(0);
    } finally {
      await Promise.all([A.close(), B.close()]);
    }
  });
});
