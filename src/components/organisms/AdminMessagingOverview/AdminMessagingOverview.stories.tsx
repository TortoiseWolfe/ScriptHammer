import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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

export const ThemeShowcase: Story = {
  args: {
    stats: mockStats,
  },
  render: (args) => (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-100 surface</p>
        <AdminMessagingOverview {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-6">
        <p className="text-base-content/60 mb-4 text-sm">base-200 surface</p>
        <AdminMessagingOverview {...args} />
      </div>
    </div>
  ),
};
