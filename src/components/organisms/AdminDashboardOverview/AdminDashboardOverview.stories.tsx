import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import type { AdminOverview } from '@/services/admin/admin-overview-service';
import type { DateRange } from '@/components/molecular/DateRangePicker';

// Seven days of trend data per domain. Wide value spread (3 → 2400) so the
// chart y-axis actually has work to do across all 32 themes.
const trends: AdminOverview['trends'] = {
  payments_daily: [
    { day: '2025-06-08', count: 12 },
    { day: '2025-06-09', count: 18 },
    { day: '2025-06-10', count: 9 },
    { day: '2025-06-11', count: 22 },
    { day: '2025-06-12', count: 15 },
    { day: '2025-06-13', count: 28 },
    { day: '2025-06-14', count: 19 },
  ],
  logins_daily: [
    { day: '2025-06-08', count: 45 },
    { day: '2025-06-09', count: 62 },
    { day: '2025-06-10', count: 38 },
    { day: '2025-06-11', count: 71 },
    { day: '2025-06-12', count: 55 },
    { day: '2025-06-13', count: 80 },
    { day: '2025-06-14', count: 48 },
  ],
  signups_daily: [
    { day: '2025-06-08', count: 3 },
    { day: '2025-06-09', count: 5 },
    { day: '2025-06-10', count: 2 },
    { day: '2025-06-11', count: 8 },
    { day: '2025-06-12', count: 4 },
    { day: '2025-06-13', count: 6 },
    { day: '2025-06-14', count: 3 },
  ],
  messages_daily: [
    { day: '2025-06-08', count: 180 },
    { day: '2025-06-09', count: 640 },
    { day: '2025-06-10', count: 520 },
    { day: '2025-06-11', count: 2400 },
    { day: '2025-06-12', count: 890 },
    { day: '2025-06-13', count: 410 },
    { day: '2025-06-14', count: 1100 },
  ],
};

// All-green. No banner, canonical section order.
const healthyOverview: AdminOverview = {
  payments: {
    total_payments: 150,
    successful_payments: 147,
    failed_payments: 3,
    pending_payments: 0,
    total_revenue_cents: 500000,
    active_subscriptions: 45,
    failed_this_week: 0,
    revenue_by_provider: {},
  },
  auth: {
    logins_today: 28,
    failed_this_week: 5,
    signups_this_month: 12,
    rate_limited_users: 0,
    top_failed_logins: [],
  },
  users: {
    total_users: 200,
    active_this_week: 85,
    pending_connections: 7,
    total_connections: 120,
  },
  messaging: {
    total_conversations: 60,
    group_conversations: 15,
    direct_conversations: 45,
    messages_this_week: 340,
    active_connections: 90,
    blocked_connections: 3,
    connection_distribution: {},
  },
  trends,
};

// Two domains on fire: auth rate-limit (alert) sorts above payment failures
// (warn). Banner shows both with auth first. Users/messaging stay quiet at
// the bottom.
const noisyOverview: AdminOverview = {
  ...healthyOverview,
  payments: {
    ...healthyOverview.payments,
    total_payments: 200,
    successful_payments: 184, // 92% → warn tier
    failed_this_week: 6,
  },
  auth: {
    ...healthyOverview.auth,
    rate_limited_users: 3, // present-tense lockout → alert
    failed_this_week: 42,
  },
};

const meta: Meta<typeof AdminDashboardOverview> = {
  title: 'Components/Organisms/AdminDashboardOverview',
  component: AdminDashboardOverview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Attention-sorted admin landing page. One composite RPC feeds all four domain sections plus 7-day trend sparklines. Sections with problems float to the top; a banner summarises what needs looking at.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: { overview: healthyOverview },
};

export const NeedsAttention: Story = {
  args: { overview: noisyOverview },
};

export const WithDateRange: Story = {
  render: () => {
    // 30-day window so the trend titles read (30d) and the DateRangePicker's
    // 30d preset lights up active. noisyOverview keeps the attention banner
    // on screen — that's the combination the theme sweep actually wants to
    // inspect (picker + badge-error + badge-warning + alert-warning banner,
    // all in one shot).
    const [range, setRange] = useState<DateRange>(() => {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 86_400_000);
      return { from, to };
    });
    return (
      <AdminDashboardOverview
        overview={noisyOverview}
        dateRange={range}
        onDateRangeChange={setRange}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Picker mounted — trend titles derive from the window span (30d here, not the server default of 7d). The 7d/30d/90d presets edit both bounds at once; the stat cards above each sparkline are all-time counters and don\'t move with the window.',
      },
    },
  },
};

export const Loading: Story = {
  args: { overview: null, isLoading: true },
};

export const Empty: Story = {
  args: { overview: null },
};

export const ThemeShowcase: Story = {
  args: { overview: noisyOverview },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-100 surface</p>
        <AdminDashboardOverview {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-200 surface</p>
        <AdminDashboardOverview {...args} />
      </div>
    </div>
  ),
};
