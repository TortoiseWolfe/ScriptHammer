/**
 * RLS User Isolation Tests
 *
 * Tests for User Story 1 (User Data Isolation) and
 * User Story 2 (Profile Self-Management)
 *
 * @module tests/rls/user-isolation.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe('RLS: User Data Isolation (US1)', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    // Create test users
    userA = await createTestUser(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );
    userB = await createTestUser(
      TEST_USERS.userB.email,
      TEST_USERS.userB.password
    );
  });

  afterAll(async () => {
    // Cleanup test users
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  // T017: Authenticated user can query own profile
  it('authenticated user can query own profile', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const { data, error } = await clientA.from('profiles').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(userA.id);
  });

  // T018: Authenticated user cannot query other user's profile
  it('authenticated user cannot query other user profile', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // Query all profiles - should only get own profile
    const { data, error } = await clientA.from('profiles').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // User A should NOT see User B's profile
    expect(data!.find((p) => p.id === userB.id)).toBeUndefined();
  });

  // T018 (continued): Direct query for other user's profile returns empty
  it('direct query for other user profile returns empty set', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // Try to directly query User B's profile
    const { data, error } = await clientA
      .from('profiles')
      .select('*')
      .eq('id', userB.id);

    expect(error).toBeNull();
    // Should return empty array, not an error
    expect(data).toHaveLength(0);
  });

  // T019: Unauthenticated user cannot query any profiles
  it('unauthenticated user cannot query profiles', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient.from('profiles').select('*');

    // RLS should return empty set for anon users (no policy grants access)
    expect(data).toHaveLength(0);
  });
});

describe('RLS: Profile Self-Management (US2)', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );
    userB = await createTestUser(
      TEST_USERS.userB.email,
      TEST_USERS.userB.password
    );
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  // T023: Profile owner can update display_name
  it('profile owner can update display_name', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const newDisplayName = 'Updated Name A';
    const { data, error } = await clientA
      .from('profiles')
      .update({ display_name: newDisplayName })
      .eq('id', userA.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.display_name).toBe(newDisplayName);
  });

  // T024: Profile owner can update bio
  it('profile owner can update bio', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const newBio = 'This is my updated bio';
    const { data, error } = await clientA
      .from('profiles')
      .update({ bio: newBio })
      .eq('id', userA.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.bio).toBe(newBio);
  });

  // T025: Non-owner cannot update another user's profile
  it('non-owner cannot update another user profile', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // User A tries to update User B's profile
    const { data, error } = await clientA
      .from('profiles')
      .update({ display_name: 'Hacked Name' })
      .eq('id', userB.id)
      .select();

    // Should return empty - no rows matched (RLS prevents access)
    expect(data).toHaveLength(0);
  });

  // T026: Update returns error for non-owner
  it('update attempt on non-owned profile returns empty result', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // Attempt to update User B's profile
    const { data, error, count } = await clientA
      .from('profiles')
      .update({ display_name: 'Attempted Hack' })
      .eq('id', userB.id)
      .select();

    // RLS silently filters - returns empty result, not error
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
