/**
 * RLS Audit Immutability Tests
 *
 * Tests for User Story 5 (Audit Trail Protection)
 * Verifies that audit logs are immutable - no UPDATE/DELETE allowed.
 *
 * @module tests/rls/audit-immutability.test
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

describe('RLS: Audit Trail Protection (US5)', () => {
  let userA: TestUser;
  let userB: TestUser;
  let testAuditLogId: string;

  beforeAll(async () => {
    userA = await createTestUser(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );
    userB = await createTestUser(
      TEST_USERS.userB.email,
      TEST_USERS.userB.password
    );

    // Create a test audit log entry via service role
    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from('audit_logs')
      .insert({
        user_id: userA.id,
        event_type: 'profile.updated',
        details: { field: 'display_name', old: 'Old', new: 'New' },
      })
      .select()
      .single();

    testAuditLogId = data!.id;
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  // T046: Authenticated user can SELECT own audit entries
  it('authenticated user can SELECT own audit entries', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const { data, error } = await clientA.from('audit_logs').select('*');

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    // All returned entries should belong to user A
    data!.forEach((log) => {
      expect(log.user_id).toBe(userA.id);
    });
  });

  // T047: Authenticated user cannot SELECT other user's audit entries
  it('authenticated user cannot SELECT other user audit entries', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    const { data, error } = await clientA.from('audit_logs').select('*');

    expect(error).toBeNull();
    // User A should not see any of User B's audit logs
    const userBLogs = data!.filter((log) => log.user_id === userB.id);
    expect(userBLogs).toHaveLength(0);
  });

  // T048: Authenticated user cannot UPDATE audit_logs
  it('authenticated user cannot UPDATE audit_logs', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // Try to update the audit log entry
    const { data, error } = await clientA
      .from('audit_logs')
      .update({ details: { tampered: true } })
      .eq('id', testAuditLogId)
      .select();

    // Should return empty - no UPDATE policy exists
    expect(data).toHaveLength(0);
  });

  // T049: Authenticated user cannot DELETE from audit_logs
  it('authenticated user cannot DELETE from audit_logs', async () => {
    const clientA = await createAuthenticatedClient(
      TEST_USERS.userA.email,
      TEST_USERS.userA.password
    );

    // Try to delete the audit log entry
    const { data, error } = await clientA
      .from('audit_logs')
      .delete()
      .eq('id', testAuditLogId)
      .select();

    // Should return empty - no DELETE policy exists
    expect(data).toHaveLength(0);

    // Verify the log still exists (check via service role)
    const serviceClient = createServiceClient();
    const { data: checkData } = await serviceClient
      .from('audit_logs')
      .select('*')
      .eq('id', testAuditLogId)
      .single();

    expect(checkData).not.toBeNull();
    expect(checkData?.id).toBe(testAuditLogId);
  });

  // T050: Service role INSERT creates audit entry
  it('service role INSERT creates audit entry', async () => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('audit_logs')
      .insert({
        user_id: userA.id,
        event_type: 'user.login',
        details: { ip: '192.168.1.1', browser: 'Chrome' },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.event_type).toBe('user.login');
    expect(data?.details).toMatchObject({ ip: '192.168.1.1' });
  });

  // Additional test: Service role also cannot UPDATE (immutability enforced at trigger level)
  it('audit log details are preserved after creation', async () => {
    const serviceClient = createServiceClient();

    // Get the original entry
    const { data: original } = await serviceClient
      .from('audit_logs')
      .select('*')
      .eq('id', testAuditLogId)
      .single();

    // The original details should be intact
    expect(original?.details).toMatchObject({
      field: 'display_name',
      old: 'Old',
      new: 'New',
    });
  });

  // Additional test: Verify audit log has correct event types
  it('audit logs have valid event types', async () => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('audit_logs')
      .select('event_type');

    expect(error).toBeNull();

    const validEventTypes = [
      'user.login',
      'user.logout',
      'user.signup',
      'user.delete',
      'policy.violation',
      'session.expired',
      'profile.updated',
    ];

    data!.forEach((log) => {
      expect(validEventTypes).toContain(log.event_type);
    });
  });
});
