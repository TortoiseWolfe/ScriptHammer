import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminUserManagement } from './AdminUserManagement';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

const mockStats: AdminUserStats = {
  total_users: 200,
  active_this_week: 85,
  pending_connections: 7,
  total_connections: 120,
};

const mockUsers: AdminUserRow[] = [
  {
    id: 'user-1',
    username: 'alice_wonder',
    display_name: 'Alice Wonderland',
    created_at: '2025-01-15T10:00:00Z',
    welcome_message_sent: true,
  },
];

describe('AdminUserManagement Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminUserManagement stats={mockStats} users={mockUsers} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when empty', async () => {
    const { container } = render(
      <AdminUserManagement stats={null} users={[]} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
