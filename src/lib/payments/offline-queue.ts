/**
 * Offline Queue System for payments — compatibility shim.
 *
 * Ported to BaseOfflineQueue architecture (SpokeToWork fork Feature 050).
 * The real implementation now lives in @/lib/offline-queue/payment-adapter.
 * This file preserves the exact pre-port API so existing consumers
 * (payment-service.ts, usePaymentButton.ts) keep working without changes.
 *
 * Key preservation: queueOperation keeps its 3-arg signature
 * (type, data, userId?) — payment-service.ts:95,127 passes userId at
 * queue time per REQ-SEC-001.
 */

import { paymentQueue } from '@/lib/offline-queue/payment-adapter';
import type { PaymentQueueItem } from '@/lib/offline-queue/types';
import type { CreatePaymentIntentInput } from '@/types/payment';

/**
 * Consumer-facing queued operation shape. Preserved from the original
 * standalone Dexie implementation.
 */
export interface QueuedOperation {
  id?: number;
  type: 'payment_intent' | 'subscription_update';
  data: CreatePaymentIntentInput | Record<string, unknown>;
  userId?: string;
  createdAt: Date;
  attempts: number;
  lastError?: string;
}

/** Translate internal PaymentQueueItem → consumer-facing QueuedOperation. */
function toQueuedOperation(item: PaymentQueueItem): QueuedOperation {
  return {
    id: item.id,
    type: item.type,
    data: item.data,
    userId: item.userId,
    createdAt: new Date(item.createdAt),
    attempts: item.retries,
    lastError: item.lastError,
  };
}

/**
 * Add operation to offline queue.
 *
 * Signature matches the original — payment-service.ts calls this with
 * `queueOperation('payment_intent', intentData, userId)`. The fork
 * dropped the userId arg; we keep it because REQ-SEC-001 requires
 * binding the payment to the user authenticated at queue time.
 */
export async function queueOperation(
  type: QueuedOperation['type'],
  data: QueuedOperation['data'],
  userId?: string
): Promise<unknown> {
  const item = await paymentQueue.queue({
    type,
    data: data as Record<string, unknown>,
    userId,
  } as Omit<PaymentQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
  return item.id;
}

/**
 * Process all pending operations in queue.
 */
export async function processPendingOperations(): Promise<void> {
  await paymentQueue.sync();
}

/**
 * Retry failed operations. The new base queue's sync() already respects
 * exponential backoff windows, so this is now equivalent to resetting
 * failed items and re-syncing.
 */
export async function retryFailedOperations(): Promise<void> {
  await paymentQueue.retryFailed();
  await paymentQueue.sync();
}

/**
 * Clear all operations from queue.
 */
export async function clearQueue(): Promise<void> {
  await paymentQueue.clear();
}

/**
 * Get count of pending operations.
 */
export async function getPendingCount(): Promise<number> {
  return await paymentQueue.getCount();
}

/**
 * Get all pending operations, translated to the legacy shape.
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const items = await paymentQueue.getQueue();
  return items.map(toQueuedOperation);
}

/**
 * Direct access to the underlying adapter. The old export was the raw
 * Dexie DB instance; the adapter is a Dexie subclass so most use cases
 * still work, but if anything was poking at `db.queuedOperations` directly
 * it would need updating. (No consumers do — verified via grep.)
 */
export const db = paymentQueue;
