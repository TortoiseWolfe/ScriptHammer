/**
 * RLS Anonymous Access Tests
 *
 * Tests for User Story 4 (Anonymous User Restrictions)
 * Verifies that unauthenticated users have no access to protected data.
 *
 * @module tests/rls/anonymous-access.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAnonClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

// Security test: verifies anonymous requests cannot read or write any
// row-level-protected table. Skips (not hides) when no live Supabase is
// available — CI shows "7 skipped" so reviewers know coverage is deferred,
// not missing. Run locally via `pnpm test:rls` with the supabase profile.
describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Anonymous User Restrictions (US4) [${RLS_SKIP_REASON}]`,
  () => {
    let testUser: TestUser;

    beforeAll(async () => {
      // Create a test user so there's data to potentially leak
      testUser = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
    });

    afterAll(async () => {
      await deleteTestUser(testUser.id);
    });

    // T039: Anon user cannot SELECT from profiles
    it('anon user cannot SELECT from profiles', async () => {
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

    // T040: Anon user cannot INSERT to profiles
    it('anon user cannot INSERT to profiles', async () => {
      const anonClient = createAnonClient();

      const { data, error } = await anonClient.from('user_profiles').insert({
        id: '00000000-0000-0000-0000-000000000000',
        display_name: 'Malicious User',
      });

      // Should fail - no INSERT policy for anon
      expect(error).not.toBeNull();
    });

    // T041: Anon user cannot SELECT from audit_logs
    it('anon user cannot SELECT from audit_logs', async () => {
      const anonClient = createAnonClient();

      const { data, error } = await anonClient
        .from('auth_audit_logs')
        .select('*');

      // RLS returns empty set for anon
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    // T042: Anon user enumeration attempt returns zero results
    it('anon user enumeration attempt returns zero results', async () => {
      const anonClient = createAnonClient();

      // Try various enumeration techniques

      // 1. Direct select all
      const { data: allProfiles, error: allError } = await anonClient
        .from('user_profiles')
        .select('id');
      // Refused by privilege, not filtered to empty. `data` is null on an
      // error, so toHaveLength(0) would throw rather than pass.
      expect(allError?.code).toBe('42501');
      expect(allProfiles).toBeNull();

      // 2. Count query
      // `head: true` issues a HEAD request, which has no body — supabase-js has
      // no PostgREST JSON to read a `code` out of, so assert the refusal and the
      // absence of a count, not the code. The sibling probes are plain GETs and
      // do pin 42501.
      const { count, error: countError } = await anonClient
        .from('user_profiles')
        .select('id', { count: 'exact', head: true });
      expect(countError).not.toBeNull();
      expect(count ?? 0).toBe(0);

      // 3. Range query
      const { data: rangeData, error: rangeError } = await anonClient
        .from('user_profiles')
        .select('id')
        .range(0, 100);
      expect(rangeError?.code).toBe('42501');
      expect(rangeData).toBeNull();
    });

    // Additional test: Anon cannot UPDATE profiles
    it('anon user cannot UPDATE profiles', async () => {
      const anonClient = createAnonClient();

      const { data, error } = await anonClient
        .from('user_profiles')
        .update({ display_name: 'Hacked' })
        .eq('id', testUser.id)
        .select();

      // RLS filters — anon has no UPDATE grant on user_profiles.
      // PostgREST returns success with 0 rows (no error, empty result).
      if (error) {
        // Some Supabase versions return a permission error — that's fine
        expect(error).toBeDefined();
      } else {
        expect(data).toHaveLength(0);
      }
    });

    // Additional test: Anon cannot DELETE from profiles
    it('anon user cannot DELETE from profiles', async () => {
      const anonClient = createAnonClient();

      const { data, error } = await anonClient
        .from('user_profiles')
        .delete()
        .eq('id', testUser.id)
        .select();

      // Same as UPDATE — either error or zero rows affected
      if (error) {
        expect(error).toBeDefined();
      } else {
        expect(data).toHaveLength(0);
      }
    });

    // Additional test: Anon cannot INSERT to audit_logs
    it('anon user cannot INSERT to audit_logs', async () => {
      const anonClient = createAnonClient();

      const { data, error } = await anonClient.from('auth_audit_logs').insert({
        event_type: 'user.login',
        event_data: { malicious: true },
      });

      // Should fail - no INSERT policy for anon
      expect(error).not.toBeNull();
    });
  }
);
