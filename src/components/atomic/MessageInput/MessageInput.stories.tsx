import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from '@storybook/test';
import MessageInput from './MessageInput';

const meta = {
  title: 'Atomic/MessageInput',
  component: MessageInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: { onSend: fn() },
} satisfies Meta<typeof MessageInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Type a message...',
  },
};
