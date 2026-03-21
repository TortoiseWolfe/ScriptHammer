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
import { PaymentQueueItem, DEFAULT_QUEUE_CONFIG } from './types';
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
    },
    userId?: string
  ): Promise<PaymentQueueItem> {
    return await this.queue({
      type: 'payment_intent',
      data,
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
   * Process a single payment queue item
   */
  protected async processItem(item: PaymentQueueItem): Promise<void> {
    switch (item.type) {
      case 'payment_intent':
        await this.executePaymentIntent(item.data, item.userId);
        break;
      case 'subscription_update':
        await this.executeSubscriptionUpdate(item.data);
        break;
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
   */
  private async executePaymentIntent(
    data: Record<string, unknown>,
    storedUserId?: string
  ): Promise<void> {
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

    const { error } = await supabase
      .from('payment_intents')
      .insert({
        amount: data.amount as number,
        currency: data.currency as string,
        type: data.type as string,
        interval: (data.interval as string) || null,
        customer_email: data.customer_email as string,
        description: (data.description as string) || null,
        metadata: (data.metadata || {}) as Json,
        template_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
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
