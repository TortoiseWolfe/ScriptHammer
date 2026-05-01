/**
 * SwitchProviderPanel unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SwitchProviderPanel } from './SwitchProviderPanel';

// ── Mock service surface ────────────────────────────────────────────────
const getParentMock = vi.fn();

vi.mock('@/lib/payments/payment-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/payments/payment-service')>();
  return {
    ...actual,
    getParentIntentForRetry: (...args: unknown[]) => getParentMock(...args),
    formatPaymentAmount: (amount: number, currency: string) => {
      const symbol = currency === 'usd' ? '$' : currency.toUpperCase();
      return `${symbol}${(amount / 100).toFixed(2)}`;
    },
  };
});

// PaymentButton renders a complex tree. Stub it to a sentinel so we can
// assert wiring without re-testing PaymentButton itself.
vi.mock('@/components/payment/PaymentButton/PaymentButton', () => ({
  PaymentButton: (props: Record<string, unknown>) => (
    <div data-testid="payment-button" data-props={JSON.stringify(props)}>
      Mock PaymentButton
    </div>
  ),
}));

beforeEach(() => {
  getParentMock.mockReset();
});

describe('SwitchProviderPanel', () => {
  it('shows loading state initially', () => {
    getParentMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading payment options/i)).toBeInTheDocument();
  });

  it('renders PaymentButton pre-filled from the parent intent on resolve', async () => {
    getParentMock.mockResolvedValue({
      amount: 2000,
      currency: 'usd',
      type: 'one_time',
      interval: null,
      customer_email: 'test@example.com',
      description: 'Premium plan',
      retry_count: 1,
    });
    render(<SwitchProviderPanel parentIntentId="parent-1" />);

    const btn = await screen.findByTestId('payment-button');
    const props = JSON.parse(btn.getAttribute('data-props') ?? '{}');
    expect(props.amount).toBe(2000);
    expect(props.currency).toBe('usd');
    expect(props.type).toBe('one_time');
    expect(props.customerEmail).toBe('test@example.com');
    expect(props.description).toBe('Premium plan');
    // Critical: the new intent created by PaymentButton must link to the parent.
    expect(props.parentIntentId).toBe('parent-1');
  });

  it('shows the masked switching-from callout with formatted amount', async () => {
    getParentMock.mockResolvedValue({
      amount: 4200,
      currency: 'usd',
      type: 'one_time',
      interval: null,
      customer_email: 'test@example.com',
      description: 'Premium plan',
      retry_count: 0,
    });
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    await waitFor(() =>
      expect(
        screen.getByText(/switching from your previous attempt/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('$42.00')).toBeInTheDocument();
    expect(screen.getByText('Premium plan')).toBeInTheDocument();
  });

  it('handles a parent with no description (no italic clause)', async () => {
    getParentMock.mockResolvedValue({
      amount: 1000,
      currency: 'usd',
      type: 'one_time',
      interval: null,
      customer_email: 'test@example.com',
      description: null,
      retry_count: 0,
    });
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    await waitFor(() =>
      expect(
        screen.getByText(/switching from your previous attempt/i)
      ).toBeInTheDocument()
    );
    // Should NOT contain the "for ..." clause.
    expect(
      screen.queryByText(/switching from your previous attempt: \$10\.00 for/i)
    ).not.toBeInTheDocument();
  });

  it('shows limit-reached alert when service throws PaymentRetryLimitError', async () => {
    const { PaymentRetryLimitError } = await import(
      '@/lib/payments/payment-service'
    );
    getParentMock.mockRejectedValue(new PaymentRetryLimitError(3, 3));
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/maximum retry attempts/i)).toBeInTheDocument();
  });

  it('shows expired alert when service throws PaymentRetryExpiredError', async () => {
    const { PaymentRetryExpiredError } = await import(
      '@/lib/payments/payment-service'
    );
    getParentMock.mockRejectedValue(new PaymentRetryExpiredError());
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    await waitFor(() =>
      expect(
        screen.getByText(/payment session has expired/i)
      ).toBeInTheDocument()
    );
  });

  it('shows generic error alert when service throws something else', async () => {
    getParentMock.mockRejectedValue(new Error('Internal error'));
    render(<SwitchProviderPanel parentIntentId="parent-1" />);
    await waitFor(() =>
      expect(screen.getByText(/internal error/i)).toBeInTheDocument()
    );
  });
});
