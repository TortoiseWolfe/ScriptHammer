import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ConversationList from './ConversationList';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof ConversationList> = {
  title: 'Components/Organisms/ConversationList',
  component: ConversationList,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'ConversationList component displays all user conversations with search, filter, and sort capabilities.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    selectedConversationId: {
      control: 'text',
      description: 'Currently selected conversation ID',
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
    selectedConversationId: null,
  },
};

export const WithSelection: Story = {
  args: {
    selectedConversationId: 'conv-123',
  },
};

export const WithCustomClass: Story = {
  args: {
    selectedConversationId: null,
    className: 'bg-base-200',
  },
};

export const ThemeShowcase: Story = {
  args: {
    selectedConversationId: null,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <ConversationList {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <ConversationList {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <ConversationList {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
