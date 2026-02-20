import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import ChatWindow from './ChatWindow';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta = {
  title: 'Components/Organisms/ChatWindow',
  component: ChatWindow,
  decorators: [withAuthProvider],
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
