/**
 * create-stripe-subscription Edge Function
 *
 * Creates a Stripe Checkout Session in subscription mode for a recurring
 * payment. The browser redirects to the session's URL; once the customer
 * completes the flow, Stripe fires `customer.subscription.created` and the
 * existing `stripe-webhook` handler upserts the `subscriptions` row.
 *
 * Phase 0b of the payment Edge Functions epic (issue #100, sub-issue #102).
 *
 * REQUEST
 *   POST /functions/v1/create-stripe-subscription
 *   Authorization: Bearer <user JWT>
 *   Body: { product_id: string, customer_email: string }
 *
 *   `price_id` is NOT accepted and a request carrying one is refused (#559).
 *
 * RESPONSE
 *   200 OK: { sessionId: string, url: string }
 *   400 Bad Request: { error: string } (validation)
 *   401 Unauthorized: { error: string }
 *   500 Internal Server Error: { error: string }
 *
 * SECURITY MODEL
 *   - JWT verified via SUPABASE_ANON_KEY (auto-injected; NEXT_PUBLIC_ fallback)
 *   - The caller's user_id flows into Stripe's subscription metadata
 *     (template_user_id) so the webhook can attribute the new
 *     subscriptions row to the right user. Without this, the NOT NULL
 *     constraint on subscriptions.template_user_id would fail on insert.
 *   - We DON'T insert a subscriptions row here — the row is created by
 *     stripe-webhook when `customer.subscription.created` fires. That
 *     event includes the real provider_subscription_id (which we don't
 *     have yet) and the real plan_amount / plan_interval / status.
 *   - THE PRICE IS RESOLVED HERE, FROM THE CATALOG — never from the request.
 *     The caller names a `product_id`; `products.stripe_price_id` supplies the
 *     Price. This closes #772 (client sent one global price for every tier) and
 *     #559 T024 (server accepted any price the request named) together: a client
 *     that has no price to send cannot send the wrong one, and the catalog is
 *     the allowlist. An earlier version of this comment claimed the price was
 *     "operator-configured in Stripe Dashboard" while the code trusted the
 *     request — per #559, the code was fixed so the comment became true.
 *
 * NOTES
 *   - No payment_intents row is involved. Subscriptions are a separate
 *     code path that bypasses the one-off payment_intents/results
 *     lifecycle.
 *   - Mirrors `create-order`, which already prices one-time SKUs from the
 *     catalog (`create-order/index.ts` product lookup + `resolve.ts`).
 *   - Email validation matches the pattern in payment-service.ts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';
import { resolveSubscription, type SubscriptionProductRow } from './resolve.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Same env-name fallback as create-stripe-checkout: Supabase auto-injects the
// unprefixed names, but this project's config also carries NEXT_PUBLIC_ ones.
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

interface RequestBody {
  product_id?: string;
  customer_email?: string;
  /**
   * Present only so a caller that still sends it is REFUSED rather than having
   * it silently ignored. Never read as a price. See resolve.ts.
   */
  price_id?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  try {
    const userId = await getAuthenticatedUserId(req);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
    }

    const productId = body.product_id?.trim();
    if (!productId) {
      return jsonResponse(req, { error: 'product_id is required' }, 400);
    }

    // Catalog lookup — the SAME shape create-order uses, service client so the
    // read is not subject to the caller's RLS.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: productRow, error: productError } = await supabase
      .from('products')
      .select(
        'id, name, type, interval, active, stripe_price_id, currency, amount'
      )
      .eq('id', productId)
      .maybeSingle();
    if (productError) {
      console.error(
        'create-stripe-subscription: product lookup failed',
        productError
      );
      return jsonResponse(req, { error: 'Internal server error' }, 500);
    }

    // Every price rule lives in the pure resolver so it is testable without Deno.
    const decision = resolveSubscription({
      product: (productRow as SubscriptionProductRow | null) ?? null,
      sentPriceId: body.price_id,
    });
    if (decision.kind === 'refuse') {
      return jsonResponse(req, { error: decision.error }, decision.status);
    }
    const priceId = decision.priceId;

    const customerEmail = body.customer_email?.trim().toLowerCase();
    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return jsonResponse(
        req,
        { error: 'customer_email is required and must be a valid email' },
        400
      );
    }

    // Create the Stripe Checkout Session in subscription mode.
    // subscription_data.metadata propagates to the Subscription object
    // that Stripe creates after checkout completes, so the
    // `customer.subscription.created` webhook can read template_user_id
    // and customer_email to satisfy the NOT NULL constraints on the
    // `subscriptions` table.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      subscription_data: {
        metadata: {
          template_user_id: userId,
          customer_email: customerEmail,
        },
      },
      success_url: `${siteUrl}/payment-result?session_id={CHECKOUT_SESSION_ID}&status=subscribed`,
      cancel_url: `${siteUrl}/payment-result?status=cancelled`,
      // No client_reference_id — there's no pre-existing intent to link to.
    });

    // Return the hosted Checkout URL alongside the id: Stripe.js removed
    // redirectToCheckout (changelog 2025-09-30 "clover"), so the client
    // navigates to session.url directly.
    return jsonResponse(req, { sessionId: session.id, url: session.url });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('create-stripe-subscription error:', err);
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    );
  }
});
