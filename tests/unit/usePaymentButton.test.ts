import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentButton } from '@/hooks/usePaymentButton';

// Mock dependencies
vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: () => ({
    hasConsent: true,
    requestConsent: vi.fn(),
  }),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  createPaymentIntent: vi.fn(() => Promise.resolve('intent-123')),
}));

vi.mock('@/lib/payments/stripe', () => ({
  createCheckoutSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/payments/paypal', () => ({
  createPayPalOrder: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/payments/offline-queue', () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
}));

describe('usePaymentButton', () => {
  const defaultOptions = {
    amount: 2000,
    currency: 'usd' as const,
    type: 'one_time' as const,
    customerEmail: 'test@example.com',
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));

    expect(result.current.selectedProvider).toBeNull();
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should allow selecting a provider', () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));

    act(() => {
      result.current.selectProvider('stripe');
    });

    expect(result.current.selectedProvider).toBe('stripe');
  });

  it('should have consent status', () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));
    expect(typeof result.current.hasConsent).toBe('boolean');
  });

  it('should provide initiatePayment function', () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));
    expect(typeof result.current.initiatePayment).toBe('function');
  });

  it('should provide clearError function', () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));
    expect(typeof result.current.clearError).toBe('function');
  });
});
