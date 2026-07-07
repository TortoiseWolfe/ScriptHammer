/**
 * Offline queue management for form submissions — compatibility shim.
 *
 * Ported to BaseOfflineQueue architecture (SpokeToWork fork Feature 050).
 * The real implementation now lives in @/lib/offline-queue/form-adapter.
 * This file preserves the exact pre-port API so existing consumers
 * (background-sync.ts, useWeb3Forms.ts, offline-integration.test.tsx)
 * keep working without changes.
 *
 * Shape translation:
 *   FormQueueItem {formData, retries, createdAt, lastAttempt}
 *     ↓
 *   QueuedSubmission {data, retryCount, timestamp, lastAttempt}
 *
 * background-sync.ts reads: .id, .data, .retryCount, .lastAttempt
 */

import { formQueue } from '@/lib/offline-queue/form-adapter';
import type { FormQueueItem } from '@/lib/offline-queue/types';

/**
 * Consumer-facing queue item shape. Preserved from the original
 * raw-IndexedDB implementation for background-sync.ts compatibility.
 */
export interface QueuedSubmission {
  id?: number;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
}

/** Translate internal FormQueueItem → consumer-facing QueuedSubmission. */
function toQueuedSubmission(item: FormQueueItem): QueuedSubmission {
  return {
    id: item.id,
    data: item.formData,
    timestamp: item.createdAt,
    retryCount: item.retries,
    lastAttempt: item.lastAttempt,
  };
}

/**
 * Add form submission to offline queue.
 */
export async function addToQueue(
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    await formQueue.queueSubmission(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all queued submissions, translated to the legacy shape.
 */
export async function getQueuedItems(): Promise<QueuedSubmission[]> {
  try {
    const items = await formQueue.getQueue();
    return items.map(toQueuedSubmission);
  } catch {
    return [];
  }
}

/**
 * Remove item from queue by ID.
 */
export async function removeFromQueue(id: number): Promise<boolean> {
  try {
    await formQueue.remove(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all items from queue.
 */
export async function clearQueue(): Promise<boolean> {
  try {
    await formQueue.clear();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the number of items in queue.
 */
export async function getQueueSize(): Promise<number> {
  try {
    return await formQueue.getCount();
  } catch {
    return 0;
  }
}

/**
 * Update retry count for a submission.
 *
 * The new BaseOfflineQueue handles retries internally via sync(), but
 * background-sync.ts drives retries manually via this function. Both
 * paths update the same underlying `retries` field.
 */
export async function updateRetryCount(
  id: number,
  retryCount: number
): Promise<boolean> {
  try {
    const item = await formQueue.get(id);
    if (!item) return false;

    // Reach into the Dexie table directly — formQueue.items is protected,
    // but formQueue is a Dexie subclass so table() is public.
    await formQueue.table('submissions').update(id, {
      retries: retryCount,
      lastAttempt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open IndexedDB database.
 *
 * Kept for backwards compatibility — useWeb3Forms.test.ts mocks this
 * export by name. Returns the Dexie IDBDatabase handle.
 */
export async function openDatabase(): Promise<IDBDatabase> {
  await formQueue.open();
  // Dexie exposes the raw IDBDatabase as .backendDB()
  return formQueue.backendDB();
}
