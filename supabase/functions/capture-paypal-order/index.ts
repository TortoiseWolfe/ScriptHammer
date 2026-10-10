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
 *     + already_captured: true when this order's row was already succeeded (no second capture)
 *     + recorded: false when PayPal captured but our row could not be written (#1342)
 *   400 Bad Request: { error: string } (validation / missing body fields)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the underlying intent)
 *   404 Not Found: { error: string } (no payment_results row for this order_id)
 *   405 Method Not Allowed: { error: string }
 *   409 Conflict: { error, code: 'already_paid' } (another attempt in the chain is paid, #1342)
 *   500 Internal Server Error: { error, code? } (PayPal call failed, or code 'paid_check_failed':
 *     the paid check could not be read, so nothing was captured)
 *
 * SECURITY MODEL
 *   - JWT verified via SUPABASE_ANON_KEY (auto-injected; NEXT_PUBLIC_ fallback) (getAuthenticatedUserId)
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
import { getPayPalAccessToken } from '../_shared/paypal.ts';
import { gateOnChainPaid } from '../_shared/payment-chain.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PayPal REST API base. Defaults to sandbox; override PAYPAL_API_BASE in the
// function env to point at live (https://api-m.paypal.com).
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  order_id?: string;
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
      .select('id, intent_id, status, payment_intents!inner(template_user_id)')
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

    // ALREADY CAPTURED (#1342): this order's own row is succeeded, from a double-clicked approval
    // or a webhook that got there first. The buyer has paid. Say so, without asking PayPal to
    // capture again, and before the chain check below, which would call it "already paid".
    if (result.status === 'succeeded') {
      return jsonResponse(req, { status: 'COMPLETED', already_captured: true });
    }

    // NOT IF ANOTHER ATTEMPT IN THE CHAIN WAS PAID (#1342). Approving an order moves no money;
    // capturing it does, so this is the last point a second charge can be stopped rather than
    // refunded. Read errors refuse too (500).
    const gate = await gateOnChainPaid(supabase, result.intent_id);
    if (gate.kind === 'refuse') {
      return jsonResponse(
        req,
        { error: gate.error, code: gate.code },
        gate.status
      );
    }

    // Capture the order via the PayPal Orders v2 API.
    const accessToken = await getPayPalAccessToken(PAYPAL_API, (name) =>
      Deno.env.get(name)
    );
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
    const { error: recordError } = await supabase
      .from('payment_results')
      .update({
        status: status === 'COMPLETED' ? 'succeeded' : 'failed',
        verification_method: 'redirect',
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    // The write's result used to be discarded (#1342). PayPal HAS captured by this line; only the
    // record can fail, and the failure is now logged rather than lost.
    //
    // DO NOT READ A UNIQUE VIOLATION HERE AS "REFUND IT". It means another payment_results row for
    // THIS intent is already succeeded, and today that has two causes:
    //   - a second order on this intent captured in the window since the check above, which IS
    //     a second charge; or
    //   - paypal-webhook writing the intent's OLDEST PayPal row instead of the captured order's
    //     (#1342 stage 2), when the buyer paid exactly once.
    // Check the order in PayPal before refunding anything. And a race across two DIFFERENT intents
    // in one chain is not seen here at all: the index is per intent, so both writes succeed.
    //
    // The response's `recorded: false` is for the server's logs and callers that read it; the
    // buyer's page reads only `status`, which stays truthful because PayPal did capture.
    if (recordError) {
      console.error(
        `capture-paypal-order: PayPal captured order ${orderId} (${status}) but recording it failed`,
        recordError
      );
      return jsonResponse(req, { status, recorded: false });
    }

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
