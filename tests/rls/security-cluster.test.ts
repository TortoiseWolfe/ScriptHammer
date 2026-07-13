/**
 * DB-contract regression tests for the security-critical bug cluster
 * (#239, #240, #241, #242).
 *
 * These run against a live Supabase instance (local via
 * `docker compose --profile supabase up`, or cloud) and pin the schema-level
 * invariants the fixes rely on. Each corresponds to a confirmed Gap-Audit bug:
 *
 *   #239  payment_results may hold at most ONE 'succeeded' row per intent
 *         (partial unique index) — PayPal redirect + webhook no longer
 *         double-count.
 *   #240  is_admin() is the single live authority — tracks the
 *         user_profiles.is_admin column, so revocation is immediate.
 *   #241  log_auth_event() writes sign-in / failed-login events (bypassing the
 *         service-role-only INSERT policy) and enforces anti-forgery.
 *   #242  a 'canceling' subscription still occupies the one-live-per-user slot,
 *         so a second subscription can't start during the paid period.
 *
 * @module tests/rls/security-cluster.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe.skipIf(!hasRlsTestEnvironment())(
  `Security cluster DB contracts [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    let user: TestUser;

    beforeAll(async () => {
      user = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
    });

    afterAll(async () => {
      // Best-effort cleanup of anything a test left behind.
      await svc.from('subscriptions').delete().eq('template_user_id', user.id);
      const { data: intents } = await svc
        .from('payment_intents')
        .select('id')
        .eq('template_user_id', user.id);
      for (const i of intents ?? []) {
        await svc.from('payment_results').delete().eq('intent_id', i.id);
      }
      await svc
        .from('payment_intents')
        .delete()
        .eq('template_user_id', user.id);
      await svc
        .from('auth_audit_logs')
        .delete()
        .like('event_data->>email', 'e241-%');
      await deleteTestUser(user.id);
    });

    // ── #239 ──────────────────────────────────────────────────────────
    it('#239: at most one succeeded payment_result per intent', async () => {
      const { data: intent, error: intentErr } = await svc
        .from('payment_intents')
        .insert({
          template_user_id: user.id,
          amount: 500,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USERS.userA.email,
        })
        .select()
        .single();
      expect(intentErr).toBeNull();

      // First succeeded row — the reconciled redirect/webhook outcome.
      const first = await svc.from('payment_results').insert({
        intent_id: intent!.id,
        provider: 'paypal',
        transaction_id: 'e239-order',
        status: 'succeeded',
      });
      expect(first.error).toBeNull();

      // Second succeeded row for the SAME intent (the old blind-insert bug) —
      // must be rejected by idx_payment_results_one_succeeded_per_intent.
      const second = await svc.from('payment_results').insert({
        intent_id: intent!.id,
        provider: 'paypal',
        transaction_id: 'e239-capture',
        status: 'succeeded',
      });
      expect(second.error).not.toBeNull();
      expect(second.error?.code).toBe('23505');

      // Exactly one succeeded row exists.
      const { count } = await svc
        .from('payment_results')
        .select('*', { count: 'exact', head: true })
        .eq('intent_id', intent!.id)
        .eq('status', 'succeeded');
      expect(count).toBe(1);
    });

    // ── #240 ──────────────────────────────────────────────────────────
    it('#240: is_admin() tracks the column live (immediate revocation)', async () => {
      await svc
        .from('user_profiles')
        .update({ is_admin: true })
        .eq('id', user.id);
      const granted = await svc.rpc('is_admin', { check_user_id: user.id });
      expect(granted.data).toBe(true);

      // Revoke the column — is_admin() must return false on the very next call.
      await svc
        .from('user_profiles')
        .update({ is_admin: false })
        .eq('id', user.id);
      const revoked = await svc.rpc('is_admin', { check_user_id: user.id });
      expect(revoked.data).toBe(false);
    });

    // ── #241 ──────────────────────────────────────────────────────────
    it('#241: log_auth_event writes a sign_in_failed row the stats can read', async () => {
      const marker = `e241-${user.id}`;
      const res = await svc.rpc('log_auth_event', {
        p_event_type: 'sign_in_failed',
        // p_user_id omitted → anonymous (no session on a failed login)
        p_event_data: { email: marker, provider: 'email' },
        p_success: false,
        p_error_message: 'Invalid login credentials',
        p_user_agent: 'test',
      });
      expect(res.error).toBeNull();

      const { data: rows } = await svc
        .from('auth_audit_logs')
        .select('event_type, success')
        .eq('event_data->>email', marker);
      expect(rows?.length).toBe(1);
      expect(rows?.[0].event_type).toBe('sign_in_failed');
      expect(rows?.[0].success).toBe(false);
    });

    it('#241: log_auth_event refuses to attribute an event to another user', async () => {
      // service_role has auth.uid()=NULL; logging for a real user must raise.
      const res = await svc.rpc('log_auth_event', {
        p_event_type: 'sign_in_success',
        p_user_id: user.id, // not the caller (anon) → anti-forgery guard fires
      });
      expect(res.error).not.toBeNull();
    });

    // ── #242 ──────────────────────────────────────────────────────────
    it('#242: a canceling subscription still blocks a second live subscription', async () => {
      const first = await svc.from('subscriptions').insert({
        template_user_id: user.id,
        provider: 'stripe',
        provider_subscription_id: 'e242-sub-1',
        customer_email: TEST_USERS.userA.email,
        plan_amount: 1000,
        plan_interval: 'month',
        status: 'active',
      });
      expect(first.error).toBeNull();

      // User cancels (Stripe cancel-at-period-end) → 'canceling', still live.
      await svc
        .from('subscriptions')
        .update({ status: 'canceling' })
        .eq('provider_subscription_id', 'e242-sub-1');

      // Starting a SECOND subscription during the canceling window must be
      // rejected by idx_subscriptions_one_live_per_user.
      const second = await svc.from('subscriptions').insert({
        template_user_id: user.id,
        provider: 'stripe',
        provider_subscription_id: 'e242-sub-2',
        customer_email: TEST_USERS.userA.email,
        plan_amount: 1000,
        plan_interval: 'month',
        status: 'active',
      });
      expect(second.error).not.toBeNull();
      expect(second.error?.code).toBe('23505');

      // Resume restores it to active.
      const resume = await svc
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('provider_subscription_id', 'e242-sub-1');
      expect(resume.error).toBeNull();
    });
  }
);
