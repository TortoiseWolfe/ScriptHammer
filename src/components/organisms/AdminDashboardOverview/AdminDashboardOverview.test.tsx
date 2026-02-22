import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('AdminDashboardOverview', () => {
  it('renders loading state', () => {
    render(
      <AdminDashboardOverview
        paymentStats={null}
        authStats={null}
        userStats={null}
        messagingStats={null}
        isLoading
        testId="overview"
      />
    );
    expect(screen.getByTestId('overview')).toBeInTheDocument();
    expect(
      screen.getByTestId('overview').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  });

  it('renders all 4 section headings', () => {
    render(
      <AdminDashboardOverview
        paymentStats={mockPaymentStats}
        authStats={mockAuthStats}
        userStats={mockUserStats}
        messagingStats={mockMessagingStats}
      />
    );
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Messaging')).toBeInTheDocument();
  });

  it('renders stat cards with data', () => {
    render(
      <AdminDashboardOverview
        paymentStats={mockPaymentStats}
        authStats={mockAuthStats}
        userStats={mockUserStats}
        messagingStats={mockMessagingStats}
      />
    );
    // Payment stats
    expect(screen.getByText('Total Payments')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-payments')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument(); // 140/150 rounded
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();

    // Auth stats
    expect(screen.getByText('Logins Today')).toBeInTheDocument();
    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText('New Signups 30d')).toBeInTheDocument();

    // User stats
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active This Week')).toBeInTheDocument();
    expect(screen.getByText('Pending Connections')).toBeInTheDocument();

    // Messaging stats
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Messages This Week')).toBeInTheDocument();
    expect(screen.getByText('Group Chats')).toBeInTheDocument();
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
  });

  it('renders zero values when stats are null', () => {
    render(
      <AdminDashboardOverview
        paymentStats={null}
        authStats={null}
        userStats={null}
        messagingStats={null}
      />
    );
    // Should still render sections
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Messaging')).toBeInTheDocument();
    // Success rate should be 0% when null
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('links first cards to detail pages', () => {
    render(
      <AdminDashboardOverview
        paymentStats={mockPaymentStats}
        authStats={mockAuthStats}
        userStats={mockUserStats}
        messagingStats={mockMessagingStats}
      />
    );
    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/admin/payments');
    expect(hrefs).toContain('/admin/audit');
    expect(hrefs).toContain('/admin/users');
    expect(hrefs).toContain('/admin/messaging');
  });

  it('computes success rate correctly', () => {
    const stats = {
      ...mockPaymentStats,
      total_payments: 200,
      successful_payments: 150,
    };
    render(
      <AdminDashboardOverview
        paymentStats={stats}
        authStats={null}
        userStats={null}
        messagingStats={null}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <AdminDashboardOverview
        paymentStats={null}
        authStats={null}
        userStats={null}
        messagingStats={null}
        className="custom-class"
        testId="overview"
      />
    );
    expect(screen.getByTestId('overview')).toHaveClass('custom-class');
  });
});
