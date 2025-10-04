/**
 * PaymentStatusDisplay Accessibility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';

expect.extend(toHaveNoViolations);

// Mock usePaymentRealtime hook
vi.mock('@/hooks/usePaymentRealtime', () => ({
  usePaymentRealtime: vi.fn(() => ({
    paymentResult: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      intent_id: '123e4567-e89b-12d3-a456-426614174001',
      provider: 'stripe',
      transaction_id: 'pi_3OjXXX2eZvKYlo2C0abc1234',
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
    },
    loading: false,
    error: null,
  })),
}));

// Mock payment service
vi.mock('@/lib/payments/payment-service', () => ({
  formatPaymentAmount: vi.fn(() => '$20.00'),
  retryFailedPayment: vi.fn(() => Promise.resolve({ id: 'new-intent-123' })),
}));

describe('PaymentStatusDisplay Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have no accessibility violations in success state', async () => {
    const { container } = render(
      <PaymentStatusDisplay
        paymentResultId="123e4567-e89b-12d3-a456-426614174000"
        showDetails={true}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in loading state', async () => {
    const { usePaymentRealtime } = await import('@/hooks/usePaymentRealtime');
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: true,
      error: null,
    });

    const { container } = render(
      <PaymentStatusDisplay
        paymentResultId="123e4567-e89b-12d3-a456-426614174000"
        showDetails={true}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in error state', async () => {
    const { usePaymentRealtime } = await import('@/hooks/usePaymentRealtime');
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: false,
      error: new Error('Failed to load payment'),
    });

    const { container } = render(
      <PaymentStatusDisplay
        paymentResultId="123e4567-e89b-12d3-a456-426614174000"
        showDetails={true}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
