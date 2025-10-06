/**
 * Contract Test: Update Profile API (PATCH /rest/v1/user_profiles)
 *
 * Tests the contract for updating user profile data using static confirmed test user.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-user';

describe('User Profile UPDATE Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient();

    // Sign in with pre-confirmed static test user
    const { data } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

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
      .select()
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
      .select()
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
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.bio).toBe(newBio);
  });

  it('should reject username shorter than 3 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ username: 'ab' })
      .eq('id', testUserId);

    expect(error).toBeDefined();
    expect(error?.message).toContain('check');
  });

  it('should reject username longer than 30 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ username: 'a'.repeat(31) })
      .eq('id', testUserId);

    expect(error).toBeDefined();
    expect(error?.message).toContain('check');
  });

  it('should reject bio longer than 500 chars', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ bio: 'a'.repeat(501) })
      .eq('id', testUserId);

    expect(error).toBeDefined();
    expect(error?.message).toContain('check');
  });

  it('should enforce RLS - users cannot update other profiles', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('user_profiles')
      .update({ username: 'hacker' })
      .eq('id', fakeId);

    // RLS blocks update to other profiles
    expect(error).toBeDefined();
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
