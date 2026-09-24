/**
 * What the admin dashboard's auth block reports, and that it still loads (#1285).
 *
 * `admin_auth_stats()` used to include `rate_limited_users`, a count of locked rows in
 * `rate_limit_attempts`, and the dashboard raised an AUTH alert — "N users rate-limited right
 * now" — whenever it was non-zero. After #1245 no sign-in lockout can exist: the only rows that
 * can lock are the Edge Functions' contact-form and booking buckets, keyed by IP. The number
 * had become a count of throttled contact-form senders, labelled as locked-out users.
 *
 * The metric is gone, and with it the one reason `authenticated` held SELECT on that table.
 * `admin_auth_stats()` is SECURITY INVOKER, so that revoke is exactly the change that would
 * turn the dashboard into a 403 if any read of the table were left behind — which is why this
 * file calls the RPCs as a real admin rather than inspecting the function's text.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: the admin auth metrics (#1285) [${RLS_SKIP_REASON}]`,
  () => {
    let admin: TestUser;
    let member: TestUser;
    let adminClient: SupabaseClient;
    let memberClient: SupabaseClient;
    let service: SupabaseClient;

    beforeAll(async () => {
      service = createServiceClient();
      admin = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      member = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await service
        .from('user_profiles')
        .update({ is_admin: true })
        .eq('id', admin.id);
      if (error) throw new Error(`could not make the admin: ${error.message}`);
      adminClient = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      memberClient = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
    });

    afterAll(async () => {
      if (admin)
        await service
          .from('user_profiles')
          .update({ is_admin: false })
          .eq('id', admin.id);
      if (member) await deleteTestUser(member.id);
      if (admin) await deleteTestUser(admin.id);
    });

    it('an admin gets the auth block, without a lockout count', async () => {
      const { data, error } = await adminClient.rpc('admin_auth_stats');
      expect(error).toBeNull();
      expect(Object.keys(data as object).sort()).toEqual([
        'failed_this_week',
        'logins_today',
        'signups_this_month',
        'top_failed_logins',
      ]);
    });

    it('the overview that embeds it still loads for an admin', async () => {
      // admin_overview runs admin_auth_stats inside itself, so a leftover read of a table the
      // caller can no longer see would fail here, as a 403 on the whole dashboard.
      const { data, error } = await adminClient.rpc('admin_overview');
      expect(error).toBeNull();
      expect(data).toHaveProperty('auth');
      expect(data).not.toHaveProperty('auth.rate_limited_users');
    });

    it('CONTROL: a signed-in non-admin is still refused', async () => {
      // Without this, a function that had stopped checking is_admin() would pass both tests
      // above for everyone.
      const { error } = await memberClient.rpc('admin_auth_stats');
      expect(error?.code).toBe('42501');
    });
  }
);
