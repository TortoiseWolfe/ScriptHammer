/**
 * PaymentStatusDisplay Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';
import { vi } from 'vitest';

// Mock the realtime hook with different states
const createMockPaymentResult = (
  status: PaymentResult['status']
): PaymentResult => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  intent_id: '123e4567-e89b-12d3-a456-426614174001',
  provider: 'stripe',
  transaction_id: 'pi_3OjXXX2eZvKYlo2C0abc1234',
  status,
  charged_amount: 2000,
  charged_currency: 'usd',
  provider_fee: 58,
  webhook_verified: true,
  verification_method: 'webhook',
  error_code: null,
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
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
    paymentResultId: 'test-success-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: createMockPaymentResult('succeeded'),
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Failed payment with retry button
 */
export const Failed: Story = {
  args: {
    paymentResultId: 'test-failed-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: createMockPaymentResult('failed'),
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Refunded payment
 */
export const Refunded: Story = {
  args: {
    paymentResultId: 'test-refunded-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: createMockPaymentResult('refunded'),
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Pending payment with loading animation
 */
export const Pending: Story = {
  args: {
    paymentResultId: 'test-pending-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: createMockPaymentResult('pending'),
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Loading state with skeleton
 */
export const Loading: Story = {
  args: {
    paymentResultId: 'test-loading-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: null,
          loading: true,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Error state
 */
export const Error: Story = {
  args: {
    paymentResultId: 'test-error-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: null,
          loading: false,
          error: { message: 'Failed to load payment result' } as Error,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * No result found
 */
export const NoResult: Story = {
  args: {
    paymentResultId: null,
    showDetails: true,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: null,
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Without details section
 */
export const WithoutDetails: Story = {
  args: {
    paymentResultId: 'test-no-details-id',
    showDetails: false,
  },
  decorators: [
    (Story) => {
      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: createMockPaymentResult('succeeded'),
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * PayPal payment
 */
export const PayPalPayment: Story = {
  args: {
    paymentResultId: 'test-paypal-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      const paypalResult = createMockPaymentResult('succeeded');
      paypalResult.provider = 'paypal';
      paypalResult.transaction_id = 'PAYID-MYXXXXXABCD1234567890';

      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: paypalResult,
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};

/**
 * Unverified webhook
 */
export const UnverifiedWebhook: Story = {
  args: {
    paymentResultId: 'test-unverified-id',
    showDetails: true,
  },
  decorators: [
    (Story) => {
      const unverifiedResult = createMockPaymentResult('succeeded');
      unverifiedResult.webhook_verified = false;

      vi.mock('@/hooks/usePaymentRealtime', () => ({
        usePaymentRealtime: () => ({
          paymentResult: unverifiedResult,
          loading: false,
          error: null,
        }),
      }));
      return <Story />;
    },
  ],
};
