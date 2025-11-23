import type { Meta, StoryObj } from '@storybook/nextjs';
import QueueStatusIndicator from './QueueStatusIndicator';

const meta: Meta<typeof QueueStatusIndicator> = {
  title: 'Components/Atomic/QueueStatusIndicator',
  component: QueueStatusIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'QueueStatusIndicator component for the atomic category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showRetryButton: {
      control: 'boolean',
      description: 'Show retry button for failed messages',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    onRetry: {
      action: 'retried',
      description: 'Callback when retry is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showRetryButton: true,
  },
};

export const WithoutRetryButton: Story = {
  args: {
    showRetryButton: false,
  },
};

export const WithCustomClass: Story = {
  args: {
    showRetryButton: true,
    className: 'p-4 bg-base-200 rounded',
  },
};
