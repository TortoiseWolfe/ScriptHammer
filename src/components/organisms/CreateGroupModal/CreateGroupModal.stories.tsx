/**
 * Storybook Stories for CreateGroupModal
 * Feature 010: Group Chats
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { CreateGroupModal } from './CreateGroupModal';

const meta: Meta<typeof CreateGroupModal> = {
  title: 'Organisms/CreateGroupModal',
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
