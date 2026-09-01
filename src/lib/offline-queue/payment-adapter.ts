/**
 * Payment Queue Adapter
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Handles offline queuing for payment operations.
 *
 * Replaces the standalone Dexie implementation that lived in
 * src/lib/payments/offline-queue.ts (that file is now a re-export shim).
 *
 * @module lib/offline-queue/payment-adapter
 */

import { BaseOfflineQueue } from './base-queue';
import {
  PaymentQueueItem,
  ProcessItemResult,
  DEFAULT_QUEUE_CONFIG,
} from './types';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';

/**
 * Payment queue for offline payment operations
 *
 * @example
 * ```typescript
 * // Queue a payment intent
 * await paymentQueue.queuePaymentIntent({
 *   amount: 1000,
 *   currency: 'usd',
 *   type: 'one_time',
 *   customer_email: 'customer@example.com',
 * });
 *
 * // Process queue when back online
 * const result = await paymentQueue.sync();
 * ```
 */
export class PaymentQueueAdapter extends BaseOfflineQueue<PaymentQueueItem> {
  constructor() {
    super({
      // V2 DB name — the original src/lib/payments/offline-queue.ts used
      // Dexie with 'PaymentQueue' and indexes '++id, type, createdAt, attempts'.
      // BaseOfflineQueue sets '++id, status, createdAt, retries'. Same DB
      // name + same version + different index spec = Dexie SchemaError.
      // New DB name starts clean.
      dbName: 'PaymentQueueV2',
      tableName: 'queuedOperations',
      ...DEFAULT_QUEUE_CONFIG,
    });
  }

  /**
   * Queue a payment intent creation
   *
   * If `data.idempotency_key` is not supplied, a fresh UUID is generated
   * here at queue-time. The same key is reused across every retry of this
   * row, which combined with the partial unique index on
   * payment_intents.idempotency_key turns the server-side INSERT into an
   * idempotent ON CONFLICT DO NOTHING — a retry whose prior attempt
   * already succeeded becomes a no-op rather than a duplicate charge (#52).
   */
  async queuePaymentIntent(
    data: {
      amount: number;
      currency: string;
      type: string;
      interval?: string;
      customer_email: string;
      description?: string;
      metadata?: Record<string, unknown>;
      idempotency_key?: string;

      /** Catalog SKU, so the drain can replay through create-order (#559 T025). */
      product_id?: string;
    },
    userId?: string
  ): Promise<PaymentQueueItem> {
    const idempotency_key = data.idempotency_key ?? crypto.randomUUID();
    return await this.queue({
      type: 'payment_intent',
      data: { ...data, idempotency_key },
      userId,
    } as Omit<PaymentQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
  }

  /**
   * Queue a subscription update
   */
  async queueSubscriptionUpdate(
    subscriptionId: string,
    updates: Record<string, unknown>
  ): Promise<PaymentQueueItem> {
    return await this.queue({
      type: 'subscription_update',
      data: { id: subscriptionId, ...updates },
    } as Omit<PaymentQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
  }

  /**
   * Process a single payment queue item.
   *
   * Returns ProcessItemResult for payment_intent so the base queue can
   * distinguish a fresh INSERT from a server-side dedupe (the work was
   * already done by a prior attempt). subscription_update returns void —
   * UPDATE is implicitly idempotent by primary key, no dedupe distinction
   * needed there.
   */
  protected async processItem(
    item: PaymentQueueItem
  ): Promise<ProcessItemResult | void> {
    switch (item.type) {
      case 'payment_intent':
        return await this.executePaymentIntent(item.data, item.userId);
      case 'subscription_update':
        await this.executeSubscriptionUpdate(item.data);
        return;
      default:
        throw new Error(`Unknown payment operation type: ${item.type}`);
    }
  }

  /**
   * Execute payment intent creation.
   *
   * Prefers the userId captured at queue time (REQ-SEC-001 — the user
   * was authenticated when they made the payment). Falls back to
   * auth.getUser() if no userId was stored, matching fork behaviour.
   *
   * Uses upsert with ignoreDuplicates so the server-side INSERT is
   * idempotent across retries: a queued item whose prior attempt
   * already wrote the row produces a zero-row response, which we
   * surface as `{ status: 'conflicted' }` so the queue marks the row
   * completed without double-charging. See #52.
   */
  private async executePaymentIntent(
    data: Record<string, unknown>,
    storedUserId?: string
  ): Promise<ProcessItemResult> {
    let userId = storedUserId;

    if (!userId) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Must be authenticated to execute payment intent');
      }
      userId = user.id;
    }

    // Idempotency key: prefer the one queued at intake. If absent (older
    // queue rows from before this column shipped), generate a fresh one
    // and warn — that retry chain will dedupe with itself but not with
    // any prior attempt that lacked a key.
    let idempotencyKey = data.idempotency_key as string | undefined;
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      this.logger.warn(
        'Queued payment_intent missing idempotency_key — generating one. ' +
          'Retries of this row will dedupe; prior attempts without a key will not.',
        { generatedKey: idempotencyKey }
      );
    }

    // THROUGH create-order, NOT A DIRECT WRITE (#559 T025). The drain replays a
    // payment the buyer authorised while offline; it must price from the catalog like
    // any other purchase, because the browser no longer writes payment_intents at all.
    //
    // The queued idempotency_key becomes the REQUEST key, so a drain that runs twice —
    // two tabs, a reload mid-sync — claims the same key and create-order replays its
    // stored result instead of charging again. That is the same guarantee the old
    // `ignoreDuplicates` upsert was reaching for, from a layer that actually works:
    // that upsert could never execute (#1046), because PostgREST emits a bare
    // ON CONFLICT the partial unique index cannot be inferred from.
    const productId = data.product_id as string | undefined;
    if (!productId) {
      // A row queued before product_id shipped. Guessing a SKU would charge for
      // something nobody chose, so this fails loudly and stays in the queue.
      throw new Error(
        'Queued payment has no product_id — it predates catalog pricing and cannot be replayed'
      );
    }

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      throw new Error('Must be authenticated to execute payment intent');
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          product_id: productId,
          buyer_email: data.customer_email as string,
          amount: data.amount as number,
        }),
      }
    );
    const payload = (await res.json().catch(() => ({}))) as {
      intent_id?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(
        `Failed to create payment intent: ${payload.error || res.status}`
      );
    }
    const inserted = payload.intent_id ? { id: payload.intent_id } : null;

    if (!inserted) {
      // ON CONFLICT DO NOTHING fired — a prior attempt already created
      // this row server-side. Mark the queue row completed via the
      // dedupe path; the user is not double-charged.
      return { status: 'conflicted' };
    }

    return { status: 'completed' };
  }

  /**
   * Execute subscription update
   */
  private async executeSubscriptionUpdate(
    data: Record<string, unknown>
  ): Promise<void> {
    const { id, ...updates } = data;

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id as string);

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }
}

// Export singleton instance for convenience
export const paymentQueue = new PaymentQueueAdapter();
