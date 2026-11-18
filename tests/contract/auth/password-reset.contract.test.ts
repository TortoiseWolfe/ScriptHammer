/**
 * Contract Test: Password Reset API (POST /auth/v1/recover)
 *
 * Tests the contract between our app and Supabase Auth password reset endpoint.
 * Requires secondary test user configured in .env for tests that send real emails.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';
import {
  extractConfirmationLink,
  waitForMessageTo,
} from '../../e2e/utils/mailpit';
import {
  TEST_EMAIL_SECONDARY,
  TEST_PASSWORD_SECONDARY,
  hasSecondaryUser,
} from '../../fixtures/test-user';

describe('Supabase Auth Password Reset Contract', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(async () => {
    supabase = createClient();

    if (!hasSecondaryUser()) {
      console.warn(
        '\n⚠️  Secondary test user not configured. Some tests will be skipped.\n' +
          'Set TEST_USER_SECONDARY_EMAIL and TEST_USER_SECONDARY_PASSWORD in .env to enable email verification tests.\n'
      );
    }
  });

  it.skipIf(!hasSecondaryUser())(
    'should send password reset email for valid email',
    async () => {
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        TEST_EMAIL_SECONDARY!,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
        }
      );

      expect(error).toBeNull();
      // Supabase returns empty object on success
      expect(data).toEqual({});

      // The request really produced a mail: it reaches the Mailpit sink and
      // carries a recovery link.
      const message = await waitForMessageTo(TEST_EMAIL_SECONDARY!, {
        timeoutMs: 30_000,
      });
      expect(extractConfirmationLink(message)).toContain('type=recovery');
    }
  );

  it('should not reveal if email exists (security)', async () => {
    // Even for non-existent email, should return success (prevents email enumeration)
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      'nonexistent@example.com',
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      }
    );

    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('should reject invalid email format', async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      'not-an-email',
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      }
    );

    expect(error).not.toBeNull();
    expect(error?.message).toContain('email');
  });

  it.skipIf(!hasSecondaryUser())('should require redirectTo URL', async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      TEST_EMAIL_SECONDARY!
    );

    // Should work without redirectTo (uses default from Supabase config)
    // This test documents the optional nature of redirectTo
    expect(error).toBeNull();
  });

  it('should update password with valid reset token', async () => {
    // The whole flow, through the real mailer (Mailpit is the SMTP sink of the
    // conformance stack): request the reset, read the emailed link, follow it
    // to get a recovery session, set a new password, then prove with Auth
    // itself that the new password works and the old one no longer does.
    const admin = createServiceClient();
    const email = `reset-contract-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const oldPassword = 'OldPass123!aA';
    const newPassword = 'NewPass456!bB';

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: oldPassword,
        email_confirm: true,
      });
    expect(createError).toBeNull();
    const userId = created.user!.id;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password` }
      );
      expect(resetError).toBeNull();

      const link = extractConfirmationLink(
        await waitForMessageTo(email, { timeoutMs: 30_000 })
      );

      // Follow the link without following its redirect: the recovery tokens
      // are in the redirect's fragment.
      const verify = await fetch(link, { redirect: 'manual' });
      expect(verify.status).toBeGreaterThanOrEqual(300);
      expect(verify.status).toBeLessThan(400);
      const location = verify.headers.get('location');
      expect(location).not.toBeNull();
      const fragment = new URLSearchParams(
        new URL(location!).hash.replace(/^#/, '')
      );
      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      const recovery = createClient();
      const { error: sessionError } = await recovery.auth.setSession({
        access_token: accessToken!,
        refresh_token: refreshToken!,
      });
      expect(sessionError).toBeNull();

      const { error: updateError } = await recovery.auth.updateUser({
        password: newPassword,
      });
      expect(updateError).toBeNull();

      const fresh = createClient();
      const withNew = await fresh.auth.signInWithPassword({
        email,
        password: newPassword,
      });
      expect(withNew.error).toBeNull();
      expect(withNew.data.session).not.toBeNull();

      const withOld = await createClient().auth.signInWithPassword({
        email,
        password: oldPassword,
      });
      expect(withOld.error).not.toBeNull();
      expect(withOld.data.session).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
