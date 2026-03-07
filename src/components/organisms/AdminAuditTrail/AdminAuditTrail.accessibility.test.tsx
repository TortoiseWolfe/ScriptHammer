import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
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

const mockEvents: AuditLogEntry[] = [
  {
    id: 'evt-1',
    user_id: 'user-abc-123',
    event_type: 'sign_in_success',
    success: true,
    ip_address: '192.168.1.1',
    created_at: '2025-06-15T10:30:00Z',
  },
];

describe('AdminAuditTrail Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminAuditTrail
        stats={mockStats}
        events={mockEvents}
        eventTypeFilter=""
        onEventTypeChange={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when empty', async () => {
    const { container } = render(<AdminAuditTrail stats={null} events={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations with trends + burst cards + date filter', async () => {
    const trends: AdminAuditTrends = {
      range: { start: '2026-02-26T00:00:00Z', end: '2026-03-05T00:00:00Z' },
      totals: { sign_in_failed: 18, sign_in_success: 412, bursts: 1 },
      bursts: [
        {
          ip_address: '203.0.113.42',
          first_seen: '2026-03-03T14:02:11Z',
          last_seen: '2026-03-03T14:09:47Z',
          attempts: 11,
          distinct_users: 1,
        },
      ],
      daily_series: [{ day: '2026-02-26', failed: 0, succeeded: 55 }],
    };
    const { container } = render(
      <AdminAuditTrail
        stats={mockStats}
        events={mockEvents}
        trends={trends}
        range={{ start: '2026-02-26', end: '2026-03-05' }}
        onRangeChange={() => {}}
        eventTypeFilter=""
        onEventTypeChange={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations with a burst card expanded', async () => {
    // aria-expanded="true" on the <button> + a new <ul> injected into
    // the card. axe's aria-valid-attr-value and list rules both see this.
    // Also the detail's onClick stopPropagation: no interactive role, so
    // no nested-interactive concern — it's a click trap, not a widget.
    const trends: AdminAuditTrends = {
      range: { start: '2026-02-26T00:00:00Z', end: '2026-03-05T00:00:00Z' },
      totals: { sign_in_failed: 18, sign_in_success: 412, bursts: 1 },
      bursts: [
        {
          ip_address: '203.0.113.42',
          first_seen: '2026-03-03T14:02:11Z',
          last_seen: '2026-03-03T14:09:47Z',
          attempts: 11,
          distinct_users: 1,
        },
      ],
      daily_series: [],
    };
    const inWindowEvent: AuditLogEntry = {
      id: 'be-1',
      user_id: 'user-targeted',
      event_type: 'sign_in_failed',
      success: false,
      ip_address: '203.0.113.42',
      created_at: '2026-03-03T14:05:00Z',
    };
    const { container, getByTestId } = render(
      <AdminAuditTrail
        stats={mockStats}
        events={[inWindowEvent]}
        trends={trends}
      />
    );
    fireEvent.click(getByTestId('burst-toggle'));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
