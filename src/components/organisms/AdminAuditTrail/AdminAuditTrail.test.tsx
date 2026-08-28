import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    created_at: '2025-06-15T10:30:00Z',
  },
  {
    id: 'evt-2',
    user_id: 'user-xyz-789-ghi-012',
    event_type: 'sign_in_failed',
    success: false,
    created_at: '2025-06-15T09:00:00Z',
  },
  {
    id: 'evt-3',
    user_id: null,
    event_type: 'sign_up',
    success: true,
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
  totals: { sign_in_failed: 18, sign_in_success: 412 },
  daily_series: [{ day: '2026-02-26', failed: 0, succeeded: 55 }],
};

describe('AdminAuditTrail trends', () => {
  it('hides the range section when trends prop is absent', () => {
    render(<AdminAuditTrail stats={mockStats} events={[]} />);
    expect(screen.queryByText('Sign-in Activity')).not.toBeInTheDocument();
  });

  it('renders range stats when trends present', () => {
    render(
      <AdminAuditTrail stats={mockStats} events={[]} trends={mockTrends} />
    );
    // `stat-bursts` is gone with the burst panel (#839); these two are the real
    // range totals and were inside that same section, so they must keep asserting.
    expect(screen.queryByTestId('stat-bursts')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-range-failed')).toHaveTextContent('18');
    expect(screen.getByTestId('stat-range-success')).toHaveTextContent('412');
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

  it('places the range section above Event Log', () => {
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
    const burstIdx = headings.indexOf('Sign-in Activity');
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
