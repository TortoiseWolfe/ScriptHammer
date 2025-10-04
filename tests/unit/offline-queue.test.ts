/**
 * Offline Queue Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  queueOperation,
  getPendingOperations,
  clearQueue,
  getPendingCount,
  processPendingOperations,
} from '@/lib/payments/offline-queue';

describe('Offline Queue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('should queue a payment intent operation', async () => {
    const data = {
      amount: 2000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test@example.com',
    };

    await queueOperation('payment_intent', data);

    const count = await getPendingCount();
    expect(count).toBe(1);
  });

  it('should retrieve queued operations', async () => {
    const data = {
      amount: 2000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test@example.com',
    };

    await queueOperation('payment_intent', data);

    const operations = await getPendingOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('payment_intent');
    expect(operations[0].attempts).toBe(0);
  });

  it('should clear all queued operations', async () => {
    await queueOperation('payment_intent', {
      amount: 2000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test@example.com',
    });

    await clearQueue();

    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it('should return correct pending count', async () => {
    await queueOperation('payment_intent', {
      amount: 1000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test1@example.com',
    });

    await queueOperation('payment_intent', {
      amount: 2000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test2@example.com',
    });

    const count = await getPendingCount();
    expect(count).toBe(2);
  });

  it('should queue subscription update operations', async () => {
    await queueOperation('subscription_update', {
      id: 'sub-123',
      status: 'canceled',
    });

    const operations = await getPendingOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('subscription_update');
  });

  it('should handle multiple operations in queue', async () => {
    await queueOperation('payment_intent', {
      amount: 1000,
      currency: 'usd' as const,
      type: 'one_time' as const,
      customer_email: 'test1@example.com',
    });

    await queueOperation('subscription_update', {
      id: 'sub-123',
      status: 'canceled',
    });

    const operations = await getPendingOperations();
    expect(operations).toHaveLength(2);

    const types = operations.map((op) => op.type);
    expect(types).toContain('payment_intent');
    expect(types).toContain('subscription_update');
  });
});
