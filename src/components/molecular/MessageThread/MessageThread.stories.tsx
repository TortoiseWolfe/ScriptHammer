import type { Meta, StoryObj } from '@storybook/nextjs';
import MessageThread from './MessageThread';
import type { DecryptedMessage } from '@/types/messaging';

// Helper function to generate mock messages
const generateMockMessages = (count: number): DecryptedMessage[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    conversation_id: 'conv-1',
    sender_id: i % 2 === 0 ? 'user-1' : 'user-2',
    recipient_id: i % 2 === 0 ? 'user-2' : 'user-1',
    content: `Message ${i + 1}: ${
      i % 5 === 0
        ? 'This is a longer message with more content to test dynamic height estimation. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
        : 'Short message'
    }`,
    encrypted_content: '',
    created_at: new Date(Date.now() - (count - i) * 60000).toISOString(),
    delivered_at: new Date(
      Date.now() - (count - i) * 60000 + 1000
    ).toISOString(),
    read_at:
      i % 3 === 0
        ? new Date(Date.now() - (count - i) * 60000 + 2000).toISOString()
        : null,
    edited: i % 10 === 0,
    edited_at:
      i % 10 === 0
        ? new Date(Date.now() - (count - i) * 60000 + 5000).toISOString()
        : null,
    deleted: i % 20 === 0,
    sequence_number: i + 1,
    senderName: i % 2 === 0 ? 'Alice' : 'Bob',
    isOwn: i % 2 === 0,
  }));
};

const meta = {
  title: 'Molecular/MessageThread',
  component: MessageThread,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '600px', width: '100%', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
  args: { messages: [] },
} satisfies Meta<typeof MessageThread>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    messages: [],
  },
};

export const FewMessages: Story = {
  args: {
    messages: generateMockMessages(10),
  },
};

export const StandardRendering: Story = {
  name: 'Standard Rendering (99 messages)',
  args: {
    messages: generateMockMessages(99),
  },
};

export const VirtualScrollingThreshold: Story = {
  name: 'Virtual Scrolling Threshold (100 messages)',
  args: {
    messages: generateMockMessages(100),
  },
};

export const MediumConversation: Story = {
  name: 'Medium Conversation (500 messages)',
  args: {
    messages: generateMockMessages(500),
  },
};

export const LargeConversation: Story = {
  name: 'Large Conversation (1000 messages)',
  args: {
    messages: generateMockMessages(1000),
  },
};

export const VeryLargeConversation: Story = {
  name: 'Very Large Conversation (2000 messages)',
  args: {
    messages: generateMockMessages(2000),
  },
};

export const WithTypingIndicator: Story = {
  args: {
    messages: generateMockMessages(20),
    isTyping: true,
    typingUserName: 'Bob',
  },
};

export const WithPagination: Story = {
  args: {
    messages: generateMockMessages(50),
    hasMore: true,
    loading: true,
    onLoadMore: () => console.log('Loading more messages...'),
  },
};

export const WithEditCallback: Story = {
  args: {
    messages: generateMockMessages(20),
    onEditMessage: async (messageId: string, newContent: string) => {
      console.log(`Editing message ${messageId} with content: ${newContent}`);
    },
    onDeleteMessage: async (messageId: string) => {
      console.log(`Deleting message ${messageId}`);
    },
  },
};

export const PerformanceBenchmark: Story = {
  name: 'Performance Benchmark (1000 messages - check console)',
  args: {
    messages: generateMockMessages(1000),
  },
  play: async () => {
    // Performance logs will appear in browser console
    console.log('Virtual scrolling should activate for 1000 messages');
    console.log('Check React Profiler logs in console for performance metrics');
  },
};
