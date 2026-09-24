// Rate limiting: what a person sees when Supabase Auth refuses for rate (#1245)
//
// The limits on sign-in, sign-up and password reset are Supabase Auth's: a captcha on every
// request and per-IP ceilings, answered with HTTP 429. This file used to drive an email-keyed
// lockout the app ran in the browser; #1245 removed it, because it stopped nobody who called
// Auth directly and let anyone lock anyone out. Its tests had also stopped testing it — each
// accepted "invalid credentials" as a pass, so they stayed green whether a lockout fired or not.
//
// Auth's 429 is simulated at the network boundary rather than provoked. Provoking it takes
// dozens of requests from one IP, which spends the quota every later spec in the run shares —
// and the local stack has no per-IP ceiling to hit (40 bad passwords, no 429; measured
// 2026-09-24). Each simulated case has an unmocked CONTROL beside it, proving the page really
// reaches Auth and that the mock is the only thing that changed the answer.

import { test, expect, type Page, type Route } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { skipIfBackendCaptchaProtected } from '../utils/captcha-guard';

// What GoTrue actually sends, read from the local stack on 2026-09-24: an API-version header,
// a wildcard CORS origin, and `{code, message}`. The CORS header is not decoration — the page and
// Auth are different origins, and without it the browser withholds the response, auth-js reports
// a network failure, and the test goes red for a reason that has nothing to do with rate limits.
const TOO_MANY_REQUESTS = {
  code: 'over_request_rate_limit',
  message: 'Request rate limit reached',
};
const EMAIL_QUOTA = {
  code: 'over_email_send_rate_limit',
  message: 'Email rate limit exceeded',
};

/** A route handler that answers 429 and counts how often it did. */
function refuseWith(body: object) {
  const handler = Object.assign(
    (route: Route) => {
      handler.calls += 1;
      return route.fulfill({
        status: 429,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'x-supabase-api-version',
          'x-supabase-api-version': '2024-01-01',
        },
        body: JSON.stringify(body),
      });
    },
    { calls: 0 }
  );
  return handler;
}

// One matcher per endpoint, kept as a value: `unroute` removes a handler by the same reference
// it was registered with, so building a fresh function for it would remove nothing.
const TOKEN = (url: URL) => url.pathname.endsWith('/auth/v1/token');
const RECOVER = (url: URL) => url.pathname.endsWith('/auth/v1/recover');

// Every sentence either form can show here, and nothing else — so Next's route announcer,
// which is also role="alert", can never be what an assertion reads.
const formError = (page: Page) =>
  page.getByRole('alert').filter({
    hasText: /too many (attempts|emails)|invalid login credentials|rate limit/i,
  });

async function signIn(page: Page) {
  await page.getByLabel('Email').fill('nobody-1245@example.com');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('Rate limiting: Supabase Auth refuses, the page says so (#1245)', () => {
  test.beforeEach(async () => {
    // The forms cannot be submitted without a Turnstile token where captcha is on.
    await skipIfBackendCaptchaProtected(
      'What sign-in and reset show when Supabase Auth answers 429'
    );
  });

  test('sign-in: a 429 reads as a rate limit, and the form still works after it', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    const refusal = refuseWith(TOO_MANY_REQUESTS);
    await page.route(TOKEN, refusal);
    await signIn(page);
    // Exactly the helper's sentence — not Auth's raw one, which names no remedy.
    await expect(formError(page)).toHaveText(
      'Too many attempts. Please wait a few minutes, then try again.'
    );
    expect(refusal.calls).toBe(1);

    // CONTROL: the same form, unmocked, reaches Auth and gets its ordinary refusal — so the
    // message above came from the 429, not from anything else about this page.
    await page.unroute(TOKEN);
    const [answer] = await Promise.all([
      page.waitForResponse(
        (r) => TOKEN(new URL(r.url())) && r.request().method() === 'POST'
      ),
      signIn(page),
    ]);
    expect(answer.status()).toBe(400);
    await expect(formError(page)).toHaveText(
      /^\s*invalid login credentials\s*$/i
    );
  });

  test('password reset: an email limit is named without saying which', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await dismissCookieBanner(page);

    const refusal = refuseWith(EMAIL_QUOTA);
    await page.route(RECOVER, refusal);
    await page.getByLabel('Email').fill('nobody-1245@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(formError(page)).toHaveText(
      'Too many emails have been sent recently. Check your inbox, or try again later.'
    );
    expect(refusal.calls).toBe(1);

    // CONTROL: unmocked, Auth accepts the request (it answers 200 for an address it does not
    // know), and the page says the email is on its way.
    await page.unroute(RECOVER);
    const [answer] = await Promise.all([
      page.waitForResponse(
        (r) => RECOVER(new URL(r.url())) && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: /send reset link/i }).click(),
    ]);
    expect(answer.status()).toBe(200);
    await expect(page.getByText(/password reset email sent/i)).toBeVisible();
  });
});
