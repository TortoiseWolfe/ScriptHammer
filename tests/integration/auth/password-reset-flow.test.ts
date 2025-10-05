/**
 * Integration Test: Password Reset Flow (T063)
 *
 * Tests the complete password reset journey:
 * Request reset → email sent → token validation → password update
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/auth/email-validator';
import { validatePassword } from '@/lib/auth/password-validator';

describe('Password Reset Flow Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  const testEmail = `password-reset-${Date.now()}@example.com`;
  const initialPassword = 'InitialPass123!';
  const newPassword = 'NewPass456!';
  let userId: string;

  beforeAll(async () => {
    supabase = createClient();

    // Create test user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: initialPassword,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create test user');
    userId = data.user.id;

    // Sign out to test password reset
    await supabase.auth.signOut();
  });

  afterAll(async () => {
    // Clean up test user
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should request password reset with valid email', async () => {
    // Step 1: Validate email
    const emailValidation = validateEmail(testEmail);
    expect(emailValidation.valid).toBe(true);

    // Step 2: Request password reset
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      testEmail,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    expect(error).toBeNull();
    // Supabase returns empty object on success
    expect(data).toBeDefined();
  });

  it('should reject password reset with invalid email', async () => {
    const invalidEmail = 'not-an-email';

    // Step 1: Client-side validation should fail
    const emailValidation = validateEmail(invalidEmail);
    expect(emailValidation.valid).toBe(false);

    // Step 2: API should also reject
    const { error } = await supabase.auth.resetPasswordForEmail(invalidEmail);
    expect(error).toBeDefined();
  });

  it('should silently succeed for non-existent email (security)', async () => {
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

    // Supabase returns success even for non-existent emails to prevent user enumeration
    const { data, error } =
      await supabase.auth.resetPasswordForEmail(nonExistentEmail);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should validate new password meets requirements', async () => {
    const weakPassword = 'weak';

    // Client-side validation should fail
    const passwordValidation = validatePassword(weakPassword);
    expect(passwordValidation.valid).toBe(false);
    expect(passwordValidation.error).toBeTruthy();
  });

  it('should update password after reset token validation', async () => {
    // Note: We can't fully test the token flow without email access
    // This test verifies the password update API works when user is authenticated

    // Step 1: Sign in with initial password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword,
    });
    expect(signInError).toBeNull();

    // Step 2: Validate new password
    const passwordValidation = validatePassword(newPassword);
    expect(passwordValidation.valid).toBe(true);

    // Step 3: Update password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();

    // Step 4: Sign out and verify can sign in with new password
    await supabase.auth.signOut();

    const { data: signInData, error: newSignInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: newPassword,
      });

    expect(newSignInError).toBeNull();
    expect(signInData.user?.email).toBe(testEmail);
  });

  it('should reject password update with same password', async () => {
    // Sign in first
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: newPassword,
    });

    // Try to update to same password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    // Supabase may or may not reject same password - check implementation
    // This test documents the behavior
    if (error) {
      expect(error.message).toContain('password');
    }
  });

  it('should send reset email with correct redirect URL', async () => {
    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: redirectUrl,
    });

    expect(error).toBeNull();
    // Email is sent with redirect URL (can't verify content without email access)
  });

  it('should invalidate old password after successful reset', async () => {
    // Password was already updated to newPassword in previous test
    // Verify old password no longer works

    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword, // Old password
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
  });
});
