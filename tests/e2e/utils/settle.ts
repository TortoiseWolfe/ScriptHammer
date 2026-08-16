import type { Page } from '@playwright/test';

/**
 * Advance a few animation frames. **This is not a stability wait** (#739).
 *
 * It was called `waitForUIStability` and duplicated verbatim in five messaging specs, and
 * the name did real damage: it observes nothing, so the frames elapse whether the UI settled
 * or not. T009 used it to wait out a `behavior: 'smooth'` scroll that takes several hundred
 * milliseconds, measured a scroll that had barely started, and hard-failed with
 * `distanceFromBottom` 2393 against a threshold of 100 — on chromium in one run and firefox
 * in the next.
 *
 * WHAT IT IS FOR. Yielding to the browser so a synchronous DOM mutation has been rendered
 * before you do something else. That is all it can honestly promise.
 *
 * WHAT IT IS NOT FOR — and the rule that matters:
 *
 *   **Never put this before a measurement that does not retry.** If the next line reads
 *   `boundingBox()`, `evaluate(() => el.scrollTop)`, or any one-shot value, you are racing
 *   whatever produced that value. Use `expect.poll(...)` on the value instead, or an
 *   auto-retrying `expect(locator)`, and assert the OUTCOME rather than a duration.
 *
 * Playwright's `expect(locator)` already retries, so a call immediately before one is
 * redundant rather than harmful. Those are left in place deliberately: removing twenty of
 * them would be churn with a real chance of disturbing timing nobody has measured.
 */
export async function settleFrames(page: Page, frames = 3): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    (n) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => {
          seen++;
          if (seen >= n) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frames,
    { timeout: 15000 }
  );
}

/**
 * Wait for a load state IF it arrives, and carry on if it does not (#757).
 *
 * THE BUG THIS REPLACES. Seven call sites wrote the intent as:
 *
 *     await page.waitForLoadState('load').catch(() => {});
 *
 * and that `.catch()` is unreachable dead code. The wait inherits
 * `navigationTimeout` — deliberately **60 s** in playwright.config.ts:112, sized for
 * Argon2id key derivation on the messaging flows — while every project except
 * `*-msg-iso` runs on Playwright's default **30 s** test budget. The test is killed
 * at 30 s with 30 s still on the wait's own clock, so the handler written to
 * tolerate a slow load never runs.
 *
 * It cost two merges. `No horizontal overflow on /game/cod-skeleton` failed three
 * attempts at ~31.5 s each on branches that changed docs and one unit-test file —
 * `/game/cod-skeleton` is the WebGL game route, and under CPU contention its `load`
 * sometimes takes longer than the whole test budget. The suite died on the exact
 * line written to survive that.
 *
 * So the bound is explicit and well under any test budget. `networkidle` callers get
 * the same treatment and need it more: a page with an animation loop may never reach
 * idle at all.
 *
 * This does NOT make a slow page fast. It makes the test measure what rendered
 * instead of dying — which is what the original `.catch()` claimed to do.
 */
export async function waitForLoadStateOrGiveUp(
  page: Page,
  state: 'load' | 'domcontentloaded' | 'networkidle',
  timeout = 8000
): Promise<boolean> {
  try {
    await page.waitForLoadState(state, { timeout });
    return true;
  } catch {
    // Deliberately swallowed: the caller has already decided this state is optional.
    // The RETURN VALUE is how a caller can tell, rather than having to guess.
    return false;
  }
}
