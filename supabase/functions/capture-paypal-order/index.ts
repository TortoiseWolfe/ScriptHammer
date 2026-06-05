/**
 * capture-paypal-order Edge Function
 *
 * Captures a previously-created PayPal order after the buyer approves it in
 * the PayPal UI. Called by the browser via approvePayPalOrder()
 * (src/lib/payments/paypal.ts) once the PayPal SDK fires onApprove.
 *
 * Phase 0b of the payment Edge Functions epic (issue #100).
 *
 * REQUEST
 *   POST /functions/v1/capture-paypal-order
 *   Authorization: Bearer <user JWT>
 *   Body: { order_id: string }   // the PayPal order id (== payment_results.transaction_id)
 *
 * RESPONSE
 *   200 OK: { status: string }   // raw PayPal capture status; caller checks status === 'COMPLETED'
 *   400 Bad Request: { error: string } (validation / missing body fields)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the underlying intent)
 *   404 Not Found: { error: string } (no payment_results row for this order_id)
 *   405 Method Not Allowed: { error: string }
 *   500 Internal Server Error: { error: string } (PayPal call failed)
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY (getAuthenticatedUserId)
 *   - service-role client used for the payment_results lookup (bypasses RLS so
 *     we can read the row regardless of policy state) — but we DO check
 *     `payment_intents.template_user_id === caller_user_id` manually before
 *     capturing, because the service-role client bypasses RLS.
 *   - The order_id is matched against payment_results.transaction_id, which was
 *     written by create-paypal-order when the order was created. We resolve the
 *     owning intent through the result row's intent_id, then verify ownership on
 *     payment_intents.template_user_id.
 *   - On capture we record verification_method = 'redirect' (the buyer-redirect
 *     flow), distinct from the asynchronous 'webhook' verification path.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PayPal REST API base. Defaults to sandbox; override PAYPAL_API_BASE in the
// function env to point at live (https://api-m.paypal.com).
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  order_id?: string;
}

/**
 * Fetch a PayPal OAuth2 access token via client-credentials grant.
 * Self-contained on purpose — each PayPal function keeps its own copy so the
 * functions stay independently deployable.
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
    throw new Error(`PayPal token request failed (${res.status}): ${detail}`);
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

    const orderId = body.order_id?.trim();
    if (!orderId) {
      return jsonResponse(req, { error: 'order_id is required' }, 400);
    }

    // Look up the payment_results row via service-role (bypasses RLS so we can
    // read the row), joining the owning intent so we can do the ownership check
    // ourselves below.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: result, error: fetchError } = await supabase
      .from('payment_results')
      .select('id, intent_id, payment_intents!inner(template_user_id)')
      .eq('transaction_id', orderId)
      .single();

    if (fetchError || !result) {
      return jsonResponse(req, { error: 'payment_result not found' }, 404);
    }

    // The embedded relation may come back as an object or a single-element
    // array depending on PostgREST's inference; normalize either shape.
    const intent = Array.isArray(result.payment_intents)
      ? result.payment_intents[0]
      : result.payment_intents;

    // Ownership check (service-role bypassed RLS, so verify manually).
    if (!intent || intent.template_user_id !== userId) {
      return jsonResponse(
        req,
        { error: 'Caller does not own this payment_result' },
        403
      );
    }

    // Capture the order via the PayPal Orders v2 API.
    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '',
      }
    );

    if (!captureRes.ok) {
      const detail = await captureRes.text();
      throw new Error(
        `PayPal capture failed (${captureRes.status}): ${detail}`
      );
    }

    const capture = await captureRes.json();
    const status: string = capture.status;

    // Record the redirect-flow outcome. The asynchronous webhook path may also
    // update this row, but the buyer-redirect capture is recorded here.
    await supabase
      .from('payment_results')
      .update({
        status: status === 'COMPLETED' ? 'succeeded' : 'failed',
        verification_method: 'redirect',
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    return jsonResponse(req, { status });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('capture-paypal-order error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
