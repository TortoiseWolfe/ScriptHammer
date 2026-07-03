/**
 * usePaymentButton Hook
 * Payment initiation logic with provider selection and offline support
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { usePaymentConsent } from './usePaymentConsent';
import { createPaymentIntent } from '@/lib/payments/payment-service';
import { createCheckoutSession as createStripeCheckout } from '@/lib/payments/stripe';
import {
  createPayPalOrder,
  approvePayPalOrder,
  renderPayPalButtons,
} from '@/lib/payments/paypal';
import { getPendingCount } from '@/lib/payments/offline-queue';
import type { Currency, PaymentType, PaymentProvider } from '@/types/payment';

export interface UsePaymentButtonOptions {
  amount: number;
  currency: Currency;
  type: PaymentType;
  customerEmail: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /**
   * Link to a previous failed intent when this payment is part of a
   * recovery flow (provider switch). Plumbed through to
   * `createPaymentIntent` so the audit chain via `parent_intent_id` is
   * preserved across providers.
   */
  parentIntentId?: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: Error) => void;
}

export interface UsePaymentButtonReturn {
  selectedProvider: PaymentProvider | null;
  isProcessing: boolean;
  error: Error | null;
  queuedCount: number;
  hasConsent: boolean;
  /** False until the underlying consent hook has read localStorage. */
  consentReady: boolean;
  selectProvider: (provider: PaymentProvider) => void;
  initiatePayment: () => Promise<void>;
  /**
   * Mount PayPal's SDK Buttons into `containerId`. Unlike Stripe (a redirect),
   * PayPal one-time payments approve inside PayPal's own popup driven by the
   * SDK: createOrder → user approves → onApprove → capture. Call this instead
   * of initiatePayment when the PayPal provider is selected.
   */
  mountPayPalButtons: (containerId: string) => Promise<void>;
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
  // The PayPal SDK's onApprove only hands us order data, so we stash the
  // intent id created in createOrder to report it back via onSuccess.
  const pendingIntentId = useRef<string | null>(null);

  const { hasConsent, ready: consentReady } = usePaymentConsent();

  // Poll for queued operations count. Prior implementation used `useState`
  // with a function initializer, which runs once but discards the returned
  // cleanup — leaking the interval and causing re-renders that detached
  // child DOM nodes (e.g. provider tabs) mid-interaction.
  useEffect(() => {
    let cancelled = false;
    const checkQueue = async () => {
      const count = await getPendingCount();
      if (!cancelled) setQueuedCount(count);
    };
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const selectProvider = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setError(null);
  };

  // Shared: create the Supabase payment_intent that both providers build on.
  const newIntent = () =>
    createPaymentIntent(
      options.amount,
      options.currency,
      options.type,
      options.customerEmail,
      {
        description: options.description,
        metadata: options.metadata,
        parent_intent_id: options.parentIntentId,
      }
    );

  // Stripe path: create intent → redirect to hosted Checkout. (PayPal does
  // NOT go through here — its approval happens in the SDK Buttons popup,
  // see mountPayPalButtons.)
  const initiatePayment = async () => {
    if (!selectedProvider) {
      setError(new Error('Please select a payment provider'));
      return;
    }
    if (selectedProvider === 'paypal') {
      // PayPal is driven by the SDK Buttons, not this click handler.
      setError(
        new Error('Use the PayPal button to approve payment in PayPal.')
      );
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
      const intent = await newIntent();
      await createStripeCheckout(intent.id); // navigates away on success
      options.onSuccess?.(intent.id);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Payment failed');
      setError(errorObj);
      options.onError?.(errorObj);
    } finally {
      setIsProcessing(false);
    }
  };

  // PayPal path: render the SDK Buttons. createOrder creates our intent +
  // the PayPal order; onApprove captures it via the capture Edge Function.
  const mountPayPalButtons = async (containerId: string) => {
    if (!hasConsent) {
      setError(
        new Error('Payment consent required. Please accept the consent modal.')
      );
      return;
    }
    setError(null);
    try {
      await renderPayPalButtons(containerId, {
        createOrder: async () => {
          const intent = await newIntent();
          // Stash for onApprove's success callback (SDK only hands us order data).
          pendingIntentId.current = intent.id;
          return await createPayPalOrder(intent.id);
        },
        onApprove: async (data: { orderID?: string }) => {
          setIsProcessing(true);
          try {
            const orderId = data?.orderID;
            if (!orderId) throw new Error('PayPal approval missing orderID');
            const result = await approvePayPalOrder(orderId);
            if (!result.success) {
              throw new Error(result.error || 'PayPal capture failed');
            }
            options.onSuccess?.(pendingIntentId.current || orderId);
          } catch (err) {
            const e = err instanceof Error ? err : new Error('Capture failed');
            setError(e);
            options.onError?.(e);
          } finally {
            setIsProcessing(false);
          }
        },
        onError: (err: unknown) => {
          const e = err instanceof Error ? err : new Error('PayPal error');
          setError(e);
          options.onError?.(e);
        },
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load PayPal');
      setError(e);
      options.onError?.(e);
    }
  };

  const clearError = () => setError(null);

  return {
    selectedProvider,
    isProcessing,
    error,
    queuedCount,
    hasConsent,
    consentReady,
    selectProvider,
    initiatePayment,
    mountPayPalButtons,
    clearError,
  };
}
