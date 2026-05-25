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
 *   Body: { price_id: string, customer_email: string }
 *
 * RESPONSE
 *   200 OK: { sessionId: string }
 *   400 Bad Request: { error: string } (validation)
 *   401 Unauthorized: { error: string }
 *   500 Internal Server Error: { error: string }
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - The caller's user_id flows into Stripe's subscription metadata
 *     (template_user_id) so the webhook can attribute the new
 *     subscriptions row to the right user. Without this, the NOT NULL
 *     constraint on subscriptions.template_user_id would fail on insert.
 *   - We DON'T insert a subscriptions row here — the row is created by
 *     stripe-webhook when `customer.subscription.created` fires. That
 *     event includes the real provider_subscription_id (which we don't
 *     have yet) and the real plan_amount / plan_interval / status.
 *   - The `price_id` is operator-configured in Stripe Dashboard; the
 *     plan amount + interval come from there. We pass it through.
 *
 * NOTES
 *   - No payment_intents row is involved. Subscriptions are a separate
 *     code path that bypasses the one-off payment_intents/results
 *     lifecycle. The browser caller (SubscriptionManager) passes the
 *     price_id directly.
 *   - Email validation matches the pattern in payment-service.ts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

interface RequestBody {
  price_id?: string;
  customer_email?: string;
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

    const priceId = body.price_id?.trim();
    if (!priceId) {
      return jsonResponse(req, { error: 'price_id is required' }, 400);
    }

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

    return jsonResponse(req, { sessionId: session.id });
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
