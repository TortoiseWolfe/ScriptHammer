import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ConversationView from './ConversationView';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof ConversationView> = {
  title: 'Components/Organisms/ConversationView',
  component: ConversationView,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Self-contained conversation surface. Owns message state, send/edit/delete handlers, and optimistic queued-message bubbles. Extracted from the messages page to keep page files under the 150-line budget.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    conversationId: {
      control: 'text',
      description: 'Conversation to display; changing resets all state',
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
    conversationId: 'conv-storybook',
  },
  render: (args) => (
    <div className="h-screen">
      <ConversationView {...args} />
    </div>
  ),
};
