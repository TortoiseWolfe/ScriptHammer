import { test, expect, type Page } from '@playwright/test';
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
import { waitForLocalTurnstileToken } from '../utils/captcha-guard';

/**
 * Asking for a new confirmation email with no session (#1352).
 *
 * Production refuses an unconfirmed sign-in, so a person whose emailed link expired or never
 * arrived has no session, and both "Resend" controls that need one never rendered for them.
 * They reached /verify-email with nothing to press. This takes the real path there:
 *
 *   real form  →  /verify-email  →  "Resend the confirmation email"  →  the SECOND email in
 *   Mailpit  →  open it in the same browser  →  /profile, signed in.
 *
 * "Signed in" is the point. A resend sends a PKCE challenge since auth-js 2.117 (#1298), so
 * the new link signs the person in when opened where they asked for it, as the original
 * does (signup-confirm.spec.ts).
 *
 * Local Supabase only (`playwright.signup-mailer.config.ts`); the lane shortens GoTrue's
 * wait between emails to one address (`GOTRUE_SMTP_MAX_FREQUENCY`) so a resend seconds after
 * signing up is not refused.
 */
test.describe('Resend a confirmation email without a session (#1352)', () => {
  const PASSWORD = 'SignupMailer123!';
  let email = '';

  test.afterEach(async () => {
    if (email) {
      await deleteTestUserByEmail(email).catch(() => {});
    }
    await clearMailbox();
  });

  const signUp = async (page: Page) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password').fill(PASSWORD);
    await waitForLocalTurnstileToken(page);
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.waitForURL(/\/verify-email/, { timeout: 30_000 });
  };

  const resendFromVerifyEmail = async (page: Page) => {
    await waitForLocalTurnstileToken(page);
    await page
      .getByRole('button', { name: /resend the confirmation email/i })
      .click();
    await expect(page.getByRole('status')).toContainText(
      /if that address is waiting to be confirmed/i,
      { timeout: 30_000 }
    );
  };

  test('sign-up hands the address over; the second email signs them in', async ({
    page,
  }) => {
    email = `resend-e2e-${Date.now()}@scripthammer.test`;

    await signUp(page);
    const first = await waitForMessageTo(email, { timeoutMs: 30_000 });

    // The control exists with nobody signed in, and the address came across the
    // navigation without a query string.
    await expect(page.getByLabel('Email')).toHaveValue(email);
    expect(page.url()).not.toContain(encodeURIComponent(email));
    expect(page.url()).not.toContain('email=');

    await resendFromVerifyEmail(page);

    const second = await waitForMessageTo(email, {
      timeoutMs: 30_000,
      excludeIds: [first.ID],
    });
    expect(second.ID).not.toBe(first.ID);

    // Opened in the same browser that asked for it: /auth/callback redeems the new PKCE
    // code with the verifier this page stored when it asked.
    await page.goto(extractConfirmationLink(second));
    await page.waitForURL(/\/profile/, { timeout: 30_000 });
    await waitForAuthenticatedState(page);
  });

  test('the "Email not confirmed" sign-in hands the address over; the second email signs them in', async ({
    page,
    browser,
  }) => {
    email = `resend-e2e-${Date.now()}@scripthammer.test`;

    // Sign up in one browser, then come back from another with the link unopened — the
    // person this issue is about. Auth refuses their password because the address is
    // unconfirmed.
    await signUp(page);
    const first = await waitForMessageTo(email, { timeoutMs: 30_000 });

    const returning = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const other = await returning.newPage();
      await other.goto('/sign-in');
      await dismissCookieBanner(other);
      await other.getByLabel('Email').fill(email);
      await other.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await waitForLocalTurnstileToken(other);
      await other.getByRole('button', { name: 'Sign In' }).click();
      await other.waitForURL(/\/verify-email/, { timeout: 30_000 });

      await expect(other.getByLabel('Email')).toHaveValue(email);
      expect(other.url()).not.toContain('email=');

      await resendFromVerifyEmail(other);

      const second = await waitForMessageTo(email, {
        timeoutMs: 30_000,
        excludeIds: [first.ID],
      });
      await other.goto(extractConfirmationLink(second));
      await other.waitForURL(/\/profile/, { timeout: 30_000 });
      await waitForAuthenticatedState(other);
    } finally {
      await returning.close();
    }
  });
});
