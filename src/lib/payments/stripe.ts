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
 * Handle the return from Stripe Checkout.
 *
 * Stripe's `success_url` carries only its own `session_id`
 * (create-stripe-checkout/index.ts:145), while every lookup on our side is keyed
 * on the payment_intent id. This bridges the two, so it returns `intentId` and not
 * just a boolean — /payment-result needs the id to resolve the real status.
 *
 * NO Stripe.js LOAD. This previously called `getStripe()` and threw "Stripe failed
 * to load" — while never using the returned object. It is a plain authenticated
 * fetch to our own Edge Function, so making it depend on a third-party script
 * loading meant an adblocker or a slow CDN could strand a buyer who had already
 * paid, on the page whose whole job is telling them the payment worked.
 */
export async function handleStripeRedirect(
  sessionId: string
): Promise<{ success: boolean; intentId?: string; error?: string }> {
  try {
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

    const { payment_status, intent_id } = await response.json();

    // `intent_id` is returned on BOTH branches. An unpaid session is still a real
    // session belonging to a real intent, and /payment-result should resolve and
    // show its actual state rather than falling back to a generic error — the
    // webhook, not this redirect, is what makes a payment authoritative.
    if (payment_status === 'paid') {
      return { success: true, intentId: intent_id };
    }
    return {
      success: false,
      intentId: intent_id,
      error: 'Payment not completed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create Stripe subscription checkout.
 *
 * Takes a catalog `productId`, NOT a Stripe price id (#772/#559). The price is
 * resolved server-side from `products.stripe_price_id`, so the browser never
 * names an amount — it cannot send the wrong tier's price, and it cannot name
 * an arbitrary Price in the account.
 */
export async function createSubscriptionCheckout(
  productId: string,
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
        product_id: productId,
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
