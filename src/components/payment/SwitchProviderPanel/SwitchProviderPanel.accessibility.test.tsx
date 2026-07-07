/**
 * SwitchProviderPanel Accessibility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SwitchProviderPanel } from './SwitchProviderPanel';

expect.extend(toHaveNoViolations);

vi.mock('@/lib/payments/payment-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/payments/payment-service')>();
  return {
    ...actual,
    getParentIntentForRetry: vi.fn(() =>
      Promise.resolve({
        amount: 2000,
        currency: 'usd',
        type: 'one_time',
        interval: null,
        customer_email: 'test@example.com',
        description: 'Premium plan',
        retry_count: 1,
      })
    ),
    formatPaymentAmount: vi.fn(() => '$20.00'),
  };
});

vi.mock('@/components/payment/PaymentButton/PaymentButton', () => ({
  PaymentButton: () => (
    <button type="button" aria-label="Pay with Stripe">
      Pay with Stripe
    </button>
  ),
}));

describe('SwitchProviderPanel Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no a11y violations in the ready state with parent loaded', async () => {
    const { container } = render(
      <SwitchProviderPanel parentIntentId="parent-1" />
    );
    await waitFor(() => container.querySelector('.card-title'));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
