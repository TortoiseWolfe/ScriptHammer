import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
  deleteTestUserByEmail,
} from '../utils/test-user-factory';
import {
  waitForMessageTo,
  extractConfirmationLink,
  clearMailbox,
} from '../utils/mailpit';

/**
 * Real-form signup with email confirmation, via a mail-catcher (#288, item 3).
 *
 * The #287 disaster: the deployed product was unusable — email confirmation
 * silently broke — while every test stayed green, because tests minted users via
 * `admin.createUser({ email_confirm: true })`, bypassing the real signup form AND
 * the mailer. This test takes the REAL human path against the local Supabase stack
 * (`GOTRUE_MAILER_AUTOCONFIRM=false` + Mailpit):
 *
 *   real /sign-up form  →  real confirmation email lands in Mailpit  →
 *   click the emailed link  →  session established  →  authenticated.
 *
 * If NO email arrives, the test fails loudly — that is exactly the #287 signal.
 *
 * Runs ONLY against local Supabase (see `playwright.signup-mailer.config.ts` +
 * `.github/workflows/signup-mailer.yml`); the cloud project has no readable inbox.
 */
test.describe('Real-form signup with email confirmation (#288)', () => {
  const PASSWORD = 'SignupMailer123!';
  let email = '';

  test.afterEach(async () => {
    // Best-effort cleanup: remove the throwaway user + empty the catcher so runs
    // don't accumulate state. deleteTestUserByEmail uses the admin client
    // (SUPABASE_ADMIN_URL → local Kong).
    if (email) {
      await deleteTestUserByEmail(email).catch(() => {});
    }
    await clearMailbox();
  });

  test('a new user signs up via the form and confirms via the emailed link', async ({
    page,
  }) => {
    email = `signup-e2e-${Date.now()}@scripthammer.test`;

    // 1. Sign up through the REAL form — not admin.createUser.
    await page.goto('/sign-up');
    await dismissCookieBanner(page);
    await expect(
      page.getByRole('heading', { name: 'Create Account' })
    ).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign up/i }).click();

    // 2. Success state: the app routes to /verify-email ("Check your inbox").
    await page.waitForURL(/\/verify-email/, { timeout: 30_000 });
    await expect(page.getByText(/check your inbox/i)).toBeVisible();

    // 3. Read the REAL confirmation email out of the mail-catcher.
    const message = await waitForMessageTo(email, { timeoutMs: 30_000 });
    const confirmationLink = extractConfirmationLink(message);

    // 4. Click the emailed link → GoTrue verify → /auth/callback establishes the
    //    session (implicit flow, detectSessionInUrl) → app pushes to /profile.
    await page.goto(confirmationLink);
    await page.waitForURL(/\/profile/, { timeout: 30_000 });

    // 5. Assert authenticated: GlobalNav shows Messages / account menu / avatar.
    await waitForAuthenticatedState(page);
  });
});
