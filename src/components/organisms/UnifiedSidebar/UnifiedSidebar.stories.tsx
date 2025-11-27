import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from '@storybook/test';
import UnifiedSidebar from './UnifiedSidebar';

const meta: Meta<typeof UnifiedSidebar> = {
  title: 'Components/Organisms/UnifiedSidebar',
  component: UnifiedSidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'UnifiedSidebar provides tabbed navigation for Chats and Connections sections in the messaging interface. Feature 038: UserSearch now embedded in ConnectionManager.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['chats', 'connections'],
      description: 'Currently active tab',
    },
    selectedConversationId: {
      control: 'text',
      description: 'Currently selected conversation ID',
    },
    unreadCount: {
      control: 'number',
      description: 'Unread message count for Chats tab badge',
    },
    pendingConnectionCount: {
      control: 'number',
      description: 'Pending connection count for Connections tab badge',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  args: {
    onConversationSelect: fn(),
    onStartConversation: fn().mockResolvedValue('conv-mock-123'),
    onTabChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="border-base-300 h-[600px] w-[400px] border">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeTab: 'chats',
    selectedConversationId: null,
    unreadCount: 0,
    pendingConnectionCount: 0,
  },
};

export const ChatsTabWithUnread: Story = {
  args: {
    activeTab: 'chats',
    selectedConversationId: null,
    unreadCount: 5,
    pendingConnectionCount: 0,
  },
};

export const ConnectionsTab: Story = {
  args: {
    activeTab: 'connections',
    selectedConversationId: null,
    unreadCount: 0,
    pendingConnectionCount: 3,
  },
};

export const WithBadges: Story = {
  args: {
    activeTab: 'chats',
    selectedConversationId: null,
    unreadCount: 12,
    pendingConnectionCount: 4,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows badge counts on both Chats and Connections tabs.',
      },
    },
  },
};

export const WithSelectedConversation: Story = {
  args: {
    activeTab: 'chats',
    selectedConversationId: 'conv-123-456',
    unreadCount: 2,
    pendingConnectionCount: 0,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the sidebar with a conversation selected (highlighted in the list).',
      },
    },
  },
};

export const MobileWidth: Story = {
  args: {
    activeTab: 'chats',
    selectedConversationId: null,
    unreadCount: 3,
    pendingConnectionCount: 1,
  },
  decorators: [
    (Story) => (
      <div className="border-base-300 h-[600px] w-[320px] border">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Shows the sidebar at mobile viewport width (320px).',
      },
    },
  },
};
