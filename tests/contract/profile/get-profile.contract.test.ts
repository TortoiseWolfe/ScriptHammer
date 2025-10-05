/**
 * Contract Test: Get Profile API (GET /rest/v1/user_profiles)
 *
 * Tests the contract for retrieving user profile data.
 * These tests MUST fail until implementation is complete (TDD RED phase).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('User Profile GET Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  const testEmail = `profile-get-${Date.now()}@example.com`;

  beforeAll(async () => {
    supabase = createClient();

    // Create and sign in test user
    const { data } = await supabase.auth.signUp({
      email: testEmail,
      password: 'ValidPass123!',
    });

    testUserId = data.user!.id;

    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'ValidPass123!',
    });
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it('should return user profile structure', async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('username');
    expect(data).toHaveProperty('display_name');
    expect(data).toHaveProperty('avatar_url');
    expect(data).toHaveProperty('bio');
    expect(data).toHaveProperty('created_at');
    expect(data).toHaveProperty('updated_at');
  });

  it('should auto-create profile on sign-up', async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(testUserId);
    expect(data?.username).toBeNull(); // Initially null until user sets it
  });

  it('should enforce RLS - users can only view own profile', async () => {
    // Try to query all profiles (should only return current user's)
    const { data, error } = await supabase.from('user_profiles').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(testUserId);
  });

  it('should return null for non-existent profile', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', fakeId)
      .single();

    // RLS blocks access to other profiles
    expect(data).toBeNull();
  });
});
