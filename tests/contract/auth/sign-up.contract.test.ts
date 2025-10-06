/**
 * Contract Test: Sign-Up API (POST /auth/v1/signup)
 *
 * Tests the contract between our app and Supabase Auth sign-up endpoint.
 * Requires secondary test user configured in .env to avoid rate limits.
 * Tests create multiple new users and can exceed rate limits on shared instances.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import {
  TEST_EMAIL_SECONDARY,
  TEST_PASSWORD_SECONDARY,
  hasSecondaryUser,
} from '../../fixtures/test-user';

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
    expect(error?.message).toContain('password');
  });

  it.skipIf(!hasSecondaryUser())('should reject duplicate email', async () => {
    const testEmail = `duplicate-${Date.now()}@example.com`;

    // First sign-up should succeed
    await supabase.auth.signUp({
      email: testEmail,
      password: 'ValidPass123!',
    });

    // Second sign-up with same email should fail
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'ValidPass123!',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('already registered');
  });

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
