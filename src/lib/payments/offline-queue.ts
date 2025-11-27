/**
 * Offline Queue System using Dexie.js (IndexedDB)
 * Queues payment operations when offline, processes when connection returns
 */

import Dexie, { Table } from 'dexie';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import type { CreatePaymentIntentInput } from '@/types/payment';
import { createLogger } from '@/lib/logger';

const logger = createLogger('payments:queue');

export interface QueuedOperation {
  id?: number;
  type: 'payment_intent' | 'subscription_update';
  data: CreatePaymentIntentInput | Record<string, unknown>;
  createdAt: Date;
  attempts: number;
  lastError?: string;
}

/**
 * IndexedDB database for offline payment queue
 */
class PaymentQueueDB extends Dexie {
  queuedOperations!: Table<QueuedOperation>;

  constructor() {
    super('PaymentQueue');
    this.version(1).stores({
      queuedOperations: '++id, type, createdAt, attempts',
    });
  }
}

export const db = new PaymentQueueDB();

/**
 * Add operation to offline queue
 */
export async function queueOperation(
  type: QueuedOperation['type'],
  data: QueuedOperation['data']
): Promise<unknown> {
  return await db.queuedOperations.add({
    type,
    data,
    createdAt: new Date(),
    attempts: 0,
  });
}

/**
 * Process all pending operations in queue
 */
export async function processPendingOperations(): Promise<void> {
  const pending = await db.queuedOperations.toArray();

  for (const op of pending) {
    try {
      await executeOperation(op);
      // Success - remove from queue
      await db.queuedOperations.delete(op.id!);
      logger.info('Processed queued operation', {
        operationId: op.id,
        type: op.type,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update retry count and error
      await db.queuedOperations.update(op.id!, {
        attempts: op.attempts + 1,
        lastError: errorMessage,
      });

      logger.error('Failed to process operation', {
        operationId: op.id,
        attempt: op.attempts + 1,
        error: errorMessage,
      });

      // If too many attempts, remove from queue (give up)
      if (op.attempts >= 5) {
        logger.warn('Removing operation after too many failed attempts', {
          operationId: op.id,
          attempts: op.attempts + 1,
        });
        await db.queuedOperations.delete(op.id!);
      }
    }
  }
}

/**
 * Retry failed operations with exponential backoff
 */
export async function retryFailedOperations(): Promise<void> {
  const failed = await db.queuedOperations.where('attempts').above(0).toArray();

  for (const op of failed) {
    // Exponential backoff: wait 2^attempts seconds
    const backoffMs = Math.pow(2, op.attempts) * 1000;
    const timeSinceCreation = Date.now() - op.createdAt.getTime();

    if (timeSinceCreation < backoffMs) {
      logger.debug('Skipping operation - backoff not complete', {
        operationId: op.id,
        remainingSeconds: Math.round((backoffMs - timeSinceCreation) / 1000),
      });
      continue;
    }

    try {
      await executeOperation(op);
      await db.queuedOperations.delete(op.id!);
      logger.info('Retried operation successfully', {
        operationId: op.id,
        attempts: op.attempts,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await db.queuedOperations.update(op.id!, {
        attempts: op.attempts + 1,
        lastError: errorMessage,
      });
    }
  }
}

/**
 * Execute a single queued operation
 */
async function executeOperation(op: QueuedOperation): Promise<void> {
  switch (op.type) {
    case 'payment_intent':
      await executePaymentIntent(op.data as CreatePaymentIntentInput);
      break;
    case 'subscription_update':
      await executeSubscriptionUpdate(op.data as Record<string, unknown>);
      break;
    default:
      throw new Error(`Unknown operation type: ${op.type}`);
  }
}

/**
 * Execute payment intent creation
 */
async function executePaymentIntent(
  data: CreatePaymentIntentInput
): Promise<void> {
  const { data: intent, error } = await supabase
    .from('payment_intents')
    .insert({
      amount: data.amount,
      currency: data.currency,
      type: data.type,
      interval: data.interval || null,
      customer_email: data.customer_email,
      description: data.description || null,
      metadata: (data.metadata || {}) as Json,
      template_user_id: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth context
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  logger.info('Created payment intent', { intentId: intent.id });
}

/**
 * Execute subscription update
 */
async function executeSubscriptionUpdate(
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update(data)
    .eq('id', data.id as string);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  logger.info('Updated subscription', { subscriptionId: data.id });
}

/**
 * Clear all operations from queue
 */
export async function clearQueue(): Promise<void> {
  await db.queuedOperations.clear();
  logger.info('Cleared all queued operations');
}

/**
 * Get count of pending operations
 */
export async function getPendingCount(): Promise<number> {
  return await db.queuedOperations.count();
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  return await db.queuedOperations.toArray();
}
