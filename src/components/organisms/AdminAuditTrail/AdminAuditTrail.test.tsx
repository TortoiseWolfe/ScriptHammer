import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminAuditTrail } from './AdminAuditTrail';
import type {
  AdminAuthStats,
  AuditLogEntry,
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
