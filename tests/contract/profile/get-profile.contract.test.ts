/**
 * Contract Test: Get Profile API (GET /rest/v1/user_profiles)
 *
 * Tests the contract for retrieving user profile data using static confirmed test user.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '../../helpers/real-supabase';
import { TEST_EMAIL, TEST_PASSWORD } from '../../fixtures/test-user';

describe('User Profile GET Contract', () => {
  const supabase = createClient();
  let testUserId: string;

  beforeAll(async () => {
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

  it('should return user profile structure', async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, username, display_name, avatar_url, bio, created_at, updated_at'
      )
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('username');
    expect(data).toHaveProperty('display_name');
    expect(data).toHaveProperty('avatar_url');
    expect(data).toHaveProperty('bio');
    expect(data).toHaveProperty('created_at');
    expect(data).toHaveProperty('updated_at');
  });

  it('should have profile matching user ID', async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, username, display_name, avatar_url, bio, created_at, updated_at'
      )
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(testUserId);
    expect(data?.username).not.toBeNull(); // Static test user has username already set
    expect(data?.username).toBeTruthy();
  });

  it('should allow viewing all profiles for friend search (Feature 023)', async () => {
    // Query all profiles - Feature 023 requires this for friend search functionality
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, username, display_name, avatar_url, bio, created_at, updated_at'
      );

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Should return at least the current user's profile
    expect(data!.length).toBeGreaterThanOrEqual(1);

    // Current user's profile should be included
    const ownProfile = data!.find((profile) => profile.id === testUserId);
    expect(ownProfile).toBeDefined();
    expect(ownProfile?.id).toBe(testUserId);

    // All profiles should have required structure
    data!.forEach((profile) => {
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('username');
      expect(profile).toHaveProperty('display_name');
      expect(profile).toHaveProperty('avatar_url');
    });
  });

  it('should return null for non-existent profile', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, username, display_name, avatar_url, bio, created_at, updated_at'
      )
      .eq('id', fakeId)
      .single();

    // .single() on zero rows is PGRST116 ("no rows"). Asserting the code keeps
    // this from passing on an unrelated failure (bad request, auth error).
    expect(data).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });
});
