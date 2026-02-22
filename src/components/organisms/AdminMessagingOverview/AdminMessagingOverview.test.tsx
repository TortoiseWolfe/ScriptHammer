import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const mockStatsEmpty: AdminMessagingStats = {
  total_conversations: 0,
  group_conversations: 0,
  direct_conversations: 0,
  messages_this_week: 0,
  active_connections: 0,
  blocked_connections: 0,
  connection_distribution: {},
};

describe('AdminMessagingOverview', () => {
  it('renders loading state', () => {
    render(
      <AdminMessagingOverview
        stats={null}
        isLoading
        testId="messaging-overview"
      />
    );
    expect(screen.getByTestId('messaging-overview')).toBeInTheDocument();
    expect(
      screen.getByTestId('messaging-overview').querySelector('.loading-spinner')
    ).toBeInTheDocument();
    expect(screen.queryByText('Messaging Statistics')).not.toBeInTheDocument();
  });

  it('renders stats cards with data', () => {
    render(<AdminMessagingOverview stats={mockStats} />);
    expect(screen.getByText('Total Conversations')).toBeInTheDocument();
    expect(screen.getByText('Messages This Week')).toBeInTheDocument();
    expect(screen.getByText('Group Chats')).toBeInTheDocument();
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
  });

  it('renders connection distribution', () => {
    render(<AdminMessagingOverview stats={mockStats} />);
    expect(screen.getByText('Connection Distribution')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('blocked')).toBeInTheDocument();
  });

  it('hides connection distribution when empty', () => {
    render(<AdminMessagingOverview stats={mockStatsEmpty} />);
    expect(
      screen.queryByText('Connection Distribution')
    ).not.toBeInTheDocument();
  });

  it('renders conversation breakdown', () => {
    render(<AdminMessagingOverview stats={mockStats} />);
    expect(screen.getByText('Direct Conversations')).toBeInTheDocument();
    expect(screen.getByText('Group Conversations')).toBeInTheDocument();
  });

  it('renders privacy notice', () => {
    render(<AdminMessagingOverview stats={mockStats} />);
    expect(
      screen.getByText(
        'Message content is end-to-end encrypted and not accessible to admins.'
      )
    ).toBeInTheDocument();
  });

  it('renders zero values when stats are null', () => {
    render(<AdminMessagingOverview stats={null} />);
    expect(screen.getByText('Messaging Statistics')).toBeInTheDocument();
    expect(screen.getByText('Conversation Breakdown')).toBeInTheDocument();
  });
});
