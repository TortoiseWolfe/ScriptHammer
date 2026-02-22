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

export const ThemeShowcase: Story = {
  args: {
    conversationId: 'conv-1',
    messages: [],
    participantName: 'Test User',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <ChatWindow {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <ChatWindow {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <ChatWindow {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
