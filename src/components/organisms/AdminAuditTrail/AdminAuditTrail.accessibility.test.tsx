import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
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
});
