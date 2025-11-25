import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from '@storybook/test';
import { ReAuthModal } from './ReAuthModal';

const meta: Meta<typeof ReAuthModal> = {
  title: 'Auth/ReAuthModal',
  component: ReAuthModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modal for re-authenticating user to unlock encryption keys after session restore.',
      },
    },
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
    onSuccess: {
      action: 'success',
      description: 'Callback when re-authentication succeeds',
    },
    onClose: {
      action: 'close',
      description: 'Callback when modal is closed without success',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReAuthModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    onClose: fn(),
  },
};

export const WithoutCloseButton: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    // No onClose - user must authenticate
  },
  parameters: {
    docs: {
      description: {
        story:
          'Modal without close option - user must authenticate to proceed.',
      },
    },
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onSuccess: fn(),
    onClose: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal when closed (not visible).',
      },
    },
  },
};

export const WithCustomClass: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    onClose: fn(),
    className: 'border-2 border-primary',
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal with custom CSS class applied.',
      },
    },
  },
};
