import type { Page } from '@playwright/test';

/**
 * Take a page offline, or back online, and make sure the page HEARS it: requests fail and
 * `window` receives `offline` / `online`, in every engine.
 *
 * WHY NOT `context.setOffline()` ALONE (#1329). Measured on this repo's Playwright, by
 * reading `navigator.onLine` and listening on `window` across a toggle:
 *
 *   chromium   onLine false -> true    events: offline, online
 *   firefox    onLine false -> true    events: none
 *
 * Firefox flips the value but fires nothing. Code that learns about the network from the
 * events never hears it went offline. That is `useOfflineQueue`, and through it
 * `ContactForm`'s "Queue for Later". The contact offline spec passed every chromium-only PR
 * run with exactly this gap, then failed four nightlies in a row on firefox. (The older note
 * in #204 said firefox flipped neither; the value half is no longer true.)
 *
 * A real network change fires these events in every browser, so dispatching them is not
 * behaviour a real visitor lacks. Chromium hears each one twice. That is harmless: each of
 * the seven `online` listeners in `src/` is guarded (an in-flight ref, a busy flag, a
 * cleared-script check) or only sets state, as a flaky real network already requires.
 */
export async function setNetworkOffline(
  page: Page,
  offline: boolean
): Promise<void> {
  await page.context().setOffline(offline);
  await page.evaluate((isOffline) => {
    window.dispatchEvent(new Event(isOffline ? 'offline' : 'online'));
  }, offline);
}
