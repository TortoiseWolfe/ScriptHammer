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
