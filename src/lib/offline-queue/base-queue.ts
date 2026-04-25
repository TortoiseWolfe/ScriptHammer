/**
 * Base Offline Queue - Dexie.js Implementation
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Provides base class for all offline queue adapters with:
 * - Dexie.js database management
 * - Exponential backoff retry logic
 * - Common CRUD operations
 *
 * @module lib/offline-queue/base-queue
 */

import Dexie, { Table } from 'dexie';
import {
  BaseQueueItem,
  QueueConfig,
  QueueStatus,
  SyncResult,
  DEFAULT_QUEUE_CONFIG,
} from './types';
import { createLogger } from '@/lib/logger';

/**
 * Abstract base class for offline queues
 *
 * @typeParam T - Queue item type extending BaseQueueItem
 *
 * @example
 * ```typescript
 * class FormQueue extends BaseOfflineQueue<FormQueueItem> {
 *   constructor() {
 *     super({
 *       dbName: 'FormQueue',
 *       tableName: 'submissions',
 *       ...DEFAULT_QUEUE_CONFIG
 *     });
 *   }
 *
 *   protected async processItem(item: FormQueueItem): Promise<void> {
 *     // Submit form to server
 *   }
 * }
 * ```
 */
export abstract class BaseOfflineQueue<T extends BaseQueueItem> extends Dexie {
  /** Queue items table */
  protected items!: Table<T>;

  /** Configuration */
  protected config: QueueConfig;

  /** Logger instance */
  protected logger;

  /** Flag to prevent concurrent sync operations */
  private syncInProgress = false;

  constructor(config: QueueConfig) {
    super(config.dbName);

    this.config = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    };

    this.logger = createLogger(`offline-queue:${config.dbName}`);

    // Define schema — subclasses can bump version if they need extra indexes
    this.version(1).stores({
      [config.tableName]: '++id, status, createdAt, retries',
    });

    // Map table
    this.items = this.table(config.tableName);
  }

  /**
   * Add item to the queue
   *
   * @param item - Item to queue (without id, status, retries, createdAt)
   * @returns The queued item with generated fields
   */
  async queue(
    item: Omit<T, 'id' | 'status' | 'retries' | 'createdAt'>
  ): Promise<T> {
    const queuedItem = {
      ...item,
      status: 'pending' as QueueStatus,
      retries: 0,
      createdAt: Date.now(),
    } as T;

    const id = await this.items.add(queuedItem);

    this.logger.debug('Item queued', { id });

    return { ...queuedItem, id } as T;
  }

  /**
   * Get all items in the queue
   *
   * @param status - Optional status filter
   * @returns Array of queue items
   */
  async getQueue(status?: QueueStatus): Promise<T[]> {
    if (status) {
      return await this.items
        .where('status')
        .equals(status)
        .sortBy('createdAt');
    }
    return await this.items.orderBy('createdAt').toArray();
  }

  /**
   * Get pending items (not yet processed or failed)
   */
  async getPending(): Promise<T[]> {
    return await this.items
      .where('status')
      .anyOf(['pending', 'processing'])
      .sortBy('createdAt');
  }

  /**
   * Get count of items by status
   */
  async getCount(status?: QueueStatus): Promise<number> {
    if (status) {
      return await this.items.where('status').equals(status).count();
    }
    return await this.items.count();
  }

  /**
   * Get a single item by ID
   */
  async get(id: number): Promise<T | undefined> {
    return await this.items.get(id);
  }

  /**
   * Remove item from queue
   */
  async remove(id: number): Promise<void> {
    await this.items.delete(id);
    this.logger.debug('Item removed', { id });
  }

  /**
   * Clear all items from queue
   */
  async clear(): Promise<void> {
    await this.items.clear();
    this.logger.info('Queue cleared');
  }

  /**
   * Clear only completed items
   */
  async clearCompleted(): Promise<number> {
    const count = await this.items.where('status').equals('completed').delete();
    this.logger.debug('Cleared completed items', { count });
    return count;
  }

  /**
   * Process the queue - sync all pending items
   *
   * @returns Sync result with success/failed counts
   */
  async sync(): Promise<SyncResult> {
    // Prevent concurrent sync
    if (this.syncInProgress) {
      this.logger.debug('Sync already in progress, skipping');
      return { success: 0, failed: 0, skipped: 0 };
    }

    this.syncInProgress = true;

    try {
      const pending = await this.getPending();

      if (pending.length === 0) {
        return { success: 0, failed: 0, skipped: 0 };
      }

      this.logger.info('Starting sync', { itemCount: pending.length });

      let success = 0;
      let failed = 0;
      let skipped = 0;

      for (const item of pending) {
        // Check if max retries exceeded
        if (item.retries >= this.config.maxRetries) {
          await this.markAsFailed(item.id!);
          failed++;
          continue;
        }

        // Check backoff (skip if still in backoff period)
        if (item.retries > 0 && item.lastAttempt) {
          const backoffMs = this.getRetryDelay(item.retries);
          const timeSinceLastAttempt = Date.now() - item.lastAttempt;

          if (timeSinceLastAttempt < backoffMs) {
            skipped++;
            continue;
          }
        }

        // Atomically claim the item: only succeeds if status is still
        // 'pending'. This prevents a second tab (or another sync invocation
        // racing through navigator.onLine) from also claiming the same
        // item — `syncInProgress` is per-instance and IndexedDB is shared
        // across tabs, so without this guard the same payment intent or
        // message could be submitted twice. Dexie's where().modify()
        // executes inside an implicit transaction.
        const claimed = await this.items
          .where('id')
          .equals(item.id!)
          .and((row) => row.status === 'pending')
          .modify({
            status: 'processing',
            lastAttempt: Date.now(),
          } as any);

        if (claimed === 0) {
          // Another tab beat us to it.
          this.logger.debug('Item already claimed by another tab, skipping', {
            id: item.id,
          });
          skipped++;
          continue;
        }

        try {
          // Process the item (implemented by subclass)
          await this.processItem(item);

          // Mark as completed

          await this.items.update(item.id!, {
            status: 'completed',
          } as any);

          success++;
          this.logger.debug('Item processed successfully', { id: item.id });
        } catch (error) {
          // Record failed attempt
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          await this.items.update(item.id!, {
            status: 'pending',
            retries: item.retries + 1,
            lastError: errorMessage,
          } as any);

          this.logger.warn('Item processing failed', {
            id: item.id,
            retries: item.retries + 1,
            error: errorMessage,
          });

          // Check if now exceeded max retries
          if (item.retries + 1 >= this.config.maxRetries) {
            await this.markAsFailed(item.id!);
          }

          failed++;
        }
      }

      this.logger.info('Sync complete', { success, failed, skipped });
      return { success, failed, skipped };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Calculate retry delay using exponential backoff
   *
   * @param retryCount - Current retry count
   * @returns Delay in milliseconds
   *
   * @example
   * // With default config (initialDelayMs=1000, backoffMultiplier=2):
   * // Retry 1: 1000ms (1s)
   * // Retry 2: 2000ms (2s)
   * // Retry 3: 4000ms (4s)
   * // Retry 4: 8000ms (8s)
   * // Retry 5: 16000ms (16s)
   */
  getRetryDelay(retryCount: number): number {
    return (
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, retryCount - 1)
    );
  }

  /**
   * Mark item as permanently failed
   */
  protected async markAsFailed(id: number): Promise<void> {
    await this.items.update(id, {
      status: 'failed',
    } as any);
    this.logger.warn('Item marked as failed', { id });
  }

  /**
   * Reset failed items to pending (for manual retry)
   *
   * @returns Number of items reset
   */
  async retryFailed(): Promise<number> {
    const failed = await this.items.where('status').equals('failed').toArray();

    for (const item of failed) {
      await this.items.update(item.id!, {
        status: 'pending',
        retries: 0,
        lastError: undefined,
      } as any);
    }

    this.logger.info('Reset failed items', { count: failed.length });
    return failed.length;
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * Process a single queue item
   * Must be implemented by subclasses with domain-specific logic
   *
   * @param item - Item to process
   * @throws Error if processing fails (will trigger retry)
   */
  protected abstract processItem(item: T): Promise<void>;
}
