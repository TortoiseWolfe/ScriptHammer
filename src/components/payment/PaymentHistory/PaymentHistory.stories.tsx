/**
 * PaymentHistory Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentHistory } from './PaymentHistory';

const meta: Meta<typeof PaymentHistory> = {
  title: 'Payment/PaymentHistory',
  component: PaymentHistory,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    userId: {
      control: 'text',
      description: 'User ID to fetch payment history for',
    },
    initialLimit: {
      control: 'number',
      description: 'Number of payments to fetch initially',
    },
    showFilters: {
      control: 'boolean',
      description: 'Show filter controls',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentHistory>;

export const Default: Story = {
  args: {
    userId: 'demo-user-123',
    initialLimit: 20,
    showFilters: true,
  },
};

export const NoFilters: Story = {
  args: {
    userId: 'demo-user-123',
    initialLimit: 20,
    showFilters: false,
  },
};

export const LargeDataset: Story = {
  args: {
    userId: 'demo-user-123',
    initialLimit: 100,
    showFilters: true,
  },
};

export const SmallLimit: Story = {
  args: {
    userId: 'demo-user-123',
    initialLimit: 5,
    showFilters: true,
  },
};
