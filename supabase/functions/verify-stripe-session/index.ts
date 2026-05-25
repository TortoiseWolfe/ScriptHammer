/**
 * verify-stripe-session Edge Function
 *
 * Wraps stripe.checkout.sessions.retrieve(session_id) for the browser to
 * check the immediate post-redirect status of a checkout session.
 *
 * Phase 0a of the payment Edge Functions epic (issue #100, sub-issue #101).
 *
 * REQUEST
 *   POST /functions/v1/verify-stripe-session
 *   Authorization: Bearer <user JWT>
 *   Body: { session_id: string }
 *
 * RESPONSE
 *   200 OK: { payment_status: 'paid' | 'unpaid' | 'no_payment_required' }
 *   400 Bad Request: { error: string }
 *   401 Unauthorized: { error: string }
 *   403 Forbidden: { error: string } (caller does not own the underlying intent)
 *   404 Not Found: { error: string } (session id unknown to Stripe)
 *   500 Internal Server Error: { error: string }
 *
 * NOTES
 *   - This is the redirect-time UI's "did the payment go through?" check.
 *     The authoritative status comes from `stripe-webhook` writing
 *     `payment_results.status='succeeded'` — that's the source of truth.
 *     This function exists so the success page can render immediately
 *     without waiting for the webhook round-trip.
 *   - Stripe's session embeds the metadata we set in create-stripe-checkout
 *     (`intent_id`). We use that to perform the ownership check — the
 *     caller must own the intent the session was created for.
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

interface RequestBody {
  session_id?: string;
}

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

    const sessionId = body.session_id?.trim();
    if (!sessionId) {
      return jsonResponse(req, { error: 'session_id is required' }, 400);
    }

    // Retrieve session from Stripe. Pull payment_intent to access metadata.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
    } catch (err) {
      // Stripe returns 404-shaped errors for unknown session ids
      const stripeErr = err as Stripe.errors.StripeError;
      if (stripeErr.statusCode === 404) {
        return jsonResponse(req, { error: 'session_id not found' }, 404);
      }
      throw err;
    }

    // Ownership check via the intent_id metadata that create-stripe-checkout
    // attached to payment_intent_data.metadata.
    const paymentIntent = session.payment_intent;
    const intentId =
      typeof paymentIntent === 'object' && paymentIntent
        ? (paymentIntent.metadata?.intent_id as string | undefined)
        : undefined;

    if (!intentId) {
      // No metadata → can't verify ownership → reject
      return jsonResponse(
        req,
        {
          error: 'session is not associated with a ScriptHammer payment_intent',
        },
        403
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: intent, error: fetchError } = await supabase
      .from('payment_intents')
      .select('template_user_id')
      .eq('id', intentId)
      .single();

    if (fetchError || !intent) {
      return jsonResponse(req, { error: 'payment_intent not found' }, 404);
    }

    if (intent.template_user_id !== userId) {
      return jsonResponse(
        req,
        { error: 'Caller does not own this session' },
        403
      );
    }

    return jsonResponse(req, {
      payment_status: session.payment_status,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('verify-stripe-session error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
