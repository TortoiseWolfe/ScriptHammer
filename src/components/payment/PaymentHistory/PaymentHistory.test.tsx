/**
 * PaymentHistory Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentHistory } from './PaymentHistory';

// Mock payment service
vi.mock('@/lib/payments/payment-service', () => ({
  getPaymentHistory: vi.fn(() =>
    Promise.resolve([
      {
        id: '1',
        created_at: '2025-01-01T00:00:00Z',
        charged_amount: 2000,
        charged_currency: 'usd',
        provider: 'stripe',
        status: 'succeeded',
        transaction_id: 'txn_123',
        webhook_verified: true,
      },
      {
        id: '2',
        created_at: '2025-01-02T00:00:00Z',
        charged_amount: 1500,
        charged_currency: 'usd',
        provider: 'paypal',
        status: 'failed',
        transaction_id: 'txn_456',
        webhook_verified: false,
      },
    ])
  ),
  formatPaymentAmount: vi.fn((amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(2);
    return `$${formatted}`;
  }),
}));

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<PaymentHistory />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render payment history after loading', async () => {
    render(<PaymentHistory />);

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument();
    });
  });

  it('should display filters when showFilters is true', async () => {
    render(<PaymentHistory showFilters={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });
  });

  it('should not display filters when showFilters is false', async () => {
    render(<PaymentHistory showFilters={false} />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    });
  });

  it('should display payment count badge', async () => {
    render(<PaymentHistory />);

    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });
  });
});
