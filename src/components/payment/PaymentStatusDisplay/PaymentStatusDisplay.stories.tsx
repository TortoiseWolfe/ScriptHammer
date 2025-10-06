/**
 * PaymentStatusDisplay Storybook Stories
 *
 * Mock data is provided via MSW handlers in src/mocks/handlers.ts
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';

const meta: Meta<typeof PaymentStatusDisplay> = {
  title: 'Features/Payment/PaymentStatusDisplay',
  component: PaymentStatusDisplay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays payment status with real-time updates. Mock data provided via MSW.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    paymentResultId: {
      control: 'text',
      description: 'Payment result ID to display',
    },
    showDetails: {
      control: 'boolean',
      description: 'Show payment details',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentStatusDisplay>;

/**
 * Successful payment
 */
export const Succeeded: Story = {
  args: {
    paymentResultId: 'result-succeeded',
    showDetails: true,
  },
};

/**
 * Failed payment with retry button
 */
export const Failed: Story = {
  args: {
    paymentResultId: 'result-failed',
    showDetails: true,
  },
};

/**
 * Pending payment
 */
export const Pending: Story = {
  args: {
    paymentResultId: 'result-pending',
    showDetails: true,
  },
};

/**
 * Refunded payment (mocked via 'refunded' in ID)
 */
export const Refunded: Story = {
  args: {
    paymentResultId: 'payment-refunded-example',
    showDetails: true,
  },
};

/**
 * Without details
 */
export const WithoutDetails: Story = {
  args: {
    paymentResultId: 'result-succeeded',
    showDetails: false,
  },
};

/**
 * Loading state (null ID)
 */
export const Loading: Story = {
  args: {
    paymentResultId: null,
    showDetails: true,
  },
};

/**
 * With retry callbacks
 */
export const WithCallbacks: Story = {
  args: {
    paymentResultId: 'result-failed',
    showDetails: true,
    onRetrySuccess: (newIntentId: string) => {
      console.log('Retry succeeded:', newIntentId);
      alert(`Payment retry succeeded! New intent: ${newIntentId}`);
    },
    onRetryError: (error: Error) => {
      console.error('Retry failed:', error);
      alert(`Payment retry failed: ${error.message}`);
    },
  },
};
