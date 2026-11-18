/**
 * Contract Test: Sign-Up API (POST /auth/v1/signup)
 *
 * Tests the contract between our app and Supabase Auth sign-up endpoint.
 * Requires secondary test user configured in .env to avoid rate limits.
 * Tests create multiple new users and can exceed rate limits on shared instances.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';
import {
  extractConfirmationLink,
  waitForMessageTo,
} from '../../e2e/utils/mailpit';
import { hasSecondaryUser } from '../../fixtures/test-user';

describe('Supabase Auth Sign-Up Contract', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient();

    if (!hasSecondaryUser()) {
      console.warn(
        '\n⚠️  Secondary test user not configured. All sign-up tests will be skipped.\n' +
          'Set TEST_USER_SECONDARY_EMAIL and TEST_USER_SECONDARY_PASSWORD in .env to enable sign-up tests.\n' +
          'Note: These tests create multiple users and may hit rate limits on shared Supabase instances.\n'
      );
    }
  });

  it.skipIf(!hasSecondaryUser())(
    'should accept valid email and password',
    async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'ValidPass123!';

      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email).toBe(testEmail);
      expect(data.user?.email_confirmed_at ?? null).toBeNull(); // Unverified initially
    }
  );

  it.skipIf(!hasSecondaryUser())(
    'should reject invalid email format',
    async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'not-an-email',
        password: 'ValidPass123!',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('email');
    }
  );

  it.skipIf(!hasSecondaryUser())('should reject weak password', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'weak',
    });

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain('password');
  });

  it.skipIf(!hasSecondaryUser())(
    'should not create a second account for a duplicate email',
    async () => {
      const testEmail = `duplicate-${Date.now()}@example.com`;
      const admin = createServiceClient();

      // A confirmed account makes GoTrue take its duplicate branch; an
      // unconfirmed one is treated as a resend and returns the real user.
      const { data: existing, error: createError } =
        await admin.auth.admin.createUser({
          email: testEmail,
          password: 'ValidPass123!',
          email_confirm: true,
        });
      expect(createError).toBeNull();

      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'ValidPass123!',
      });

      // This lane runs with confirmations on (conformance.yml sets
      // GOTRUE_MAILER_AUTOCONFIRM=false and GOTRUE_SMS_AUTOCONFIRM=false), so
      // GoTrue answers a duplicate with its anti-enumeration response: no
      // error, and a synthetic user with no identities and a fresh id, so the
      // real account does not leak. If either auto-confirm flag is true it
      // rejects the duplicate with a "User already registered" error instead
      // (the SMS flag counts even though phone sign-in is off); that setting
      // is not this contract, and the check below fails on it.
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.identities ?? []).toHaveLength(0);
      expect(data.user?.id).not.toBe(existing.user?.id);

      if (existing.user) {
        await admin.auth.admin.deleteUser(existing.user.id);
      }
    }
  );

  it.skipIf(!hasSecondaryUser())(
    'should return user metadata structure',
    async () => {
      const { data, error } = await supabase.auth.signUp({
        email: `test-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      });

      // A sign-up that returns no user must fail the test, not skip its checks.
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      const user = data.user!;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('created_at');
      expect(user.email_confirmed_at ?? null).toBeNull();
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    }
  );

  it.skipIf(!hasSecondaryUser())('should send verification email', async () => {
    const email = `test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 'ValidPass123!',
    });

    expect(error).toBeNull();
    expect(data.user).not.toBeNull();

    // The conformance stack's mail sink (Mailpit) receives the message, and it
    // carries the signup verification link. waitForMessageTo throws if no
    // mail arrives (the #287 failure).
    const message = await waitForMessageTo(email, { timeoutMs: 30_000 });
    expect(extractConfirmationLink(message)).toContain('type=signup');

    if (data.user) {
      await createServiceClient().auth.admin.deleteUser(data.user.id);
    }
  });
});
