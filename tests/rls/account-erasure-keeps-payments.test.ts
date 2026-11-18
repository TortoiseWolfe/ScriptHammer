/**
 * Deleting an account keeps the buyer's payment records, on a real database (#1309).
 *
 * Why this file exists. The fix for #1309 changed every foreign key that points at `auth.users`
 * to `ON DELETE SET NULL`, so a person who ever checked out can delete their account and the
 * business keeps its payment, subscription and order records. The unit tests read the SQL text
 * and the decision function; neither ever deleted a buyer. This one does: it builds a buyer with
 * a payment, subscriptions and an order, then runs the same `deleteAccount` code the
 * delete-account Edge Function runs, against the Supabase stack the Conformance lane builds from
 * the whole monolithic migration file.
 *
 * Two cases:
 *   - every subscription is cancelled: the delete succeeds, the three kinds of record stay, and
 *     their user link is NULL.
 *   - one subscription is still billing: the delete is refused with the plain message (the Edge
 *     Function answers 409) and the user still exists.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  type TestUser,
} from '../fixtures/test-users';
import {
  deleteAccount,
  LIVE_SUBSCRIPTION_MESSAGE,
  type AccountEraser,
} from '../../supabase/functions/delete-account/resolve';

const RUN = Date.now().toString(36);
const PRODUCT_ID = `e1460-product-${RUN}`;
const PASSWORD = 'Erasure1460Buyer!';

describe.skipIf(!hasRlsTestEnvironment())(
  `#1309 account erasure keeps payment records [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    // The service client satisfies the slice of the admin API deleteAccount uses; the cast only
    // narrows its very wide generic types to that slice.
    const admin = svc as unknown as AccountEraser;
    const created: string[] = [];

    /** A buyer with a payment, one cancelled subscription, and an order that points at both. */
    async function seedBuyer(label: string, extraSub?: { status: string }) {
      const email = `erasure1460-${label}-${RUN}@scripthammer.test`;
      const user: TestUser = await createTestUser(email, PASSWORD);
      created.push(user.id);

      const intent = await svc
        .from('payment_intents')
        .insert({
          template_user_id: user.id,
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: email,
        })
        .select('id')
        .single();
      expect(intent.error).toBeNull();

      const cancelled = await svc
        .from('subscriptions')
        .insert({
          template_user_id: user.id,
          provider: 'stripe',
          provider_subscription_id: `e1460-${label}-old-${RUN}`,
          customer_email: email,
          plan_amount: 1000,
          plan_interval: 'month',
          status: 'canceled',
        })
        .select('id')
        .single();
      expect(cancelled.error).toBeNull();

      let billingId: string | null = null;
      if (extraSub) {
        const billing = await svc
          .from('subscriptions')
          .insert({
            template_user_id: user.id,
            provider: 'stripe',
            provider_subscription_id: `e1460-${label}-live-${RUN}`,
            customer_email: email,
            plan_amount: 1000,
            plan_interval: 'month',
            status: extraSub.status,
          })
          .select('id')
          .single();
        expect(billing.error).toBeNull();
        billingId = billing.data!.id;
      }

      const order = await svc
        .from('orders')
        .insert({
          intent_id: intent.data!.id,
          product_id: PRODUCT_ID,
          buyer_user_id: user.id,
          buyer_email: email,
          amount_charged: 1000,
        })
        .select('id')
        .single();
      expect(order.error).toBeNull();

      return {
        user,
        intentId: intent.data!.id as string,
        cancelledId: cancelled.data!.id as string,
        billingId,
        orderId: order.data!.id as string,
      };
    }

    beforeAll(async () => {
      const product = await svc.from('products').insert({
        id: PRODUCT_ID,
        lane: 'service',
        name: 'Account erasure test product',
        type: 'one_time',
        amount: 1000,
      });
      expect(product.error).toBeNull();
    }, 60_000);

    afterAll(async () => {
      // The records outlive their users by design, so the users' deletion does not clear them.
      await svc.from('orders').delete().eq('product_id', PRODUCT_ID);
      await svc
        .from('subscriptions')
        .delete()
        .like('provider_subscription_id', `e1460-%-${RUN}`);
      await svc
        .from('payment_intents')
        .delete()
        .like('customer_email', `erasure1460-%-${RUN}@scripthammer.test`);
      await svc.from('products').delete().eq('id', PRODUCT_ID);
      for (const id of created) await deleteTestUser(id).catch(() => {});
    }, 60_000);

    it('deletes a buyer whose subscriptions are all cancelled and keeps their records, unlinked', async () => {
      const buyer = await seedBuyer('gone');

      const result = await deleteAccount(admin, buyer.user.id);
      expect(result).toEqual({ status: 200, body: { success: true } });

      const gone = await svc.auth.admin.getUserById(buyer.user.id);
      expect(gone.data?.user ?? null).toBeNull();

      const intent = await svc
        .from('payment_intents')
        .select('id, template_user_id, amount')
        .eq('id', buyer.intentId)
        .single();
      expect(intent.error).toBeNull();
      expect(intent.data?.template_user_id).toBeNull();
      expect(intent.data?.amount).toBe(1000);

      const sub = await svc
        .from('subscriptions')
        .select('id, template_user_id, status')
        .eq('id', buyer.cancelledId)
        .single();
      expect(sub.error).toBeNull();
      expect(sub.data?.template_user_id).toBeNull();
      expect(sub.data?.status).toBe('canceled');

      const order = await svc
        .from('orders')
        .select('id, buyer_user_id, amount_charged')
        .eq('id', buyer.orderId)
        .single();
      expect(order.error).toBeNull();
      expect(order.data?.buyer_user_id).toBeNull();
      expect(order.data?.amount_charged).toBe(1000);
    }, 60_000);

    it('refuses to delete a buyer with a subscription that is still billing', async () => {
      const buyer = await seedBuyer('billing', { status: 'active' });

      const result = await deleteAccount(admin, buyer.user.id);
      expect(result).toEqual({
        status: 409,
        body: { error: LIVE_SUBSCRIPTION_MESSAGE },
      });
      expect(LIVE_SUBSCRIPTION_MESSAGE).toBe(
        'You have a subscription that is still billing. Cancel it first, then delete your account.'
      );

      // Nothing was touched: the user is still there and still owns the billing subscription.
      const stillThere = await svc.auth.admin.getUserById(buyer.user.id);
      expect(stillThere.data?.user?.id).toBe(buyer.user.id);

      const sub = await svc
        .from('subscriptions')
        .select('template_user_id, status')
        .eq('id', buyer.billingId!)
        .single();
      expect(sub.data?.template_user_id).toBe(buyer.user.id);
      expect(sub.data?.status).toBe('active');
    }, 60_000);
  }
);
