/**
 * Storybook Stories for CreateGroupModal
 * Feature 010: Group Chats
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CreateGroupModal } from './CreateGroupModal';

const meta: Meta<typeof CreateGroupModal> = {
  title: 'Components/Organisms/CreateGroupModal',
  component: CreateGroupModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CreateGroupModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onGroupCreated: (id) => console.log('Created group:', id),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
};

export const ThemeShowcase: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onGroupCreated: () => {},
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <CreateGroupModal {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
