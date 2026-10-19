/**
 * Admin Access Contract Tests
 *
 * Two halves:
 *   1. Non-admin → 42501 — proves the is_admin() guard refuses. Since #1029 the
 *                          guard RAISES; it no longer returns '{}', which was
 *                          indistinguishable from "no rows".
 *   2. Admin → shape     — proves the SQL past the guard emits what the
 *                          component destructures.
 *
 * Runs in conformance (vitest.rls.config.ts) against a local stack whose admin
 * was seeded under a random per-run password (#1379). It is excluded from the
 * default vitest config because it needs that live backend.
 *
 * Half 2 is the one that catches drift. A SQL column aliased `fail_count`
 * and a component reading `entry.attempts` both pass in isolation: the unit
 * test feeds a fixture with `attempts`, the SQL compiles, the non-admin
 * contract sees `{}` and never reaches the SELECT. The bug only surfaces in
 * a browser, against a live backend, with admin creds — where the anomaly
 * card reads " failed attempts" with no number because `undefined` renders
 * as nothing.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Every admin RPC, with the arguments its signature accepts. */
const ADMIN_RPCS: Array<{ fn: string; args?: Record<string, unknown> }> = [
  { fn: 'admin_payment_stats' },
  { fn: 'admin_auth_stats' },
  { fn: 'admin_user_stats' },
  { fn: 'admin_messaging_stats' },
  { fn: 'admin_payment_trends', args: { p_start: null, p_end: null } },
  { fn: 'admin_audit_trends', args: { p_start: null, p_end: null } },
  { fn: 'admin_messaging_trends', args: { p_start: null, p_end: null } },
  {
    fn: 'admin_list_users',
    args: { p_search: '', p_limit: 10, p_offset: 0 },
  },
  { fn: 'admin_conversation_list', args: { p_limit: 10, p_offset: 0 } },
  { fn: 'admin_overview', args: { p_start: null, p_end: null } },
];

const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('Admin Access Contract Tests', () => {
  let nonAdmin: SupabaseClient;

  beforeAll(async () => {
    nonAdmin = createClient(supabaseUrl, supabaseKey);
    const { error } = await nonAdmin.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // Without this a failed sign-in makes the caller anonymous, and anonymous is
    // refused with the same 42501 — the refusal tests below would pass for the
    // wrong reason.
    if (error) {
      throw new Error(`Non-admin sign-in failed: ${error.message}`);
    }
  });

  it.each(ADMIN_RPCS)(
    'non-admin is refused by $fn with 42501, not an empty result',
    async ({ fn, args }) => {
      const { data, error } = await nonAdmin.rpc(fn, args);
      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('caller is not an admin');
    }
  );
});

// Signing in as the admin needs the password the seeder was given. There is no
// fallback literal (#1246) and no skip (#1379): without SEED_ADMIN_PASSWORD the
// block FAILS in beforeAll, so a missing variable is a red run, never a silent one.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

describe('Admin RPC Shape Contract — admin caller', () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    if (!ADMIN_PASSWORD) {
      throw new Error(
        'SEED_ADMIN_PASSWORD is required: the admin shape contract signs in as ' +
          'the seeded admin and has no default password (#1246).'
      );
    }
    admin = createClient(supabaseUrl, supabaseKey);
    const { error } = await admin.auth.signInWithPassword({
      email: process.env.SEED_ADMIN_EMAIL || 'admin@scripthammer.com',
      password: ADMIN_PASSWORD,
    });
    if (error) {
      throw new Error(
        `Admin sign-in failed: ${error.message}. ` +
          `Seed script must set user_profiles.is_admin on this user.`
      );
    }
  });

  const call = async (fn: string, args?: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(fn, args);
    expect(error, `${fn} must not error for an admin`).toBeNull();
    expect(data, `${fn} must return a JSON object`).toBeTypeOf('object');
    expect(data).not.toBeNull();
    return data;
  };

  // A Record<string, number> — the shape TS declares and Object.entries()
  // expects — is a plain object with string keys and number values. An
  // array satisfies `typeof x === 'object'` and has `.length`, so we need
  // all three checks to distinguish {stripe: 2500} from [{provider, total}].
  const expectRecordStringNumber = (actual: unknown, label: string): void => {
    expect(
      actual,
      `${label} must be a plain object, not array`
    ).not.toBeInstanceOf(Array);
    expect(typeof actual, `${label} must be an object`).toBe('object');
    expect(actual, `${label} must not be null`).not.toBeNull();
    for (const [k, v] of Object.entries(actual as object)) {
      expect(typeof k).toBe('string');
      expect(typeof v, `${label}[${k}] must be a number, got ${typeof v}`).toBe(
        'number'
      );
    }
  };

  it('admin_payment_stats.revenue_by_provider is Record<string, number>', async () => {
    // json_object_agg(provider, total) gives the Record shape; json_agg(row_to_json())
    // would give [["0", {provider, total}], ...] under Object.entries().
    const data = await call('admin_payment_stats');
    expectRecordStringNumber(data.revenue_by_provider, 'revenue_by_provider');
  });

  it('admin_auth_stats.top_failed_logins entries have .attempts, not .fail_count', async () => {
    // AdminAuditTrail renders `{entry.attempts} failed attempts`. The array is empty
    // under the default seed, so this is a no-op on a fresh stack; the top-level
    // key check below still pins the surrounding shape.
    const data = await call('admin_auth_stats');
    expect(data.top_failed_logins).toBeInstanceOf(Array);
    for (const entry of data.top_failed_logins) {
      expect(entry).toHaveProperty('user_id');
      expect(entry).toHaveProperty('attempts');
      expect(typeof entry.attempts).toBe('number');
      expect(entry).not.toHaveProperty('fail_count');
    }
  });

  it('admin_messaging_stats.connection_distribution is Record<string, number>', async () => {
    // AdminMessagingOverview does Object.entries(distribution); an array of rows
    // would crash React with "Objects are not valid as a React child".
    const data = await call('admin_messaging_stats');
    expectRecordStringNumber(
      data.connection_distribution,
      'connection_distribution'
    );
  });

  it('admin_overview inherits corrected shapes from sub-RPCs', async () => {
    const data = await call('admin_overview', { p_start: null, p_end: null });
    expect(keysOf(data)).toEqual(
      ['range', 'payments', 'auth', 'users', 'messaging', 'sparks'].sort()
    );
    expect(keysOf(data.range)).toEqual(['end', 'start']);
    expect(keysOf(data.sparks)).toEqual(
      ['logins', 'messages', 'payments', 'signups'].sort()
    );
    expectRecordStringNumber(
      data.payments.revenue_by_provider,
      'overview.payments.revenue_by_provider'
    );
    expectRecordStringNumber(
      data.messaging.connection_distribution,
      'overview.messaging.connection_distribution'
    );
    for (const entry of data.auth.top_failed_logins) {
      expect(entry).toHaveProperty('attempts');
      expect(entry).not.toHaveProperty('fail_count');
    }
  });

  // ---------------------------------------------------------------------
  // Regression lock: full key-set equality, not just "has the fields we use
  // today", because unexpected extra fields are also drift (the SQL changed and
  // nobody updated the type).
  // ---------------------------------------------------------------------

  it('admin_payment_stats top-level keys match AdminPaymentStats', async () => {
    const data = await call('admin_payment_stats');
    expect(keysOf(data)).toEqual(
      [
        'total_payments',
        'successful_payments',
        'failed_payments',
        'pending_payments',
        'total_revenue_cents',
        'active_subscriptions',
        'failed_this_week',
        'revenue_by_provider',
      ].sort()
    );
  });

  it('admin_auth_stats top-level keys match AdminAuthStats', async () => {
    const data = await call('admin_auth_stats');
    expect(keysOf(data)).toEqual(
      [
        'reports_dropped_this_week',
        'logins_today',
        'failed_this_week',
        'signups_this_month',
        'top_failed_logins',
      ].sort()
    );
  });

  it('admin_user_stats keys match AdminUserStats', async () => {
    const data = await call('admin_user_stats');
    expect(keysOf(data)).toEqual(
      [
        'total_users',
        'active_this_week',
        'pending_connections',
        'total_connections',
      ].sort()
    );
  });

  it('admin_messaging_stats top-level keys match AdminMessagingStats', async () => {
    const data = await call('admin_messaging_stats');
    expect(keysOf(data)).toEqual(
      [
        'total_conversations',
        'group_conversations',
        'direct_conversations',
        'messages_this_week',
        'active_connections',
        'blocked_connections',
        'connection_distribution',
      ].sort()
    );
  });

  // The *_trends RPCs default their window to the last 7 days only when the
  // arguments are OMITTED; explicit NULLs are echoed back and produce no series.
  // So the element-shape checks call them with no arguments, which yields one
  // daily_series row per day regardless of what data the stack holds.

  it('admin_payment_trends shape matches PaymentTrends', async () => {
    const data = await call('admin_payment_trends');
    expect(keysOf(data)).toEqual(
      [
        'range',
        'totals',
        'refund_rate',
        'provider_breakdown',
        'daily_series',
      ].sort()
    );
    expect(keysOf(data.totals)).toEqual(
      ['succeeded', 'failed', 'refunded', 'revenue_cents'].sort()
    );
    expect(data.daily_series.length).toBeGreaterThan(0);
    for (const row of data.daily_series) {
      expect(keysOf(row)).toEqual(
        ['day', 'succeeded', 'failed', 'revenue_cents'].sort()
      );
    }
    for (const row of data.provider_breakdown) {
      expect(keysOf(row)).toEqual(
        ['provider', 'succeeded', 'failed', 'refunded', 'revenue_cents'].sort()
      );
    }
  });

  it('admin_audit_trends shape matches AuditTrends', async () => {
    const data = await call('admin_audit_trends');
    expect(keysOf(data)).toEqual(['range', 'totals', 'daily_series'].sort());
    expect(keysOf(data.totals)).toEqual(['sign_in_failed', 'sign_in_success']);
    expect(data.daily_series.length).toBeGreaterThan(0);
    for (const row of data.daily_series) {
      expect(keysOf(row)).toEqual(['day', 'failed', 'succeeded'].sort());
    }
  });

  it('admin_messaging_trends shape matches MessagingTrends', async () => {
    const data = await call('admin_messaging_trends');
    expect(keysOf(data)).toEqual(
      ['range', 'totals', 'daily_series', 'top_senders'].sort()
    );
    expect(keysOf(data.totals)).toEqual(
      ['messages', 'conversations_created', 'active_senders'].sort()
    );
    expect(data.daily_series.length).toBeGreaterThan(0);
    for (const row of data.daily_series) {
      expect(keysOf(row)).toEqual(
        ['day', 'messages', 'conversations_created'].sort()
      );
    }
    for (const row of data.top_senders) {
      expect(keysOf(row)).toEqual(
        ['user_id', 'username', 'display_name', 'messages'].sort()
      );
    }
  });

  it('admin_list_users rows match AdminUserRow', async () => {
    // last_sign_in_at is emitted as null, not omitted — row_to_json keeps null
    // columns — so the key set is stable whether or not a user has signed in.
    const data = await call('admin_list_users', {
      p_search: '',
      p_limit: 10,
      p_offset: 0,
    });
    expect(keysOf(data)).toEqual(['total', 'users']);
    expect(data.users).toBeInstanceOf(Array);
    expect(data.users.length).toBeGreaterThan(0); // conformance seeds 3 users
    for (const row of data.users) {
      expect(keysOf(row)).toEqual(
        [
          'id',
          'username',
          'display_name',
          'created_at',
          'welcome_message_sent',
          'last_sign_in_at',
          'activity',
        ].sort()
      );
    }
  });

  it('admin_list_users accepts a search substring', async () => {
    const data = await call('admin_list_users', {
      p_search: 'testuser',
      p_limit: 10,
      p_offset: 0,
    });
    expect(data.total).toBeGreaterThan(0);
  });

  it('admin_conversation_list shape matches AdminConversationList', async () => {
    const data = await call('admin_conversation_list', {
      p_limit: 10,
      p_offset: 0,
    });
    expect(keysOf(data)).toEqual(['conversations', 'total']);
    expect(data.conversations).toBeInstanceOf(Array);
    for (const row of data.conversations) {
      expect(keysOf(row)).toEqual(
        [
          'conversation_id',
          'is_group',
          'participant_count',
          'message_count',
          'last_activity',
          'created_at',
        ].sort()
      );
    }
  });
});
