import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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

const meta: Meta<typeof AdminPaymentPanel> = {
  title: 'Components/Organisms/AdminPaymentPanel',
  component: AdminPaymentPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin payment panel displaying payment statistics and a transaction table with status badges.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: mockStats,
    transactions: mockTransactions,
  },
};

export const Loading: Story = {
  args: {
    stats: null,
    transactions: [],
    isLoading: true,
  },
};

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
    { day: '2026-02-27', succeeded: 5, failed: 1, revenue_cents: 15_000 },
    { day: '2026-02-28', succeeded: 8, failed: 0, revenue_cents: 22_000 },
    { day: '2026-03-01', succeeded: 3, failed: 2, revenue_cents: 9_000 },
    { day: '2026-03-02', succeeded: 9, failed: 0, revenue_cents: 27_000 },
    { day: '2026-03-03', succeeded: 7, failed: 1, revenue_cents: 19_000 },
    { day: '2026-03-04', succeeded: 4, failed: 0, revenue_cents: 12_000 },
  ],
};

export const WithTrends: Story = {
  args: {
    stats: mockStats,
    transactions: mockTransactions,
    trends: mockTrends,
    range: { start: '2026-02-26', end: '2026-03-05' },
    onRangeChange: () => {},
  },
};

export const TrendsElevatedFailures: Story = {
  args: {
    stats: mockStats,
    transactions: [],
    trends: {
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
    },
    range: { start: '2026-02-26', end: '2026-03-05' },
    onRangeChange: () => {},
  },
};

export const Empty: Story = {
  args: {
    stats: {
      total_payments: 0,
      successful_payments: 0,
      failed_payments: 0,
      pending_payments: 0,
      total_revenue_cents: 0,
      active_subscriptions: 0,
      failed_this_week: 0,
      revenue_by_provider: {},
    },
    transactions: [],
  },
};

export const ThemeShowcase: Story = {
  args: {
    stats: mockStats,
    transactions: mockTransactions,
  },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-100 surface</p>
        <AdminPaymentPanel {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-200 surface</p>
        <AdminPaymentPanel {...args} />
      </div>
    </div>
  ),
};
