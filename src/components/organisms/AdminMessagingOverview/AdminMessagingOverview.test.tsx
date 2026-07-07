import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminMessagingOverview } from './AdminMessagingOverview';
import type {
  AdminMessagingStats,
  AdminMessagingTrends,
} from '@/services/admin/admin-messaging-service';

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

const mockTrends: AdminMessagingTrends = {
  range: {
    start: '2026-02-26T00:00:00+00:00',
    end: '2026-03-05T00:00:00+00:00',
  },
  totals: { messages: 847, conversations_created: 12, active_senders: 23 },
  daily_series: [
    { day: '2026-02-26', messages: 110, conversations_created: 2 },
  ],
  top_senders: [
    {
      user_id: 'u-alice',
      username: 'alice_wonder',
      display_name: 'Alice Wonderland',
      messages: 142,
    },
    {
      user_id: 'u-bob',
      username: null,
      display_name: null,
      messages: 88,
    },
  ],
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

  it('hides Volume Trends section when trends absent', () => {
    render(<AdminMessagingOverview stats={mockStats} />);
    expect(screen.queryByText('Volume Trends')).not.toBeInTheDocument();
    expect(screen.queryByTestId('top-senders-table')).not.toBeInTheDocument();
  });

  it('renders Volume Trends with range totals', () => {
    render(<AdminMessagingOverview stats={mockStats} trends={mockTrends} />);
    expect(screen.getByText('Volume Trends')).toBeInTheDocument();
    expect(screen.getByTestId('stat-range-messages')).toHaveTextContent('847');
    expect(screen.getByTestId('stat-range-convs')).toHaveTextContent('12');
    expect(screen.getByTestId('stat-range-senders')).toHaveTextContent('23');
  });

  it('renders the trend chart fed by daily_series, between stat grid and top senders', () => {
    // Same slot as PaymentTrendChart in the payments panel: stat cards
    // above (the numbers), chart (the shape), table below (the who).
    render(<AdminMessagingOverview stats={mockStats} trends={mockTrends} />);
    const chart = screen.getByTestId('messaging-trend-chart');
    expect(chart.tagName.toLowerCase()).toBe('svg');
    // Two polylines — messages + conversations. The RPC already returns
    // these two fields per DailyMessagingPoint, no extra fetch.
    expect(chart.querySelectorAll('polyline')).toHaveLength(2);

    const senders = screen.getByText('Top Senders');
    expect(
      chart.compareDocumentPosition(senders) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders top senders table — user + count only', () => {
    render(<AdminMessagingOverview stats={mockStats} trends={mockTrends} />);
    const table = screen.getByTestId('top-senders-table');

    // Two columns only: User, Messages. No "Conversation" / "Recipient"
    // column — that's the boundary between traffic volume and social graph.
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent
    );
    expect(headers).toEqual(['User', 'Messages']);

    expect(table).toHaveTextContent('Alice Wonderland');
    expect(table).toHaveTextContent('@alice_wonder');
    expect(table).toHaveTextContent('142');
    // Null username + display_name falls through to N/A
    expect(table).toHaveTextContent('N/A');
    expect(table).toHaveTextContent('88');
  });

  it('renders empty-state when top_senders is empty', () => {
    render(
      <AdminMessagingOverview
        stats={mockStats}
        trends={{ ...mockTrends, top_senders: [] }}
      />
    );
    expect(screen.queryByTestId('top-senders-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('top-senders-empty')).toHaveTextContent(
      'No messages in this range.'
    );
  });

  it('shows range filter only when onRangeChange provided', () => {
    const { rerender } = render(
      <AdminMessagingOverview stats={mockStats} trends={mockTrends} />
    );
    expect(
      screen.queryByTestId('messaging-range-filter')
    ).not.toBeInTheDocument();

    rerender(
      <AdminMessagingOverview
        stats={mockStats}
        trends={mockTrends}
        onRangeChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('messaging-range-filter')).toBeInTheDocument();
  });

  it('places Volume Trends directly above the privacy notice', () => {
    const { container } = render(
      <AdminMessagingOverview stats={mockStats} trends={mockTrends} />
    );
    // The "what you CAN see" section should land immediately before the
    // "what you CANNOT see" reminder.
    const trendsSection = screen.getByText('Volume Trends').closest('section')!;
    const privacyNotice = container.querySelector('.alert-info')!;
    expect(trendsSection.nextElementSibling).toBe(privacyNotice);
  });
});
