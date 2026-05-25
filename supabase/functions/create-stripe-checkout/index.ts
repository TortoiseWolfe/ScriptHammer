/**
 * create-stripe-checkout Edge Function
 *
 * Creates a Stripe Checkout Session for a one-off payment.
 *
 * Phase 0a of the payment Edge Functions epic (issue #100, sub-issue #101).
 *
 * REQUEST
 *   POST /functions/v1/create-stripe-checkout
 *   Authorization: Bearer <user JWT>
 *   Body: { payment_intent_id: string }
 *
 * RESPONSE
 *   200 OK: { sessionId: string }
 *   400 Bad Request: { error: string } (validation / missing body fields)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the intent)
 *   404 Not Found: { error: string } (intent does not exist)
 *   410 Gone: { error: string } (intent expired)
 *   500 Internal Server Error: { error: string } (Stripe call failed)
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - service-role client used for the intent lookup (bypasses RLS so we can
 *     read the intent regardless of policy state) — but we DO check
 *     `template_user_id === caller_user_id` manually before proceeding
 *   - Stripe metadata carries `intent_id` so `stripe-webhook` can correlate
 *     `payment_intent.succeeded` events back to our row (see existing
 *     stripe-webhook/index.ts:171)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

interface RequestBody {
  payment_intent_id?: string;
}

serve(async (req) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  try {
    // Auth check
    const userId = await getAuthenticatedUserId(req);

    // Parse body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
    }

    const intentId = body.payment_intent_id?.trim();
    if (!intentId) {
      return jsonResponse(req, { error: 'payment_intent_id is required' }, 400);
    }

    // Look up the intent via service-role (bypasses RLS so we can read
    // the row, but we'll do the ownership check ourselves below).
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: intent, error: fetchError } = await supabase
      .from('payment_intents')
      .select(
        'id, template_user_id, amount, currency, description, customer_email, expires_at, type'
      )
      .eq('id', intentId)
      .single();

    if (fetchError || !intent) {
      return jsonResponse(req, { error: 'payment_intent not found' }, 404);
    }

    // Ownership check
    if (intent.template_user_id !== userId) {
      return jsonResponse(
        req,
        { error: 'Caller does not own this payment_intent' },
        403
      );
    }

    // Expiry check (matches isPaymentIntentExpired in payment-service.ts)
    const expiresAt = new Date(intent.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      return jsonResponse(req, { error: 'payment_intent has expired' }, 410);
    }

    // Type check — this function handles one-off payments only.
    // Subscriptions go through create-stripe-subscription.
    if (intent.type !== 'one_time') {
      return jsonResponse(
        req,
        {
          error:
            'payment_intent type is not "one_time"; use create-stripe-subscription for recurring',
        },
        400
      );
    }

    // Create the Stripe Checkout Session.
    // The metadata.intent_id is critical — stripe-webhook reads it to
    // correlate `payment_intent.succeeded` back to our row.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: intent.currency,
            product_data: {
              name: intent.description || 'ScriptHammer payment',
            },
            unit_amount: intent.amount,
          },
          quantity: 1,
        },
      ],
      customer_email: intent.customer_email,
      payment_intent_data: {
        metadata: {
          intent_id: intent.id,
        },
      },
      success_url: `${siteUrl}/payment-result?session_id={CHECKOUT_SESSION_ID}&status=succeeded`,
      cancel_url: `${siteUrl}/payment-result?status=cancelled`,
      // Use our intent id as the client_reference_id for easy lookup
      // in the Stripe dashboard.
      client_reference_id: intent.id,
    });

    return jsonResponse(req, { sessionId: session.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('create-stripe-checkout error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
