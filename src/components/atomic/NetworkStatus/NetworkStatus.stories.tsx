import type { Meta, StoryObj } from '@storybook/nextjs';
import NetworkStatus from './NetworkStatus';

const meta: Meta<typeof NetworkStatus> = {
  title: 'Components/Atomic/NetworkStatus',
  component: NetworkStatus,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'NetworkStatus component for the atomic category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean',
      description: 'Whether to show compact mode (badge only)',
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
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    compact: true,
  },
};

export const WithCustomClass: Story = {
  args: {
    compact: false,
    className: 'p-4 bg-base-200 rounded',
  },
};
