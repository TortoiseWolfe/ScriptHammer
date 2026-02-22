import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminMessagingOverview } from './AdminMessagingOverview';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

const mockStats: AdminMessagingStats = {
  total_conversations: 60,
  group_conversations: 15,
  direct_conversations: 45,
  messages_this_week: 340,
  active_connections: 90,
  blocked_connections: 3,
  connection_distribution: {
    accepted: 90,
    pending: 12,
    blocked: 3,
  },
};

describe('AdminMessagingOverview Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(<AdminMessagingOverview stats={mockStats} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when empty', async () => {
    const { container } = render(<AdminMessagingOverview stats={null} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
