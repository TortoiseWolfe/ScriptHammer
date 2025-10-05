/**
 * Offline Queue System using Dexie.js (IndexedDB)
 * Queues payment operations when offline, processes when connection returns
 */

import Dexie, { Table } from 'dexie';
import { supabase } from '@/lib/supabase/client';
import type { CreatePaymentIntentInput } from '@/types/payment';

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
      console.log(`✅ Processed queued operation ${op.id} (${op.type})`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update retry count and error
      await db.queuedOperations.update(op.id!, {
        attempts: op.attempts + 1,
        lastError: errorMessage,
      });

      console.error(
        `❌ Failed to process operation ${op.id} (attempt ${op.attempts + 1}):`,
        errorMessage
      );

      // If too many attempts, remove from queue (give up)
      if (op.attempts >= 5) {
        console.warn(
          `🗑️  Removing operation ${op.id} after ${op.attempts + 1} failed attempts`
        );
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
      console.log(
        `⏳ Skipping operation ${op.id} - backoff not complete (${Math.round((backoffMs - timeSinceCreation) / 1000)}s remaining)`
      );
      continue;
    }

    try {
      await executeOperation(op);
      await db.queuedOperations.delete(op.id!);
      console.log(
        `✅ Retried operation ${op.id} successfully after ${op.attempts} attempts`
      );
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
      metadata: data.metadata || {},
      template_user_id: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth context
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  console.log('✅ Created payment intent:', intent.id);
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
    .eq('id', data.id);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log('✅ Updated subscription:', data.id);
}

/**
 * Clear all operations from queue
 */
export async function clearQueue(): Promise<void> {
  await db.queuedOperations.clear();
  console.log('🗑️  Cleared all queued operations');
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
