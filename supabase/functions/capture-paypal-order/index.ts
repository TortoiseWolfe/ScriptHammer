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
 *   409 Conflict: { error, code: 'already_paid' } (another attempt in the chain is paid, #1342,
 *     or a Stripe session for the chain is complete at Stripe, #1347)
 *   500 Internal Server Error: { error, code? } (PayPal call failed; 'paid_check_failed': the paid
 *     check could not be read; 'session_check_failed': the chain's Stripe sessions could not be
 *     checked or closed, #1347. In both coded cases nothing was captured)
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
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { chainIntentIds, gateOnChainPaid } from '../_shared/payment-chain.ts';
import {
  retirePriorSessions,
  sessionDepsFor,
} from '../_shared/checkout-sessions.ts';

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

/**
 * A Stripe client, built only when this purchase has recorded Stripe sessions to close (#1347).
 * A PayPal-only fork has no Stripe key and no sessions, and its captures never reach this. With
 * sessions recorded and no key, it throws, and the retirement refuses with 500: assuming the
 * sessions are closed would be the double charge this exists to stop.
 */
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set, but this purchase has Stripe sessions to close'
    );
  }
  stripeClient ??= new Stripe(key, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });
  return stripeClient;
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

    // AND NO STRIPE SESSION LEFT PAYABLE BESIDE IT (#1347). The gate above sees what the webhooks
    // have recorded. A Stripe session for this purchase that is still open could be paid after
    // this capture, and one already complete at Stripe (its webhook not yet landed) means the
    // buyer has paid there. So, before capturing: expire the chain's open Stripe sessions, and
    // refuse if one is complete. Same rules, and the same code, as create-stripe-checkout.
    let chainIds: string[];
    try {
      chainIds = await chainIntentIds(supabase, result.intent_id);
    } catch (chainError) {
      console.error(
        'capture-paypal-order: could not read the retry chain',
        chainError
      );
      return jsonResponse(
        req,
        {
          error: 'Could not prepare this payment. Please try again.',
          code: 'session_check_failed',
        },
        500
      );
    }
    const retire = await retirePriorSessions(
      sessionDepsFor(supabase, getStripe),
      chainIds
    );
    if (retire.kind === 'refuse') {
      return jsonResponse(
        req,
        { error: retire.error, code: retire.code },
        retire.status
      );
    }
    if (retire.expired.length) {
      console.log(
        `capture-paypal-order: expired ${retire.expired.length} Stripe session(s) for ${result.intent_id}'s chain before capturing ${orderId}: ${retire.expired.join(', ')}`
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
    //   - paypal-webhook's fallback for a capture carrying no order id, which writes the intent's
    //     OLDEST PayPal row instead of the captured order's (#1346), when the buyer paid once.
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
    }

    // SWEEP AGAIN, BEST EFFORT (#1347). A Stripe session opened for this purchase in the seconds
    // since the retirement above would otherwise stay payable beside a capture that has now
    // succeeded. The payment has gone through, so nothing here changes the answer: it is logged,
    // and a COMPLETE session found now is a second charge, said so loudly.
    //
    // The chain is walked AGAIN: a Retry pressed during the capture is a new intent, and a session
    // opened on it is not in the list read before. A failed walk falls back to that list, inside
    // its own try, because a throw here would answer 500 for a payment PayPal has taken.
    //
    // Only on COMPLETED. Any other status is recorded as failed above, so by our own record the
    // purchase is unpaid and a Stripe session is still a way to pay it. A PENDING capture, which
    // PayPal may complete later, is the gap in that: #1349.
    if (status === 'COMPLETED') {
      let sweepIds = chainIds;
      try {
        sweepIds = await chainIntentIds(supabase, result.intent_id);
      } catch (chainError) {
        console.error(
          `capture-paypal-order: could not re-read the retry chain after capturing ${orderId}; sweeping the chain read before it`,
          chainError
        );
      }
      const sweep = await retirePriorSessions(
        sessionDepsFor(supabase, getStripe),
        sweepIds
      );
      if (sweep.kind === 'refuse' && sweep.code === 'already_paid') {
        console.error(
          `capture-paypal-order: a Stripe session for ${result.intent_id}'s chain is COMPLETE beside PayPal capture ${orderId}: a second charge, which needs a refund`
        );
      } else if (sweep.kind === 'refuse') {
        console.error(
          `capture-paypal-order: could not sweep Stripe sessions after capturing ${orderId}`
        );
      } else if (sweep.expired.length) {
        console.log(
          `capture-paypal-order: expired ${sweep.expired.length} Stripe session(s) opened during capture ${orderId}: ${sweep.expired.join(', ')}`
        );
      }
    }

    if (recordError) {
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
