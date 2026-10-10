import { test, expect, type Route } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * A contact message written offline is sent once the connection is back (#1321).
 *
 * WHAT THIS GUARDS. Before #1321, the form said "It will be sent automatically when
 * connection is restored" and nothing could keep that promise. On Chromium nothing ever
 * processed the queue, because the page and the service worker used different sync tags.
 * Elsewhere it replayed through Web3Forms, which production does not configure, and deleted
 * the message after three tries.
 *
 * This drives the real path in a real browser: save offline, reconnect, and watch
 * ContactQueueSender (mounted in the root layout) deliver it through the contact function.
 * Works with or without a Turnstile site key in the build. With one (the hosted lane bakes
 * Cloudflare's always-pass test key), the request carries a token.
 *
 * Nothing in this file reaches a real delivery endpoint (#1319). Both legs are fulfilled
 * locally.
 */
test.describe('Contact form - message saved offline', () => {
  // A visitor who opens the page offline also fails to load Cloudflare's script. The
  // library never re-injects a script whose element exists, so before the fix no token
  // ever arrived and the card said "Sending..." forever (measured on production, #1321).
  // Builds without a site key render no widget, and this then runs the plain path.
  test('still sends when the spam-check script failed to load while offline', async ({
    page,
    context,
  }) => {
    const delivered: Record<string, unknown>[] = [];
    await page.route('**/functions/v1/contact-message', async (route) => {
      delivered.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'e2e-stub' }),
      });
    });
    await page.route('**/api.web3forms.com/**', (route) =>
      route.fulfill({ status: 200, body: '{"success":true}' })
    );
    // The script request fails exactly as it does with no connection.
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.abort('internetdisconnected')
    );

    await page.goto('/contact');
    await dismissCookieBanner(page);
    await context.setOffline(true);
    await page.locator('#name').fill('Offline Visitor');
    await page.locator('#email').fill('offline@example.com');
    await page.locator('#subject').fill('Opened with no signal');
    await page
      .locator('#message')
      .fill('The page itself was opened offline, so the check never loaded.');
    await page.getByRole('button', { name: /queue for later/i }).click();
    await expect(page.getByText(/saved on this device/i)).toBeVisible();

    await page.unroute('https://challenges.cloudflare.com/**');
    await context.setOffline(false);

    await expect(page.getByText(/your saved message was sent/i)).toBeVisible({
      timeout: 30_000,
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ subject: 'Opened with no signal' });
  });

  test('is sent once the connection is back, and the visitor sees that', async ({
    page,
    context,
  }) => {
    const delivered: Record<string, unknown>[] = [];
    const fulfil = async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      delivered.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'e2e-stub' }),
      });
    };
    await page.route('**/functions/v1/contact-message', fulfil);
    await page.route('**/api.web3forms.com/**', fulfil);

    await page.goto('/contact');
    await dismissCookieBanner(page);

    await context.setOffline(true);
    const queueButton = page.getByRole('button', { name: /queue for later/i });
    await expect(queueButton).toBeVisible();

    await page.locator('#name').fill('Offline Visitor');
    await page.locator('#email').fill('offline@example.com');
    await page.locator('#subject').fill('Written on the train');
    await page
      .locator('#message')
      .fill('Typed with no signal; it should arrive once I am back online.');
    await queueButton.click();

    // The promise is honest now, and nothing has been sent yet.
    await expect(page.getByText(/saved on this device/i)).toBeVisible();
    expect(delivered).toHaveLength(0);

    await context.setOffline(false);

    await expect(page.getByText(/your saved message was sent/i)).toBeVisible({
      timeout: 30_000,
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({
      name: 'Offline Visitor',
      email: 'offline@example.com',
      subject: 'Written on the train',
      message: 'Typed with no signal; it should arrive once I am back online.',
    });
  });
});
