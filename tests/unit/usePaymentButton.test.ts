import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentButton } from '@/hooks/usePaymentButton';
import { createPaymentIntent } from '@/lib/payments/payment-service';
import {
  createCheckoutSession,
  createSubscriptionCheckout,
} from '@/lib/payments/stripe';
import { renderPayPalButtons } from '@/lib/payments/paypal';

// Mock dependencies
vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: () => ({
    hasConsent: true,
    ready: true,
    requestConsent: vi.fn(),
  }),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  createPaymentIntent: vi.fn(() => Promise.resolve({ id: 'intent-123' })),
}));

vi.mock('@/lib/payments/stripe', () => ({
  createCheckoutSession: vi.fn(() => Promise.resolve()),
  createSubscriptionCheckout: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/payments/paypal', () => ({
  createPayPalOrder: vi.fn(() => Promise.resolve('paypal-order-id')),
  approvePayPalOrder: vi.fn(() => Promise.resolve({ success: true })),
  renderPayPalButtons: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/payments/offline-queue', () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
}));

// Mutable so individual tests can unset the price ID (vi.mock factories are
// hoisted, so the shared object must be hoisted too).
const mockStripeConfig = vi.hoisted(() => ({
  subscriptionPriceId: 'price_test_123',
}));
vi.mock('@/config/payment', () => ({
  stripeConfig: mockStripeConfig,
}));

describe('usePaymentButton', () => {
  const defaultOptions = {
    amount: 2000,
    currency: 'usd' as const,
    type: 'one_time' as const,
    customerEmail: 'test@example.com',
  };

  const recurringOptions = {
    ...defaultOptions,
    amount: 999,
    type: 'recurring' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeConfig.subscriptionPriceId = 'price_test_123';
  });

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

  it('routes one_time Stripe payments through intent + checkout session', async () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));

    act(() => {
      result.current.selectProvider('stripe');
    });
    await act(async () => {
      await result.current.initiatePayment();
    });

    expect(createPaymentIntent).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith('intent-123');
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('routes recurring Stripe payments through subscription checkout (no intent)', async () => {
    const { result } = renderHook(() => usePaymentButton(recurringOptions));

    act(() => {
      result.current.selectProvider('stripe');
    });
    await act(async () => {
      await result.current.initiatePayment();
    });

    expect(createSubscriptionCheckout).toHaveBeenCalledWith(
      'price_test_123',
      'test@example.com'
    );
    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('errors clearly when recurring is used without a configured price ID', async () => {
    mockStripeConfig.subscriptionPriceId = '';
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePaymentButton({ ...recurringOptions, onError })
    );

    act(() => {
      result.current.selectProvider('stripe');
    });
    await act(async () => {
      await result.current.initiatePayment();
    });

    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(result.current.error?.message).toMatch(
      /NEXT_PUBLIC_STRIPE_PRICE_ID/
    );
    expect(onError).toHaveBeenCalled();
  });

  it('refuses to mount PayPal buttons for recurring payments (#104 not wired)', async () => {
    const { result } = renderHook(() => usePaymentButton(recurringOptions));

    await act(async () => {
      await result.current.mountPayPalButtons('container-id');
    });

    expect(renderPayPalButtons).not.toHaveBeenCalled();
    expect(result.current.error?.message).toMatch(
      /PayPal subscriptions are not yet supported/
    );
  });

  it('still mounts PayPal buttons for one_time payments', async () => {
    const { result } = renderHook(() => usePaymentButton(defaultOptions));

    await act(async () => {
      await result.current.mountPayPalButtons('container-id');
    });

    expect(renderPayPalButtons).toHaveBeenCalledWith(
      'container-id',
      expect.objectContaining({
        createOrder: expect.any(Function),
        onApprove: expect.any(Function),
        onError: expect.any(Function),
      })
    );
    expect(result.current.error).toBeNull();
  });
});
