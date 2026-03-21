import type { Meta, StoryObj } from '@storybook/react';
import EmptyConversationState from './EmptyConversationState';

const meta: Meta<typeof EmptyConversationState> = {
  title: 'Components/Molecular/EmptyConversationState',
  component: EmptyConversationState,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '600px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onOpenSidebar: () => alert('Open sidebar clicked'),
  },
};

export default meta;
type Story = StoryObj<typeof EmptyConversationState>;

export const Default: Story = {};
