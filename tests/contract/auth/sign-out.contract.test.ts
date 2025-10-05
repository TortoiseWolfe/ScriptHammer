/**
 * Contract Test: Sign-Out API (POST /auth/v1/logout)
 *
 * Tests the contract between our app and Supabase Auth sign-out endpoint.
 * These tests MUST fail until implementation is complete (TDD RED phase).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Supabase Auth Sign-Out Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  const testEmail = `signout-test-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  beforeEach(async () => {
    supabase = createClient();

    // Create and sign in test user
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
  });

  it('should clear session on sign-out', async () => {
    // Verify user is signed in
    const { data: beforeData } = await supabase.auth.getSession();
    expect(beforeData.session).toBeDefined();

    // Sign out
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();

    // Verify session is cleared
    const { data: afterData } = await supabase.auth.getSession();
    expect(afterData.session).toBeNull();
  });

  it('should return no error when already signed out', async () => {
    // Sign out first time
    await supabase.auth.signOut();

    // Sign out again should not error
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });

  it('should invalidate access token', async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const oldAccessToken = sessionData.session?.access_token;

    // Sign out
    await supabase.auth.signOut();

    // Try to use old token (should fail)
    const { data, error } = await supabase.auth.getUser(oldAccessToken);
    expect(error).toBeDefined();
    expect(data.user).toBeNull();
  });

  it('should clear all sessions globally', async () => {
    // Sign out with scope: global
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    expect(error).toBeNull();

    // Session should be cleared
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });
});
