import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminPaymentPanel } from './AdminPaymentPanel';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
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
});
