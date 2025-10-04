import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPaymentIntent,
  getPaymentHistory,
  formatPaymentAmount,
} from '@/lib/payments/payment-service';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-intent-id' },
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
}));

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent', async () => {
      const result = await createPaymentIntent({
        amount: 2000,
        currency: 'usd',
        type: 'one_time',
        provider: 'stripe',
        customerEmail: 'test@example.com',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getPaymentHistory', () => {
    it('should fetch payment history for user', async () => {
      const history = await getPaymentHistory('user-123', 20);
      expect(Array.isArray(history)).toBe(true);
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
  });
});
