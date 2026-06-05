/**
 * create-paypal-order Edge Function
 *
 * Creates a PayPal Order (intent=CAPTURE) for a one-off payment.
 *
 * Part of the payment Edge Functions epic (issue #100). Mirrors
 * create-stripe-checkout structure for the PayPal provider.
 *
 * REQUEST
 *   POST /functions/v1/create-paypal-order
 *   Authorization: Bearer <user JWT>
 *   Body: { payment_intent_id: string }
 *
 * RESPONSE
 *   200 OK: { orderId: string }
 *   400 Bad Request: { error: string } (validation / missing body fields / wrong type)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the intent)
 *   404 Not Found: { error: string } (intent does not exist)
 *   410 Gone: { error: string } (intent expired)
 *   500 Internal Server Error: { error: string } (PayPal call failed)
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY (getAuthenticatedUserId)
 *   - service-role client used for the intent lookup (bypasses RLS so we can
 *     read the intent regardless of policy state) — but we DO check
 *     `template_user_id === caller_user_id` manually before proceeding
 *   - PayPal order carries `custom_id = intent.id` so capture-paypal-order /
 *     the PayPal webhook can correlate the order back to our row
 *   - A `payment_results` row is inserted (status 'pending') keyed by the
 *     intent id + the returned PayPal order id for correlation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PayPal API base. Defaults to sandbox; override with PAYPAL_API_BASE for live
// (e.g. https://api-m.paypal.com).
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  payment_intent_id?: string;
}

/**
 * Fetch a PayPal OAuth2 access token via client_credentials.
 * Self-contained per PayPal function — no shared PayPal helper module.
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error(
      'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in function env'
    );
  }

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  return json.access_token as string;
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
    // Subscriptions go through create-paypal-subscription.
    if (intent.type !== 'one_time') {
      return jsonResponse(
        req,
        {
          error:
            'payment_intent type is not "one_time"; use create-paypal-subscription for recurring',
        },
        400
      );
    }

    // Get a PayPal access token (client_credentials).
    const accessToken = await getPayPalAccessToken();

    // Create the PayPal order. Amount is stored in CENTS in our DB; PayPal
    // wants a decimal string (e.g. 1999 -> "19.99"). custom_id carries our
    // intent id so capture / webhook can correlate back to our row.
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: intent.currency.toUpperCase(),
              value: (intent.amount / 100).toFixed(2),
            },
            description: intent.description ?? 'ScriptHammer payment',
            custom_id: intent.id,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return jsonResponse(
        req,
        { error: `PayPal order creation failed (${res.status}): ${detail}` },
        500
      );
    }

    const order = await res.json();

    // Record a pending payment_results row keyed by our intent id and the
    // PayPal order id, so capture / webhook can correlate later.
    const { error: insertError } = await supabase
      .from('payment_results')
      .insert({
        intent_id: intent.id,
        provider: 'paypal',
        transaction_id: order.id,
        status: 'pending',
      });

    if (insertError) {
      console.error(
        'create-paypal-order: failed to insert payment_results:',
        insertError
      );
      return jsonResponse(
        req,
        { error: 'Failed to record payment result' },
        500
      );
    }

    return jsonResponse(req, { orderId: order.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('create-paypal-order error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
