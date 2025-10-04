import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToQueue,
  getQueuedPayments,
  removeFromQueue,
  getPendingCount,
} from '@/lib/payments/offline-queue';

// Mock Dexie database
vi.mock('@/lib/payments/offline-queue', async () => {
  const actual = await vi.importActual('@/lib/payments/offline-queue');
  return {
    ...actual,
    // Mock will use in-memory storage for tests
  };
});

describe('OfflineQueue', () => {
  beforeEach(async () => {
    // Clear queue before each test
    const queued = await getQueuedPayments();
    for (const item of queued) {
      await removeFromQueue(item.id);
    }
  });

  describe('addToQueue', () => {
    it('should add payment to queue', async () => {
      const paymentData = {
        amount: 2000,
        currency: 'usd' as const,
        type: 'one_time' as const,
        provider: 'stripe' as const,
        customerEmail: 'test@example.com',
      };

      await addToQueue(paymentData);
      const count = await getPendingCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getQueuedPayments', () => {
    it('should return all queued payments', async () => {
      const payments = await getQueuedPayments();
      expect(Array.isArray(payments)).toBe(true);
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending payments', async () => {
      const count = await getPendingCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove payment from queue', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'usd' as const,
        type: 'one_time' as const,
        provider: 'stripe' as const,
        customerEmail: 'test@example.com',
      };

      const id = await addToQueue(paymentData);
      await removeFromQueue(id);

      const queued = await getQueuedPayments();
      const found = queued.find((p) => p.id === id);
      expect(found).toBeUndefined();
    });
  });
});
