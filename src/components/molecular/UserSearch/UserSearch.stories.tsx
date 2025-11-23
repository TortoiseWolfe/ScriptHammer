import type { Meta, StoryObj } from '@storybook/nextjs';
import UserSearch from './UserSearch';

const meta: Meta<typeof UserSearch> = {
  title: 'Components/Molecular/UserSearch',
  component: UserSearch,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'UserSearch component allows users to search for other users and send friend requests.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onRequestSent: {
      action: 'request-sent',
      description: 'Callback when a friend request is sent',
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
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'max-w-2xl',
  },
};
