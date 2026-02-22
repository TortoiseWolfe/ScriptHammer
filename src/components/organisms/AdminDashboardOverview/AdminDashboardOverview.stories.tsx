import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminUserStats } from '@/services/admin/admin-user-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

const mockPaymentStats: AdminPaymentStats = {
  total_payments: 150,
  successful_payments: 140,
  failed_payments: 10,
  pending_payments: 0,
  total_revenue_cents: 500000,
  active_subscriptions: 45,
  failed_this_week: 3,
  revenue_by_provider: { stripe: 400000, paypal: 100000 },
};

const mockAuthStats: AdminAuthStats = {
  logins_today: 28,
  failed_this_week: 5,
  signups_this_month: 12,
  rate_limited_users: 2,
  top_failed_logins: [],
};

const mockUserStats: AdminUserStats = {
  total_users: 200,
  active_this_week: 85,
  pending_connections: 7,
  total_connections: 120,
};

const mockMessagingStats: AdminMessagingStats = {
  total_conversations: 60,
  group_conversations: 15,
  direct_conversations: 45,
  messages_this_week: 340,
  active_connections: 90,
  blocked_connections: 3,
  connection_distribution: {},
};

const meta: Meta<typeof AdminDashboardOverview> = {
  title: 'Components/Organisms/AdminDashboardOverview',
  component: AdminDashboardOverview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin dashboard overview displaying stat cards across 4 domains: Payments, Authentication, Users, and Messaging.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    paymentStats: mockPaymentStats,
    authStats: mockAuthStats,
    userStats: mockUserStats,
    messagingStats: mockMessagingStats,
  },
};

export const Loading: Story = {
  args: {
    paymentStats: null,
    authStats: null,
    userStats: null,
    messagingStats: null,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    paymentStats: null,
    authStats: null,
    userStats: null,
    messagingStats: null,
  },
};

export const ThemeShowcase: Story = {
  args: {
    paymentStats: mockPaymentStats,
    authStats: mockAuthStats,
    userStats: mockUserStats,
    messagingStats: mockMessagingStats,
  },
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
