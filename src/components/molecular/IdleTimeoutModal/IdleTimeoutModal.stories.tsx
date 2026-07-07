import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import IdleTimeoutModal from './IdleTimeoutModal';

const meta: Meta<typeof IdleTimeoutModal> = {
  title: 'Components/Molecular/IdleTimeoutModal',
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

export const ThemeShowcase: Story = {
  args: {
    isOpen: true,
    timeRemaining: 60,
    onContinue: () => {},
    onSignOut: () => {},
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <IdleTimeoutModal {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
