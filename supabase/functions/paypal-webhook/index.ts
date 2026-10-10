/**
 * PayPal Webhook Handler (Supabase Edge Function)
 * Processes PayPal webhook events for payments and subscriptions
 */

import { advanceOrderAndNotify } from '../_shared/advance-order.ts';
import {
  claimWebhookEvent,
  failWebhookEvent,
  finishWebhookEvent,
  replaySafe,
} from '../_shared/webhook-claim.ts';
import {
  canceledAtFromPayPal,
  failurePatch,
  laterOf,
  mapPayPalSubscription,
  paypalEventAt,
  snapshotDecision,
} from '../_shared/subscription-events.ts';
import {
  errorMessage,
  isOurIntentRef,
  type WebhookHandlerResult,
} from '../_shared/webhook-types.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paypalClientId =
  Deno.env.get('PAYPAL_CLIENT_ID') ??
  Deno.env.get('NEXT_PUBLIC_PAYPAL_CLIENT_ID')!;
const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!;
const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')!;
// Same base + sandbox default as the outbound PayPal fns. Hardcoding the
// LIVE host here meant sandbox creds could never verify a single sandbox
// webhook event (401 at oauth → every delivery rejected).
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

// Days a past-due subscription stays usable before expiring. Mirrors
// subscriptionConfig.gracePeriodDays in src/config/payment.ts (kept in sync
// manually — Deno can't import that browser-oriented module).
const GRACE_PERIOD_DAYS = 7;

serve(async (req) => {
  try {
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionTime = req.headers.get('paypal-transmission-time');
    const transmissionSig = req.headers.get('paypal-transmission-sig');
    const certUrl = req.headers.get('paypal-cert-url');
    const authAlgo = req.headers.get('paypal-auth-algo');

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !certUrl ||
      !authAlgo
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing PayPal verification headers' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyPayPalSignature({
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
      webhookId: paypalWebhookId,
      body,
    });

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid PayPal signature' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CLAIM BEFORE HANDLING (#1307). See _shared/webhook-claim.ts.
    const claim = await claimWebhookEvent(supabase, 'paypal', {
      provider_event_id: event.id,
      event_type: event.event_type,
      event_data: event.resource,
      signature: transmissionSig,
    });
    if (claim.kind === 'respond') {
      return new Response(
        JSON.stringify({
          received: claim.status === 200,
          message: claim.message,
        }),
        {
          status: claim.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    const webhookEvent = { id: claim.id };

    let processResult;
    try {
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
        case 'PAYMENT.SALE.COMPLETED':
          processResult = await handlePaymentCompleted(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'BILLING.SUBSCRIPTION.CREATED':
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.UPDATED':
          processResult = await handleSubscriptionEvent(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          processResult = await handleSubscriptionCancelled(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
          processResult = await handleSubscriptionPaymentFailed(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        default:
          processResult = { handled: false };
      }
    } catch (handlerError) {
      // Retry (500) while replay-safe and under the cap; otherwise give up with 200 and leave
      // the row permanently_failed for the liveness alarm.
      const outcome = await failWebhookEvent(
        supabase,
        claim.id,
        claim.attempt,
        replaySafe('paypal', event.event_type),
        handlerError
      );
      console.error(
        `PayPal handler failed for ${event.id} (attempt ${claim.attempt}, gave up: ${outcome.giveUp}):`,
        handlerError
      );
      return new Response(
        JSON.stringify({
          error: errorMessage(handlerError) || 'Internal server error',
          gave_up: outcome.giveUp,
        }),
        {
          status: outcome.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Throws if the row was not marked, so a success whose bookkeeping failed is retried.
    await finishWebhookEvent(supabase, claim.id, claim.attempt, {
      related_payment_id: processResult.related_payment_id,
      related_subscription_id: processResult.related_subscription_id,
    });

    return new Response(
      JSON.stringify({ received: true, processed: processResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage(error) || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyPayPalSignature(params: any): Promise<boolean> {
  try {
    // `encode` from std@0.168 takes `ArrayBuffer | string` and, given a string, does
    // `new TextEncoder().encode(data)` itself — so this produces byte-identical output to the
    // previous `base64Encode(new TextEncoder().encode(...))` while satisfying the signature.
    // The old form worked only because `new Uint8Array(u8)` happens to copy (#1153).
    const credentials = base64Encode(paypalClientId + ':' + paypalClientSecret);

    const authResponse = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + credentials,
      },
      body: 'grant_type=client_credentials',
    });

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const verifyResponse = await fetch(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({
          transmission_id: params.transmissionId,
          transmission_time: params.transmissionTime,
          transmission_sig: params.transmissionSig,
          cert_url: params.certUrl,
          auth_algo: params.authAlgo,
          webhook_id: params.webhookId,
          webhook_event: JSON.parse(params.body),
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal verification error:', error);
    return false;
  }
}

async function handlePaymentCompleted(
  supabase: any,
  event: any,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const resource = event.resource;
  // A PayPal Invoicing capture carries `INV2-...` here, and other integrations on the merchant
  // account set custom_id. Not ours, and permanent: check before a lookup that would throw.
  const intentId = resource.custom_id || resource.invoice_id;
  if (!isOurIntentRef(intentId)) {
    return { handled: false, reason: 'not_our_intent' };
  }

  // .maybeSingle() and a checked error. .single() ERRORS on zero rows and the error was never
  // read, so "could not read the intent" looked like "no such intent" and the capture was marked
  // processed unrecorded. A read error now throws, which the claim turns into a retry (#1307).
  const { data: intent, error: intentError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();
  if (intentError) throw intentError;

  if (!intent) return { handled: false };

  // #239: RECONCILE onto the ONE payment_results row for this intent — do NOT
  // blind-INSERT. create-paypal-order already wrote a 'pending' row for this
  // intent (transaction_id = PayPal ORDER id), and the buyer-redirect capture
  // (capture-paypal-order) may have already flipped it to 'succeeded'. This
  // webhook carries the PayPal CAPTURE id (resource.id) — a DIFFERENT value from
  // the order id — so the old blind INSERT produced a SECOND 'succeeded' row for
  // a single payment, double-counting PayPal in admin revenue. Update the
  // existing row instead (mirrors how the Stripe path keeps one row per payment).
  const chargedAmount = Math.round(
    parseFloat(resource.amount?.value || '0') * 100
  );
  const chargedCurrency =
    resource.amount?.currency_code?.toLowerCase() || 'usd';
  const providerFee = resource.transaction_fee
    ? Math.round(parseFloat(resource.transaction_fee.value) * 100)
    : null;

  // A read error here used to fall through to the INSERT below as if no row existed. That is a
  // second succeeded row on a retry; the per-intent unique index would refuse it, but the
  // answer to "could not read" is to retry, not to guess.
  const { data: existing, error: existingError } = await supabase
    .from('payment_results')
    .select('id')
    .eq('intent_id', intent.id)
    .eq('provider', 'paypal')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    // Authoritative webhook confirmation: mark succeeded + fill the amounts and
    // the verified flag. Keep verification_method as 'webhook' to record that
    // the out-of-band notification confirmed it (a prior 'redirect' is upgraded).
    const { data: updated, error: updateError } = await supabase
      .from('payment_results')
      .update({
        status: 'succeeded',
        charged_amount: chargedAmount,
        charged_currency: chargedCurrency,
        provider_fee: providerFee,
        webhook_verified: true,
        verification_method: 'webhook',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Same transition as the Stripe path (#1151). Both PayPal exits below mean the capture
    // completed, and advance-order.ts compare-and-swaps on `status = 'pending'`, so reaching it
    // twice for one order is harmless — which matters here, because the buyer-redirect capture
    // (capture-paypal-order) and this webhook can both describe the same payment.
    await advanceOrderAndNotify(supabase, {
      intentId: intent.id,
      amount: chargedAmount,
      currency: chargedCurrency,
      provider: 'paypal',
    });
    return { handled: true, related_payment_id: updated.id };
  }

  // Defensive fallback: no row exists for this intent (payment never went
  // through create-paypal-order). Insert one so the payment is still recorded.
  const { data: inserted, error: insertError } = await supabase
    .from('payment_results')
    .insert({
      intent_id: intent.id,
      provider: 'paypal',
      transaction_id: resource.id,
      status: 'succeeded',
      charged_amount: chargedAmount,
      charged_currency: chargedCurrency,
      provider_fee: providerFee,
      webhook_verified: true,
      verification_method: 'webhook',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Same transition as the Stripe path (#1151). Both PayPal exits below mean the capture
  // completed, and advance-order.ts compare-and-swaps on `status = 'pending'`, so reaching it
  // twice for one order is harmless — which matters here, because the buyer-redirect capture
  // (capture-paypal-order) and this webhook can both describe the same payment.
  await advanceOrderAndNotify(supabase, {
    intentId: intent.id,
    amount: chargedAmount,
    currency: chargedCurrency,
    provider: 'paypal',
  });
  return { handled: true, related_payment_id: inserted.id };
}

async function handleSubscriptionEvent(
  supabase: any,
  event: any,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const resource = event.resource;

  // create-paypal-subscription stamps the caller's user_id into the PayPal
  // subscription's custom_id so we can attribute the row here. Without it the
  // NOT NULL template_user_id constraint fails — mirrors the Stripe webhook's
  // metadata.template_user_id guard.
  const templateUserId = resource.custom_id;
  if (!templateUserId) {
    console.error(
      `PayPal subscription event missing custom_id (template_user_id); ` +
        `subscription_id=${resource.id}. Ensure the subscription was created ` +
        `via create-paypal-subscription, which sets custom_id.`
    );
    return { handled: false, reason: 'missing_custom_id' };
  }

  // THE PLAN COMES FROM THE CATALOG, where create-paypal-subscription chose it. The event's own
  // fields gave plan_interval 'regular' (tenure_type) and plan_amount 0 before the first payment,
  // and both violate the subscriptions CHECKs, so every such event failed (#1311,
  // RescueDogs#349). limit(1): two products sharing one plan id would describe the same plan.
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('interval, amount')
    .eq('paypal_plan_id', resource.plan_id ?? '')
    .limit(1)
    .maybeSingle();
  if (productError) throw productError;

  const mapped = mapPayPalSubscription(resource, product);
  if (mapped.kind === 'skip') {
    console.warn(
      `PayPal subscription ${resource.id} (${resource.status}) not stored: ${mapped.reason}`
    );
    return { handled: false, reason: mapped.reason };
  }

  // ORDERED BY THE PROVIDER'S CLOCK (#1307 stage 2): an older snapshot, replayed or delivered
  // out of order, must not roll the row back. See snapshotDecision.
  const eventAt = paypalEventAt(event.create_time, Date.now());
  const { data: stored, error: storedError } = await supabase
    .from('subscriptions')
    .select('status, last_provider_event_at')
    .eq('provider_subscription_id', resource.id)
    .maybeSingle();
  if (storedError) throw storedError;
  const decision = snapshotDecision(stored, eventAt);
  if (!decision.apply) {
    console.log(
      `PayPal subscription ${resource.id}: ${event.event_type} not applied (${decision.reason})`
    );
    return { handled: false, reason: decision.reason };
  }

  const subscriptionData = {
    provider: 'paypal',
    provider_subscription_id: resource.id,
    template_user_id: templateUserId,
    customer_email: resource.subscriber?.email_address || '',
    plan_amount: mapped.plan_amount,
    plan_interval: mapped.plan_interval,
    status: mapped.status,
    current_period_start: resource.billing_info?.last_payment?.time
      ? new Date(resource.billing_info.last_payment.time)
          .toISOString()
          .split('T')[0]
      : null,
    current_period_end: resource.billing_info?.next_billing_time
      ? new Date(resource.billing_info.next_billing_time)
          .toISOString()
          .split('T')[0]
      : null,
    next_billing_date:
      mapped.status === 'active' && resource.billing_info?.next_billing_time
        ? new Date(resource.billing_info.next_billing_time)
            .toISOString()
            .split('T')[0]
        : null,
    // The provider's time for this snapshot, so an older one can never overwrite it (#1307).
    last_provider_event_at: eventAt,
  };

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'provider_subscription_id' })
    .select()
    .single();

  if (error) {
    // idx_subscriptions_one_live_per_user rejects a second live subscription
    // for a user who already has one. Acknowledge (don't 500 → no provider
    // retry storm) and report the reason.
    if (error.code === '23505') {
      console.warn(
        'Duplicate live subscription rejected by unique index:',
        error.message
      );
      return { handled: false, reason: 'duplicate_live_subscription' };
    }
    throw error;
  }
  return { handled: true, related_subscription_id: sub.id };
}

async function handleSubscriptionCancelled(
  supabase: any,
  event: any,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const resource = event.resource;

  // NO ORDERING GUARD, deliberately: cancellation is terminal and canceled_at comes from the
  // event, so applying it again is harmless, and skipping it could leave a dead subscription
  // holding the user's one live slot. It STAMPS the provider time, so an older snapshot arriving
  // later is refused by snapshotDecision instead of reviving the row.
  const { data: stored, error: storedError } = await supabase
    .from('subscriptions')
    .select('last_provider_event_at')
    .eq('provider_subscription_id', resource.id)
    .maybeSingle();
  if (storedError) throw storedError;

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      last_provider_event_at: laterOf(
        stored?.last_provider_event_at ?? null,
        paypalEventAt(event.create_time, Date.now())
      ),
      // From the event, not now(), so a replay cannot move the date (#1307). This used to write
      // status_update_time into cancellation_reason, a timestamp where a reason belongs.
      canceled_at: canceledAtFromPayPal(
        resource,
        event.create_time,
        Date.now()
      ),
      cancellation_reason: resource.status_change_note || null,
    })
    .eq('provider_subscription_id', resource.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  // .single() ERRORED on zero rows, so a cancellation for a subscription this database never
  // recorded was a 500. Under the claim that is a permanent condition: a give-up and a daily red
  // alarm for nothing. Acknowledge it, as stripe-webhook does (#1307 prerequisite 6).
  if (!sub) {
    console.warn(
      `BILLING.SUBSCRIPTION.CANCELLED for a subscription not in the database: ${resource.id}`
    );
    return { handled: false, reason: 'unknown_subscription' };
  }
  return { handled: true, related_subscription_id: sub.id };
}

/**
 * Handle a failed subscription payment (BILLING.SUBSCRIPTION.PAYMENT.FAILED).
 * Mirrors the Stripe invoice.payment_failed handler: flip to grace_period,
 * increment the failure count, and start the grace clock. The supabase-js
 * client has no SQL-expression template tag, so the increment is a read-then-
 * write (PayPal delivers events for one subscription serially).
 */
async function handleSubscriptionPaymentFailed(
  supabase: any,
  event: any,
  _webhookEventId: string
): Promise<WebhookHandlerResult> {
  const resource = event.resource;
  const providerSubId = resource.id;

  // .maybeSingle() and a checked error: .single() errored on zero rows and the error was never
  // read, so "could not read" looked like "no subscription" (#1307).
  const { data: existing, error: readError } = await supabase
    .from('subscriptions')
    .select(
      'id, status, failed_payment_count, grace_period_expires, last_provider_event_at'
    )
    .eq('provider_subscription_id', providerSubId)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    return { handled: false };
  }

  // Idempotent, so a replay is safe (#1307): PayPal's own failed_payments_count, a live grace
  // deadline kept, no revival of an ended subscription, and no failure applied to one a newer
  // snapshot shows active again.
  const providerCount = resource.billing_info?.failed_payments_count;
  if (!(providerCount > 0)) {
    // The rule then adds one, which a replay would repeat. Whether PayPal has already counted
    // this failure when it sends the event is undocumented; this line records it if not.
    console.warn(
      `PayPal subscription ${providerSubId}: failed_payments_count is ${providerCount}; counting +1`
    );
  }
  const decision = failurePatch(existing, {
    providerCount,
    eventAt: paypalEventAt(event.create_time, Date.now()),
    nowMs: Date.now(),
    graceDays: GRACE_PERIOD_DAYS,
  });
  if (decision.kind === 'skip') {
    return { handled: false, reason: decision.reason };
  }

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update(decision.patch)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;
  return { handled: true, related_subscription_id: sub.id };
}
