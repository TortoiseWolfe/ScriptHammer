/**
 * PaymentButton Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentButton } from './PaymentButton';

// Mock hooks and services
vi.mock('@/hooks/usePaymentButton', () => ({
  usePaymentButton: vi.fn(() => ({
    selectedProvider: null,
    isProcessing: false,
    error: null,
    queuedCount: 0,
    hasConsent: true,
    selectProvider: vi.fn(),
    initiatePayment: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: vi.fn(() => ({
    showModal: false,
    hasConsent: true,
    consentDate: new Date().toISOString(),
    grantConsent: vi.fn(),
    declineConsent: vi.fn(),
    resetConsent: vi.fn(),
  })),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  formatPaymentAmount: vi.fn((amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(2);
    const symbols: Record<string, string> = {
      usd: '$',
      eur: '€',
      gbp: '£',
      cad: 'CA$',
      aud: 'AU$',
    };
    return `${symbols[currency]}${formatted}`;
  }),
}));

describe('PaymentButton', () => {
  const defaultProps = {
    amount: 2000,
    currency: 'usd' as const,
    type: 'one_time' as const,
    customerEmail: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders payment button with formatted amount', () => {
    render(<PaymentButton {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /Pay \$20.00/i })
    ).toBeInTheDocument();
  });

  it('renders provider selection tabs by default', () => {
    render(<PaymentButton {...defaultProps} />);
    expect(
      screen.getByRole('tab', { name: /Select Stripe/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Select PayPal/i })
    ).toBeInTheDocument();
  });

  it('hides provider tabs when showProviderTabs is false', () => {
    render(<PaymentButton {...defaultProps} showProviderTabs={false} />);
    expect(
      screen.queryByRole('tab', { name: /Select Stripe/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /Select PayPal/i })
    ).not.toBeInTheDocument();
  });

  it('renders custom button text when provided', () => {
    render(<PaymentButton {...defaultProps} buttonText="Subscribe Now" />);
    expect(
      screen.getByRole('button', { name: /Subscribe Now/i })
    ).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<PaymentButton {...defaultProps} size="sm" />);
    let button = screen.getByRole('button', { name: /Pay/i });
    expect(button).toHaveClass('btn-sm');

    rerender(<PaymentButton {...defaultProps} size="lg" />);
    button = screen.getByRole('button', { name: /Pay/i });
    expect(button).toHaveClass('btn-lg');
  });

  it('formats different currencies correctly', () => {
    const { rerender } = render(
      <PaymentButton {...defaultProps} currency="eur" />
    );
    expect(screen.getByRole('button', { name: /€20.00/i })).toBeInTheDocument();

    rerender(<PaymentButton {...defaultProps} currency="gbp" />);
    expect(screen.getByRole('button', { name: /£20.00/i })).toBeInTheDocument();
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<PaymentButton {...defaultProps} />);

    const button = screen.getByRole('button', { name: /Pay \$20.00/i });
    expect(button).toHaveAttribute('aria-label', 'Pay $20.00');
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('disables button when no provider selected', () => {
    render(<PaymentButton {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Pay/i });
    expect(button).toBeDisabled();
  });

  it('shows provider redirect message when provider selected', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: 'stripe',
      isProcessing: false,
      error: null,
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    render(<PaymentButton {...defaultProps} />);
    expect(
      screen.getByText(/You will be redirected to Stripe/i)
    ).toBeInTheDocument();
  });

  it('displays error alert when error exists', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    const testError = new Error('Payment failed');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: 'stripe',
      isProcessing: false,
      error: testError,
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    render(<PaymentButton {...defaultProps} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed');
  });

  it('displays offline queue notice when items queued', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: null,
      isProcessing: false,
      error: null,
      queuedCount: 3,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    render(<PaymentButton {...defaultProps} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 payments queued offline'
    );
  });

  it('displays consent warning when consent not granted', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: null,
      isProcessing: false,
      error: null,
      queuedCount: 0,
      hasConsent: false,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    render(<PaymentButton {...defaultProps} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Payment consent required'
    );
  });

  it('shows processing state when payment in progress', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: 'stripe',
      isProcessing: true,
      error: null,
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    render(<PaymentButton {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Pay/i });
    expect(button).toHaveTextContent('Processing...');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('applies custom className', () => {
    const { container } = render(
      <PaymentButton {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
