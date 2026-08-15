import { test, expect, Page } from '@playwright/test';
import { settleFrames } from '../utils/settle';
import {
  dismissCookieBanner,
  handleReAuthModal,
  seedScrollFixture,
  deleteScrollFixture,
  type ScrollFixture,
} from '../utils/test-user-factory';

// Test user credentials
const TEST_USER_PASSWORD =
  process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';
const PRIMARY_EMAIL = process.env.TEST_USER_PRIMARY_EMAIL;

// Issue #109: T007-T008 needs a thread tall enough to scroll, but the shared
// messaging conversation is deliberately kept SHORT by other specs'
// cleanupOldMessages() calls. So this spec builds its OWN isolated, static
// fixture — a throwaway user + private conversation with PRIMARY + a fixed 30
// messages — that no cleanup ever touches. See seedScrollFixture().
const SCROLL_FIXTURE_MESSAGE_COUNT = 30;
let scrollFixture: ScrollFixture | null = null;

/**
 * Messaging Scroll E2E Tests
 * Feature: 005-fix-messaging-scroll
 *
 * Tests CSS Grid layout fix for ChatWindow ensuring:
 * - Message input is visible at bottom on all viewports
 * - Scroll is constrained to message thread
 * - Jump-to-bottom button works correctly
 */

// Track if conversations exist for test user in CI
let setupSucceeded = false;

test.beforeAll(async ({ browser }) => {
  // Build the isolated, static scroll fixture (issue #109). No-ops gracefully
  // if credentials/admin client are unavailable, preserving the skip path.
  if (PRIMARY_EMAIL) {
    scrollFixture = await seedScrollFixture(
      PRIMARY_EMAIL,
      SCROLL_FIXTURE_MESSAGE_COUNT
    );
  }

  const context = await browser.newContext({
    storageState: './tests/e2e/fixtures/storage-state-auth.json',
  });
  const page = await context.newPage();
  try {
    // RELATIVE, so it honours the configured baseURL (#300).
    //
    // This was `http://localhost:3000/messages`, hardcoded. Every other navigation in this
    // file is relative, so the suite ran fine on 3000 and nowhere else — and the failure
    // mode was silent: the goto reached whatever else was on 3000, the conversation button
    // never appeared, `setupSucceeded` went false, and FIVE tests skipped with the
    // reassuring message "No conversations for test user in CI". A green run that executed
    // two of seven tests.
    //
    // That is what stopped this file being reproducible off-CI, which is what made T009 so
    // hard to diagnose: locally it never ran at all.
    await page.goto('/messages', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // Wait for the conversation list to mount + render. Use waitFor
    // (auto-retries) instead of isVisible (single shot, returns false
    // immediately if not yet in DOM). Issue #66 diagnostic confirmed
    // conversations exist in DB and render correctly — the original
    // isVisible({ timeout: 8000 }) was returning false in ~50ms because
    // the element wasn't attached yet at the moment of the call.
    setupSucceeded = await page
      .getByRole('button', { name: /Conversation with/ })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
  } finally {
    await context.close();
  }
});

test.afterAll(async () => {
  // Tear down the fixture user — cascades its conversation + messages away.
  await deleteScrollFixture(scrollFixture);
});

// Test configuration for viewports
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

/**
 * Click the first available conversation button to open a chat
 * Throws if no conversation exists (tests should have setup)
 */
async function clickFirstConversation(page: Page): Promise<void> {
  const conversationButton = page
    .getByRole('button', { name: /Conversation with/ })
    .first();

  // Wait for the button to be visible (give it plenty of time)
  await conversationButton.waitFor({ state: 'visible', timeout: 45000 });
  await conversationButton.click();

  // Wait for chat window to load after clicking
  await page.waitForSelector('[data-testid="chat-window"]', { timeout: 10000 });
  await settleFrames(page);
}

// Helper to check if element is in viewport
async function isElementInViewport(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  const isVisible = await element.isVisible();
  if (!isVisible) return false;

  const box = await element.boundingBox();
  if (!box) return false;

  const viewport = page.viewportSize();
  if (!viewport) return false;

  return (
    box.y >= 0 &&
    box.y + box.height <= viewport.height &&
    box.x >= 0 &&
    box.x + box.width <= viewport.width
  );
}

test.describe('Messaging Scroll - User Story 1: View Message Input', () => {
  test.beforeEach(async ({ page }) => {
    // Auth comes from storageState — navigate to messages directly
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);
    // Handle ReAuthModal if encryption keys need unlocking
    await handleReAuthModal(page, TEST_USER_PASSWORD);
  });

  test('T003: Message input visible on mobile viewport (375x667)', async ({
    page,
  }) => {
    test.skip(!setupSucceeded, 'No conversations for test user in CI');
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    // Click on a conversation to open chat (handles waiting internally)
    await clickFirstConversation(page);

    // Check message input is visible
    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    // Verify it's actually in viewport (not just in DOM)
    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });

  test('T004: Message input visible on tablet viewport (768x1024)', async ({
    page,
  }) => {
    test.skip(!setupSucceeded, 'No conversations for test user in CI');
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    await clickFirstConversation(page);

    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });

  test('T005: Message input visible on desktop viewport (1280x800)', async ({
    page,
  }) => {
    test.skip(!setupSucceeded, 'No conversations for test user in CI');
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    await clickFirstConversation(page);

    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    await expect(messageInput).toBeVisible();

    const isInViewport = await isElementInViewport(
      page,
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    expect(isInViewport).toBe(true);
  });
});

test.describe('Messaging Scroll - User Story 2: Scroll Through Messages', () => {
  test.beforeEach(async ({ page }) => {
    // Auth comes from storageState — navigate to messages directly
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);
    await handleReAuthModal(page, TEST_USER_PASSWORD);
  });

  test('T006: Scroll container constrained to MessageThread', async ({
    page,
  }) => {
    test.skip(!setupSucceeded, 'No conversations for test user in CI');
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    await clickFirstConversation(page);

    // Get message thread element
    const messageThread = page.locator('[data-testid="message-thread"]');
    await expect(messageThread).toBeVisible();

    // Get initial input position
    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    const initialInputBox = await messageInput.boundingBox();

    // Scroll up in the message thread.
    // WebKit does not always fire the scroll event for programmatic scrollTop
    // assignments. Dispatch it explicitly so React listeners (e.g.,
    // MessageThread's handleScroll at MessageThread.tsx:194) run reliably
    // across browsers.
    await messageThread.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    // Wait for scroll to complete
    await settleFrames(page);

    // Get input position after scroll
    const afterScrollInputBox = await messageInput.boundingBox();

    // Input should remain in the same position (header and input fixed)
    expect(afterScrollInputBox?.y).toBe(initialInputBox?.y);
  });
});

test.describe('Messaging Scroll - User Story 3: Jump to Bottom Button', () => {
  test.beforeEach(async ({ page }) => {
    // Auth comes from storageState — navigate to messages directly
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);
    await handleReAuthModal(page, TEST_USER_PASSWORD);
  });

  test('T007-T008: Jump button appears when scrolled and does not overlap input', async ({
    page,
  }) => {
    // Requires the isolated, tall scroll fixture (issue #109). Skip with a
    // CLEAR, logged reason if it couldn't be built (e.g. admin client / creds
    // unavailable) — never a silent pass that hides zero coverage.
    test.skip(
      !scrollFixture,
      'Scroll fixture unavailable (no admin client / credentials) — cannot build a scrollable thread'
    );
    const conversationId = scrollFixture!.conversationId;

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('about:blank').catch(() => {});
    // Open the fixture conversation DIRECTLY by id — deterministic, not
    // dependent on conversation-list sort order.
    await page.goto(`/messages?conversation=${conversationId}`, {
      waitUntil: 'domcontentloaded',
    });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    const messageThread = page.locator('[data-testid="message-thread"]');
    await expect(messageThread).toBeVisible({ timeout: 30000 });
    await settleFrames(page);

    // Scroll up more than 500px to trigger button
    await messageThread.evaluate((el) => {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - 600);
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await settleFrames(page);

    const jumpButton = page.locator('[data-testid="jump-to-bottom"]');

    const scrollInfo = await messageThread.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      distanceFromBottom: el.scrollHeight - (el.scrollTop + el.clientHeight),
    }));

    // The fixture seeds a fixed 30 messages, so the thread MUST be scrollable
    // past the 500px threshold. Assert it (rather than silently skipping the
    // button checks) — a short thread here is a real regression or a fixture
    // failure, not a no-op.
    expect(
      scrollInfo.distanceFromBottom,
      'fixture thread should be tall enough to scroll 500px+ from bottom'
    ).toBeGreaterThan(500);

    // Wait for the parent wrapper's `data-show-scroll-button` attribute
    // to flip to "true" before asserting button visibility. The attribute
    // is written by MessageThread.tsx synchronously when `setShowScroll
    // Button(true)` commits — bypassing the React-state-flush vs
    // WebKit-event-loop race that rounds 10-13 chased through other
    // surfaces. See round 14 for the structural fix.
    const wrapper = page.locator('[data-show-scroll-button]').first();
    await expect
      .poll(async () => await wrapper.getAttribute('data-show-scroll-button'), {
        timeout: 5000,
        intervals: [50, 100, 200, 500],
      })
      .toBe('true');

    await expect(jumpButton).toBeVisible();

    // Verify button doesn't overlap message input
    const buttonBox = await jumpButton.boundingBox();
    const messageInput = page.locator(
      'textarea[placeholder*="Type a message"], textarea[placeholder*="message"]'
    );
    const inputBox = await messageInput.boundingBox();

    expect(buttonBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    if (buttonBox && inputBox) {
      // Button bottom should be above input top
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(inputBox.y);
    }
  });

  test('T009: Jump button click scrolls to bottom', async ({ page }) => {
    test.skip(!setupSucceeded, 'No conversations for test user in CI');
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('about:blank').catch(() => {});
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await handleReAuthModal(page, TEST_USER_PASSWORD);

    await clickFirstConversation(page);

    const messageThread = page.locator('[data-testid="message-thread"]');

    // SCROLLING AN EMPTY THREAD MEASURES NOTHING.
    //
    // This used to scroll the moment the conversation opened. Roughly one run in ten the
    // messages had not rendered yet — the thread was 404px tall with 0 bubbles — so
    // `scrollTop = 0` was already the bottom, the component correctly hid the jump button,
    // and no later event ever revisited that decision. The test then measured a 2798px
    // scroll distance and demanded a button whose state had been decided against an empty
    // list. That intermittence was a real product defect (fixed: MessageThread now
    // recomputes on resize) but the test should still not be scrolling nothing.
    await expect(
      page.locator('[data-testid="message-bubble"]').first()
    ).toBeVisible({
      timeout: 30000,
    });

    // Scroll up to trigger button
    await messageThread.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await settleFrames(page);

    const jumpButton = page.locator('[data-testid="jump-to-bottom"]');

    // WAIT THE WAY T007/T008 DOES, WHICH IS WHY T007/T008 DOES NOT FLAKE.
    //
    // Removing the old `if (await jumpButton.isVisible())` wrapper — which made the whole
    // test vacuous whenever the button was absent — exposed a SECOND failure hiding behind
    // it: on firefox the button was simply not there yet, and `expect(...).toBeVisible()`
    // reported `<element(s) not found>` after 5s.
    //
    // `settleFrames` advances three animation frames, roughly 50 ms. That is not long
    // enough for the scroll to propagate through React state to a rendered button on every
    // engine. T007/T008 solves this by waiting on the component's OWN signal instead of on
    // time, and this now does the same.
    //
    // First: prove the thread really did scroll. A thread that is too short to pass the
    // 500px threshold SHOULD have no button, and asserting the button in that case would be
    // blaming the component for a fixture problem.
    const scrollInfo = await messageThread.evaluate((el) => ({
      distanceFromBottom: el.scrollHeight - (el.scrollTop + el.clientHeight),
    }));
    expect(
      scrollInfo.distanceFromBottom,
      'fixture thread is not tall enough to scroll 500px+ from the bottom, so the jump ' +
        'button is correctly absent — this is a fixture failure, not a UI regression'
    ).toBeGreaterThan(500);

    // Then: the attribute MessageThread writes synchronously when it decides to show the
    // button, which sidesteps the React-state-flush vs event-loop race entirely.
    const wrapper = page.locator('[data-show-scroll-button]').first();
    await expect
      .poll(async () => await wrapper.getAttribute('data-show-scroll-button'), {
        message:
          'MessageThread never set data-show-scroll-button="true" after scrolling to the ' +
          'top — the component did not register the scroll',
        timeout: 5000,
        intervals: [50, 100, 200, 500],
      })
      .toBe('true');

    // NOT `if (await jumpButton.isVisible())`. The whole body used to sit inside that
    // condition, so a thread where the button never appeared passed having asserted
    // nothing — and "the jump button stopped rendering" is precisely what this test is
    // named for. It is a requirement here, not a precondition.
    await expect(jumpButton).toBeVisible();

    await jumpButton.click();

    // POLL FOR THE OUTCOME — DO NOT WAIT A FIXED TIME (#300).
    //
    // This is what made T009 flaky, and it is not a browser quirk: the button calls
    // `scrollToBottom(true)`, i.e. `behavior: 'smooth'` (MessageThread.tsx:239-243), while
    // `settleFrames` (then named `waitForUIStability`) waits three animation frames — about 50 ms. A smooth scroll from
    // the top of a 30-message thread takes several hundred. So the assertion measured a
    // scroll that had barely started, and failed with **2393px** remaining rather than
    // marginally over the 100px threshold.
    //
    // That is why it hard-failed on chromium AND firefox after retries, which #300's
    // existing T007-T008 row cannot explain — that row attributes the family to webkit not
    // firing `scroll` on programmatic `scrollTop`. Racing an animation loses on any engine
    // under load.
    await expect
      .poll(
        async () =>
          messageThread.evaluate(
            (el) => el.scrollHeight - (el.scrollTop + el.clientHeight)
          ),
        {
          message:
            'smooth scroll never reached the bottom — the jump button did not do its job',
          timeout: 10_000,
          intervals: [50, 100, 200, 500],
        }
      )
      .toBeLessThan(100);

    // Auto-retrying, so it tolerates the state flush after the scroll settles.
    await expect(jumpButton).not.toBeVisible();
  });
});
