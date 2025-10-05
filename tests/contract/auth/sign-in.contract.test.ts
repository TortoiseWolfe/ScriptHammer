/**
 * Contract Test: Sign-In API (POST /auth/v1/token)
 *
 * Tests the contract between our app and Supabase Auth sign-in endpoint.
 * These tests MUST fail until implementation is complete (TDD RED phase).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Supabase Auth Sign-In Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  const testEmail = `signin-test-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  beforeAll(async () => {
    supabase = createClient();

    // Create test user
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
  });

  afterEach(async () => {
    // Clean up session after each test
    await supabase.auth.signOut();
  });

  it('should accept valid credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(testEmail);
  });

  it('should return session with access token', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.session).toHaveProperty('access_token');
    expect(data.session).toHaveProperty('refresh_token');
    expect(data.session).toHaveProperty('expires_in');
    expect(data.session?.access_token).toMatch(
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
    ); // JWT format
  });

  it('should reject invalid email', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@example.com',
      password: testPassword,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
    expect(data.session).toBeNull();
  });

  it('should reject invalid password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'WrongPassword123!',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
    expect(data.session).toBeNull();
  });

  it('should handle case-insensitive email', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail.toUpperCase(),
      password: testPassword,
    });

    // Supabase normalizes email to lowercase
    expect(error).toBeNull();
    expect(data.user?.email).toBe(testEmail.toLowerCase());
  });
});
