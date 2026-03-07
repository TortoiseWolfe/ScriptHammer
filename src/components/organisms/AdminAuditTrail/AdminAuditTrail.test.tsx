import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAuditTrail } from './AdminAuditTrail';
import type {
  AdminAuthStats,
  AuditLogEntry,
  AdminAuditTrends,
} from '@/services/admin/admin-audit-service';

const mockStats: AdminAuthStats = {
  logins_today: 28,
  failed_this_week: 5,
  signups_this_month: 12,
  rate_limited_users: 2,
  top_failed_logins: [],
};

const mockStatsWithAnomalies: AdminAuthStats = {
  ...mockStats,
  top_failed_logins: [
    { user_id: 'user-abc-123-def-456', attempts: 15 },
    { user_id: 'user-xyz-789-ghi-012', attempts: 8 },
  ],
};

const mockEvents: AuditLogEntry[] = [
  {
    id: 'evt-1',
    user_id: 'user-abc-123-def-456',
    event_type: 'sign_in_success',
    success: true,
    ip_address: '192.168.1.1',
    created_at: '2025-06-15T10:30:00Z',
  },
  {
    id: 'evt-2',
    user_id: 'user-xyz-789-ghi-012',
    event_type: 'sign_in_failed',
    success: false,
    ip_address: '10.0.0.1',
    created_at: '2025-06-15T09:00:00Z',
  },
  {
    id: 'evt-3',
    user_id: null,
    event_type: 'sign_up',
    success: true,
    ip_address: null,
    created_at: '2025-06-14T14:00:00Z',
  },
];

describe('AdminAuditTrail', () => {
  it('renders loading state', () => {
    render(
      <AdminAuditTrail
        stats={null}
        events={[]}
        isLoading
        testId="audit-trail"
      />
    );
    expect(screen.getByTestId('audit-trail')).toBeInTheDocument();
    expect(
      screen.getByTestId('audit-trail').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Authentication Statistics')
    ).not.toBeInTheDocument();
  });

  it('renders stats cards with data', () => {
    render(<AdminAuditTrail stats={mockStats} events={mockEvents} />);
    expect(screen.getByText('Logins Today')).toBeInTheDocument();
    expect(screen.getByText('Failed This Week')).toBeInTheDocument();
    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText('Signups (30d)')).toBeInTheDocument();
  });

  it('renders event table with rows', () => {
    render(<AdminAuditTrail stats={mockStats} events={mockEvents} />);
    expect(screen.getByText('sign_in_success')).toBeInTheDocument();
    expect(screen.getByText('sign_in_failed')).toBeInTheDocument();
    expect(screen.getByText('sign_up')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('filter dropdown calls onEventTypeChange', () => {
    const handleChange = vi.fn();
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={mockEvents}
        eventTypeFilter=""
        onEventTypeChange={handleChange}
      />
    );
    const select = screen.getByTestId('event-type-filter');
    fireEvent.change(select, { target: { value: 'sign_in_failed' } });
    expect(handleChange).toHaveBeenCalledWith('sign_in_failed');
  });

  it('shows anomaly section when top_failed_logins exist', () => {
    render(
      <AdminAuditTrail stats={mockStatsWithAnomalies} events={mockEvents} />
    );
    expect(screen.getByText('Anomaly Alerts')).toBeInTheDocument();
    expect(screen.getByText('15 failed attempts')).toBeInTheDocument();
    expect(screen.getByText('8 failed attempts')).toBeInTheDocument();
  });

  it('hides anomaly section when no top_failed_logins', () => {
    render(<AdminAuditTrail stats={mockStats} events={mockEvents} />);
    expect(screen.queryByText('Anomaly Alerts')).not.toBeInTheDocument();
  });

  it('shows retention notice', () => {
    render(<AdminAuditTrail stats={mockStats} events={mockEvents} />);
    expect(
      screen.getByText('Audit logs are retained for 90 days.')
    ).toBeInTheDocument();
  });
});

const mockTrends: AdminAuditTrends = {
  range: { start: '2026-02-26T00:00:00Z', end: '2026-03-05T00:00:00Z' },
  totals: { sign_in_failed: 18, sign_in_success: 412, bursts: 2 },
  bursts: [
    {
      ip_address: '203.0.113.42',
      first_seen: '2026-03-03T14:02:11Z',
      last_seen: '2026-03-03T14:09:47Z',
      attempts: 11,
      distinct_users: 1,
    },
    {
      ip_address: '198.51.100.7',
      first_seen: '2026-03-04T03:15:00Z',
      last_seen: '2026-03-04T03:22:30Z',
      attempts: 6,
      distinct_users: 4,
    },
  ],
  daily_series: [{ day: '2026-02-26', failed: 0, succeeded: 55 }],
};

describe('AdminAuditTrail trends', () => {
  it('hides burst section when trends prop is absent', () => {
    render(<AdminAuditTrail stats={mockStats} events={[]} />);
    expect(screen.queryByText('Failed Login Bursts')).not.toBeInTheDocument();
  });

  it('renders burst cards with attempts and distinct_users', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    expect(screen.getByText('Failed Login Bursts')).toBeInTheDocument();
    const cards = screen.getAllByTestId('burst-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('11 attempts')).toBeInTheDocument();
    expect(screen.getByText('6 attempts')).toBeInTheDocument();
    // distinct_users: "1 user" singular, "4 users" plural
    expect(screen.getByText(/1 user · \d+ min span/)).toBeInTheDocument();
    expect(screen.getByText(/4 users · \d+ min span/)).toBeInTheDocument();
  });

  it('labels single-user bursts differently from multi-user', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    // distinct_users=1 → targeted, distinct_users=4 → spray
    expect(screen.getByText('Targeted account')).toBeInTheDocument();
    expect(screen.getByText('Credential spray')).toBeInTheDocument();
  });

  it('renders IP address per burst', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    expect(screen.getByText('203.0.113.42')).toBeInTheDocument();
    expect(screen.getByText('198.51.100.7')).toBeInTheDocument();
  });

  it('renders range stats when trends present', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    expect(screen.getByText('Bursts Detected')).toBeInTheDocument();
    expect(screen.getByTestId('stat-bursts')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-range-failed')).toHaveTextContent('18');
    expect(screen.getByTestId('stat-range-success')).toHaveTextContent('412');
  });

  it('shows empty message when trends has zero bursts', () => {
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={[]}
        trends={{
          ...mockTrends,
          bursts: [],
          totals: { ...mockTrends.totals, bursts: 0 },
        }}
      />
    );
    expect(screen.getByTestId('burst-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('burst-card')).not.toBeInTheDocument();
  });

  it('renders DateRangeFilter and emits range changes', () => {
    const onRangeChange = vi.fn();
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={[]}
        trends={mockTrends}
        range={{ start: '2026-02-26', end: '2026-03-05' }}
        onRangeChange={onRangeChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it('places burst section above Event Log', () => {
    const { container } = render(
      <AdminAuditTrail
        stats={mockStats}
        events={mockEvents}
        trends={mockTrends}
      />
    );
    const headings = Array.from(container.querySelectorAll('h2')).map(
      (h) => h.textContent
    );
    const burstIdx = headings.indexOf('Failed Login Bursts');
    const logIdx = headings.indexOf('Event Log');
    expect(burstIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeGreaterThan(-1);
    expect(burstIdx).toBeLessThan(logIdx);
  });
});

// Drill-down: same keyboard pattern as AdminDataTable's row expansion.
// <button aria-expanded> is the a11y trigger, card-click is the mouse
// affordance. aria-expanded is always valid on button (not on plain div
// without a widget role). Accordion — only one card open at a time.
describe('AdminAuditTrail burst card expansion', () => {
  // First burst: 203.0.113.42, window 14:02:11 → 14:09:47 UTC Mar 3.
  // be-1 and be-2 match both ip AND window. be-outside is same ip, wrong
  // time. be-other-ip is right time, wrong ip. Only the first two surface.
  const burstEvents: AuditLogEntry[] = [
    {
      id: 'be-1',
      user_id: 'user-targeted-abc',
      event_type: 'sign_in_failed',
      success: false,
      ip_address: '203.0.113.42',
      created_at: '2026-03-03T14:03:00Z',
    },
    {
      id: 'be-2',
      user_id: 'user-targeted-abc',
      event_type: 'sign_in_failed',
      success: false,
      ip_address: '203.0.113.42',
      created_at: '2026-03-03T14:07:30Z',
    },
    {
      id: 'be-outside',
      user_id: 'user-targeted-abc',
      event_type: 'sign_in_failed',
      success: false,
      ip_address: '203.0.113.42',
      created_at: '2026-03-03T18:00:00Z',
    },
    {
      id: 'be-other-ip',
      user_id: 'user-other',
      event_type: 'sign_in_failed',
      success: false,
      ip_address: '10.0.0.99',
      created_at: '2026-03-03T14:05:00Z',
    },
  ];

  it('each burst card renders a toggle button, collapsed by default', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const toggles = screen.getAllByTestId('burst-toggle');
    expect(toggles).toHaveLength(2);
    toggles.forEach((t) => {
      expect(t.tagName).toBe('BUTTON');
      expect(t).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.queryByTestId('burst-detail')).not.toBeInTheDocument();
  });

  it('toggle button has an accessible name including the IP', () => {
    // "11 attempts" alone doesn't tell a screen reader user which card
    // they're about to open. The IP is the identifier.
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    expect(
      screen.getByRole('button', { name: /show .*203\.0\.113\.42/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show .*198\.51\.100\.7/i })
    ).toBeInTheDocument();
  });

  it('Tab reaches the toggle, Enter expands', async () => {
    // The DateRangeFilter buttons precede the cards in DOM order, so
    // focus() directly rather than counting tabs. The point is that
    // native <button> lands in the tab sequence at all.
    const user = userEvent.setup();
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={burstEvents}
        trends={mockTrends}
      />
    );
    const toggle = screen.getAllByTestId('burst-toggle')[0];
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('burst-detail')).toBeInTheDocument();
  });

  it('Space also activates the toggle', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const toggle = screen.getAllByTestId('burst-toggle')[0];
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('expanded detail filters events by ip AND time window', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={burstEvents}
        trends={mockTrends}
      />
    );
    await user.click(screen.getAllByTestId('burst-toggle')[0]);

    const detail = screen.getByTestId('burst-detail');
    const rows = within(detail).getAllByTestId('burst-event-row');
    expect(rows).toHaveLength(2);

    // be-outside (18:00) and be-other-ip (10.0.0.99) are excluded.
    // Checking absence inside the detail panel specifically — both
    // values may still appear in the raw event log table below.
    expect(within(detail).queryByText(/18:00/)).not.toBeInTheDocument();
    expect(within(detail).queryByText('10.0.0.99')).not.toBeInTheDocument();
  });

  it('detail shows count vs burst attempts — events prop may be partial', async () => {
    // The burst says 11 attempts but events only has 2 in-window. The
    // detail should surface that mismatch so the admin knows they're
    // seeing a subset (events is a limit-100 recent query, bursts are
    // aggregated server-side over the full range).
    const user = userEvent.setup();
    render(
      <AdminAuditTrail
        stats={mockStats}
        events={burstEvents}
        trends={mockTrends}
      />
    );
    await user.click(screen.getAllByTestId('burst-toggle')[0]);
    expect(screen.getByTestId('burst-detail')).toHaveTextContent('2 of 11');
  });

  it('accordion — expanding a second card collapses the first', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const [first, second] = screen.getAllByTestId('burst-toggle');

    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');

    await user.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('burst-detail')).toHaveLength(1);
  });

  it('clicking the card body also toggles (mouse affordance)', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const card = screen.getAllByTestId('burst-card')[0];
    await user.click(card);
    expect(screen.getAllByTestId('burst-toggle')[0]).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('button click does not double-toggle via bubbling', async () => {
    // Card listens too. Without stopPropagation the click bubbles and
    // the detail opens then immediately closes — net effect: nothing.
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const toggle = screen.getAllByTestId('burst-toggle')[0];
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('second Enter collapses and aria-label flips back', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    const toggle = screen.getAllByTestId('burst-toggle')[0];
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAccessibleName(/hide/i);
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName(/show/i);
    expect(screen.queryByTestId('burst-detail')).not.toBeInTheDocument();
  });

  it('empty detail when no events match the burst window', async () => {
    const user = userEvent.setup();
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    await user.click(screen.getAllByTestId('burst-toggle')[0]);
    const detail = screen.getByTestId('burst-detail');
    expect(detail).toHaveTextContent('0 of 11');
    expect(
      within(detail).queryByTestId('burst-event-row')
    ).not.toBeInTheDocument();
  });
});
