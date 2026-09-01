/**
 * Payment Service Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import * as paymentService from '@/lib/payments/payment-service';
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
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: {
                id: 'test-user-123',
                email: 'test@example.com',
              },
              access_token: 'test-access-token',
            },
          },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      // ONE `select` key. There used to be two in this literal — a later duplicate
      // silently overwrote the earlier one, because in an object literal the last key
      // wins. The chain therefore has to serve both shapes createPaymentIntent and the
      // history queries use: .eq().single() reads one row back after create-order
      // wrote it (#559 T025), .eq().order().limit() lists.
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
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
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
  isSupabaseOnline: vi.fn(() => true),
}));

describe('Payment Service', () => {
  it('does not expose client-side payment-intent cancellation', () => {
    // payment_intents are immutable and their DELETE RLS policy always denies
    // client deletion. Keeping a public cancel helper here would report success
    // after a zero-row delete, so cancellation needs a real server-side state
    // transition before it can be offered again (#565).
    expect(paymentService).not.toHaveProperty('cancelPaymentIntent');
  });

  describe('createPaymentIntent', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ intent_id: 'test-intent-123' }),
        }))
      );
    });

    it('prices through create-order and returns the row it wrote', async () => {
      const intent = await createPaymentIntent(
        2000,
        'usd',
        'one_time',
        'test@example.com',
        { product_id: 'demo-checkout' }
      );

      expect(intent).toBeDefined();
      expect(intent.id).toBe('test-intent-123');
      expect(intent.amount).toBe(2000);
      expect(intent.currency).toBe('usd');

      // The catalog SKU is what the server prices from; `amount` is only a request.
      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.product_id).toBe('demo-checkout');
      expect(body.buyer_email).toBe('test@example.com');
    });

    it('refuses without a product_id, before making any request (#559 T025)', async () => {
      // The browser cannot name a price any more. Failing here is louder than
      // letting create-order return a generic 400.
      await expect(
        createPaymentIntent(2000, 'usd', 'one_time', 'test@example.com')
      ).rejects.toThrow(/product_id is required/);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error for invalid email', async () => {
      await expect(
        createPaymentIntent(2000, 'usd', 'one_time', 'invalid-email', {
          product_id: 'demo-checkout',
        })
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
          product_id: 'svc-care',
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
        idempotency_key: null,
        retry_count: 0,
        parent_intent_id: null,
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
        idempotency_key: null,
        retry_count: 0,
        parent_intent_id: null,
        created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      expect(isPaymentIntentExpired(intent)).toBe(true);
    });
  });
});
