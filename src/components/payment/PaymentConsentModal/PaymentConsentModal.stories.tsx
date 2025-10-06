/**
 * PaymentConsentModal Storybook Stories
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { Decorator } from '@storybook/nextjs';
import { PaymentConsentModal } from './PaymentConsentModal';

// Mock the usePaymentConsent hook to always show the modal
const MockConsentDecorator: Decorator = (Story) => {
  // Clear consent in localStorage before rendering
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('payment_consent_date');
    }
  }, []);

  return <Story />;
};

const meta: Meta<typeof PaymentConsentModal> = {
  title: 'Features/Payment/PaymentConsentModal',
  component: PaymentConsentModal,
  decorators: [MockConsentDecorator],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    showLogo: {
      control: 'boolean',
      description: 'Show lock icon in modal header',
    },
    customMessage: {
      control: 'text',
      description: 'Custom consent message',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentConsentModal>;

/**
 * Default consent modal with logo
 */
export const Default: Story = {
  args: {
    showLogo: true,
  },
};

/**
 * Without logo for minimal design
 */
export const WithoutLogo: Story = {
  args: {
    showLogo: false,
  },
};

/**
 * Custom consent message
 */
export const CustomMessage: Story = {
  args: {
    showLogo: true,
    customMessage:
      'We partner with Stripe and PayPal to provide secure payment processing. Your consent is required to load their payment scripts.',
  },
};

/**
 * With callbacks for testing
 */
export const WithCallbacks: Story = {
  args: {
    showLogo: true,
    onConsentGranted: () => {
      console.log('User granted consent');
      alert('Consent granted! Payment providers will now load.');
    },
    onConsentDeclined: () => {
      console.log('User declined consent');
      alert('Consent declined. Payment functionality will be unavailable.');
    },
  },
};

/**
 * Short custom message
 */
export const ShortMessage: Story = {
  args: {
    showLogo: true,
    customMessage: 'Allow payment processing?',
  },
};

/**
 * Long custom message to test layout
 */
export const LongMessage: Story = {
  args: {
    showLogo: true,
    customMessage:
      'To provide you with the best payment experience, we utilize industry-leading payment processors Stripe and PayPal. These services require loading external JavaScript that will process your payment information securely. By granting consent, you allow us to load these scripts in accordance with GDPR and other privacy regulations. This consent can be revoked at any time through your account settings or by clearing your browser data. Your payment information is never stored on our servers and is transmitted directly to the payment processor using industry-standard encryption.',
  },
};
