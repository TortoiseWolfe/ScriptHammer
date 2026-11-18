/**
 * Contract Test: Delete Account (POST /functions/v1/delete-account)
 *
 * Tests the contract for account deletion with cascade behavior.
 * Account deletion runs server-side via the delete-account Edge Function, which
 * calls auth.admin.deleteUser with the service role; the profile, audit logs and
 * other ON DELETE CASCADE children fall with the auth.users row.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient, createServiceClient } from '../../helpers/real-supabase';

describe('Account Deletion Contract', () => {
  let supabase: ReturnType<typeof createClient>;
  let admin: ReturnType<typeof createServiceClient>;
  let testUserId: string;
  let testEmail: string;
  let testAccessToken: string;
  let paymentIntentId: string | undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  async function callDeleteAccount(accessToken: string) {
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  }

  beforeEach(async () => {
    supabase = createClient();
    admin = createServiceClient();
    testEmail = `delete-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'ValidPass123!',
      email_confirm: true,
    });
    expect(error).toBeNull();
    testUserId = data.user!.id;

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'ValidPass123!',
      });
    expect(signInError).toBeNull();
    testAccessToken = signInData.session!.access_token;
  });

  afterEach(async () => {
    await supabase.auth.signOut();
    // A deleted account's payment rows are kept with no owner (#1309), so they
    // are found by id, not by user. Remove them, then whatever is left of the
    // throwaway account.
    if (paymentIntentId) {
      await admin.from('payment_intents').delete().eq('id', paymentIntentId);
      paymentIntentId = undefined;
    }
    await admin
      .from('payment_intents')
      .delete()
      .eq('template_user_id', testUserId);
    await admin.auth.admin.deleteUser(testUserId);
  });

  it('should cascade delete user profile when auth user deleted', async () => {
    const { data: beforeProfile, error: readError } = await supabase
      .from('user_profiles')
      .select(
        'id, username, display_name, avatar_url, bio, created_at, updated_at'
      )
      .eq('id', testUserId)
      .single();

    expect(readError).toBeNull();
    expect(beforeProfile).not.toBeNull();
    expect(beforeProfile?.id).toBe(testUserId);

    const result = await callDeleteAccount(testAccessToken);
    expect(result.success).toBe(true);

    const { data: afterProfile } = await admin
      .from('user_profiles')
      .select('id')
      .eq('id', testUserId)
      .maybeSingle();

    expect(afterProfile).toBeNull();
  });

  it('should cascade delete audit logs when user deleted', async () => {
    const { error: insertError } = await admin.from('auth_audit_logs').insert({
      user_id: testUserId,
      event_type: 'sign_in_success',
      event_data: { test: true },
    });
    expect(insertError).toBeNull();

    const { data: beforeLogs, error: readError } = await admin
      .from('auth_audit_logs')
      .select('id, user_id')
      .eq('user_id', testUserId);
    expect(readError).toBeNull();
    expect(beforeLogs?.length).toBeGreaterThan(0);

    const result = await callDeleteAccount(testAccessToken);
    expect(result.success).toBe(true);

    const { data: afterLogs } = await admin
      .from('auth_audit_logs')
      .select('id')
      .eq('user_id', testUserId);
    expect(afterLogs ?? []).toHaveLength(0);
  });

  it('should delete the account and keep its payment records, ownerless', async () => {
    // A buyer's payment rows reference auth.users with ON DELETE SET NULL
    // (#1309): the delete goes through and the accounting row stays, with no
    // owner. This goes through the real Edge Function over HTTP. It goes red
    // if the function starts refusing the delete again, or if the row is
    // deleted along with the account instead of kept.
    const { data: inserted, error: insertError } = await admin
      .from('payment_intents')
      .insert({
        template_user_id: testUserId,
        amount: 1000,
        currency: 'usd',
        customer_email: testEmail,
        type: 'one_time',
      })
      .select('id')
      .single();
    expect(insertError).toBeNull();
    paymentIntentId = inserted!.id;

    const result = await callDeleteAccount(testAccessToken);
    expect(result.success).toBe(true);

    const { data: gone } = await admin.auth.admin.getUserById(testUserId);
    expect(gone?.user ?? null).toBeNull();

    const { data: kept, error: keptError } = await admin
      .from('payment_intents')
      .select('id, template_user_id, amount')
      .eq('id', paymentIntentId)
      .single();
    expect(keptError).toBeNull();
    expect(kept?.amount).toBe(1000);
    expect(kept?.template_user_id).toBeNull();
  });

  it('should prevent profile deletion by regular user', async () => {
    // Regular users cannot delete their profile directly: there is no DELETE
    // policy and authenticated holds no DELETE privilege.
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', testUserId);

    // A refusal, not an empty result: the role has no DELETE privilege at all.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    // Control: the profile is still there.
    const { data: stillThere } = await admin
      .from('user_profiles')
      .select('id')
      .eq('id', testUserId)
      .maybeSingle();
    expect(stillThere?.id).toBe(testUserId);
  });

  it('should refuse account deletion with no token', async () => {
    // The edge function itself enforces auth: a call with no user token is a
    // 401 and the account is left alone.
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);

    const { data } = await admin.auth.admin.getUserById(testUserId);
    expect(data?.user?.id).toBe(testUserId);
  });
});
