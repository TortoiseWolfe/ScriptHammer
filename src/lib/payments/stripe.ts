/**
 * Stripe Client Wrapper
 * Lazy-loads Stripe.js only after consent granted
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { stripeConfig } from '@/config/payment';
import { supabase } from '@/lib/supabase/client';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the current Supabase session's access token so we can attach
 * Authorization: Bearer <jwt> to Edge Function calls. The outbound
 * payment functions (create-stripe-checkout, verify-stripe-session,
 * create-stripe-subscription) all do server-side ownership checks
 * against payment_intents.template_user_id — the JWT is how they
 * identify the caller.
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('No active session — sign in required for payments');
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get Stripe instance (lazy loaded)
 * Requires payment consent before loading
 */
export async function getStripe(): Promise<Stripe | null> {
  // Check consent before loading external script
  const hasConsent =
    typeof window !== 'undefined' &&
    localStorage.getItem('payment_consent') === 'granted';

  if (!hasConsent) {
    throw new Error(
      'Payment consent required. Please accept the payment consent modal to use Stripe.'
    );
  }

  // Lazy load Stripe.js (only once)
  if (!stripePromise) {
    stripePromise = loadStripe(stripeConfig.publishableKey);
  }

  return stripePromise;
}

/**
 * Create Stripe Checkout Session
 * Calls Edge Function, then redirects to Stripe Checkout
 */
export async function createCheckoutSession(
  paymentIntentId: string
): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  // Call Edge Function to create checkout session
  // (Edge Function will be created in Phase 5)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const { sessionId } = await response.json();

  // Redirect to Stripe Checkout
  // Note: redirectToCheckout is deprecated in newer Stripe.js versions
  // Using type assertion to handle deprecated API
  const { error } = await (stripe as any).redirectToCheckout({ sessionId });

  if (error) {
    throw new Error(error.message || 'Failed to redirect to Stripe Checkout');
  }
}

/**
 * Handle return from Stripe Checkout
 * Verifies session and updates payment status
 */
export async function handleStripeRedirect(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    // Retrieve session to check status
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-stripe-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ session_id: sessionId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify session');
    }

    const { payment_status } = await response.json();

    if (payment_status === 'paid') {
      return { success: true };
    } else {
      return { success: false, error: 'Payment not completed' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create Stripe subscription checkout
 */
export async function createSubscriptionCheckout(
  priceId: string,
  customerEmail: string
): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-subscription`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({
        price_id: priceId,
        customer_email: customerEmail,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create subscription checkout');
  }

  const { sessionId } = await response.json();

  const { error } = await (stripe as any).redirectToCheckout({ sessionId });

  if (error) {
    throw new Error(error.message || 'Failed to redirect to Stripe Checkout');
  }
}
