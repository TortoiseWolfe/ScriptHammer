/**
 * PayPal Client Wrapper
 * Lazy-loads PayPal SDK only after consent granted
 */

import { paypalConfig } from '@/config/payment';
import { createLogger } from '@/lib/logger';

const logger = createLogger('payments:paypal');

declare global {
  interface Window {
    paypal?: any;
  }
}

let paypalLoadPromise: Promise<void> | null = null;

/**
 * Load PayPal SDK (lazy loaded)
 * Requires payment consent before loading
 */
export async function loadPayPalSDK(): Promise<void> {
  // Check consent before loading external script
  const hasConsent =
    typeof window !== 'undefined' &&
    localStorage.getItem('payment_consent') === 'granted';

  if (!hasConsent) {
    throw new Error(
      'Payment consent required. Please accept the payment consent modal to use PayPal.'
    );
  }

  // Already loaded
  if (window.paypal) return;

  // Loading in progress
  if (paypalLoadPromise) return paypalLoadPromise;

  // Start loading
  paypalLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => {
      logger.info('PayPal SDK loaded');
      resolve();
    };
    script.onerror = () => {
      paypalLoadPromise = null; // Reset to allow retry
      reject(new Error('Failed to load PayPal SDK'));
    };
    document.body.appendChild(script);
  });

  return paypalLoadPromise;
}

/**
 * Create PayPal order for one-time payment
 */
export async function createPayPalOrder(
  paymentIntentId: string
): Promise<string> {
  await loadPayPalSDK();

  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
  }

  // Call Edge Function to create PayPal order
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-paypal-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create PayPal order');
  }

  const { orderId } = await response.json();
  return orderId;
}

/**
 * Approve PayPal order (after user approval)
 */
export async function approvePayPalOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/capture-paypal-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to capture PayPal order');
    }

    const { status } = await response.json();

    if (status === 'COMPLETED') {
      return { success: true };
    } else {
      return { success: false, error: `Order status: ${status}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create PayPal subscription
 */
export async function createPayPalSubscription(
  planId: string,
  customerEmail: string
): Promise<string> {
  await loadPayPalSDK();

  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-paypal-subscription`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_email: customerEmail,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create PayPal subscription');
  }

  const { subscriptionId } = await response.json();
  return subscriptionId;
}

/**
 * Render PayPal Buttons
 * Use this in a React component with a container ref
 */
export async function renderPayPalButtons(
  containerId: string,
  options: {
    onApprove: (data: any) => void;
    onError?: (error: any) => void;
    onCancel?: () => void;
    createOrder: () => Promise<string>;
  }
): Promise<void> {
  await loadPayPalSDK();

  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
  }

  window.paypal
    .Buttons({
      createOrder: async () => {
        return await options.createOrder();
      },
      onApprove: async (data: any) => {
        options.onApprove(data);
      },
      onError: (error: any) => {
        logger.error('PayPal button error', { error });
        options.onError?.(error);
      },
      onCancel: () => {
        logger.info('PayPal checkout cancelled');
        options.onCancel?.();
      },
    })
    .render(`#${containerId}`);
}
