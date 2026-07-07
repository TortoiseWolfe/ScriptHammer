import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPaymentPanel } from './AdminPaymentPanel';
import type {
  AdminPaymentStats,
  AdminPaymentTrends,
} from '@/services/admin/admin-payment-service';
import type { PaymentActivity } from '@/types/payment';

const mockStats: AdminPaymentStats = {
  total_payments: 150,
  successful_payments: 140,
  failed_payments: 10,
  pending_payments: 0,
  total_revenue_cents: 500000,
  active_subscriptions: 45,
  failed_this_week: 3,
  revenue_by_provider: { stripe: 400000, paypal: 100000 },
};

const mockTransactions: PaymentActivity[] = [
  {
    id: 'tx-1',
    provider: 'stripe',
    transaction_id: 'pi_abc123',
    status: 'succeeded',
    charged_amount: 2500,
    charged_currency: 'usd',
    customer_email: 'alice@example.com',
    webhook_verified: true,
    created_at: '2025-06-15T10:30:00Z',
  },
  {
    id: 'tx-2',
    provider: 'paypal',
    transaction_id: 'pp_xyz789',
    status: 'failed',
    charged_amount: 1000,
    charged_currency: 'usd',
    customer_email: 'bob@example.com',
    webhook_verified: false,
    created_at: '2025-06-14T08:00:00Z',
  },
  {
    id: 'tx-3',
    provider: 'stripe',
    transaction_id: 'pi_def456',
    status: 'pending',
    charged_amount: 5000,
    charged_currency: 'usd',
    customer_email: 'carol@example.com',
    webhook_verified: false,
    created_at: '2025-06-16T14:00:00Z',
  },
  {
    id: 'tx-4',
    provider: 'stripe',
    transaction_id: 'pi_ghi789',
    status: 'refunded',
    charged_amount: 3000,
    charged_currency: 'usd',
    customer_email: 'dave@example.com',
    webhook_verified: true,
    created_at: '2025-06-13T12:00:00Z',
  },
];

describe('AdminPaymentPanel', () => {
  it('renders loading state', () => {
    render(
      <AdminPaymentPanel
        stats={null}
        transactions={[]}
        isLoading
        testId="payment-panel"
      />
    );
    expect(screen.getByTestId('payment-panel')).toBeInTheDocument();
    expect(
      screen.getByTestId('payment-panel').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(screen.queryByText('Payment Statistics')).not.toBeInTheDocument();
  });

  it('renders stats cards with data', () => {
    render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    expect(screen.getByText('Total Payments')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders transaction table with rows', () => {
    render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    expect(screen.getByText('dave@example.com')).toBeInTheDocument();
  });

  it('formats amounts correctly as dollars from cents', () => {
    render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    // Revenue stat: 500000 cents = $5,000.00
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    // Transaction amounts: $25.00, $10.00, $50.00, $30.00
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('renders status badges with correct classes', () => {
    const { container } = render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    const badges = container.querySelectorAll('td .badge');
    const badgeClasses = Array.from(badges).map((b) => b.className);
    expect(badgeClasses.some((c) => c.includes('badge-success'))).toBe(true);
    expect(badgeClasses.some((c) => c.includes('badge-error'))).toBe(true);
    expect(badgeClasses.some((c) => c.includes('badge-warning'))).toBe(true);
    expect(badgeClasses.some((c) => c.includes('badge-info'))).toBe(true);
  });

  it('renders empty table message when no transactions', () => {
    render(<AdminPaymentPanel stats={mockStats} transactions={[]} />);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('expands a transaction row to show provider IDs on click', () => {
    // The table shows 6 of PaymentActivity's 9 fields. The drill-down
    // surfaces the other 3: transaction_id (Stripe's pi_*, copy-pasteable
    // into their dashboard), internal id, and the raw ISO timestamp.
    render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );

    expect(screen.queryByText('pi_abc123')).not.toBeInTheDocument();

    const aliceRow = screen.getByText('alice@example.com').closest('tr')!;
    fireEvent.click(aliceRow);

    expect(screen.getByText('pi_abc123')).toBeInTheDocument();
    expect(screen.getByText('tx-1')).toBeInTheDocument();
    expect(screen.getByText('2025-06-15T10:30:00Z')).toBeInTheDocument();
  });

  it('each transaction row has a keyboard-reachable toggle', () => {
    render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    const row = screen.getByText('alice@example.com').closest('tr')!;
    const toggle = row.querySelector('button')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Native <button> → in the tab order, Enter/Space activation for free.
  });
});

const mockTrends: AdminPaymentTrends = {
  range: { start: '2026-02-26T00:00:00Z', end: '2026-03-05T00:00:00Z' },
  totals: { succeeded: 42, failed: 3, refunded: 2, revenue_cents: 125_000 },
  refund_rate: 0.0476,
  provider_breakdown: [
    {
      provider: 'stripe',
      succeeded: 35,
      failed: 2,
      refunded: 1,
      revenue_cents: 100_000,
    },
    {
      provider: 'paypal',
      succeeded: 7,
      failed: 1,
      refunded: 1,
      revenue_cents: 25_000,
    },
  ],
  daily_series: [
    { day: '2026-02-26', succeeded: 6, failed: 0, revenue_cents: 18_000 },
  ],
};

describe('AdminPaymentPanel trends', () => {
  it('hides trends section when trends prop is absent', () => {
    render(<AdminPaymentPanel stats={mockStats} transactions={[]} />);
    expect(screen.queryByText('Provider Breakdown')).not.toBeInTheDocument();
  });

  it('renders refund rate stat as a percentage', () => {
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={mockTrends}
      />
    );
    expect(screen.getByText('Refund Rate')).toBeInTheDocument();
    expect(screen.getByText('4.76%')).toBeInTheDocument();
  });

  it('renders provider breakdown table', () => {
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={mockTrends}
      />
    );
    expect(screen.getByText('Provider Breakdown')).toBeInTheDocument();
    expect(screen.getByText('stripe')).toBeInTheDocument();
    expect(screen.getByText('paypal')).toBeInTheDocument();
    // revenue cells: $1,000.00 and $250.00
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });

  it('renders DateRangeFilter and emits range changes', () => {
    const onRangeChange = vi.fn();
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={mockTrends}
        range={{ start: '2026-02-26', end: '2026-03-05' }}
        onRangeChange={onRangeChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it('renders 0.00% refund rate when rate is zero', () => {
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={{ ...mockTrends, refund_rate: 0 }}
      />
    );
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });

  it('renders the trend chart fed by daily_series', () => {
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={mockTrends}
      />
    );
    const chart = screen.getByTestId('payment-trend-chart');
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(chart.querySelectorAll('polyline')).toHaveLength(2);
  });

  it('flags providers with elevated failure share', () => {
    // A provider where failed > succeeded — clearly anomalous
    const anomalous: AdminPaymentTrends = {
      ...mockTrends,
      provider_breakdown: [
        {
          provider: 'stripe',
          succeeded: 2,
          failed: 10,
          refunded: 0,
          revenue_cents: 500,
        },
        {
          provider: 'paypal',
          succeeded: 20,
          failed: 0,
          refunded: 0,
          revenue_cents: 5000,
        },
      ],
    };
    render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={[]}
        trends={anomalous}
      />
    );
    // The flagged provider row should contain an error badge
    const stripeCell = screen.getByText('stripe');
    const row = stripeCell.closest('tr');
    expect(row?.querySelector('.badge-error')).toBeInTheDocument();
  });
});
