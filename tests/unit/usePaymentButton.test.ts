import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentButton } from '@/hooks/usePaymentButton';
import { createPaymentIntent } from '@/lib/payments/payment-service';
import {
  createCheckoutSession,
  createSubscriptionCheckout,
} from '@/lib/payments/stripe';
import { renderPayPalButtons } from '@/lib/payments/paypal';
import { createPayPalSubscription } from '@/lib/payments/paypal';

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
  createPayPalSubscription: vi.fn(() => Promise.resolve('paypal-sub-id')),
  renderPayPalButtons: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/payments/offline-queue', () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
}));

// Mutable so individual tests can unset the price/plan ids (vi.mock factories
// are hoisted, so the shared objects must be hoisted too).
// stripeConfig no longer carries a subscription price — the price is resolved
// server-side from products.stripe_price_id (#772). Kept as an empty object so
// the module mock still supplies the export the hook's module graph expects.
const mockStripeConfig = vi.hoisted(() => ({}));
// Empty for the same reason as mockStripeConfig above: the only field the hook
// read was subscriptionPlanId, and that is gone (#774). The PayPal plan is now
// resolved server-side from products.paypal_plan_id.
const mockPaypalConfig = vi.hoisted(() => ({}));
vi.mock('@/config/payment', () => ({
  stripeConfig: mockStripeConfig,
  paypalConfig: mockPaypalConfig,
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
    // The catalog SKU. The server resolves its price; the client never names one.
    productId: 'svc-care',
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

    // The SKU, not a price. #772: this used to assert a price id that came from
    // one global env var and was therefore identical for every tier.
    expect(createSubscriptionCheckout).toHaveBeenCalledWith(
      'svc-care',
      'test@example.com'
    );
    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('THE #772 REGRESSION: two tiers send two different SKUs', async () => {
    // The original bug returned a valid price id every time — just the SAME one,
    // from one global env var. So "a price id was sent" passes on the bug and
    // proves nothing. Only comparing two tiers catches it.
    for (const sku of ['svc-care', 'svc-care-pro']) {
      const { result } = renderHook(() =>
        usePaymentButton({ ...recurringOptions, productId: sku })
      );
      act(() => {
        result.current.selectProvider('stripe');
      });
      await act(async () => {
        await result.current.initiatePayment();
      });
    }

    const sent = (
      createSubscriptionCheckout as unknown as {
        mock: { calls: unknown[][] };
      }
    ).mock.calls.map((c) => c[0]);
    expect(sent).toEqual(['svc-care', 'svc-care-pro']);
    expect(new Set(sent).size).toBe(2);
  });

  it('errors clearly when a recurring payment names no product', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePaymentButton({ ...recurringOptions, productId: undefined, onError })
    );

    act(() => {
      result.current.selectProvider('stripe');
    });
    await act(async () => {
      await result.current.initiatePayment();
    });

    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(result.current.error?.message).toMatch(/productId/);
    expect(onError).toHaveBeenCalled();
  });

  it('mounts PayPal subscription buttons for recurring payments (#104)', async () => {
    const { result } = renderHook(() => usePaymentButton(recurringOptions));

    await act(async () => {
      await result.current.mountPayPalButtons('container-id');
    });

    // Subscription mode uses createSubscription (not createOrder), driving
    // the configured Plan; no one-time order is created.
    expect(renderPayPalButtons).toHaveBeenCalledWith(
      'container-id',
      expect.objectContaining({
        createSubscription: expect.any(Function),
        onApprove: expect.any(Function),
        onError: expect.any(Function),
      })
    );
    const call = (renderPayPalButtons as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(call.createOrder).toBeUndefined();
    await call.createSubscription();
    // The SKU, not a plan id — the server resolves the plan (#774).
    expect(createPayPalSubscription).toHaveBeenCalledWith(
      recurringOptions.productId,
      'test@example.com'
    );
    expect(result.current.error).toBeNull();
  });

  it('errors clearly for recurring PayPal without a productId', async () => {
    // The failure mode moved: it used to be "the one global plan id is unset",
    // now it is "you did not name a SKU". Same shape as the Stripe lane (#772).
    const { result } = renderHook(() =>
      usePaymentButton({ ...recurringOptions, productId: undefined })
    );

    await act(async () => {
      await result.current.mountPayPalButtons('container-id');
    });

    expect(renderPayPalButtons).not.toHaveBeenCalled();
    expect(result.current.error?.message).toMatch(/productId/);
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
