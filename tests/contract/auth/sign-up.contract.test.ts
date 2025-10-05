/**
 * Contract Test: Sign-Up API (POST /auth/v1/signup)
 *
 * Tests the contract between our app and Supabase Auth sign-up endpoint.
 * These tests MUST fail until implementation is complete (TDD RED phase).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Supabase Auth Sign-Up Contract', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient();
  });

  it('should accept valid email and password', async () => {
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
  });

  it('should reject invalid email format', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: 'not-an-email',
      password: 'ValidPass123!',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('email');
  });

  it('should reject weak password', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'weak',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('password');
  });

  it('should reject duplicate email', async () => {
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

  it('should return user metadata structure', async () => {
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
  });

  it('should send verification email', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'ValidPass123!',
    });

    expect(error).toBeNull();
    // Supabase sends verification email automatically
    // We can't test email delivery in unit tests, but contract ensures no error
  });
});
