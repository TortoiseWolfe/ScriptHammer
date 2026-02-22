import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
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
  revenue_by_provider: {},
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

describe('AdminDashboardOverview Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminDashboardOverview
        paymentStats={mockPaymentStats}
        authStats={mockAuthStats}
        userStats={mockUserStats}
        messagingStats={mockMessagingStats}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when loading', async () => {
    const { container } = render(
      <AdminDashboardOverview
        paymentStats={null}
        authStats={null}
        userStats={null}
        messagingStats={null}
        isLoading
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have section headings with correct ids for aria-labelledby', () => {
    const { container } = render(
      <AdminDashboardOverview
        paymentStats={mockPaymentStats}
        authStats={mockAuthStats}
        userStats={mockUserStats}
        messagingStats={mockMessagingStats}
      />
    );
    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(4);
    sections.forEach((section) => {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const heading = section.querySelector(`#${labelledBy}`);
      expect(heading).toBeTruthy();
    });
  });
});
