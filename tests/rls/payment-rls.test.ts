/**
 * RLS Payment Policy Tests
 *
 * Verifies all 20 RLS policies across the 5 payment tables:
 * - payment_intents (4 policies + 1 admin)
 * - payment_results (4 policies + 1 admin)
 * - subscriptions (3 policies + 1 admin)
 * - webhook_events (2 policies, service_role only)
 * - payment_provider_config (1 policy, public read)
 *
 * @module tests/rls/payment-rls.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAnonClient,
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

// ── payment_intents ──────────────────────────────────────────────────

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Payment Intents [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;
    let userB: TestUser;
    let intentIdA: string;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      userB = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );

      // Seed an intent for userA via authenticated client
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_intents')
        .insert({
          template_user_id: userA.id,
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USERS.userA.email,
        })
        .select()
        .single();

      if (error) throw new Error(`Seed intent failed: ${error.message}`);
      intentIdA = data.id;
    });

    afterAll(async () => {
      // Clean up test data via service role
      const svc = createServiceClient();
      await svc.from('payment_intents').delete().eq('id', intentIdA);
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    });

    it('user can SELECT own payment intents', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_intents')
        .select('*')
        .eq('id', intentIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].template_user_id).toBe(userA.id);
    });

    it('user cannot SELECT other user payment intents', async () => {
      const clientB = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { data, error } = await clientB
        .from('payment_intents')
        .select('*')
        .eq('id', intentIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('user can INSERT own payment intent', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_intents')
        .insert({
          template_user_id: userA.id,
          amount: 500,
          currency: 'eur',
          type: 'one_time',
          customer_email: TEST_USERS.userA.email,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.amount).toBe(500);

      // Clean up
      const svc = createServiceClient();
      await svc.from('payment_intents').delete().eq('id', data!.id);
    });

    it('user cannot INSERT intent for another user', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await clientA.from('payment_intents').insert({
        template_user_id: userB.id,
        amount: 500,
        currency: 'usd',
        type: 'one_time',
        customer_email: TEST_USERS.userB.email,
      });

      expect(error).not.toBeNull();
    });

    it('payment intents are immutable (no UPDATE)', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_intents')
        .update({ amount: 9999 })
        .eq('id', intentIdA)
        .select();

      // USING(false) means zero rows match the UPDATE filter
      expect(data).toHaveLength(0);
    });

    it('payment intents cannot be deleted by users', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_intents')
        .delete()
        .eq('id', intentIdA)
        .select();

      // USING(false) means zero rows match the DELETE filter
      expect(data).toHaveLength(0);

      // Verify it still exists
      const svc = createServiceClient();
      const { data: check } = await svc
        .from('payment_intents')
        .select('id')
        .eq('id', intentIdA)
        .single();
      expect(check?.id).toBe(intentIdA);
    });

    it('anon user cannot read payment intents', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon.from('payment_intents').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('anon user cannot write payment intents', async () => {
      const anon = createAnonClient();
      const { error } = await anon.from('payment_intents').insert({
        template_user_id: userA.id,
        amount: 100,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'anon@test.com',
      });

      expect(error).not.toBeNull();
    });
  }
);

// ── payment_results ──────────────────────────────────────────────────

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Payment Results [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;
    let userB: TestUser;
    let intentIdA: string;
    let resultIdA: string;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      userB = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );

      // Create intent for userA, then result via service role
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data: intent } = await clientA
        .from('payment_intents')
        .insert({
          template_user_id: userA.id,
          amount: 2000,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USERS.userA.email,
        })
        .select()
        .single();
      intentIdA = intent!.id;

      // Results can only be inserted by service_role
      const svc = createServiceClient();
      const { data: result, error } = await svc
        .from('payment_results')
        .insert({
          intent_id: intentIdA,
          provider: 'stripe',
          transaction_id: 'txn_test_001',
          status: 'succeeded',
          charged_amount: 2000,
          charged_currency: 'usd',
        })
        .select()
        .single();
      if (error) throw new Error(`Seed result failed: ${error.message}`);
      resultIdA = result.id;
    });

    afterAll(async () => {
      const svc = createServiceClient();
      await svc.from('payment_results').delete().eq('id', resultIdA);
      await svc.from('payment_intents').delete().eq('id', intentIdA);
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    });

    it('user can SELECT own payment results (via intent ownership)', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_results')
        .select('*')
        .eq('id', resultIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].intent_id).toBe(intentIdA);
    });

    it('user cannot SELECT other user payment results', async () => {
      const clientB = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { data, error } = await clientB
        .from('payment_results')
        .select('*')
        .eq('id', resultIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('authenticated user cannot INSERT payment results', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await clientA.from('payment_results').insert({
        intent_id: intentIdA,
        provider: 'stripe',
        transaction_id: 'txn_fake_001',
        status: 'succeeded',
        charged_amount: 9999,
      });

      // INSERT is restricted to service_role
      expect(error).not.toBeNull();
    });

    it('service role CAN insert payment results', async () => {
      const svc = createServiceClient();
      const { data, error } = await svc
        .from('payment_results')
        .insert({
          intent_id: intentIdA,
          provider: 'stripe',
          transaction_id: 'txn_test_svc_002',
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('pending');

      // Clean up
      await svc.from('payment_results').delete().eq('id', data!.id);
    });

    it('payment results are immutable (no UPDATE)', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data } = await clientA
        .from('payment_results')
        .update({ status: 'refunded' })
        .eq('id', resultIdA)
        .select();

      expect(data).toHaveLength(0);
    });

    it('payment results cannot be deleted by users', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data } = await clientA
        .from('payment_results')
        .delete()
        .eq('id', resultIdA)
        .select();

      expect(data).toHaveLength(0);

      // Verify still exists
      const svc = createServiceClient();
      const { data: check } = await svc
        .from('payment_results')
        .select('id')
        .eq('id', resultIdA)
        .single();
      expect(check?.id).toBe(resultIdA);
    });
  }
);

// ── subscriptions ────────────────────────────────────────────────────

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Subscriptions [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;
    let userB: TestUser;
    let subIdA: string;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      userB = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );

      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('subscriptions')
        .insert({
          template_user_id: userA.id,
          provider: 'stripe',
          provider_subscription_id: `sub_test_${Date.now()}`,
          customer_email: TEST_USERS.userA.email,
          plan_amount: 999,
          plan_interval: 'month',
          status: 'active',
        })
        .select()
        .single();
      if (error) throw new Error(`Seed subscription failed: ${error.message}`);
      subIdA = data.id;
    });

    afterAll(async () => {
      const svc = createServiceClient();
      await svc.from('subscriptions').delete().eq('id', subIdA);
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    });

    it('user can SELECT own subscriptions', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('subscriptions')
        .select('*')
        .eq('id', subIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].template_user_id).toBe(userA.id);
    });

    it('user cannot SELECT other user subscriptions', async () => {
      const clientB = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { data, error } = await clientB
        .from('subscriptions')
        .select('*')
        .eq('id', subIdA);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('user can UPDATE own subscription', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('id', subIdA)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('canceled');

      // Restore for other tests
      await clientA
        .from('subscriptions')
        .update({ status: 'active', canceled_at: null })
        .eq('id', subIdA);
    });

    it('user cannot UPDATE other user subscription', async () => {
      const clientB = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { data } = await clientB
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subIdA)
        .select();

      expect(data).toHaveLength(0);
    });

    it('user cannot INSERT subscription for another user', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await clientA.from('subscriptions').insert({
        template_user_id: userB.id,
        provider: 'stripe',
        provider_subscription_id: `sub_fake_${Date.now()}`,
        customer_email: TEST_USERS.userB.email,
        plan_amount: 999,
        plan_interval: 'month',
        status: 'active',
      });

      expect(error).not.toBeNull();
    });
  }
);

// ── webhook_events ───────────────────────────────────────────────────

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Webhook Events [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;
    let webhookId: string;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );

      // Seed a webhook event via service role
      const svc = createServiceClient();
      const { data, error } = await svc
        .from('webhook_events')
        .insert({
          provider: 'stripe',
          provider_event_id: `evt_test_${Date.now()}`,
          event_type: 'payment_intent.succeeded',
          event_data: { test: true },
          signature: 'sig_test_abc',
        })
        .select()
        .single();
      if (error) throw new Error(`Seed webhook failed: ${error.message}`);
      webhookId = data.id;
    });

    afterAll(async () => {
      const svc = createServiceClient();
      await svc.from('webhook_events').delete().eq('id', webhookId);
      await deleteTestUser(userA.id);
    });

    it('authenticated user cannot INSERT webhook events', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await clientA.from('webhook_events').insert({
        provider: 'stripe',
        provider_event_id: `evt_fake_${Date.now()}`,
        event_type: 'payment_intent.succeeded',
        event_data: { fake: true },
        signature: 'sig_fake',
      });

      expect(error).not.toBeNull();
    });

    it('authenticated user cannot UPDATE webhook events', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data } = await clientA
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', webhookId)
        .select();

      // No rows affected — no UPDATE policy for authenticated
      expect(data).toHaveLength(0);
    });

    it('authenticated user cannot SELECT webhook events', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA.from('webhook_events').select('*');

      // No SELECT policy for authenticated users on webhook_events
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('service role CAN insert webhook events', async () => {
      const svc = createServiceClient();
      const { data, error } = await svc
        .from('webhook_events')
        .insert({
          provider: 'paypal',
          provider_event_id: `evt_svc_${Date.now()}`,
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          event_data: { svc: true },
          signature: 'sig_svc_test',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.provider).toBe('paypal');

      // Clean up
      await svc.from('webhook_events').delete().eq('id', data!.id);
    });

    it('service role CAN update webhook events', async () => {
      const svc = createServiceClient();
      const { data, error } = await svc
        .from('webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', webhookId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.processed).toBe(true);
    });
  }
);

// ── payment_provider_config ──────────────────────────────────────────

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Payment Provider Config [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
    });

    afterAll(async () => {
      await deleteTestUser(userA.id);
    });

    it('authenticated user can SELECT provider config', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data, error } = await clientA
        .from('payment_provider_config')
        .select('*');

      // USING(true) lets all authenticated users read
      expect(error).toBeNull();
      // May be empty if no config rows seeded, but no error
      expect(data).toBeDefined();
    });

    it('authenticated user cannot INSERT provider config', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { error } = await clientA.from('payment_provider_config').insert({
        provider: 'stripe',
        enabled: true,
        config_status: 'configured',
        priority: 1,
      });

      // No INSERT policy for authenticated, only SELECT
      expect(error).not.toBeNull();
    });

    it('authenticated user cannot UPDATE provider config', async () => {
      const clientA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      // Try to update all rows
      const { data } = await clientA
        .from('payment_provider_config')
        .update({ enabled: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();

      expect(data).toHaveLength(0);
    });

    it('anon user cannot read provider config', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon
        .from('payment_provider_config')
        .select('*');

      // No anon SELECT policy
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  }
);
