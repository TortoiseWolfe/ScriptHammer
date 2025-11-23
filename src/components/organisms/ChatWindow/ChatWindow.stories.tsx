import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from '@storybook/test';
import ChatWindow from './ChatWindow';

const meta = {
  title: 'Organisms/ChatWindow',
  component: ChatWindow,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    conversationId: 'conv-1',
    messages: [],
    onSendMessage: fn(),
  },
} satisfies Meta<typeof ChatWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    conversationId: 'conv-1',
    messages: [],
    participantName: 'Test User',
  },
};
