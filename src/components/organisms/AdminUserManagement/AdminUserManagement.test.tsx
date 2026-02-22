import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  {
    id: 'user-2',
    username: 'bob_builder',
    display_name: 'Bob Builder',
    created_at: '2025-03-20T14:30:00Z',
    welcome_message_sent: false,
  },
  {
    id: 'user-3',
    username: null,
    display_name: null,
    created_at: '2025-06-01T09:00:00Z',
    welcome_message_sent: false,
  },
];

describe('AdminUserManagement', () => {
  it('renders loading state', () => {
    render(
      <AdminUserManagement
        stats={null}
        users={[]}
        isLoading
        testId="user-mgmt"
      />
    );
    expect(screen.getByTestId('user-mgmt')).toBeInTheDocument();
    expect(
      screen.getByTestId('user-mgmt').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(screen.queryByText('User Statistics')).not.toBeInTheDocument();
  });

  it('renders stats cards with data', () => {
    render(<AdminUserManagement stats={mockStats} users={mockUsers} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active This Week')).toBeInTheDocument();
    expect(screen.getByText('Pending Connections')).toBeInTheDocument();
    expect(screen.getByText('Total Connections')).toBeInTheDocument();
  });

  it('renders user table with rows', () => {
    render(<AdminUserManagement stats={mockStats} users={mockUsers} />);
    expect(screen.getByText('alice_wonder')).toBeInTheDocument();
    expect(screen.getByText('Alice Wonderland')).toBeInTheDocument();
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
  });

  it('shows welcome sent badges correctly', () => {
    const { container } = render(
      <AdminUserManagement stats={mockStats} users={mockUsers} />
    );
    const successBadges = container.querySelectorAll('td .badge-success');
    const ghostBadges = container.querySelectorAll('td .badge-ghost');
    // Alice has welcome sent (1 success badge)
    expect(successBadges.length).toBeGreaterThanOrEqual(1);
    // Bob and null user don't (2 ghost badges)
    expect(ghostBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('handles null username and display_name', () => {
    render(<AdminUserManagement stats={mockStats} users={mockUsers} />);
    // Should show N/A for null values
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty table message when no users', () => {
    render(<AdminUserManagement stats={mockStats} users={[]} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });
});
