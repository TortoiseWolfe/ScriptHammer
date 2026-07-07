/**
 * PaymentHistory Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

// Mock the realtime hook so a test can drive its onBatch / onEvent callbacks
// without opening a channel. Captures the latest callbacks.
let capturedOnBatch: ((count: number) => void) | undefined;
let capturedOnEvent:
  | ((payload: { eventType: string; new?: { status?: string } | null }) => void)
  | undefined;
vi.mock('@/hooks/usePaymentResultsRealtime', () => ({
  usePaymentResultsRealtime: (
    _onChange: () => void,
    _enabled?: boolean,
    onBatch?: (count: number) => void,
    onEvent?: (payload: {
      eventType: string;
      new?: { status?: string } | null;
    }) => void
  ) => {
    capturedOnBatch = onBatch;
    capturedOnEvent = onEvent;
    return 'live';
  },
}));

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnBatch = undefined;
    capturedOnEvent = undefined;
  });

  it('should render loading state initially', () => {
    render(<PaymentHistory realtime={false} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render payment history after loading', async () => {
    render(<PaymentHistory realtime={false} />);

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument();
    });
  });

  it('should display filters when showFilters is true', async () => {
    render(<PaymentHistory showFilters={true} realtime={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });
  });

  it('should not display filters when showFilters is false', async () => {
    render(<PaymentHistory showFilters={false} realtime={false} />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    });
  });

  it('should display payment count badge', async () => {
    render(<PaymentHistory realtime={false} />);

    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });
  });

  it('renders the payment trend chart from the fetched payments', async () => {
    render(<PaymentHistory realtime={false} />);

    // The mocked getPaymentHistory returns 2 payments (succeeded + failed) →
    // a non-empty daily series → the trend chart renders.
    await waitFor(() => {
      expect(screen.getByTestId('payment-trend-chart')).toBeInTheDocument();
    });
  });

  it('shows an "N updates" pill when a burst of realtime updates is coalesced', async () => {
    render(<PaymentHistory />);
    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });

    // A batch of >1 coalesced events → the pill appears with the count.
    act(() => capturedOnBatch?.(3));
    await waitFor(() => {
      expect(screen.getByTestId('batch-update-count')).toHaveTextContent(
        '3 updates'
      );
    });
  });

  it('does NOT show the batch pill for a single update', async () => {
    render(<PaymentHistory />);
    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });

    act(() => capturedOnBatch?.(1));
    expect(screen.queryByTestId('batch-update-count')).not.toBeInTheDocument();
  });

  it('shows an error alert when a realtime event reports a failed payment', async () => {
    render(<PaymentHistory />);
    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });

    act(() =>
      capturedOnEvent?.({ eventType: 'INSERT', new: { status: 'failed' } })
    );
    await waitFor(() => {
      expect(screen.getByTestId('realtime-error-alert')).toBeInTheDocument();
    });
  });

  it('does NOT show the error alert for a succeeded payment event', async () => {
    render(<PaymentHistory />);
    await waitFor(() => {
      expect(screen.getByText(/total payments/i)).toBeInTheDocument();
    });

    act(() =>
      capturedOnEvent?.({ eventType: 'INSERT', new: { status: 'succeeded' } })
    );
    expect(
      screen.queryByTestId('realtime-error-alert')
    ).not.toBeInTheDocument();
  });
});
