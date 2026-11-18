/**
 * Contract Test: Update Profile API (PATCH /rest/v1/user_profiles)
 *
 * Tests the contract for updating user profile data using static confirmed test user.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-user';

describe('User Profile UPDATE Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient();

    // Sign in with pre-confirmed static test user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    // Every check below runs as this user; a failed sign-in must stop here.
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    testUserId = data.user!.id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it('should update username', async () => {
    const newUsername = `user_${Date.now()}`;

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ username: newUsername })
      .eq('id', testUserId)
      .select('id, username, display_name, bio')
      .single();

    expect(error).toBeNull();
    expect(data?.username).toBe(newUsername);
  });

  it('should update display_name', async () => {
    const newDisplayName = 'Test User';

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ display_name: newDisplayName })
      .eq('id', testUserId)
      .select('id, username, display_name, bio')
      .single();

    expect(error).toBeNull();
    expect(data?.display_name).toBe(newDisplayName);
  });

  it('should update bio', async () => {
    const newBio = 'This is my bio';

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ bio: newBio })
      .eq('id', testUserId)
      .select('id, username, display_name, bio')
      .single();

    expect(error).toBeNull();
    expect(data?.bio).toBe(newBio);
  });

  it('should reject username shorter than 3 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ username: 'ab' })
      .eq('id', testUserId);

    // 23514 is Postgres check_violation: the database refused the value.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    expect(error?.message).toContain('check');
  });

  it('should reject username longer than 30 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ username: 'a'.repeat(31) })
      .eq('id', testUserId);

    // 23514 is Postgres check_violation: the database refused the value.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    expect(error?.message).toContain('check');
  });

  it('should reject bio longer than 500 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ bio: 'a'.repeat(501) })
      .eq('id', testUserId);

    // 23514 is Postgres check_violation: the database refused the value.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    expect(error?.message).toContain('check');
  });

  it('should enforce RLS - users cannot update other profiles', async () => {
    // Target a REAL second account. An update aimed at an id that does not
    // exist matches no rows whether or not RLS is on, so it proves nothing.
    const admin = createServiceClient();
    const victimEmail = `rls-victim-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: victimEmail,
        password: 'ValidPass123!',
        email_confirm: true,
      });
    expect(createError).toBeNull();
    const victimId = created.user!.id;

    try {
      const { data: before } = await admin
        .from('user_profiles')
        .select('username, display_name, bio')
        .eq('id', victimId)
        .single();
      expect(before).not.toBeNull();

      // RLS hides the other user's row from the update: no rows change. Some
      // setups answer with an error instead of an empty result; both mean the
      // update was refused, so the check is on the rows, not on the error.
      const { data: changed } = await supabase
        .from('user_profiles')
        .update({ username: 'hacker', display_name: 'hacked', bio: 'hacked' })
        .eq('id', victimId)
        .select('id');
      expect(changed ?? []).toHaveLength(0);

      // Control: read the row back with the service client. It is untouched.
      const { data: after } = await admin
        .from('user_profiles')
        .select('username, display_name, bio')
        .eq('id', victimId)
        .single();
      expect(after).toEqual(before);
    } finally {
      await admin.auth.admin.deleteUser(victimId);
    }
  });

  it('should auto-update updated_at timestamp', async () => {
    const { data: before } = await supabase
      .from('user_profiles')
      .select('updated_at')
      .eq('id', testUserId)
      .single();

    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await supabase
      .from('user_profiles')
      .update({ bio: 'Updated bio' })
      .eq('id', testUserId);

    const { data: after } = await supabase
      .from('user_profiles')
      .select('updated_at')
      .eq('id', testUserId)
      .single();

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime()
    );
  });
});
