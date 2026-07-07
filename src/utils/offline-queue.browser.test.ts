/**
 * @vitest-environment jsdom
 * Browser-only tests for IndexedDB offline queue functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addToQueue,
  getQueuedItems,
  removeFromQueue,
  clearQueue,
  getQueueSize,
  updateRetryCount,
} from './offline-queue';

// Skip in Node environment where IndexedDB isn't available
const isBrowser = typeof window !== 'undefined' && 'indexedDB' in window;

describe.skipIf(!isBrowser)('Offline Queue - Real IndexedDB', () => {
  beforeEach(async () => {
    // Clear any existing data
    if (isBrowser) {
      await clearQueue().catch(() => {});
    }
  });

  afterEach(async () => {
    // Clean up after tests
    if (isBrowser) {
      await clearQueue().catch(() => {});
    }
  });

  describe('Basic Queue Operations', () => {
    it('should add items to queue and retrieve them', async () => {
      const testData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
      };

      // Add to queue
      const added = await addToQueue(testData);
      expect(added).toBe(true);

      // Get queue size
      const size = await getQueueSize();
      expect(size).toBe(1);

      // Retrieve items
      const items = await getQueuedItems();
      expect(items).toHaveLength(1);
      expect(items[0].data).toEqual(testData);
      expect(items[0].timestamp).toBeDefined();
      expect(items[0].retryCount).toBe(0);
    });

    it('should handle multiple items in queue', async () => {
      const items = [
        { name: 'User 1', email: 'user1@test.com', message: 'Message 1' },
        { name: 'User 2', email: 'user2@test.com', message: 'Message 2' },
        { name: 'User 3', email: 'user3@test.com', message: 'Message 3' },
      ];

      // Add multiple items
      for (const item of items) {
        await addToQueue(item);
      }

      // Check size
      const size = await getQueueSize();
      expect(size).toBe(3);

      // Retrieve all
      const queued = await getQueuedItems();
      expect(queued).toHaveLength(3);
    });

    it('should remove specific item from queue', async () => {
      // Add items
      await addToQueue({ name: 'Item 1' });
      await addToQueue({ name: 'Item 2' });
      await addToQueue({ name: 'Item 3' });

      // Get items to find ID
      const items = await getQueuedItems();
      expect(items).toHaveLength(3);

      // Remove middle item
      const removed = await removeFromQueue(items[1].id!);
      expect(removed).toBe(true);

      // Check remaining items
      const remaining = await getQueuedItems();
      expect(remaining).toHaveLength(2);
      expect(remaining.find((item) => item.id === items[1].id)).toBeUndefined();
    });

    it('should clear entire queue', async () => {
      // Add multiple items
      await addToQueue({ name: 'Item 1' });
      await addToQueue({ name: 'Item 2' });
      await addToQueue({ name: 'Item 3' });

      // Verify they exist
      let size = await getQueueSize();
      expect(size).toBe(3);

      // Clear queue
      const cleared = await clearQueue();
      expect(cleared).toBe(true);

      // Verify empty
      size = await getQueueSize();
      expect(size).toBe(0);

      const items = await getQueuedItems();
      expect(items).toHaveLength(0);
    });

    it('should update retry count for submission', async () => {
      // Add item
      await addToQueue({ name: 'Test Item' });

      // Get item to find ID
      const items = await getQueuedItems();
      expect(items).toHaveLength(1);
      expect(items[0].retryCount).toBe(0);

      // Update retry count
      const updated = await updateRetryCount(items[0].id!, 3);
      expect(updated).toBe(true);

      // Verify update
      const updatedItems = await getQueuedItems();
      expect(updatedItems[0].retryCount).toBe(3);
      expect(updatedItems[0].lastAttempt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle removing non-existent item', async () => {
      const removed = await removeFromQueue(99999);
      expect(removed).toBe(true); // Transaction completes even if item doesn't exist
    });

    it('should handle updating non-existent item retry count', async () => {
      const updated = await updateRetryCount(99999, 1);
      expect(updated).toBe(false);
    });
  });
});
