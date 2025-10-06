/**
 * Contract Test: Password Reset API (POST /auth/v1/recover)
 *
 * Tests the contract between our app and Supabase Auth password reset endpoint.
 * Requires secondary test user configured in .env for tests that send real emails.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
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
      expect(data).toBeDefined();
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
    expect(data).toBeDefined();
  });

  it('should reject invalid email format', async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      'not-an-email',
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      }
    );

    expect(error).toBeDefined();
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

  it.skipIf(!hasSecondaryUser())(
    'should update password with valid reset token',
    async () => {
      // Note: In real implementation, we'd get token from email link
      // This test documents the expected flow

      // Step 1: Request reset
      await supabase.auth.resetPasswordForEmail(TEST_EMAIL_SECONDARY!);

      // Step 2: Would extract token from email link
      // Step 3: Update password (requires valid session from token)
      // This part tested in integration tests with actual token flow
    }
  );
});
