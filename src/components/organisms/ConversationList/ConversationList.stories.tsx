import type { Meta, StoryObj } from '@storybook/nextjs';
import ConversationList from './ConversationList';

const meta: Meta<typeof ConversationList> = {
  title: 'Components/Organisms/ConversationList',
  component: ConversationList,
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
