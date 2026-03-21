/**
 * Unit Tests for BaseOfflineQueue
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Tests the abstract base queue class functionality:
 * - Queue operations (add, get, remove, clear)
 * - Sync with retry logic
 * - Exponential backoff calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseOfflineQueue } from '../base-queue';
import { BaseQueueItem, DEFAULT_QUEUE_CONFIG } from '../types';

// Concrete implementation for testing
interface TestQueueItem extends BaseQueueItem {
  data: string;
}

// Unique DB per process — avoids collision if another test file opened
// a Dexie DB named 'TestQueue' with a different schema.
const TEST_DB_NAME = `TestQueue_${process.pid}`;

class TestQueue extends BaseOfflineQueue<TestQueueItem> {
  public processedItems: TestQueueItem[] = [];
  public shouldFail = false;
  public failCount = 0;

  constructor() {
    super({
      dbName: TEST_DB_NAME,
      tableName: 'testItems',
      ...DEFAULT_QUEUE_CONFIG,
    });
  }

  protected async processItem(item: TestQueueItem): Promise<void> {
    if (this.shouldFail) {
      this.failCount++;
      throw new Error('Test failure');
    }
    this.processedItems.push(item);
  }

  // Expose protected method for testing
  public async testMarkAsFailed(id: number): Promise<void> {
    await this.markAsFailed(id);
  }
}

describe('BaseOfflineQueue', () => {
  let queue: TestQueue;

  beforeEach(async () => {
    queue = new TestQueue();
    // Clear any existing data
    await queue.clear();
  });

  afterEach(async () => {
    await queue.clear();
    queue.close();
  });

  describe('queue()', () => {
    it('should add item to queue with generated fields', async () => {
      const item = await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      expect(item.id).toBeDefined();
      expect(item.status).toBe('pending');
      expect(item.retries).toBe(0);
      expect(item.createdAt).toBeDefined();
      expect(item.data).toBe('test');
    });

    it('should increment IDs for multiple items', async () => {
      const item1 = await queue.queue({ data: 'first' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      const item2 = await queue.queue({ data: 'second' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      expect(item2.id).toBeGreaterThan(item1.id!);
    });
  });

  describe('getQueue()', () => {
    it('should return all items when no status filter', async () => {
      await queue.queue({ data: 'one' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.queue({ data: 'two' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      const items = await queue.getQueue();
      expect(items).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const item = await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.testMarkAsFailed(item.id!);

      const pending = await queue.getQueue('pending');
      const failed = await queue.getQueue('failed');

      expect(pending).toHaveLength(0);
      expect(failed).toHaveLength(1);
    });
  });

  describe('getCount()', () => {
    it('should return total count', async () => {
      await queue.queue({ data: 'one' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.queue({ data: 'two' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      const count = await queue.getCount();
      expect(count).toBe(2);
    });

    it('should return count by status', async () => {
      await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      const pendingCount = await queue.getCount('pending');
      const failedCount = await queue.getCount('failed');

      expect(pendingCount).toBe(1);
      expect(failedCount).toBe(0);
    });
  });

  describe('remove()', () => {
    it('should remove item from queue', async () => {
      const item = await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      await queue.remove(item.id!);

      const count = await queue.getCount();
      expect(count).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should remove all items', async () => {
      await queue.queue({ data: 'one' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.queue({ data: 'two' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      await queue.clear();

      const count = await queue.getCount();
      expect(count).toBe(0);
    });
  });

  describe('sync()', () => {
    it('should process pending items', async () => {
      await queue.queue({ data: 'one' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.queue({ data: 'two' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      const result = await queue.sync();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(queue.processedItems).toHaveLength(2);
    });

    it('should mark items as completed after processing', async () => {
      await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);

      await queue.sync();

      const completed = await queue.getQueue('completed');
      expect(completed).toHaveLength(1);
    });

    it('should increment retry count on failure', async () => {
      const item = await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      queue.shouldFail = true;

      await queue.sync();

      const updated = await queue.get(item.id!);
      expect(updated?.retries).toBe(1);
    });

    it('should return skipped count when sync in progress', async () => {
      // Start first sync
      const syncPromise = queue.sync();

      // Try second sync immediately
      const result = await queue.sync();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);

      await syncPromise;
    });

    it('should return empty result when no pending items', async () => {
      const result = await queue.sync();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('getRetryDelay()', () => {
    it('should calculate exponential backoff', () => {
      // Default: initialDelayMs=1000, backoffMultiplier=2
      expect(queue.getRetryDelay(1)).toBe(1000); // 1s
      expect(queue.getRetryDelay(2)).toBe(2000); // 2s
      expect(queue.getRetryDelay(3)).toBe(4000); // 4s
      expect(queue.getRetryDelay(4)).toBe(8000); // 8s
      expect(queue.getRetryDelay(5)).toBe(16000); // 16s
    });
  });

  describe('retryFailed()', () => {
    it('should reset failed items to pending', async () => {
      const item = await queue.queue({ data: 'test' } as Omit<
        TestQueueItem,
        'id' | 'status' | 'retries' | 'createdAt'
      >);
      await queue.testMarkAsFailed(item.id!);

      const resetCount = await queue.retryFailed();

      expect(resetCount).toBe(1);
      const updated = await queue.get(item.id!);
      expect(updated?.status).toBe('pending');
      expect(updated?.retries).toBe(0);
    });
  });

  describe('isSyncing()', () => {
    it('should return false when not syncing', () => {
      expect(queue.isSyncing()).toBe(false);
    });
  });
});
