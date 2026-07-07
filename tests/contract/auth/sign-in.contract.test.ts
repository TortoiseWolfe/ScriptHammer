/**
 * Contract Test: Sign-In API (POST /auth/v1/token)
 *
 * Tests the contract between our app and Supabase Auth sign-in endpoint.
 * Uses static pre-confirmed test user from fixtures.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-user';

// Contract tests use real Supabase - create client directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Supabase Auth Sign-In Contract', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  afterEach(async () => {
    // Clean up session after each test
    await supabase.auth.signOut();
  });

  it('should accept valid credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(TEST_EMAIL);
  });

  it('should return session with access token', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
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
      password: TEST_PASSWORD,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
    expect(data.session).toBeNull();
  });

  it('should reject invalid password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'WrongPassword123!',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
    expect(data.session).toBeNull();
  });

  it('should handle case-insensitive email', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL.toUpperCase(),
      password: TEST_PASSWORD,
    });

    // Supabase normalizes email to lowercase
    expect(error).toBeNull();
    expect(data.user?.email).toBe(TEST_EMAIL.toLowerCase());
  });
});
