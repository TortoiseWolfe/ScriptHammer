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
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

// Security test: tenant isolation. User A must never see User B's rows.
// Skips (not hides) when no live Supabase is available so CI reviewers see
// the coverage is deferred, not missing. Run via `pnpm test:rls`.
describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: User Data Isolation (US1) [${RLS_SKIP_REASON}]`,
  () => {
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

      // `select('*')` needs the privilege on EVERY column, and `authenticated`
      // no longer holds one on `is_admin` — so a star fails outright rather
      // than quietly omitting it. Name what this test needs.
      const { data, error } = await clientA
        .from('user_profiles')
        .select('id, username, display_name, bio')
        .eq('id', userA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(userA.id);
    });

    // T018: Authenticated users CAN see other profiles (search policy)
    // The "Authenticated users can search profiles" policy grants SELECT
    // to all authenticated users so friend search works (Feature 023).
    // This test verifies that policy works as designed.
    it('authenticated user can see other profiles via search policy', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );

      const { data, error } = await clientA
        .from('user_profiles')
        .select('id')
        .eq('id', userB.id);

      expect(error).toBeNull();
      // Search policy allows reading other profiles
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(userB.id);
    });

    // T019: Unauthenticated user cannot query any profiles
    it('unauthenticated user cannot query profiles', async () => {
      const anonClient = createAnonClient();

      // anon now holds NO privilege on this table at all, so the refusal
      // happens at the GRANT layer rather than by RLS returning an empty set.
      // That is strictly stronger — a row policy that stops matching would
      // silently re-open the table, whereas a missing privilege cannot.
      const { data, error } = await anonClient
        .from('user_profiles')
        .select('id');

      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });
  }
);

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Profile Self-Management (US2) [${RLS_SKIP_REASON}]`,
  () => {
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
        .from('user_profiles')
        .update({ display_name: newDisplayName })
        .eq('id', userA.id)
        .select('id, display_name, bio')
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
        .from('user_profiles')
        .update({ bio: newBio })
        .eq('id', userA.id)
        .select('id, display_name, bio')
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
        .from('user_profiles')
        .update({ display_name: 'Hacked Name' })
        .eq('id', userB.id)
        .select('id, display_name, bio');

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
        .from('user_profiles')
        .update({ display_name: 'Attempted Hack' })
        .eq('id', userB.id)
        .select('id, display_name, bio');

      // RLS silently filters - returns empty result, not error
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  }
);
