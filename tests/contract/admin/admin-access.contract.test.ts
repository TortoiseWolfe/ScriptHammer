/**
 * Admin Access Contract Tests
 *
 * Two halves:
 *   1. Non-admin → {}  — proves the JWT guard short-circuits.
 *   2. Admin → shape   — proves the SQL past the guard emits what the
 *                        component destructures.
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

describe('Admin Access Contract Tests', () => {
  it('non-admin gets empty result from admin_payment_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_payment_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_auth_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_auth_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_user_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_user_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_messaging_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_messaging_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_payment_analytics', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data, error } = await supabase.rpc('admin_payment_analytics', {
      p_from: '2025-01-01T00:00:00Z',
      p_to: '2025-12-31T23:59:59Z',
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('admin_payment_analytics accepts null range (defaults to 30 days)', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // Non-admin still gets {} but this verifies the function signature
    // tolerates NULL params without raising a Postgres error.
    const { data, error } = await supabase.rpc('admin_payment_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_audit_analytics', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data, error } = await supabase.rpc('admin_audit_analytics', {
      p_from: '2025-01-01T00:00:00Z',
      p_to: '2025-12-31T23:59:59Z',
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('admin_audit_analytics accepts null range (defaults to 30 days)', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data, error } = await supabase.rpc('admin_audit_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_user_list', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // Empty search + default limit. {} is the non-admin sentinel; an admin
    // would get a JSON array here.
    const { data, error } = await supabase.rpc('admin_user_list', {
      p_search: '',
      p_limit: 50,
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('admin_user_list accepts search substring without error', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // Verifies the ILIKE '%...%' concat tolerates a real string — the JWT
    // guard short-circuits before the query runs, so this is a
    // signature-acceptance check not a result check.
    const { data, error } = await supabase.rpc('admin_user_list', {
      p_search: 'alice',
      p_limit: 10,
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_messaging_analytics', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data, error } = await supabase.rpc('admin_messaging_analytics', {
      p_from: '2025-01-01T00:00:00Z',
      p_to: '2025-12-31T23:59:59Z',
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('admin_messaging_analytics accepts null range (defaults to 30 days)', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // JWT guard returns {} before the FULL OUTER JOIN runs, so this proves
    // Postgres accepts the signature with NULLs — not that the join is sound.
    // Admin-positive shape tests below cover the post-guard path.
    const { data, error } = await supabase.rpc('admin_messaging_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(error).toBeNull();
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_overview', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    // No args. The outer guard short-circuits before any of the four nested
    // _stats calls run, so this is strictly a signature + guard check. If the
    // guard were missing, the nested functions would each return {} anyway
    // (defence in depth) and we'd see {payments:{}, auth:{}, ...} here — so
    // asserting a bare {} proves the outer guard specifically.
    const { data, error } = await supabase.rpc('admin_overview');
    expect(error).toBeNull();
    expect(data).toEqual({});
  });
});

describe('Admin RPC Shape Contract — admin caller', () => {
  // One client for the whole block. Each test creating its own client +
  // sign-in worked fine for the non-admin tests above (where the sign-in
  // is part of what's being proven), but here we just need a JWT that
  // clears the guard. The shape assertions are the test.
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(supabaseUrl, supabaseKey);
    const { error } = await admin.auth.signInWithPassword({
      email: process.env.SEED_ADMIN_EMAIL || 'admin@scripthammer.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!',
    });
    if (error) {
      throw new Error(
        `Admin sign-in failed: ${error.message}. ` +
          `Seed script must set raw_app_meta_data.is_admin on this user.`
      );
    }
  });

  // A Record<string, number> — the shape TS declares and Object.entries()
  // expects — is a plain object with string keys and number values. An
  // array satisfies `typeof x === 'object'` and has `.length`, so we need
  // all three checks to distinguish {stripe: 2500} from [{provider, total}].
  const expectRecordStringNumber = (
    actual: unknown,
    label: string
  ): void => {
    expect(actual, `${label} must be a plain object, not array`).not.toBeInstanceOf(Array);
    expect(typeof actual, `${label} must be an object`).toBe('object');
    expect(actual, `${label} must not be null`).not.toBeNull();
    for (const [k, v] of Object.entries(actual as object)) {
      expect(typeof k).toBe('string');
      expect(typeof v, `${label}[${k}] must be a number, got ${typeof v}`).toBe('number');
    }
  };

  it('admin_payment_stats.revenue_by_provider is Record<string, number>', async () => {
    // AdminPaymentPanel never dereferences this today — the field is
    // declared, passed, and discarded. But the type says Record, the test
    // fixtures say {stripe: 400000, paypal: 100000}, and the next dev who
    // tries `Object.entries(stats.revenue_by_provider).map(([provider, cents]) => ...)`
    // against live data will get [["0", {provider, total}], ["1", {...}]]
    // because json_agg(row_to_json()) produces an array of rows.
    //
    // json_object_agg(provider, total) produces the Record shape directly.
    const { data, error } = await admin.rpc('admin_payment_stats');
    expect(error).toBeNull();
    expectRecordStringNumber(
      data.revenue_by_provider,
      'revenue_by_provider'
    );
  });

  it('admin_auth_stats.top_failed_logins entries have .attempts, not .fail_count', async () => {
    // AdminAuditTrail.tsx:437 renders `{entry.attempts} failed attempts`.
    // SQL aliases the count AS fail_count. entry.attempts is undefined.
    // React renders undefined as nothing → the card reads " failed attempts"
    // with no number. The smoke didn't catch this because it doesn't assert
    // on anomaly card text — the section renders (length > 0) but the
    // content is wrong.
    //
    // We can't force the seed to produce a failed-login entry for this test,
    // so if the array is empty we can only assert it's an array. But when
    // it's populated (which the current seed does give us), every entry
    // must expose the field the component reads.
    const { data, error } = await admin.rpc('admin_auth_stats');
    expect(error).toBeNull();
    expect(data.top_failed_logins).toBeInstanceOf(Array);
    for (const entry of data.top_failed_logins) {
      expect(entry).toHaveProperty('user_id');
      // The field the component reads:
      expect(entry).toHaveProperty('attempts');
      expect(typeof entry.attempts).toBe('number');
      // And NOT the stale SQL alias. If both exist someone did an additive
      // "fix" and left the old column, which means two names for one value
      // and the next reader gets to guess which one is authoritative.
      expect(entry).not.toHaveProperty('fail_count');
    }
  });

  it('admin_messaging_stats.connection_distribution is Record<string, number>', async () => {
    // AdminMessagingOverview.tsx:132 does:
    //   const distributionEntries = Object.entries(distribution);
    //   ...
    //   distributionEntries.map(([status, count]) => (
    //     <div className="stat-title">{status}</div>
    //     <div className="stat-value">{count}</div>
    //   ))
    //
    // With the RPC returning [{status, total}, ...], Object.entries gives
    // [["0", {status, total}], ["1", {...}]] — array indices as keys,
    // whole row objects as values. {count} then tries to render an object
    // and React throws "Objects are not valid as a React child (found:
    // object with keys {status, total})".
    //
    // The admin smoke never hit /admin/messaging, so this crashed silently.
    const { data, error } = await admin.rpc('admin_messaging_stats');
    expect(error).toBeNull();
    expectRecordStringNumber(
      data.connection_distribution,
      'connection_distribution'
    );
  });

  it('admin_overview inherits corrected shapes from sub-RPCs', async () => {
    // admin_overview() calls the four _stats functions and nests their
    // output. If those are fixed, this is fixed — but the overview page
    // is the one admins actually look at first, so it gets its own
    // assertion rather than trusting composition.
    const { data, error } = await admin.rpc('admin_overview', {
      p_from: null,
      p_to: null,
    });
    expect(error).toBeNull();
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
  // Regression lock: the 6 RPCs that already match. These passed on first
  // run — they're here so the next person who touches the migration can't
  // silently drift a field name. Full key-set equality, not just "has the
  // fields we use today", because unexpected extra fields are also drift
  // (they mean the SQL changed and nobody updated the type).
  // ---------------------------------------------------------------------

  it('admin_payment_stats top-level keys match AdminPaymentStats', async () => {
    const { data } = await admin.rpc('admin_payment_stats');
    expect(Object.keys(data).sort()).toEqual(
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
    const { data } = await admin.rpc('admin_auth_stats');
    expect(Object.keys(data).sort()).toEqual(
      [
        'logins_today',
        'failed_this_week',
        'signups_this_month',
        'rate_limited_users',
        'top_failed_logins',
      ].sort()
    );
  });

  it('admin_user_stats keys match AdminUserStats', async () => {
    const { data } = await admin.rpc('admin_user_stats');
    expect(Object.keys(data).sort()).toEqual(
      [
        'total_users',
        'active_this_week',
        'pending_connections',
        'total_connections',
      ].sort()
    );
  });

  it('admin_messaging_stats top-level keys match AdminMessagingStats', async () => {
    const { data } = await admin.rpc('admin_messaging_stats');
    expect(Object.keys(data).sort()).toEqual(
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

  it('admin_payment_analytics shape matches PaymentAnalytics', async () => {
    const { data } = await admin.rpc('admin_payment_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(Object.keys(data).sort()).toEqual(
      ['window', 'daily_volume', 'provider_breakdown', 'refund_trend'].sort()
    );
    expect(data.window).toHaveProperty('from');
    expect(data.window).toHaveProperty('to');
    // Element shapes — the seed gives us at least one row for each, so
    // we can check field names. If the seed ever stops producing rows
    // these silently become no-ops; the top-level key check still holds.
    for (const row of data.daily_volume) {
      expect(Object.keys(row).sort()).toEqual(
        ['day', 'provider', 'status', 'txn_count', 'revenue_cents'].sort()
      );
    }
    for (const row of data.provider_breakdown) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'provider',
          'succeeded',
          'failed',
          'refunded',
          'pending',
          'revenue_cents',
          'refund_rate_pct',
        ].sort()
      );
    }
    for (const row of data.refund_trend) {
      expect(Object.keys(row).sort()).toEqual(
        ['day', 'refunded', 'completed', 'refund_rate_pct'].sort()
      );
    }
  });

  it('admin_audit_analytics shape matches AuditAnalytics', async () => {
    const { data } = await admin.rpc('admin_audit_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(Object.keys(data).sort()).toEqual(
      ['window', 'daily_activity', 'event_breakdown', 'ip_bursts'].sort()
    );
    for (const row of data.daily_activity) {
      expect(Object.keys(row).sort()).toEqual(
        ['day', 'ok', 'failed', 'total', 'failure_rate_pct'].sort()
      );
    }
    for (const row of data.event_breakdown) {
      expect(Object.keys(row).sort()).toEqual(
        ['event_type', 'ok', 'failed', 'total'].sort()
      );
    }
    // ip_bursts is empty under the default seed (no >10 events/IP/10min
    // window). Shape verified by reading the SQL: json_build_object in the
    // ip_bursts CTE uses exactly {ip_address, bucket_start, event_count,
    // failed_sign_ins, distinct_users}. An admin seeding a burst would
    // exercise this loop.
    for (const row of data.ip_bursts) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'ip_address',
          'bucket_start',
          'event_count',
          'failed_sign_ins',
          'distinct_users',
        ].sort()
      );
    }
  });

  it('admin_messaging_analytics shape matches MessagingAnalytics', async () => {
    const { data } = await admin.rpc('admin_messaging_analytics', {
      p_from: null,
      p_to: null,
    });
    expect(Object.keys(data).sort()).toEqual(
      ['window', 'conversation_counts', 'daily_volume', 'top_senders'].sort()
    );
    expect(Object.keys(data.conversation_counts).sort()).toEqual(
      ['total', 'created_in_window', 'active_in_window'].sort()
    );
    for (const row of data.daily_volume) {
      expect(Object.keys(row).sort()).toEqual(
        ['day', 'messages', 'new_conversations'].sort()
      );
    }
    for (const row of data.top_senders) {
      expect(Object.keys(row).sort()).toEqual(
        ['sender_id', 'username', 'message_count', 'conversation_count'].sort()
      );
    }
  });

  it('admin_user_list rows match AdminUserRow', async () => {
    // The two optional fields (last_sign_in_at, days_since_sign_in) are
    // emitted as null, not omitted — row_to_json doesn't drop null columns.
    // So the key set is stable regardless of whether a user has signed in.
    const { data } = await admin.rpc('admin_user_list', {
      p_search: '',
      p_limit: 10,
    });
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0); // seed guarantees ≥1 user
    for (const row of data) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'id',
          'username',
          'display_name',
          'created_at',
          'welcome_message_sent',
          'last_sign_in_at',
          'days_since_sign_in',
        ].sort()
      );
    }
  });
});
