/**
 * usePaymentRealtime Hook Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';
import type { PaymentResult } from '@/types/payment';

// Create mock instances
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => ({
          data: {
            id: 'result-123',
            intent_id: 'intent-123',
            provider: 'stripe',
            transaction_id: 'txn_123',
            status: 'succeeded',
            charged_amount: 2000,
            charged_currency: 'usd',
            provider_fee: 58,
            webhook_verified: true,
            verification_method: 'webhook',
            error_code: null,
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as PaymentResult,
          error: null,
        })),
      })),
    })),
  })),
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

// Mock Supabase client module - use function to avoid hoisting issues
vi.mock('@/lib/supabase/client', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

describe('usePaymentRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial loading state', () => {
    const { result } = renderHook(() => usePaymentRealtime('test-result-123'));

    expect(result.current.loading).toBe(true);
    expect(result.current.paymentResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should load payment result', async () => {
    const { result } = renderHook(() => usePaymentRealtime('test-result-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.paymentResult).toBeTruthy();
    expect(result.current.paymentResult?.status).toBe('succeeded');
    expect(result.current.error).toBeNull();
  });

  it('should handle null paymentResultId', () => {
    const { result } = renderHook(() => usePaymentRealtime(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.paymentResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    const testError = new Error('Fetch failed');
    (mockSupabase.from as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({
            data: null,
            error: testError,
          })),
        })),
      })),
    });

    const { result } = renderHook(() => usePaymentRealtime('test-result-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.paymentResult).toBeNull();
  });

  it('should subscribe to realtime updates', async () => {
    const { result } = renderHook(() => usePaymentRealtime('test-result-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.channel).toHaveBeenCalledWith(
      'payment-result-test-result-123'
    );
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('should cleanup subscription on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      usePaymentRealtime('test-result-123')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('should resubscribe when paymentResultId changes', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => usePaymentRealtime(id),
      {
        initialProps: { id: 'result-1' },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const firstCallCount = mockSupabase.channel.mock.calls.length;

    rerender({ id: 'result-2' });

    await waitFor(() => {
      expect(mockSupabase.channel.mock.calls.length).toBeGreaterThan(
        firstCallCount
      );
    });

    expect(mockSupabase.channel).toHaveBeenCalledWith(
      'payment-result-result-2'
    );
  });

  it('should handle realtime updates', async () => {
    let realtimeCallback: ((payload: { new: PaymentResult }) => void) | null =
      null;

    mockChannel.on.mockImplementation((event, config, callback) => {
      realtimeCallback = callback;
      return mockChannel;
    });

    const { result } = renderHook(() => usePaymentRealtime('test-result-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate realtime update
    const updatedResult: PaymentResult = {
      id: 'result-123',
      intent_id: 'intent-123',
      provider: 'stripe',
      transaction_id: 'txn_123',
      status: 'refunded',
      charged_amount: 2000,
      charged_currency: 'usd',
      provider_fee: 58,
      webhook_verified: true,
      verification_method: 'webhook',
      error_code: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (realtimeCallback) {
      (realtimeCallback as any)({ new: updatedResult });
    }

    await waitFor(() => {
      expect(result.current.paymentResult?.status).toBe('refunded');
    });
  });
});
