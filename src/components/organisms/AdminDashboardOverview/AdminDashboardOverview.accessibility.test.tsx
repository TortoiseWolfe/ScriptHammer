import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import type { AdminOverview } from '@/services/admin/admin-overview-service';

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
  trends: {
    payments_daily: [
      { day: '2025-06-01', count: 20 },
      { day: '2025-06-02', count: 24 },
    ],
    logins_daily: [{ day: '2025-06-01', count: 40 }],
    signups_daily: [{ day: '2025-06-01', count: 3 }],
    messages_daily: [
      { day: '2025-06-01', count: 120 },
      { day: '2025-06-02', count: 180 },
    ],
  },
};

describe('AdminDashboardOverview Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminDashboardOverview overview={healthyOverview} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when loading', async () => {
    const { container } = render(
      <AdminDashboardOverview overview={null} isLoading />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations with attention banner', async () => {
    // Trip both an alert (rate-limit) and a warn (payment failures) so the
    // banner + both badge variants are in the DOM during the axe pass.
    const noisy: AdminOverview = {
      ...healthyOverview,
      payments: { ...healthyOverview.payments, failed_this_week: 3 },
      auth: { ...healthyOverview.auth, rate_limited_users: 2 },
    };
    const { container } = render(<AdminDashboardOverview overview={noisy} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations with the date picker mounted', async () => {
    // Picker adds two <input type="date"> plus a preset button group. The
    // existing tests render without it (props absent → picker absent), so
    // they don't prove the labels on those inputs resolve. DateRangePicker
    // has its own a11y test but composition can still break things — e.g. if
    // the overview wrapped it in a region with a clashing label.
    const { container } = render(
      <AdminDashboardOverview
        overview={healthyOverview}
        dateRange={{ from: new Date(2025, 5, 1), to: new Date(2025, 5, 8) }}
        onDateRangeChange={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('every section has a resolvable aria-labelledby heading', () => {
    const { container } = render(
      <AdminDashboardOverview overview={healthyOverview} />
    );
    // Don't pin section count — attention sorting doesn't change count but a
    // future domain would, and the invariant we actually care about is "every
    // section is labelled", not "there are exactly 4".
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThan(0);
    sections.forEach((section) => {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const heading = section.querySelector(`#${labelledBy}`);
      expect(heading).toBeTruthy();
    });
  });
});
