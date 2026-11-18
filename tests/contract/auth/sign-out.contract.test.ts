/**
 * Contract Test: Sign-Out API (POST /auth/v1/logout)
 *
 * Tests the contract between our app and Supabase Auth sign-out endpoint.
 * Runs in the conformance lane against a local stack with email confirmation
 * on, so the user is created already confirmed with the admin client. Every
 * test starts from a real session: the sign-in error must be null and the
 * session present, otherwise the sign-out checks below would pass on nothing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';

describe('Supabase Auth Sign-Out Contract', () => {
  const admin = createServiceClient();
  const testPassword = 'ValidPass123!';
  let supabase: ReturnType<typeof createClient>;
  let testEmail: string;
  let userId: string;
  let oldAccessToken: string;

  beforeEach(async () => {
    supabase = createClient();
    testEmail = `signout-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
    expect(createError).toBeNull();
    userId = created.user!.id;

    const { data: signedIn, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
    expect(signInError).toBeNull();
    expect(signedIn.session).not.toBeNull();
    expect(signedIn.session!.access_token).toBeTruthy();
    oldAccessToken = signedIn.session!.access_token;
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  it('should clear session on sign-out', async () => {
    // Verify user is signed in
    const { data: beforeData } = await supabase.auth.getSession();
    expect(beforeData.session).not.toBeNull();
    expect(beforeData.session!.user.id).toBe(userId);

    // Sign out
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();

    // Verify session is cleared
    const { data: afterData } = await supabase.auth.getSession();
    expect(afterData.session).toBeNull();
  });

  it('should return no error when already signed out', async () => {
    // Sign out first time, from a real session
    const { error: firstError } = await supabase.auth.signOut();
    expect(firstError).toBeNull();
    const { data: between } = await supabase.auth.getSession();
    expect(between.session).toBeNull();

    // Sign out again should not error
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });

  it('should invalidate access token', async () => {
    // The token works before sign-out, so a failure afterwards is caused by
    // the sign-out and not by a token that never worked.
    const { data: before, error: beforeError } =
      await supabase.auth.getUser(oldAccessToken);
    expect(beforeError).toBeNull();
    expect(before.user?.id).toBe(userId);

    const { error: signOutError } = await supabase.auth.signOut();
    expect(signOutError).toBeNull();

    // Try to use old token (should fail)
    const { data, error } = await supabase.auth.getUser(oldAccessToken);
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it('should clear all sessions globally', async () => {
    // A second, separate sign-in for the same user: a second session.
    const other = createClient();
    const { data: otherSignIn, error: otherError } =
      await other.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
    expect(otherError).toBeNull();
    const otherToken = otherSignIn.session!.access_token;
    expect(otherToken).toBeTruthy();
    expect(otherToken).not.toBe(oldAccessToken);

    // Sign out with scope: global from the first client
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    expect(error).toBeNull();

    // This client's session is cleared
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();

    // The OTHER client's session is revoked on the server too
    const { data: otherUser, error: otherUserError } =
      await other.auth.getUser(otherToken);
    expect(otherUserError).not.toBeNull();
    expect(otherUser.user).toBeNull();
  });
});
