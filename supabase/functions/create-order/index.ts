/**
 * create-order Edge Function — the only writer of price (#557, #558).
 *
 * REQUEST
 *   POST /functions/v1/create-order
 *   Authorization: Bearer <user JWT>   (an ANONYMOUS session is fine — FR-007,
 *                                       no account is required to buy)
 *   Idempotency-Key: <opaque>          (optional but strongly recommended)
 *   Body: { product_id, amount?, buyer_email, intake? }
 *
 * RESPONSE
 *   200 { order_id, intent_id, amount_charged, is_deposit, balance_due }
 *   400 validation      401 JWT        404 unknown/inactive product
 *   409 Idempotency-Key reused with a different payload
 *   503 the idempotency store could not be consulted (nothing was charged)
 *   500 anything else
 *
 * ALL DECISIONS LIVE IN ./resolve.ts, which imports nothing and is unit-tested
 * from tests/unit/create-order-resolve.test.ts. This file is plumbing: HTTP,
 * Deno, the Supabase client, and the two writes. That split is why this function
 * has real tests while its eleven siblings have none — theirs call serve() at
 * module top level with the handler inline, which their own test files complain
 * about (create-stripe-checkout/index.test.ts:17-21).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  type IdempotencyClaim,
} from '../_shared/idempotency.ts';
import {
  resolveOrder,
  fingerprintRequest,
  buildIntentRow,
  buildOrderRow,
  type ProductRow,
} from './resolve.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FN = 'create-order';

interface RequestBody {
  product_id?: string;
  amount?: unknown;
  buyer_email?: string;
  intake?: Record<string, unknown>;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  try {
    // An anonymous session still yields a real auth.uid(), so this is the guest
    // path too. The uid goes on the intent, which keeps create-stripe-checkout's
    // existing ownership check working unchanged.
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
    const buyerEmail = body.buyer_email?.trim().toLowerCase();
    if (!buyerEmail || !buyerEmail.includes('@')) {
      return jsonResponse(
        req,
        { error: 'a valid buyer_email is required' },
        400
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const idempotencyKey = req.headers.get('Idempotency-Key');
    const fingerprint = fingerprintRequest({
      productId,
      amount: body.amount,
      buyerEmail,
    });

    // CLAIM BEFORE WORKING. Inserting the key first makes the unique constraint
    // on (idempotency_key, function_name) the arbiter, so two concurrent
    // requests with the same key cannot both proceed — one wins the insert, the
    // other reads the winner's row. A check-then-work protocol would let both
    // pass the check before either wrote.
    let claim: IdempotencyClaim = { state: 'miss' };
    if (idempotencyKey) {
      claim = await claimIdempotencyKey(
        supabase,
        idempotencyKey,
        FN,
        fingerprint
      );
    }

    // Product lookup is skipped entirely on a replay — see resolve.ts for why a
    // completed purchase must not be re-priced.
    let product: ProductRow | null = null;
    if (claim.state !== 'hit') {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, amount, amount_mode, min_amount, max_amount, currency, type, interval, active, metadata, name'
        )
        .eq('id', productId)
        .maybeSingle();
      if (error) {
        console.error(`${FN}: product lookup failed`, error);
        return jsonResponse(req, { error: 'Internal server error' }, 500);
      }
      product = (data as ProductRow | null) ?? null;
    }

    const decision = resolveOrder({
      product,
      submittedAmount: body.amount,
      idempotencyKey,
      lookup: claim,
      requestFingerprint: fingerprint,
    });

    if (decision.kind === 'refuse') {
      return jsonResponse(req, { error: decision.error }, decision.status);
    }
    if (decision.kind === 'replay') {
      return jsonResponse(req, decision.result, 200);
    }

    // ---- proceed: two writes, intent then order --------------------------
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .insert(
        buildIntentRow({
          userId,
          amountCents: decision.amountCents,
          product: {
            id: productId,
            currency: product!.currency,
            type: product!.type,
            interval: product!.interval,
            name: product!.name,
          },
          buyerEmail,
          isDeposit: decision.isDeposit,
          idempotencyKey,
        })
      )
      .select('id')
      .single();

    if (intentError || !intent) {
      console.error(`${FN}: intent insert failed`, intentError);
      return jsonResponse(req, { error: 'Could not create payment' }, 500);
    }

    const balanceDue = decision.fullPriceCents - decision.amountCents;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(
        buildOrderRow({
          intentId: intent.id,
          productId,
          buyerUserId: userId,
          buyerEmail,
          amountCents: decision.amountCents,
          intake: body.intake,
        })
      )
      .select('id')
      .single();

    if (orderError || !order) {
      console.error(`${FN}: order insert failed`, orderError);
      return jsonResponse(req, { error: 'Could not create order' }, 500);
    }

    const result = {
      order_id: order.id,
      intent_id: intent.id,
      amount_charged: decision.amountCents,
      is_deposit: decision.isDeposit,
      balance_due: balanceDue,
    };

    if (idempotencyKey) {
      // Store the result so a retry replays it. A failure here is logged and
      // NOT fatal: the order exists and the buyer must not be told otherwise.
      // The cost is that one retry could duplicate — which the claim row still
      // prevents, since it was written before the work.
      await completeIdempotencyKey(supabase, idempotencyKey, FN, result);
    }

    return jsonResponse(req, result, 200);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error(`${FN} error:`, err);
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    );
  }
});
