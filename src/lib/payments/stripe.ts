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
 * Throw unless the user has granted payment consent (GDPR gate).
 * Shared by the checkout flows — they no longer load Stripe.js (see
 * createCheckoutSession), but the consent requirement stands.
 */
function assertPaymentConsent(): void {
  const hasConsent =
    typeof window !== 'undefined' &&
    localStorage.getItem('payment_consent') === 'granted';

  if (!hasConsent) {
    throw new Error(
      'Payment consent required. Please accept the payment consent modal to use Stripe.'
    );
  }
}

/**
 * Get Stripe instance (lazy loaded)
 * Requires payment consent before loading
 */
export async function getStripe(): Promise<Stripe | null> {
  // Check consent before loading external script
  assertPaymentConsent();

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
  // Consent gate (no Stripe.js load needed — see redirect note below)
  assertPaymentConsent();

  // Call Edge Function to create checkout session
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

  // Navigate to the hosted Checkout URL from the Edge Function response.
  // Stripe.js REMOVED redirectToCheckout (changelog 2025-09-30 "clover");
  // session.url is the supported redirect mechanism.
  const { url } = await response.json();
  if (!url) {
    throw new Error(
      'Checkout session response missing url — redeploy create-stripe-checkout'
    );
  }
  window.location.assign(url);
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
  // Consent gate (no Stripe.js load needed — see redirect note below)
  assertPaymentConsent();

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

  // Navigate to the hosted Checkout URL (redirectToCheckout was removed
  // from Stripe.js — changelog 2025-09-30 "clover").
  const { url } = await response.json();
  if (!url) {
    throw new Error(
      'Subscription checkout response missing url — redeploy create-stripe-subscription'
    );
  }
  window.location.assign(url);
}
