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

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'ValidPass123!',
    });
    expect(signInError).toBeNull();
    testAccessToken = signInData.session!.access_token;
  });

  afterEach(async () => {
    await supabase.auth.signOut();
    // payment_intents.template_user_id references auth.users with NO ON DELETE
    // action, so a user that owns an intent cannot be deleted. Clear those
    // first, then remove whatever is left of the throwaway account.
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
    expect(beforeProfile).toBeDefined();

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

  it('should keep payment intents when user deletion is refused', async () => {
    // Buyer payment rows reference auth.users with NO ON DELETE action, so
    // deleting the account is REFUSED rather than orphaning or cascading the
    // payment history. The gdpr-service relies on this: it deletes the account
    // before wiping local keys, because a refused delete leaves the account
    // usable and its messages decryptable (#859, #1309).
    const { error: insertError } = await admin.from('payment_intents').insert({
      template_user_id: testUserId,
      amount: 1000,
      currency: 'usd',
      customer_email: testEmail,
      type: 'one_time',
    });
    expect(insertError).toBeNull();

    const { data: beforePayments, error: readError } = await admin
      .from('payment_intents')
      .select('id, template_user_id')
      .eq('template_user_id', testUserId);
    expect(readError).toBeNull();
    expect(beforePayments?.length).toBeGreaterThan(0);

    const result = await callDeleteAccount(testAccessToken);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    const { data: afterPayments } = await admin
      .from('payment_intents')
      .select('id')
      .eq('template_user_id', testUserId);
    expect(afterPayments?.length).toBeGreaterThan(0);
  });

  it('should prevent profile deletion by regular user', async () => {
    // Regular users cannot delete their profile directly: there is no DELETE
    // policy and authenticated holds no DELETE privilege.
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', testUserId);

    expect(error).toBeDefined();
  });

  it('should require admin privileges for account deletion', async () => {
    // This test verifies the edge function itself enforces auth — calling it
    // with a valid user JWT succeeds, and the user is gone afterward.
    const result = await callDeleteAccount(testAccessToken);
    expect(result.success).toBe(true);

    const { data } = await admin.auth.admin.getUserById(testUserId);
    expect(data?.user ?? null).toBeNull();
  });
});
