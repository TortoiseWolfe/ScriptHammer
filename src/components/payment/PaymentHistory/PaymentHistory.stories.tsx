/**
 * PaymentHistory Storybook Stories
 *
 * Mock data is provided via MSW handlers in src/mocks/handlers.ts
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentHistory } from './PaymentHistory';

const meta: Meta<typeof PaymentHistory> = {
  title: 'Features/Payment/PaymentHistory',
  component: PaymentHistory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Displays payment transaction history with filters and pagination. Mock data provided via MSW.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    initialLimit: {
      control: 'number',
      description: 'Number of payments to fetch initially',
    },
    showFilters: {
      control: 'boolean',
      description: 'Show filter controls',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentHistory>;

export const Default: Story = {
  args: {
    initialLimit: 20,
    showFilters: true,
  },
};

export const NoFilters: Story = {
  args: {
    initialLimit: 20,
    showFilters: false,
  },
};

export const LargeDataset: Story = {
  args: {
    initialLimit: 100,
    showFilters: true,
  },
};

export const SmallLimit: Story = {
  args: {
    initialLimit: 5,
    showFilters: true,
  },
};
