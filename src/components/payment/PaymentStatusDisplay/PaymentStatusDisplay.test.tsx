/**
 * PaymentStatusDisplay Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';

// Mock hooks and services
const mockRetryFailedPayment = vi.fn();

vi.mock('@/hooks/usePaymentRealtime', () => ({
  usePaymentRealtime: vi.fn(() => ({
    paymentResult: null,
    loading: false,
    error: null,
  })),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  retryFailedPayment: (...args: unknown[]) => mockRetryFailedPayment(...args),
  formatPaymentAmount: vi.fn((amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(2);
    const symbols: Record<string, string> = {
      usd: '$',
      eur: '€',
      gbp: '£',
    };
    return `${symbols[currency] || '$'}${formatted}`;
  }),
}));

const createMockResult = (status: PaymentResult['status']): PaymentResult => ({
  id: '123',
  intent_id: '456',
  provider: 'stripe',
  transaction_id: 'tx_123',
  status,
  charged_amount: 2000,
  charged_currency: 'usd',
  webhook_verified: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
});

describe('PaymentStatusDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while loading', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: null,
      loading: true,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading payment status...')).toBeInTheDocument();
  });

  it('renders error alert when error exists', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: null,
      loading: false,
      error: new Error('Test error'),
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Test error');
  });

  it('renders no result message when result is null', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: null,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'No payment result found'
    );
  });

  it('renders successful payment status', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('paid'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
  });

  it('renders failed payment status with retry button', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Retry failed payment/i })
    ).toBeInTheDocument();
  });

  it('renders refunded payment status', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('refunded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
    expect(screen.getByText('REFUNDED')).toBeInTheDocument();
  });

  it('renders pending payment status', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('pending'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByText('Payment Pending')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('displays payment details when showDetails is true', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('paid'),
      loading: false,
      error: null,
    });

    render(
      <PaymentStatusDisplay paymentResultId="test-id" showDetails={true} />
    );

    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Provider:')).toBeInTheDocument();
    expect(screen.getByText('stripe')).toBeInTheDocument();
    expect(screen.getByText('Transaction ID:')).toBeInTheDocument();
    expect(screen.getByText('tx_123')).toBeInTheDocument();
  });

  it('hides payment details when showDetails is false', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('paid'),
      loading: false,
      error: null,
    });

    render(
      <PaymentStatusDisplay paymentResultId="test-id" showDetails={false} />
    );

    expect(screen.queryByText('Amount:')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider:')).not.toBeInTheDocument();
  });

  it('displays webhook verified indicator', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('paid'),
      loading: false,
      error: null,
    });

    render(
      <PaymentStatusDisplay paymentResultId="test-id" showDetails={true} />
    );

    expect(screen.getByText('Webhook Verified')).toBeInTheDocument();
  });

  it('handles retry button click', async () => {
    const user = userEvent.setup();
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    mockRetryFailedPayment.mockResolvedValue({ id: 'new-intent-id' });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    const retryButton = screen.getByRole('button', {
      name: /Retry failed payment/i,
    });
    await user.click(retryButton);

    expect(mockRetryFailedPayment).toHaveBeenCalledWith('456');
  });

  it('calls onRetrySuccess callback on successful retry', async () => {
    const user = userEvent.setup();
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    const onRetrySuccess = vi.fn();
    mockRetryFailedPayment.mockResolvedValue({ id: 'new-intent-id' });

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetrySuccess={onRetrySuccess}
      />
    );

    const retryButton = screen.getByRole('button', {
      name: /Retry failed payment/i,
    });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetrySuccess).toHaveBeenCalledWith('new-intent-id');
    });
  });

  it('calls onRetryError callback on failed retry', async () => {
    const user = userEvent.setup();
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    const onRetryError = vi.fn();
    mockRetryFailedPayment.mockRejectedValue(new Error('Retry failed'));

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetryError={onRetryError}
      />
    );

    const retryButton = screen.getByRole('button', {
      name: /Retry failed payment/i,
    });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetryError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('applies custom className', () => {
    const { usePaymentRealtime } = require('@/hooks/usePaymentRealtime');
    usePaymentRealtime.mockReturnValue({
      paymentResult: createMockResult('paid'),
      loading: false,
      error: null,
    });

    const { container } = render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
