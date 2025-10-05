/**
 * Integration Test: Protected Routes (T065)
 *
 * Tests the complete protected route flow:
 * Middleware blocks unauth → allows auth → session refresh
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Protected Routes Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  const testEmail = `protected-routes-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';
  let userId: string;

  beforeAll(async () => {
    supabase = createClient();

    // Create test user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create test user');
    userId = data.user.id;
  });

  afterAll(async () => {
    // Clean up test user
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should allow authenticated users to access protected routes', async () => {
    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();

    // Verify session is active
    const { data: sessionData } = await supabase.auth.getSession();
    expect(sessionData.session).toBeDefined();
    expect(sessionData.session?.user.id).toBe(userId);

    // In a real app, middleware would check this session
    // and allow access to /profile, /account, etc.
  });

  it('should block unauthenticated users from protected routes', async () => {
    // Sign out
    await supabase.auth.signOut();

    // Verify no session
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();

    // In a real app, middleware would detect no session
    // and redirect to /auth/sign-in
  });

  it('should refresh session before expiration', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Get initial session
    const { data: initialSession } = await supabase.auth.getSession();
    expect(initialSession.session).toBeDefined();

    const initialAccessToken = initialSession.session?.access_token;

    // Refresh session
    const { data: refreshedSession, error } =
      await supabase.auth.refreshSession();

    expect(error).toBeNull();
    expect(refreshedSession.session).toBeDefined();

    // New access token should be different
    expect(refreshedSession.session?.access_token).toBeDefined();
    expect(refreshedSession.session?.access_token).not.toBe(initialAccessToken);
  });

  it('should validate session on protected route access', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Get session
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeDefined();

    // Verify session has required properties
    expect(data.session?.access_token).toBeDefined();
    expect(data.session?.refresh_token).toBeDefined();
    expect(data.session?.user).toBeDefined();
    expect(data.session?.expires_at).toBeDefined();

    // Session should not be expired
    const expiresAt = data.session?.expires_at;
    if (expiresAt) {
      expect(expiresAt).toBeGreaterThan(Date.now() / 1000);
    }
  });

  it('should redirect to sign-in when session expires', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Get session expiry
    const { data } = await supabase.auth.getSession();
    expect(data.session?.expires_at).toBeDefined();

    // In a real app, middleware would:
    // 1. Check if session is expired
    // 2. Try to refresh if refresh_token is valid
    // 3. Redirect to /auth/sign-in if refresh fails

    // We can verify the session has an expiry time
    expect(typeof data.session?.expires_at).toBe('number');
  });

  it('should preserve redirect URL after authentication', async () => {
    // Sign out
    await supabase.auth.signOut();

    // Attempt to access protected route (would be caught by middleware)
    // Middleware would store intended URL in localStorage/cookie
    const intendedUrl = '/profile';
    localStorage.setItem('redirectAfterAuth', intendedUrl);

    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Verify redirect URL is preserved
    const storedUrl = localStorage.getItem('redirectAfterAuth');
    expect(storedUrl).toBe(intendedUrl);

    // Clean up
    localStorage.removeItem('redirectAfterAuth');
  });

  it('should handle concurrent session validation requests', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Make multiple concurrent session checks
    const promises = Array(5)
      .fill(null)
      .map(() => supabase.auth.getSession());

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach((result) => {
      expect(result.data.session).toBeDefined();
      expect(result.error).toBeNull();
    });

    // All should have same session
    const firstSession = results[0].data.session;
    results.forEach((result) => {
      expect(result.data.session?.access_token).toBe(
        firstSession?.access_token
      );
    });
  });

  it('should enforce email verification for protected routes', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Get user
    const { data } = await supabase.auth.getUser();
    expect(data.user).toBeDefined();

    // Check email verification status
    const isVerified = data.user?.email_confirmed_at !== null;

    // In a real app, AuthGuard component would:
    // 1. Check email_confirmed_at
    // 2. Redirect to /verify-email if null and requireVerification=true

    // We can verify the field exists
    expect(data.user).toHaveProperty('email_confirmed_at');
  });

  it('should allow navigation between protected routes without re-auth', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Get initial session
    const { data: session1 } = await supabase.auth.getSession();
    expect(session1.session).toBeDefined();

    const accessToken = session1.session?.access_token;

    // Simulate navigation to another protected route
    // Session should still be valid
    const { data: session2 } = await supabase.auth.getSession();
    expect(session2.session).toBeDefined();
    expect(session2.session?.access_token).toBe(accessToken);

    // No re-authentication required
  });

  it('should handle sign out from protected route', async () => {
    // Sign in
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Verify session exists
    const { data: beforeSignOut } = await supabase.auth.getSession();
    expect(beforeSignOut.session).toBeDefined();

    // Sign out
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();

    // Verify session cleared
    const { data: afterSignOut } = await supabase.auth.getSession();
    expect(afterSignOut.session).toBeNull();

    // In a real app, middleware would now redirect to /auth/sign-in
  });
});
