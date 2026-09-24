import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import {
  assertLocalBackend,
  createTestUser,
  deleteTestUserByEmail,
  dismissCookieBanner,
  isAdminClientAvailable,
  signInAsInjectable,
} from '../utils/test-user-factory';
import {
  clearMailbox,
  extractConfirmationLink,
  waitForMessageTo,
} from '../utils/mailpit';

/**
 * Password reset through the real email, under PKCE (#1255).
 *
 * Reset links used to arrive as `/reset-password/#access_token=…`, and the client consumed a
 * session from the URL on any page — so anyone's reset link, forwarded to a victim, signed the
 * victim into THAT account with a form for setting its password. Now requesting a reset stores
 * a verifier in the requesting browser, and the link carries a `?code=` redeemable only with it.
 *
 * Both halves need the real mailer, which is why this lives in the signup-mailer lane: the
 * same-browser path must still work end to end, and the link must do nothing in another browser.
 * No test elsewhere clicks a reset email at all.
 */
test.describe('Password reset through the emailed link (#1255)', () => {
  const OLD_PASSWORD = `${randomUUID()}Aa1!`;
  const NEW_PASSWORD = `${randomUUID()}Bb2!`;
  let email = '';

  test.beforeEach(async () => {
    if (!isAdminClientAvailable()) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is unset, so no account can be seeded. A skip would report ' +
          'the reset flow as working.'
      );
    }
    assertLocalBackend('password-reset.spec.ts');
    email = `reset-e2e-${Date.now()}@scripthammer.test`;
    const user = await createTestUser(email, OLD_PASSWORD, {
      createProfile: true,
    });
    if (!user) throw new Error(`could not seed ${email}`);
  });

  test.afterEach(async () => {
    if (email) await deleteTestUserByEmail(email).catch(() => {});
    await clearMailbox();
  });

  async function requestReset(page: Page): Promise<string> {
    await page.goto('/forgot-password');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/password reset email sent/i)).toBeVisible({
      timeout: 30_000,
    });
    return extractConfirmationLink(
      await waitForMessageTo(email, { timeoutMs: 30_000 })
    );
  }

  test('the browser that asked for the link can set a new password with it', async ({
    page,
  }) => {
    const link = await requestReset(page);

    await page.goto(link);
    await page.waitForURL(/\/reset-password/, { timeout: 30_000 });
    await page.getByLabel('New Password').fill(NEW_PASSWORD);
    await page.getByLabel('Confirm Password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: /reset password/i }).click();
    await page.waitForURL(/\/sign-in/, { timeout: 30_000 });

    // Auth itself says the password changed: the new one works and the old one does not.
    expect(
      (await signInAsInjectable(email, NEW_PASSWORD)).session
    ).not.toBeNull();
    expect((await signInAsInjectable(email, OLD_PASSWORD)).session).toBeNull();
  });

  test('the same link opened in another browser changes nothing and says why', async ({
    page,
    browser,
  }) => {
    const link = await requestReset(page);

    const elsewhere = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const other = await elsewhere.newPage();
      await other.goto(link);
      await other.waitForURL(/\/reset-password/, { timeout: 30_000 });

      await expect(other.getByText(/only works in the browser/i)).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        other.getByRole('link', { name: /request a new link/i })
      ).toBeVisible();
      await expect(other.getByLabel('New Password')).toHaveCount(0);
    } finally {
      await elsewhere.close();
    }

    // Control: the account is exactly as it was.
    expect(
      (await signInAsInjectable(email, OLD_PASSWORD)).session
    ).not.toBeNull();
  });
});
