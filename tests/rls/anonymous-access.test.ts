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
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe('RLS: Anonymous User Restrictions (US4)', () => {
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

    const { data, error } = await anonClient.from('profiles').select('*');

    // RLS returns empty set for anon (no policy grants SELECT)
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // T040: Anon user cannot INSERT to profiles
  it('anon user cannot INSERT to profiles', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient.from('profiles').insert({
      id: '00000000-0000-0000-0000-000000000000',
      display_name: 'Malicious User',
    });

    // Should fail - no INSERT policy for anon
    expect(error).not.toBeNull();
  });

  // T041: Anon user cannot SELECT from audit_logs
  it('anon user cannot SELECT from audit_logs', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient.from('audit_logs').select('*');

    // RLS returns empty set for anon
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // T042: Anon user enumeration attempt returns zero results
  it('anon user enumeration attempt returns zero results', async () => {
    const anonClient = createAnonClient();

    // Try various enumeration techniques

    // 1. Direct select all
    const { data: allProfiles } = await anonClient
      .from('profiles')
      .select('id');
    expect(allProfiles).toHaveLength(0);

    // 2. Count query
    const { count } = await anonClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    expect(count).toBe(0);

    // 3. Range query
    const { data: rangeData } = await anonClient
      .from('profiles')
      .select('id')
      .range(0, 100);
    expect(rangeData).toHaveLength(0);
  });

  // Additional test: Anon cannot UPDATE profiles
  it('anon user cannot UPDATE profiles', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient
      .from('profiles')
      .update({ display_name: 'Hacked' })
      .eq('id', testUser.id);

    // RLS filters - no rows to update
    expect(data).toHaveLength(0);
  });

  // Additional test: Anon cannot DELETE from profiles
  it('anon user cannot DELETE from profiles', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient
      .from('profiles')
      .delete()
      .eq('id', testUser.id);

    // RLS filters - no rows to delete
    expect(data).toHaveLength(0);
  });

  // Additional test: Anon cannot INSERT to audit_logs
  it('anon user cannot INSERT to audit_logs', async () => {
    const anonClient = createAnonClient();

    const { data, error } = await anonClient.from('audit_logs').insert({
      event_type: 'user.login',
      details: { malicious: true },
    });

    // Should fail - no INSERT policy for anon
    expect(error).not.toBeNull();
  });
});
