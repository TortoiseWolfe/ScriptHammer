/**
 * PaymentButton Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentButton } from './PaymentButton';

const meta: Meta<typeof PaymentButton> = {
  title: 'Features/Payment/PaymentButton',
  component: PaymentButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    amount: {
      control: 'number',
      description: 'Payment amount in cents',
    },
    currency: {
      control: 'select',
      options: ['usd', 'eur', 'gbp', 'cad', 'aud'],
      description: 'Currency code',
    },
    type: {
      control: 'select',
      options: ['one_time', 'recurring'],
      description: 'Payment type',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    showProviderTabs: {
      control: 'boolean',
      description: 'Show provider selection tabs',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentButton>;

/**
 * Default payment button with provider tabs
 */
export const Default: Story = {
  args: {
    amount: 2000,
    currency: 'usd',
    type: 'one_time',
    customerEmail: 'user@example.com',
    description: 'Premium Plan',
    showProviderTabs: true,
    size: 'md',
  },
};

/**
 * Small button for compact layouts
 */
export const Small: Story = {
  args: {
    ...Default.args,
    size: 'sm',
  },
};

/**
 * Large button for emphasis
 */
export const Large: Story = {
  args: {
    ...Default.args,
    size: 'lg',
  },
};

/**
 * Custom button text
 */
export const CustomText: Story = {
  args: {
    ...Default.args,
    buttonText: 'Subscribe Now',
  },
};

/**
 * Without provider tabs (pre-selected)
 */
export const NoProviderTabs: Story = {
  args: {
    ...Default.args,
    showProviderTabs: false,
  },
};

/**
 * Subscription payment
 */
export const Subscription: Story = {
  args: {
    ...Default.args,
    type: 'recurring',
    buttonText: 'Start Subscription',
  },
};

/**
 * Different currency (EUR)
 */
export const Euro: Story = {
  args: {
    ...Default.args,
    amount: 1500,
    currency: 'eur',
  },
};

/**
 * Different currency (GBP)
 */
export const BritishPound: Story = {
  args: {
    ...Default.args,
    amount: 1800,
    currency: 'gbp',
  },
};

/**
 * High amount payment
 */
export const HighAmount: Story = {
  args: {
    ...Default.args,
    amount: 99999,
    description: 'Enterprise Plan',
  },
};

/**
 * With success callback
 */
export const WithCallbacks: Story = {
  args: {
    ...Default.args,
    onSuccess: (id: string) => {
      console.log('Payment succeeded:', id);
      alert(`Payment succeeded! Intent ID: ${id}`);
    },
    onError: (error: Error) => {
      console.error('Payment failed:', error);
      alert(`Payment failed: ${error.message}`);
    },
  },
};
