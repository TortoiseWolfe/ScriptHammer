/**
 * E2E tests for the large-history message thread: virtualization, pagination,
 * jump-to-bottom, scroll restoration, keyboard access.
 *
 * WHAT THIS FILE USED TO BE (#745). Ten tests, NINE of which asserted only
 * `expectConversationLoaded` — "the thread and the input are visible" — and then waited a few
 * animation frames and closed the page. `T167: Pagination loads next 50 messages` never
 * paginated. `T166: Performance with 1000 messages` ran against a 150-message fixture and
 * measured nothing. Two tests claimed 60fps while doing no scrolling and taking no timings.
 *
 * They passed whether the features worked, were broken, or were deleted. Same family as the
 * regex guard that predicted #723 and stayed green through it, and the
 * `if (await jumpButton.isVisible())` wrapper that made T009 vacuous.
 *
 * HOW THE ASSERTIONS ARE GROUNDED NOW. Each one names an observable consequence:
 *
 *   virtualization  the thread renders far FEWER `message-bubble` nodes than the 150 seeded
 *                   (MessageThread.tsx:92 switches on `messages.length >= 100`)
 *   pagination      `pagination-loader` appears AND the scroll height grows — under
 *                   virtualization the loaded count is not directly countable in the DOM,
 *                   so total height is the honest signal
 *   jump-to-bottom  `data-show-scroll-button` flips true, then the scroll lands at the end
 *   restoration     after a page loads, you are NOT teleported to the top
 *
 * WHAT WAS DELETED RATHER THAN FIXED. The two "60fps" tests and "Performance monitoring
 * logs" made claims this harness cannot substantiate: Playwright cannot measure frame rate
 * meaningfully through a WebDriver session, and there is no logging contract to assert
 * against. A test that cannot check its own name is worse than no test — it occupies the
 * space where a real one would go. If frame budget matters, it needs a tracing-based
 * measurement, and that is its own piece of work.
 *
 * #116 Phase 2 — per-test fixture isolation (workers>1). Every test seeds its OWN throwaway
 * viewer + partner + conversation via seedIsolatedConversation(SEEDED_MESSAGE_COUNT), so
 * nothing is shared and the spec runs `fullyParallel`.
 */

import { test, expect, type Page } from '@playwright/test';
import { settleFrames } from '../utils/settle';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  openAsViewer,
  type IsolatedConversation,
  type OpenedParticipant,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

/**
 * Enough placeholder history that the virtualizer engages (it activates at 100) and
 * pagination has a second page to load.
 */
const SEEDED_MESSAGE_COUNT = 150;

/** MessageThread.tsx:92 — `messages.length >= VIRTUAL_SCROLL_THRESHOLD`. */
const VIRTUAL_SCROLL_THRESHOLD = 100;

const THREAD = '[data-testid="message-thread"]';
const BUBBLE = '[data-testid="message-bubble"]';

async function expectConversationLoaded(viewer: OpenedParticipant) {
  await expect(viewer.page.locator(THREAD)).toBeVisible({ timeout: 60000 });
  const messageInput = viewer.page.getByRole('textbox', {
    name: /Message input/i,
  });
  await expect(messageInput).toBeVisible({ timeout: 45000 });

  // AND THE THREAD MUST ACTUALLY HAVE CONTENT.
  //
  // "the thread element is visible" was the entire assertion this file used to make, and it
  // is true long before any message renders: the container mounts, then messages are
  // fetched, decrypted, and — above 100 — handed to a virtualizer that renders nothing until
  // it has measured the scroll box.
  //
  // The first version of this rewrite counted bubbles after `settleFrames` (three animation
  // frames) and got ZERO on all three browsers. Every downstream assertion here — how many
  // nodes virtualization renders, whether scrolling to the top paginates, whether the jump
  // button appears — is meaningless against an empty thread, so they all failed together.
  // Waiting on the outcome instead of a frame count is the same lesson as #300 and #739,
  // and I walked into it while fixing exactly that class of bug.
  await expect(
    viewer.page.locator(BUBBLE).first(),
    'the thread mounted but never rendered a message — every assertion below would be ' +
      'measuring an empty list'
  ).toBeVisible({ timeout: 45000 });
}

/** Scroll metrics straight off the scroll container. */
function threadMetrics(page: Page) {
  return page.locator(THREAD).evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    distanceFromBottom: el.scrollHeight - (el.scrollTop + el.clientHeight),
  }));
}

/**
 * Scroll the thread to the top and let the component see it.
 *
 * The explicit dispatch is required because MessageThread binds a native `scroll` listener
 * (MessageThread.tsx:224) and programmatic `scrollTop` assignment does not reliably fire it
 * on every engine — the round-10 lesson recorded in CLAUDE.md.
 */
async function scrollThreadToTop(page: Page) {
  await page.locator(THREAD).evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

test.describe('Large-history message thread', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation(SEEDED_MESSAGE_COUNT);
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T172b: virtualization renders far fewer nodes than the seeded history', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);
      await settleFrames(viewer.page);

      // THE POINT OF VIRTUALIZING. With 150 messages the thread must not put 150 bubbles in
      // the DOM. The old version asserted only that the thread was visible, which is equally
      // true with virtualization switched off entirely.
      // `expectConversationLoaded` has already established at least one bubble exists, so
      // this is measuring a settled list rather than racing the virtualizer.
      const rendered = await viewer.page.locator(BUBBLE).count();
      expect(rendered, 'no messages rendered at all').toBeGreaterThan(0);
      expect(
        rendered,
        `expected the virtualizer to render a window, not the whole history — ` +
          `${rendered} bubbles in the DOM for ${SEEDED_MESSAGE_COUNT} messages`
      ).toBeLessThan(VIRTUAL_SCROLL_THRESHOLD);
    } finally {
      await viewer.close();
    }
  });

  test('T167: scrolling to the top loads another page of history', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);
      await settleFrames(viewer.page);

      const before = await threadMetrics(viewer.page);
      expect(
        before.scrollHeight,
        'thread is not scrollable, so pagination cannot be triggered — fixture problem'
      ).toBeGreaterThan(before.clientHeight);

      await scrollThreadToTop(viewer.page);

      // The loader is the component saying "I am fetching another page" — the direct
      // evidence that `onLoadMore` fired (MessageThread.tsx:209 → ConversationView's
      // handleLoadMore → loadMessages(true)).
      await expect(
        viewer.page.locator('[data-testid="pagination-loader"]'),
        'scrolling to the top did not trigger a page load'
      ).toBeVisible({ timeout: 15000 });

      // And the consequence: more history is now in the list. Under virtualization the
      // loaded count is not countable in the DOM, so total scroll height is the honest
      // signal that the list grew.
      await expect
        .poll(async () => (await threadMetrics(viewer.page)).scrollHeight, {
          message: 'a page load was triggered but the thread never grew',
          timeout: 20000,
          intervals: [200, 500, 1000],
        })
        .toBeGreaterThan(before.scrollHeight);
    } finally {
      await viewer.close();
    }
  });

  test('jump-to-bottom returns you to the newest message', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);
      await settleFrames(viewer.page);

      await scrollThreadToTop(viewer.page);

      // NOT `if (await jumpButton.isVisible())`. That wrapper is why this test passed for
      // however long the button has been broken: absent button, no assertions, green.
      const wrapper = viewer.page.locator('[data-show-scroll-button]').first();
      await expect
        .poll(
          async () => await wrapper.getAttribute('data-show-scroll-button'),
          {
            message:
              'scrolled to the top but the component never decided to show the jump button',
            timeout: 15000,
            intervals: [100, 250, 500],
          }
        )
        .toBe('true');

      const jumpButton = viewer.page.locator('[data-testid="jump-to-bottom"]');
      await expect(jumpButton).toBeVisible();
      await jumpButton.click();

      // Poll: the button scrolls smoothly, so the destination is reached over several
      // hundred ms. Asserting once, immediately, measures the middle of an animation (#300).
      await expect
        .poll(
          async () => (await threadMetrics(viewer.page)).distanceFromBottom,
          {
            message: 'jump-to-bottom did not land at the newest message',
            timeout: 15000,
            intervals: [100, 250, 500],
          }
        )
        .toBeLessThan(100);

      await expect(jumpButton).not.toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  test('loading older history does not teleport you to the top', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);
      await settleFrames(viewer.page);

      const before = await threadMetrics(viewer.page);
      await scrollThreadToTop(viewer.page);
      await expect(
        viewer.page.locator('[data-testid="pagination-loader"]')
      ).toBeVisible({ timeout: 15000 });

      // THE ACTUAL RESTORATION CLAIM, POLLED — because restoration necessarily happens
      // AFTER the growth that triggers it, and asserting once in between measures the gap.
      //
      // This test asserted the outcome once, immediately after polling `scrollHeight >
      // before.scrollHeight`, and failed with scrollTop 0 on firefox every run. It looked
      // exactly like a product defect and was reported as one. It was not. Traced in the
      // browser at 60ms intervals:
      //
      //     0ms  top=0     h=5278  kids=2
      //    94ms  top=2722  h=8216  kids=8
      //   155ms  top=2962  h=8600  kids=14   <- stable for the next 1.4s
      //
      // Restoration works. The bug was that `before.scrollHeight` was 5216 while the
      // pre-pagination height had already settled at 5278, so the growth poll was
      // satisfied by 62px of ordinary layout drift and returned before a single older
      // message had arrived — then the one-shot read caught scrollTop still at 0.
      //
      // So: poll the thing being claimed. This is the same lesson as #300 and #739, in the
      // file written to remove exactly this pattern, which is worth stating plainly rather
      // than quietly fixing.
      await expect
        .poll(async () => (await threadMetrics(viewer.page)).scrollTop, {
          message:
            'after older messages loaded the view stayed pinned at the very top, so the ' +
            'reader lost their place',
          timeout: 20000,
          intervals: [100, 250, 500],
        })
        .toBeGreaterThan(0);

      // And the page really did grow — otherwise the assertion above could be satisfied by
      // any stray scroll, with no pagination having happened at all.
      const after = await threadMetrics(viewer.page);
      expect(
        after.scrollHeight,
        'the thread never grew, so no older page was loaded and the restoration assertion ' +
          'above proved nothing'
      ).toBeGreaterThan(before.scrollHeight + 500);
    } finally {
      await viewer.close();
    }
  });
});

test.describe('Keyboard access', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation(SEEDED_MESSAGE_COUNT);
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  test('T169: the message input keeps focus through arrow-key navigation', async ({
    browser,
  }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);

      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await messageInput.focus();
      await expect(messageInput).toBeFocused();

      // Arrow keys move the caret; they must not move focus out of the composer, which is
      // what would make a long thread unusable from the keyboard. The old test pressed
      // these keys and asserted nothing at all.
      await viewer.page.keyboard.press('ArrowDown');
      await viewer.page.keyboard.press('ArrowUp');
      await expect(
        messageInput,
        'arrow keys moved focus out of the message input'
      ).toBeFocused();
    } finally {
      await viewer.close();
    }
  });

  test('Tab moves focus to a real, reachable control', async ({ browser }) => {
    const viewer = await openAsViewer(browser, fixture!);
    try {
      await expectConversationLoaded(viewer);

      const messageInput = viewer.page.getByRole('textbox', {
        name: /Message input/i,
      });
      await messageInput.focus();
      await viewer.page.keyboard.press('Tab');

      // Focus must land on something focusable and named — a keyboard user has to be able
      // to leave the composer and reach a control. The old test pressed Tab and asserted
      // nothing, so it passed even if focus vanished to <body>.
      const focused = await viewer.page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName.toLowerCase(),
          name:
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.textContent?.trim().slice(0, 40) ||
            '',
        };
      });
      expect(
        focused,
        'Tab from the message input dropped focus to <body> — the composer is a keyboard trap exit'
      ).not.toBeNull();
      expect(
        focused?.name,
        `focus landed on <${focused?.tag}> with no accessible name`
      ).not.toBe('');
    } finally {
      await viewer.close();
    }
  });
});
