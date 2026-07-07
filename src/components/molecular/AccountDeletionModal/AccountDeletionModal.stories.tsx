/**
 * Storybook stories for AccountDeletionModal component
 * Task: T193
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { useState } from 'react';
import AccountDeletionModal from './AccountDeletionModal';

const meta: Meta<typeof AccountDeletionModal> = {
  title: 'Components/Molecular/AccountDeletionModal',
  component: AccountDeletionModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'GDPR-compliant account deletion modal with confirmation flow. Requires typing "DELETE" to enable deletion button. Part of Phase 9: GDPR Compliance (Task T187).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    onClose: {
      description: 'Callback when modal is closed',
    },
    onDeleteComplete: {
      description: 'Callback when deletion completes successfully',
    },
    onDeleteError: {
      description: 'Callback when deletion fails',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: fn(),
    onDeleteComplete: fn(),
    onDeleteError: fn(),
  },
};

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onDeleteComplete: fn(),
    onDeleteError: fn(),
  },
};

export const WithCallbacks: Story = {
  args: {
    isOpen: true,
    onClose: () => {
      console.log('Modal closed');
    },
    onDeleteComplete: () => {
      console.log('Account deleted successfully');
      alert('Account deleted successfully');
    },
    onDeleteError: (error) => {
      console.error('Deletion failed:', error);
      alert(`Deletion failed: ${error.message}`);
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div>
        <button
          onClick={() => setIsOpen(true)}
          className="btn btn-error min-h-11"
        >
          Delete Account
        </button>

        <AccountDeletionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onDeleteComplete={() => {
            console.log('Account deleted');
            setIsOpen(false);
          }}
          onDeleteError={(error) => {
            console.error('Deletion failed:', error);
          }}
        />
      </div>
    );
  },
};

export const ThemeShowcase: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onDeleteComplete: () => {},
    onDeleteError: () => {},
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <AccountDeletionModal {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
