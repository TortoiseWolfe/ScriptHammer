/**
 * RLS Service Role Tests
 *
 * Tests for User Story 3 (Service Role Operations)
 * Verifies that service_role bypasses RLS for backend operations.
 *
 * @module tests/rls/service-role.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe('RLS: Service Role Operations (US3)', () => {
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

  // T031: Service role can SELECT all profiles
  it('service role can SELECT all profiles', async () => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient.from('profiles').select('*');

    expect(error).toBeNull();
    // Service role should see ALL profiles
    expect(data!.length).toBeGreaterThanOrEqual(2);
    expect(data!.find((p) => p.id === userA.id)).toBeDefined();
    expect(data!.find((p) => p.id === userB.id)).toBeDefined();
  });

  // T032: Service role can INSERT audit_logs
  it('service role can INSERT audit_logs', async () => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('audit_logs')
      .insert({
        user_id: userA.id,
        event_type: 'user.login',
        details: { test: true },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.event_type).toBe('user.login');
    expect(data?.user_id).toBe(userA.id);
  });

  // T033: Service role can UPDATE any profile
  it('service role can UPDATE any profile', async () => {
    const serviceClient = createServiceClient();

    const adminNote = 'Updated by admin';
    const { data, error } = await serviceClient
      .from('profiles')
      .update({ bio: adminNote })
      .eq('id', userB.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.bio).toBe(adminNote);
  });

  // T034: Authenticated user cannot INSERT to audit_logs
  it('authenticated user cannot INSERT to audit_logs', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const { data, error } = await clientA.from('audit_logs').insert({
      user_id: userA.id,
      event_type: 'user.login',
      details: { attempted_by: 'user' },
    });

    // Should fail - no INSERT policy for authenticated users
    expect(error).not.toBeNull();
  });

  // Additional test: Verify service role can read all audit logs
  it('service role can read all audit logs', async () => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient.from('audit_logs').select('*');

    expect(error).toBeNull();
    // Should have at least the signup events from user creation
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });

  // Additional test: Authenticated user only sees own audit logs
  it('authenticated user only sees own audit logs', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const { data, error } = await clientA.from('audit_logs').select('*');

    expect(error).toBeNull();
    // User A should only see their own audit logs
    data!.forEach((log) => {
      expect(log.user_id).toBe(userA.id);
    });
  });
});
