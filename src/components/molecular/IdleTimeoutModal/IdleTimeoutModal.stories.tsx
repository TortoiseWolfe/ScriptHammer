import type { Meta, StoryObj } from '@storybook/nextjs';
import IdleTimeoutModal from './IdleTimeoutModal';

const meta: Meta<typeof IdleTimeoutModal> = {
  title: 'Molecular/IdleTimeoutModal',
  component: IdleTimeoutModal,
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
    timeRemaining: {
      control: { type: 'number', min: 0, max: 300 },
      description: 'Seconds remaining before automatic sign-out',
    },
    onContinue: { action: 'continue clicked' },
    onSignOut: { action: 'sign out clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof IdleTimeoutModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    timeRemaining: 60,
    onContinue: () => console.log('Continue clicked'),
    onSignOut: () => console.log('Sign out clicked'),
  },
};

export const TenSecondsLeft: Story = {
  args: {
    isOpen: true,
    timeRemaining: 10,
    onContinue: () => console.log('Continue clicked'),
    onSignOut: () => console.log('Sign out clicked'),
  },
};

export const TwoMinutesLeft: Story = {
  args: {
    isOpen: true,
    timeRemaining: 120,
    onContinue: () => console.log('Continue clicked'),
    onSignOut: () => console.log('Sign out clicked'),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    timeRemaining: 60,
    onContinue: () => console.log('Continue clicked'),
    onSignOut: () => console.log('Sign out clicked'),
  },
};
