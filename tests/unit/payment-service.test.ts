/**
 * Payment Service Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createPaymentIntent,
  formatPaymentAmount,
  getPaymentHistory,
  isPaymentIntentExpired,
} from '@/lib/payments/payment-service';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'test-user-123',
              email: 'test@example.com',
            },
          },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'test-intent-123',
              amount: 2000,
              currency: 'usd',
              type: 'one_time',
              customer_email: 'test@example.com',
              template_user_id: 'test-user-123',
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
  isSupabaseOnline: vi.fn(() => true),
}));

describe('Payment Service', () => {
  describe('createPaymentIntent', () => {
    it('should create a payment intent with correct parameters', async () => {
      const intent = await createPaymentIntent(
        2000,
        'usd',
        'one_time',
        'test@example.com'
      );

      expect(intent).toBeDefined();
      expect(intent.id).toBe('test-intent-123');
      expect(intent.amount).toBe(2000);
      expect(intent.currency).toBe('usd');
    });

    it('should throw error for invalid email', async () => {
      await expect(
        createPaymentIntent(2000, 'usd', 'one_time', 'invalid-email')
      ).rejects.toThrow('Invalid email address');
    });

    it('should accept optional parameters', async () => {
      const intent = await createPaymentIntent(
        2000,
        'usd',
        'recurring',
        'test@example.com',
        {
          interval: 'month',
          description: 'Test subscription',
          metadata: { plan: 'premium' },
        }
      );

      expect(intent).toBeDefined();
    });
  });

  describe('formatPaymentAmount', () => {
    it('should format USD correctly', () => {
      const formatted = formatPaymentAmount(2000, 'usd');
      expect(formatted).toBe('$20.00');
    });

    it('should format EUR correctly', () => {
      const formatted = formatPaymentAmount(1500, 'eur');
      expect(formatted).toBe('€15.00');
    });

    it('should format GBP correctly', () => {
      const formatted = formatPaymentAmount(3000, 'gbp');
      expect(formatted).toBe('£30.00');
    });

    it('should format CAD correctly', () => {
      const formatted = formatPaymentAmount(2500, 'cad');
      expect(formatted).toBe('CA$25.00');
    });

    it('should format AUD correctly', () => {
      const formatted = formatPaymentAmount(1800, 'aud');
      expect(formatted).toBe('AU$18.00');
    });

    it('should handle zero amount', () => {
      const formatted = formatPaymentAmount(0, 'usd');
      expect(formatted).toBe('$0.00');
    });

    it('should handle large amounts', () => {
      const formatted = formatPaymentAmount(99999, 'usd');
      expect(formatted).toBe('$999.99');
    });
  });

  describe('getPaymentHistory', () => {
    it('should retrieve payment history for authenticated user', async () => {
      const history = await getPaymentHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should accept limit parameter', async () => {
      const history = await getPaymentHistory(10);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should use default limit when not specified', async () => {
      const history = await getPaymentHistory();

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('isPaymentIntentExpired', () => {
    it('should return false for non-expired intent', () => {
      const intent = {
        id: 'test-123',
        template_user_id: 'user-123',
        amount: 2000,
        currency: 'usd' as const,
        type: 'one_time' as const,
        interval: null,
        customer_email: 'test@example.com',
        description: null,
        metadata: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };

      expect(isPaymentIntentExpired(intent)).toBe(false);
    });

    it('should return true for expired intent', () => {
      const intent = {
        id: 'test-123',
        template_user_id: 'user-123',
        amount: 2000,
        currency: 'usd' as const,
        type: 'one_time' as const,
        interval: null,
        customer_email: 'test@example.com',
        description: null,
        metadata: null,
        created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      expect(isPaymentIntentExpired(intent)).toBe(true);
    });
  });
});
