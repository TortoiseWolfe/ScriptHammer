import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
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
  revenue_by_provider: {},
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
];

describe('AdminPaymentPanel Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminPaymentPanel stats={mockStats} transactions={mockTransactions} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when empty', async () => {
    const { container } = render(
      <AdminPaymentPanel stats={null} transactions={[]} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations with trends section rendered', async () => {
    const trends: AdminPaymentTrends = {
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
      ],
      daily_series: [],
    };
    const { container } = render(
      <AdminPaymentPanel
        stats={mockStats}
        transactions={mockTransactions}
        trends={trends}
        range={{ start: '2026-02-26', end: '2026-03-05' }}
        onRangeChange={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
