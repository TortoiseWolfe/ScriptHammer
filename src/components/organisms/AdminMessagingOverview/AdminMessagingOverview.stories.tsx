import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminMessagingOverview } from './AdminMessagingOverview';
import type {
  AdminMessagingStats,
  AdminMessagingTrends,
  AdminConversationRow,
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

const mockTrends: AdminMessagingTrends = {
  range: {
    start: '2026-02-26T00:00:00+00:00',
    end: '2026-03-05T00:00:00+00:00',
  },
  totals: { messages: 847, conversations_created: 12, active_senders: 23 },
  // Sums to the totals above — 847 messages, 12 conversations. The chart
  // sits between the stat cards and the senders table, so a viewer can
  // cross-check the max-y tick against the Messages card.
  daily_series: [
    { day: '2026-02-26', messages: 110, conversations_created: 2 },
    { day: '2026-02-27', messages: 98, conversations_created: 1 },
    { day: '2026-02-28', messages: 134, conversations_created: 3 },
    { day: '2026-03-01', messages: 122, conversations_created: 0 },
    { day: '2026-03-02', messages: 101, conversations_created: 2 },
    { day: '2026-03-03', messages: 140, conversations_created: 1 },
    { day: '2026-03-04', messages: 142, conversations_created: 3 },
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
      username: 'bob_builder',
      display_name: 'Bob Builder',
      messages: 88,
    },
    {
      user_id: 'u-carol',
      username: 'carol_singer',
      display_name: null,
      messages: 61,
    },
  ],
};

const meta: Meta<typeof AdminMessagingOverview> = {
  title: 'Components/Organisms/AdminMessagingOverview',
  component: AdminMessagingOverview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin messaging overview displaying messaging statistics, connection distribution, conversation breakdown, and privacy notice.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: mockStats,
    trends: mockTrends,
    onRangeChange: () => {},
  },
};

export const StatsOnly: Story = {
  name: 'Stats only (no trends loaded)',
  args: {
    stats: mockStats,
  },
};

export const ZeroTraffic: Story = {
  args: {
    stats: mockStats,
    trends: {
      ...mockTrends,
      totals: { messages: 0, conversations_created: 0, active_senders: 0 },
      top_senders: [],
    },
    onRangeChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    stats: null,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    stats: {
      total_conversations: 0,
      group_conversations: 0,
      direct_conversations: 0,
      messages_this_week: 0,
      active_connections: 0,
      blocked_connections: 0,
      connection_distribution: {},
    },
  },
};

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const mockConversations: AdminConversationRow[] = [
  {
    id: 'conv-1',
    is_group: false,
    group_name: null,
    last_message_at: daysAgo(1),
    created_at: '2025-06-01T10:00:00Z',
    participant_count: 2,
    message_count: 47,
    participants: [
      { username: 'alice', display_name: 'Alice W' },
      { username: 'bob', display_name: 'Bob B' },
    ],
  },
  {
    id: 'conv-2',
    is_group: true,
    group_name: 'Engineering',
    last_message_at: daysAgo(3),
    created_at: '2025-07-15T08:00:00Z',
    participant_count: 5,
    message_count: 231,
    participants: null,
  },
  {
    id: 'conv-3',
    is_group: false,
    group_name: null,
    last_message_at: null,
    created_at: '2025-08-20T14:00:00Z',
    participant_count: 2,
    message_count: 0,
    participants: [
      { username: 'carol', display_name: 'Carol S' },
      { username: 'dave', display_name: 'Dave T' },
    ],
  },
];

export const WithConversations: Story = {
  name: 'With conversation list',
  args: {
    stats: mockStats,
    trends: mockTrends,
    conversations: mockConversations,
    conversationTotal: 60,
    conversationPage: 0,
    onConversationPageChange: () => {},
    onConversationSearchChange: () => {},
    onRangeChange: () => {},
  },
};

export const ConversationsPaginated: Story = {
  name: 'Conversations (page 2 of 3)',
  args: {
    stats: mockStats,
    conversations: mockConversations,
    conversationTotal: 60,
    conversationPage: 1,
    onConversationPageChange: () => {},
    onConversationSearchChange: () => {},
  },
};

export const ConversationsEmpty: Story = {
  name: 'Conversations (empty)',
  args: {
    stats: mockStats,
    conversations: [],
    conversationTotal: 0,
  },
};

export const ThemeShowcase: Story = {
  args: {
    stats: mockStats,
  },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content mb-4 text-sm">base-100 surface</p>
        <AdminMessagingOverview {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content mb-4 text-sm">base-200 surface</p>
        <AdminMessagingOverview {...args} />
      </div>
    </div>
  ),
};
