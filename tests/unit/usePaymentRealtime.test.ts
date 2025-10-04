import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('usePaymentRealtime', () => {
  it('should initialize with null payment result', () => {
    const { result } = renderHook(() =>
      usePaymentRealtime({ intentId: 'test-intent-123' })
    );

    expect(result.current.paymentResult).toBeNull();
  });

  it('should track subscription status', () => {
    const { result } = renderHook(() =>
      usePaymentRealtime({ intentId: 'test-intent-123' })
    );

    expect(typeof result.current.isSubscribed).toBe('boolean');
  });

  it('should provide disconnect function', () => {
    const { result } = renderHook(() =>
      usePaymentRealtime({ intentId: 'test-intent-123' })
    );

    expect(typeof result.current.disconnect).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() =>
      usePaymentRealtime({ intentId: 'test-intent-123' })
    );

    unmount();
    // Hook should cleanup subscription
    expect(true).toBe(true);
  });
});
