import type { Meta, StoryObj } from '@storybook/nextjs';
import MessageBubble from './MessageBubble';
import type { DecryptedMessage } from '@/types/messaging';

const mockMessage: DecryptedMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  content: 'Hello, this is a test message!',
  sequence_number: 1,
  deleted: false,
  edited: false,
  edited_at: null,
  delivered_at: null,
  read_at: null,
  created_at: new Date().toISOString(),
  isOwn: true,
  senderName: 'Test User',
};

const meta = {
  title: 'Atomic/MessageBubble',
  component: MessageBubble,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: { message: mockMessage },
} satisfies Meta<typeof MessageBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: mockMessage,
  },
};

export const ReceivedMessage: Story = {
  args: {
    message: { ...mockMessage, isOwn: false, senderName: 'Other User' },
  },
};

export const ReadMessage: Story = {
  args: {
    message: {
      ...mockMessage,
      read_at: new Date().toISOString(),
    },
  },
};

// Task: T129 - Edit/Delete states
export const EditedMessage: Story = {
  args: {
    message: {
      ...mockMessage,
      content: 'This message has been edited',
      edited: true,
      edited_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    },
  },
};

export const DeletedMessage: Story = {
  args: {
    message: {
      ...mockMessage,
      content: '[Message deleted]',
      deleted: true,
    },
  },
};

export const WithEditButton: Story = {
  args: {
    message: {
      ...mockMessage,
      content: 'This is my recent message (Edit/Delete buttons visible)',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      isOwn: true,
    },
    onEdit: async (messageId: string, newContent: string) => {
      console.log('Edit clicked:', messageId, newContent);
      alert(`Edit message: ${messageId}\nNew content: ${newContent}`);
    },
    onDelete: async (messageId: string) => {
      console.log('Delete clicked:', messageId);
      alert(`Delete message: ${messageId}`);
    },
  },
};

export const OldMessageNoEditDelete: Story = {
  args: {
    message: {
      ...mockMessage,
      content: 'This is an old message (no Edit/Delete buttons)',
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago (outside window)
      isOwn: true,
    },
    onEdit: async (messageId: string, newContent: string) => {
      console.log('Edit should not be visible');
    },
    onDelete: async (messageId: string) => {
      console.log('Delete should not be visible');
    },
  },
};

export const ReceivedMessageNoEditDelete: Story = {
  args: {
    message: {
      ...mockMessage,
      content: 'This is a received message (no Edit/Delete buttons)',
      created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      isOwn: false,
      senderName: 'Other User',
    },
    onEdit: async (messageId: string, newContent: string) => {
      console.log('Edit should not be visible for received messages');
    },
    onDelete: async (messageId: string) => {
      console.log('Delete should not be visible for received messages');
    },
  },
};

export const EditedAndRead: Story = {
  args: {
    message: {
      ...mockMessage,
      content: 'This message was edited and read',
      edited: true,
      edited_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      read_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      isOwn: true,
    },
  },
};
