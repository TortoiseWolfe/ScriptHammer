import type { Meta, StoryObj } from '@storybook/nextjs';
import ConversationListItem from './ConversationListItem';

const mockParticipant = {
  id: 'user-123',
  username: 'johndoe',
  display_name: 'John Doe',
  avatar_url: null,
  bio: null,
  email_verified: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const meta: Meta<typeof ConversationListItem> = {
  title: 'Components/Molecular/ConversationListItem',
  component: ConversationListItem,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'ConversationListItem component for displaying a conversation in a list.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    conversationId: {
      control: 'text',
      description: 'Conversation ID',
    },
    lastMessage: {
      control: 'text',
      description: 'Last message preview (truncated)',
    },
    lastMessageAt: {
      control: 'text',
      description: 'Timestamp of last message',
    },
    unreadCount: {
      control: 'number',
      description: 'Number of unread messages',
    },
    isSelected: {
      control: 'boolean',
      description: 'Whether this conversation is selected',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    conversationId: 'conv-123',
    participant: mockParticipant,
    lastMessage: 'Hey, how are you doing?',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    isSelected: false,
  },
};

export const WithUnreadMessages: Story = {
  args: {
    conversationId: 'conv-456',
    participant: mockParticipant,
    lastMessage: 'I have a question about the project',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 3,
    isSelected: false,
  },
};

export const Selected: Story = {
  args: {
    conversationId: 'conv-789',
    participant: mockParticipant,
    lastMessage: 'Sounds good, let me know!',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    isSelected: true,
  },
};

export const NoMessages: Story = {
  args: {
    conversationId: 'conv-000',
    participant: mockParticipant,
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
    isSelected: false,
  },
};
