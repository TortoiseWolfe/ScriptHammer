/**
 * PaymentStatusDisplay Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';

// Mock hooks and services
const mockRetryFailedPayment = vi.fn();

vi.mock('@/hooks/usePaymentRealtime');

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
  provider_fee: 58,
  webhook_verified: true,
  verification_method: 'webhook',
  error_code: null,
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
});

describe('PaymentStatusDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while loading', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: true,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading payment status...')).toBeInTheDocument();
  });

  it('renders error alert when error exists', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: false,
      error: new Error('Test error'),
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Test error');
  });

  it('renders no result message when result is null', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
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
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
  });

  it('renders failed payment status with retry button', async () => {
    // Mock is already set up at top level
    const failedResult = createMockResult('failed');
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: failedResult,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders pending payment status', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('pending'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Pending')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders refunded payment status', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('refunded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
    expect(screen.getByText('REFUNDED')).toBeInTheDocument();
  });

  it('displays payment details when showDetails is true', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Provider:')).toBeInTheDocument();
    expect(screen.getByText('stripe')).toBeInTheDocument(); // lowercase with capitalize CSS class
  });

  it('hides payment details when showDetails is false', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(
      <PaymentStatusDisplay paymentResultId="test-id" showDetails={false} />
    );

    expect(screen.queryByText('Amount:')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider:')).not.toBeInTheDocument();
  });

  it('calls onRetrySuccess when retry succeeds', async () => {
    const user = userEvent.setup();
    const onRetrySuccess = vi.fn();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    mockRetryFailedPayment.mockResolvedValue({ id: 'new-intent-123' });

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetrySuccess={onRetrySuccess}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetrySuccess).toHaveBeenCalledWith('new-intent-123');
    });
  });

  it('calls onRetryError when retry fails', async () => {
    const user = userEvent.setup();
    const onRetryError = vi.fn();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    const testError = new Error('Retry failed');
    mockRetryFailedPayment.mockRejectedValue(testError);

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetryError={onRetryError}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetryError).toHaveBeenCalledWith(testError);
    });
  });

  it('disables retry button while retrying', async () => {
    const user = userEvent.setup();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    mockRetryFailedPayment.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ id: '123' }), 100))
    );

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(retryButton).toBeDisabled();
  });

  it('displays webhook verified badge when verified', () => {
    // Mock is already set up at top level
    const result = createMockResult('succeeded');
    result.webhook_verified = true;

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: result,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Webhook Verified')).toBeInTheDocument();
  });

  it('does not show retry button for non-failed payments', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(
      screen.queryByRole('button', { name: /retry/i })
    ).not.toBeInTheDocument();
  });
});
