import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import type { AdminOverview } from '@/services/admin/admin-overview-service';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

// Healthy baseline: every attention scorer returns `ok`. Success rate 98%,
// zero failed this week, zero rate-limited, block rate well under 10%.
const healthyOverview: AdminOverview = {
  range: { start: '2025-06-01', end: '2025-06-07' },
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
  sparks: {
    payments: [20, 24, 18, 0, 0, 0, 0],
    logins: [40, 52, 0, 0, 0, 0, 0],
    signups: [3, 0, 0, 0, 0, 0, 0],
    messages: [120, 180, 95, 0, 0, 0, 0],
  },
  trends: {
    payments_daily: [
      { day: '2025-06-01', count: 20 },
      { day: '2025-06-02', count: 24 },
      { day: '2025-06-03', count: 18 },
    ],
    logins_daily: [
      { day: '2025-06-01', count: 40 },
      { day: '2025-06-02', count: 52 },
    ],
    signups_daily: [{ day: '2025-06-01', count: 3 }],
    messages_daily: [
      { day: '2025-06-01', count: 120 },
      { day: '2025-06-02', count: 180 },
      { day: '2025-06-03', count: 95 },
    ],
  },
};

describe('AdminDashboardOverview', () => {
  it('renders loading state', () => {
    render(
      <AdminDashboardOverview overview={null} isLoading testId="overview" />
    );
    expect(screen.getByTestId('overview')).toBeInTheDocument();
    expect(
      screen.getByTestId('overview').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  });

  it('renders all 4 section headings', () => {
    render(<AdminDashboardOverview overview={healthyOverview} />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Messaging')).toBeInTheDocument();
  });

  it('renders stat cards with data', () => {
    render(<AdminDashboardOverview overview={healthyOverview} />);
    expect(screen.getByText('Total Payments')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-payments')).toBeInTheDocument();
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Logins Today')).toBeInTheDocument();
    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText('New Signups 30d')).toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active This Week')).toBeInTheDocument();
    expect(screen.getByText('Pending Connections')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Messages This Week')).toBeInTheDocument();
    expect(screen.getByText('Group Chats')).toBeInTheDocument();
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
  });

  it('renders zero values when overview is null', () => {
    render(<AdminDashboardOverview overview={null} />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Messaging')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('links to detail pages', () => {
    render(<AdminDashboardOverview overview={healthyOverview} />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/admin/payments');
    expect(hrefs).toContain('/admin/audit');
    expect(hrefs).toContain('/admin/users');
    expect(hrefs).toContain('/admin/messaging');
  });

  it('computes success rate correctly', () => {
    const ov: AdminOverview = {
      ...healthyOverview,
      payments: {
        ...healthyOverview.payments,
        total_payments: 200,
        successful_payments: 150,
      },
    };
    render(<AdminDashboardOverview overview={ov} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <AdminDashboardOverview
        overview={null}
        className="custom-class"
        testId="overview"
      />
    );
    expect(screen.getByTestId('overview')).toHaveClass('custom-class');
  });

  describe('trend charts', () => {
    it('renders one chart per domain', () => {
      render(<AdminDashboardOverview overview={healthyOverview} />);
      expect(screen.getByTestId('trend-payments')).toBeInTheDocument();
      expect(screen.getByTestId('trend-auth')).toBeInTheDocument();
      expect(screen.getByTestId('trend-users')).toBeInTheDocument();
      expect(screen.getByTestId('trend-messaging')).toBeInTheDocument();
    });

    it('maps trend days to local-midnight labels', () => {
      render(<AdminDashboardOverview overview={healthyOverview} />);
      // payments_daily has Jun 1-3
      expect(screen.getAllByText('Jun 1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Jun 3').length).toBeGreaterThan(0);
    });

    it('uses domain-distinct colour tokens', () => {
      const { container } = render(
        <AdminDashboardOverview overview={healthyOverview} />
      );
      // Payments → success (money=green), messaging → primary. Pick two
      // that can't false-positive against each other.
      const paymentsChart = screen.getByTestId('trend-payments');
      const messagingChart = screen.getByTestId('trend-messaging');
      expect(
        paymentsChart.querySelector('[data-chart-line]')?.getAttribute('class')
      ).toContain('stroke-success');
      expect(
        messagingChart.querySelector('[data-chart-line]')?.getAttribute('class')
      ).toContain('stroke-primary');
      void container;
    });

    it('renders empty-state chart when trend array is empty', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        trends: {
          ...healthyOverview.trends,
          signups_daily: [],
        },
      };
      render(<AdminDashboardOverview overview={ov} />);
      const chart = screen.getByTestId('trend-users');
      expect(chart).toHaveTextContent('No data');
    });
  });

  describe('attention scoring', () => {
    it('hides banner when everything is ok', () => {
      render(<AdminDashboardOverview overview={healthyOverview} />);
      expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument();
    });

    it('keeps canonical order when all sections are ok', () => {
      const { container } = render(
        <AdminDashboardOverview overview={healthyOverview} />
      );
      const domains = Array.from(
        container.querySelectorAll('section[data-domain]')
      ).map((s) => s.getAttribute('data-domain'));
      expect(domains).toEqual(['payments', 'auth', 'users', 'messaging']);
    });

    it('flags payment failures this week as warn', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        payments: { ...healthyOverview.payments, failed_this_week: 3 },
      };
      render(<AdminDashboardOverview overview={ov} />);
      const banner = screen.getByTestId('attention-banner');
      expect(banner).toHaveTextContent('3 failed payments this week');
      // Warn badge on the payments section header
      const section = screen
        .getAllByRole('region')
        .find((s) => s.getAttribute('data-domain') === 'payments');
      expect(section?.getAttribute('data-attention')).toBe('warn');
      expect(section?.querySelector('.badge-warning')).toBeTruthy();
    });

    it('escalates low payment success rate to alert', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        // 85/100 = 85% → below the 90% alert threshold
        payments: {
          ...healthyOverview.payments,
          total_payments: 100,
          successful_payments: 85,
          failed_this_week: 0,
        },
      };
      render(<AdminDashboardOverview overview={ov} />);
      expect(screen.getByTestId('attention-banner')).toHaveTextContent(
        'Payment success rate 85%'
      );
      const section = screen
        .getAllByRole('region')
        .find((s) => s.getAttribute('data-domain') === 'payments');
      expect(section?.getAttribute('data-attention')).toBe('alert');
      expect(section?.querySelector('.badge-error')).toBeTruthy();
    });

    it('ignores success rate on tiny samples', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        // 3/5 = 60% but n<10, shouldn't scream
        payments: {
          ...healthyOverview.payments,
          total_payments: 5,
          successful_payments: 3,
          failed_this_week: 0,
        },
      };
      render(<AdminDashboardOverview overview={ov} />);
      expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument();
    });

    it('treats any rate-limited user as alert', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        auth: { ...healthyOverview.auth, rate_limited_users: 1 },
      };
      render(<AdminDashboardOverview overview={ov} />);
      expect(screen.getByTestId('attention-banner')).toHaveTextContent(
        '1 user rate-limited right now'
      );
      const section = screen
        .getAllByRole('region')
        .find((s) => s.getAttribute('data-domain') === 'auth');
      expect(section?.getAttribute('data-attention')).toBe('alert');
    });

    it('sorts sections by attention level, alert first', () => {
      // Auth=alert, Payments=warn, rest ok → auth floats above payments,
      // both float above the quiet ones. Canonical order within tiers.
      const ov: AdminOverview = {
        ...healthyOverview,
        payments: { ...healthyOverview.payments, failed_this_week: 2 },
        auth: { ...healthyOverview.auth, rate_limited_users: 3 },
      };
      const { container } = render(<AdminDashboardOverview overview={ov} />);
      const domains = Array.from(
        container.querySelectorAll('section[data-domain]')
      ).map((s) => s.getAttribute('data-domain'));
      expect(domains).toEqual(['auth', 'payments', 'users', 'messaging']);
    });

    it('lists banner reasons in sorted-section order', () => {
      const ov: AdminOverview = {
        ...healthyOverview,
        payments: { ...healthyOverview.payments, failed_this_week: 2 },
        auth: { ...healthyOverview.auth, rate_limited_users: 3 },
      };
      render(<AdminDashboardOverview overview={ov} />);
      const items = screen
        .getByTestId('attention-banner')
        .querySelectorAll('li');
      // Auth is alert-level so its reason comes first, matching the section
      // sort. Payments (warn) second.
      expect(items[0].textContent).toContain('Authentication:');
      expect(items[1].textContent).toContain('Payments:');
    });

    it('flags high block rate but not normal blocks', () => {
      // 2 blocked out of 92 total ≈ 2% → fine
      const lowBlock: AdminOverview = {
        ...healthyOverview,
        messaging: {
          ...healthyOverview.messaging,
          active_connections: 90,
          blocked_connections: 2,
        },
      };
      const { rerender } = render(
        <AdminDashboardOverview overview={lowBlock} />
      );
      expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument();

      // 15 blocked out of 45 total ≈ 33% → warn
      const highBlock: AdminOverview = {
        ...healthyOverview,
        messaging: {
          ...healthyOverview.messaging,
          active_connections: 30,
          blocked_connections: 15,
        },
      };
      rerender(<AdminDashboardOverview overview={highBlock} />);
      expect(screen.getByTestId('attention-banner')).toHaveTextContent(
        '15 blocked connections'
      );
    });
  });

  describe('date range', () => {
    // Fixed anchor so the span arithmetic is exact. 30 × 86_400_000 ms apart;
    // DateRangePicker's active-preset check tolerates ±1h so DST drift in
    // the test runner's zone won't matter, but keeping it clean anyway.
    const thirtyDayRange: DateRange = {
      start: '2025-06-01',
      end: '2025-07-01',
    };

    it('defaults trend titles to (7d) when no range prop is given', () => {
      // Backward compat: existing callers (stories, the page before this
      // change lands) pass no dateRange and should see exactly what they
      // saw before. This pins the fallback so a future refactor can't
      // accidentally make the label blank or "(undefinedd)".
      render(<AdminDashboardOverview overview={healthyOverview} />);
      expect(screen.getByText('Payments (7d)')).toBeInTheDocument();
      expect(screen.getByText('Logins (7d)')).toBeInTheDocument();
      expect(screen.getByText('Signups (7d)')).toBeInTheDocument();
      expect(screen.getByText('Messages (7d)')).toBeInTheDocument();
    });

    it('mounts a DateRangePicker when both range and handler are provided', () => {
      render(
        <AdminDashboardOverview
          overview={healthyOverview}
          dateRange={thirtyDayRange}
          onDateRangeChange={() => {}}
        />
      );
      expect(screen.getByTestId('overview-range')).toBeInTheDocument();
      // <input type="date"> — proves it's the real picker, not a stub div.
      expect(screen.getByLabelText('Start date')).toHaveValue('2025-06-01');
      expect(screen.getByLabelText('End date')).toHaveValue('2025-07-01');
    });

    it('omits the picker when either prop is absent', () => {
      // Optional means optional. A range without a handler is inert; a
      // handler without a range has nothing to control. Neither half-pair
      // should render a dead widget.
      const { rerender } = render(
        <AdminDashboardOverview overview={healthyOverview} />
      );
      expect(screen.queryByTestId('overview-range')).not.toBeInTheDocument();

      rerender(
        <AdminDashboardOverview
          overview={healthyOverview}
          dateRange={thirtyDayRange}
        />
      );
      expect(screen.queryByTestId('overview-range')).not.toBeInTheDocument();

      rerender(
        <AdminDashboardOverview
          overview={healthyOverview}
          onDateRangeChange={() => {}}
        />
      );
      expect(screen.queryByTestId('overview-range')).not.toBeInTheDocument();
    });

    it('derives trend title window-length from the range', () => {
      // The whole ask: if the admin widens to 30 days on /admin, the four
      // sparkline labels should say 30d, not lie and say 7d while showing
      // 30 days of data. The span comes from the range prop, not from
      // counting trends.payments_daily.length (the RPC skips zero-days).
      render(
        <AdminDashboardOverview
          overview={healthyOverview}
          dateRange={thirtyDayRange}
          onDateRangeChange={() => {}}
        />
      );
      expect(screen.getByText('Payments (30d)')).toBeInTheDocument();
      expect(screen.getByText('Logins (30d)')).toBeInTheDocument();
      expect(screen.getByText('Signups (30d)')).toBeInTheDocument();
      expect(screen.getByText('Messages (30d)')).toBeInTheDocument();
      expect(screen.queryByText('Payments (7d)')).not.toBeInTheDocument();
    });

    it('fires onDateRangeChange when the picker edits a bound', () => {
      // The picker is controlled. Page-level handler owns the refetch; the
      // component just needs to pipe the edit through without swallowing it.
      // fireEvent.change sets the value atomically — user.type() on
      // <input type="date"> in jsdom fires per-keystroke with partial
      // strings that don't parse.
      const onChange = vi.fn();
      render(
        <AdminDashboardOverview
          overview={healthyOverview}
          dateRange={thirtyDayRange}
          onDateRangeChange={onChange}
        />
      );
      fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2025-05-15' },
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      // DateRangeFilter produces { start, end } strings. The edited
      // bound gets the new value; the other passes through untouched.
      const [next] = onChange.mock.calls[0] as [DateRange];
      expect(next.start).toBe('2025-05-15');
      expect(next.end).toBe(thirtyDayRange.end);
    });
  });
});
