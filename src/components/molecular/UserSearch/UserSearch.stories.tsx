import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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

export const ThemeShowcase: Story = {
  args: {
    onRequestSent: () => {},
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <UserSearch {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <UserSearch {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <UserSearch {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
