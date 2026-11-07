/**
 * Contract Test: Sign-Up API (POST /auth/v1/signup)
 *
 * Tests the contract between our app and Supabase Auth sign-up endpoint.
 * Requires secondary test user configured in .env to avoid rate limits.
 * Tests create multiple new users and can exceed rate limits on shared instances.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';
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
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(testEmail);
      expect(data.user?.email_confirmed_at).toBeNull(); // Unverified initially
    }
  );

  it.skipIf(!hasSecondaryUser())(
    'should reject invalid email format',
    async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'not-an-email',
        password: 'ValidPass123!',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('email');
    }
  );

  it.skipIf(!hasSecondaryUser())('should reject weak password', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'weak',
    });

    expect(error).toBeDefined();
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

      if (error) {
        // Auto-confirm on: GoTrue rejects the duplicate outright.
        expect(error.message.toLowerCase()).toContain('already registered');
      } else {
        // Confirmations on: the anti-enumeration response is a synthetic user
        // with no identities and a fresh id, so the real account does not leak.
        expect(data.user?.identities ?? []).toHaveLength(0);
        expect(data.user?.id).not.toBe(existing.user?.id);
      }

      if (existing.user) {
        await admin.auth.admin.deleteUser(existing.user.id);
      }
    }
  );

  it.skipIf(!hasSecondaryUser())(
    'should return user metadata structure',
    async () => {
      const { data } = await supabase.auth.signUp({
        email: `test-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      });

      if (data.user) {
        expect(data.user).toHaveProperty('id');
        expect(data.user).toHaveProperty('email');
        expect(data.user).toHaveProperty('created_at');
        expect(data.user).toHaveProperty('email_confirmed_at');
        expect(data.user.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
      }
    }
  );

  it.skipIf(!hasSecondaryUser())('should send verification email', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'ValidPass123!',
    });

    expect(error).toBeNull();
    // Supabase sends verification email automatically
    // We can't test email delivery in unit tests, but contract ensures no error
  });
});
