/**
 * usePaymentButton Hook
 * Payment initiation logic with provider selection and offline support
 */

'use client';

import { useState } from 'react';
import { usePaymentConsent } from './usePaymentConsent';
import { createPaymentIntent } from '@/lib/payments/payment-service';
import { createCheckoutSession as createStripeCheckout } from '@/lib/payments/stripe';
import { createPayPalOrder } from '@/lib/payments/paypal';
import { getPendingCount } from '@/lib/payments/offline-queue';
import type { Currency, PaymentType, PaymentProvider } from '@/types/payment';

export interface UsePaymentButtonOptions {
  amount: number;
  currency: Currency;
  type: PaymentType;
  customerEmail: string;
  description?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: Error) => void;
}

export interface UsePaymentButtonReturn {
  selectedProvider: PaymentProvider | null;
  isProcessing: boolean;
  error: Error | null;
  queuedCount: number;
  hasConsent: boolean;
  selectProvider: (provider: PaymentProvider) => void;
  initiatePayment: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for payment button with provider selection
 *
 * @example
 * ```tsx
 * function CheckoutButton() {
 *   const { selectedProvider, isProcessing, initiatePayment, selectProvider } =
 *     usePaymentButton({
 *       amount: 2000, // $20.00 in cents
 *       currency: 'usd',
 *       type: 'one_time',
 *       customerEmail: 'user@example.com',
 *       onSuccess: (id) => router.push(`/payment/success?id=${id}`),
 *     });
 *
 *   return (
 *     <>
 *       <ProviderTabs onSelect={selectProvider} />
 *       <button onClick={initiatePayment} disabled={!selectedProvider || isProcessing}>
 *         {isProcessing ? 'Processing...' : 'Pay Now'}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function usePaymentButton(
  options: UsePaymentButtonOptions
): UsePaymentButtonReturn {
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  const { hasConsent } = usePaymentConsent();

  // Poll for queued operations count
  useState(() => {
    const checkQueue = async () => {
      const count = await getPendingCount();
      setQueuedCount(count);
    };
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    return () => clearInterval(interval);
  });

  const selectProvider = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setError(null);
  };

  const initiatePayment = async () => {
    if (!selectedProvider) {
      setError(new Error('Please select a payment provider'));
      return;
    }

    if (!hasConsent) {
      setError(
        new Error('Payment consent required. Please accept the consent modal.')
      );
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Create payment intent in Supabase
      const intent = await createPaymentIntent(
        options.amount,
        options.currency,
        options.type,
        options.customerEmail,
        {
          description: options.description,
          metadata: options.metadata,
        }
      );

      // Step 2: Redirect to provider checkout
      if (selectedProvider === 'stripe') {
        await createStripeCheckout(intent.id);
      } else if (selectedProvider === 'paypal') {
        await createPayPalOrder(intent.id);
      }

      // Success callback
      if (options.onSuccess) {
        options.onSuccess(intent.id);
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Payment failed');
      setError(errorObj);

      // Error callback
      if (options.onError) {
        options.onError(errorObj);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const clearError = () => setError(null);

  return {
    selectedProvider,
    isProcessing,
    error,
    queuedCount,
    hasConsent,
    selectProvider,
    initiatePayment,
    clearError,
  };
}
