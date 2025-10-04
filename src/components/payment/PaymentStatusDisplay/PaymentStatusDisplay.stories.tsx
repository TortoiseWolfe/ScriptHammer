/**
 * PaymentStatusDisplay Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';

// Helper to create mock payment results
const createMockPaymentResult = (
  status: PaymentResult['status'],
  overrides?: Partial<PaymentResult>
): PaymentResult => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  intent_id: '123e4567-e89b-12d3-a456-426614174001',
  template_user_id: 'user-123',
  provider: 'stripe',
  transaction_id: 'pi_3OjXXX2eZvKYlo2C0abc1234',
  status,
  charged_amount: 2000,
  charged_currency: 'usd',
  provider_fee: 58,
  webhook_verified: true,
  webhook_verified_at: new Date().toISOString(),
  redirect_verified: false,
  redirect_verified_at: null,
  verification_method: 'webhook',
  failure_reason: null,
  error_code: null,
  error_message: null,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const meta: Meta<typeof PaymentStatusDisplay> = {
  title: 'Payment/PaymentStatusDisplay',
  component: PaymentStatusDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
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
export const Success: Story = {
  args: {
    result: createMockPaymentResult('succeeded'),
    loading: false,
  },
};

/**
 * Failed payment with retry button
 */
export const Failed: Story = {
  args: {
    result: createMockPaymentResult('failed'),
    loading: false,
    onRetry: () => alert('Retry clicked!'),
  },
};

/**
 * Refunded payment
 */
export const Refunded: Story = {
  args: {
    result: createMockPaymentResult('refunded'),
    loading: false,
  },
};

/**
 * Pending payment
 */
export const Pending: Story = {
  args: {
    result: createMockPaymentResult('pending'),
    loading: false,
  },
};

/**
 * Loading state with skeleton
 */
export const Loading: Story = {
  args: {
    loading: true,
  },
};

/**
 * Error state
 */
export const ErrorState: Story = {
  args: {
    loading: false,
    error: new Error('Failed to load payment result'),
    onRetry: () => alert('Retry clicked!'),
  },
};

/**
 * No result found
 */
export const NoResult: Story = {
  args: {
    loading: false,
  },
};

/**
 * PayPal payment
 */
export const PayPalPayment: Story = {
  args: {
    result: createMockPaymentResult('succeeded', {
      provider: 'paypal',
      transaction_id: 'PAYID-MYXXXXXABCD1234567890',
    }),
    loading: false,
  },
};

/**
 * Unverified webhook
 */
export const UnverifiedWebhook: Story = {
  args: {
    result: createMockPaymentResult('succeeded', {
      webhook_verified: false,
    }),
    loading: false,
  },
};
