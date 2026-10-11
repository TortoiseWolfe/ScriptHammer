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
 *   200 OK: { sessionId: string, url: string }
 *   400 Bad Request: { error: string } (validation / missing body fields)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the intent)
 *   404 Not Found: { error: string } (intent does not exist)
 *   409 Conflict: { error, code: 'already_paid' } (the purchase's retry chain is already paid, #1342,
 *     or an earlier session for it is complete at Stripe, #1345)
 *   410 Gone: { error: string } (intent expired)
 *   500 Internal Server Error: { error, code? } (Stripe call failed; the paid check could not be read;
 *     'session_check_failed': an earlier session could not be checked or closed (#1345);
 *     'session_record_failed': this session could not be recorded, so it was expired)
 *
 * SECURITY MODEL
 *   - JWT verified via SUPABASE_ANON_KEY (auto-injected; NEXT_PUBLIC_ fallback)
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
import { chainIntentIds, gateOnChainPaid } from '../_shared/payment-chain.ts';
import { retirePriorSessions } from '../_shared/checkout-sessions.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
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
        'id, template_user_id, amount, currency, description, customer_email, expires_at, type, metadata'
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

    // NOT FOR A PURCHASE ALREADY PAID (#1342). Asked before a session exists, because
    // once one does the buyer can pay it, and nothing after this point can stop that. Read errors refuse too (500): the alternative to
    // "could not confirm it is unpaid" is charging on a guess.
    const gate = await gateOnChainPaid(supabase, intent.id);
    if (gate.kind === 'refuse') {
      return jsonResponse(
        req,
        { error: gate.error, code: gate.code },
        gate.status
      );
    }

    // NO SECOND OPEN SESSION FOR ONE PURCHASE (#1345). The gate above sees only what the webhooks
    // have recorded. A session already paid at Stripe whose webhook has not landed, or one still
    // open and payable, is invisible to it, and two open sessions could both be paid. So ask Stripe
    // about every session recorded for the chain: expire the open ones, refuse if one is complete.
    // Any failure refuses (500): proceeding would leave an earlier session open beside this one.
    let chainIds: string[];
    try {
      chainIds = await chainIntentIds(supabase, intent.id);
    } catch (chainError) {
      console.error(
        'create-stripe-checkout: could not read the retry chain',
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
      {
        // Only sessions young enough to still be open: Stripe Checkout sessions last at most 24
        // hours, so an older one is expired or complete, and a complete one that old with no
        // success recorded is a webhook failure Webhook Liveness already reports. Without the
        // bound, every checkout would re-fetch every session the chain ever had (blind review).
        recorded: async (ids) => {
          const { data, error } = await supabase
            .from('stripe_checkout_sessions')
            .select('session_id')
            .in('intent_id', ids)
            .gte(
              'created_at',
              new Date(Date.now() - 25 * 3600_000).toISOString()
            );
          if (error) throw error;
          return (data ?? []).map((r: { session_id: string }) => r.session_id);
        },
        retrieve: async (id) => {
          try {
            const s = await stripe.checkout.sessions.retrieve(id);
            return {
              id: s.id,
              status: s.status,
              payment_status: s.payment_status,
            };
          } catch (e) {
            // Recorded under other keys (a test/live switch, another account): skipped, because
            // failing here would refuse this chain every checkout until its intent expired.
            if ((e as { code?: string })?.code === 'resource_missing')
              return null;
            throw e;
          }
        },
        expire: async (id) => {
          await stripe.checkout.sessions.expire(id);
        },
      },
      chainIds
    );
    if (retire.kind === 'refuse') {
      return jsonResponse(
        req,
        { error: retire.error, code: retire.code },
        retire.status
      );
    }
    // The only trace of why a buyer's other tab stopped working, besides the Stripe dashboard:
    // stripe-webhook acknowledges checkout.session.expired without recording it.
    if (retire.expired.length) {
      console.log(
        `create-stripe-checkout: expired ${retire.expired.length} earlier session(s) for ${intent.id}'s chain: ${retire.expired.join(', ')}`
      );
    }

    // Create the Stripe Checkout Session.
    // The metadata.intent_id is critical — stripe-webhook reads it to
    // correlate `payment_intent.succeeded` back to our row.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // CARD ONLY, and #1345 depends on it: retiring earlier sessions refuses on any COMPLETE one,
      // which is right only because a card session completes paid. A delayed method (bank debit)
      // completes unpaid and may later fail, which would leave the chain refused for good.
      // scripts/__tests__/checkout-retires-prior-sessions.test.js pins this line.
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
          // Carried so stripe-webhook can report the sale to OpenAI Ads once payment is
          // PROVEN. Stripe returns this on the payment_intent.succeeded event, which is the
          // only moment we know money actually moved. Absent for organic traffic.
          ...(typeof intent.metadata?.oppref === 'string'
            ? { oppref: intent.metadata.oppref }
            : {}),
        },
      },
      success_url: `${siteUrl}/payment-result?session_id={CHECKOUT_SESSION_ID}&status=succeeded`,
      cancel_url: `${siteUrl}/payment-result?status=cancelled`,
      // Use our intent id as the client_reference_id for easy lookup
      // in the Stripe dashboard.
      client_reference_id: intent.id,
    });

    // RECORD IT, OR CLOSE IT (#1345). A session nothing has recorded is one the next call cannot
    // find to expire. This one's URL is never returned, so nobody is sent to it; expiring it is a
    // safety net, best effort and logged, and the buyer is asked to try again.
    const { error: recordError } = await supabase
      .from('stripe_checkout_sessions')
      .insert({ session_id: session.id, intent_id: intent.id });
    if (recordError) {
      console.error(
        `create-stripe-checkout: could not record session ${session.id}`,
        recordError
      );
      await stripe.checkout.sessions
        .expire(session.id)
        .catch((e: unknown) =>
          console.error(
            `create-stripe-checkout: could not expire unrecorded session ${session.id}`,
            e
          )
        );
      return jsonResponse(
        req,
        {
          error: 'Could not start this payment. Please try again.',
          code: 'session_record_failed',
        },
        500
      );
    }

    // Return the hosted Checkout URL alongside the id: Stripe.js removed
    // redirectToCheckout (changelog 2025-09-30 "clover"), so the client
    // navigates to session.url directly.
    return jsonResponse(req, { sessionId: session.id, url: session.url });
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
