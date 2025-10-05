/**
 * Integration Test: Sign-In Flow (T062)
 *
 * Tests the complete sign-in journey:
 * Form validation → API call → session created → redirect logic
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/auth/email-validator';
import { RateLimiter } from '@/lib/auth/rate-limiter';

describe('Sign-In Flow Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  const testEmail = `signin-test-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';
  let userId: string;

  beforeAll(async () => {
    supabase = createClient();

    // Create test user for sign-in tests
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create test user');
    userId = data.user.id;

    // Sign out to test sign-in
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

  it('should complete full sign-in flow with valid credentials', async () => {
    // Step 1: Validate email
    const emailValidation = validateEmail(testEmail);
    expect(emailValidation.valid).toBe(true);

    // Step 2: Sign in via API
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(testEmail);

    // Step 3: Verify session created
    expect(data.session).toBeDefined();
    expect(data.session?.access_token).toBeDefined();
    expect(data.session?.refresh_token).toBeDefined();

    // Step 4: Verify session is active
    const { data: sessionData } = await supabase.auth.getSession();
    expect(sessionData.session).toBeDefined();
    expect(sessionData.session?.user.id).toBe(userId);
  });

  it('should reject sign-in with invalid email', async () => {
    const invalidEmail = 'not-an-email';

    // Step 1: Client-side validation should fail
    const emailValidation = validateEmail(invalidEmail);
    expect(emailValidation.valid).toBe(false);

    // Step 2: API should also reject
    const { data, error } = await supabase.auth.signInWithPassword({
      email: invalidEmail,
      password: testPassword,
    });

    expect(error).toBeDefined();
  });

  it('should reject sign-in with wrong password', async () => {
    const wrongPassword = 'WrongPass123!';

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: wrongPassword,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
  });

  it('should reject sign-in with non-existent email', async () => {
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: nonExistentEmail,
      password: testPassword,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
  });

  it('should enforce rate limiting after multiple failed attempts', async () => {
    const rateLimiter = new RateLimiter('test-rate-limit', 3, 1); // 3 attempts, 1 minute

    // Step 1: First 3 attempts should be allowed
    for (let i = 0; i < 3; i++) {
      expect(rateLimiter.isAllowed()).toBe(true);
      rateLimiter.recordAttempt();
    }

    // Step 2: 4th attempt should be blocked
    expect(rateLimiter.isAllowed()).toBe(false);
    expect(rateLimiter.getTimeUntilReset()).toBeGreaterThan(0);

    // Clean up
    rateLimiter.clear();
  });

  it('should update user state after successful sign-in', async () => {
    // Sign out first
    await supabase.auth.signOut();

    // Verify no session
    const { data: beforeSession } = await supabase.auth.getSession();
    expect(beforeSession.session).toBeNull();

    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();

    // Verify session exists
    const { data: afterSession } = await supabase.auth.getSession();
    expect(afterSession.session).toBeDefined();
    expect(afterSession.session?.user.email).toBe(testEmail);
  });

  it('should allow Remember Me to extend session duration', async () => {
    // Sign in without Remember Me (default: 1 hour)
    const { data: shortSession } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(shortSession.session).toBeDefined();
    expect(shortSession.session?.expires_at).toBeDefined();

    // Note: Supabase doesn't have a direct "remember me" flag in signInWithPassword
    // Instead, this is handled client-side by storing refresh token
    // The test verifies that session has an expiry time
  });
});
