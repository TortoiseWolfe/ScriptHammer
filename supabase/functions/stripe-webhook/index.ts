/**
 * Stripe Webhook Handler (Supabase Edge Function)
 * Processes Stripe webhook events for payments and subscriptions
 */

import { advanceOrderAndNotify } from '../_shared/advance-order.ts';
import {
  errorMessage,
  PG_UNIQUE_VIOLATION,
  resolveCheckoutIntentId,
  type WebhookHandlerResult,
} from '../_shared/webhook-types.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// ONE URL SERVES BOTH STRIPE MODES, AND EACH MODE HAS ITS OWN SIGNING SECRET.
// The live endpoint (we_1U5ZAe...) and the test endpoint (we_1U1geo...) both POST here.
// Reading only STRIPE_WEBHOOK_SECRET meant every LIVE delivery failed HMAC for a month
// while test traffic verified fine -- the live endpoint never delivered one event, and
// Stripe moved to disable it. The live secret was stored as STRIPE_WEBHOOK_SECRET_LIVE,
// following the .env.example convention for OPERATOR credentials that nothing reads.
// That convention is right for STRIPE_SECRET_KEY_LIVE and exactly wrong here: production
// MUST read this one (#1180). Try live first -- it is the traffic that pays.
const WEBHOOK_SECRETS = [
  Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE'),
  Deno.env.get('STRIPE_WEBHOOK_SECRET'),
].filter((s): s is string => !!s && s.length > 0);

// Days a past-due subscription stays usable before expiring. Mirrors
// subscriptionConfig.gracePeriodDays in src/config/payment.ts (kept in sync
// manually — Deno can't import that browser-oriented module).
const GRACE_PERIOD_DAYS = 7;

serve(async (req) => {
  try {
    // Get signature and body
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();

    // An unset secret used to be indistinguishable from a wrong one: both produced a
    // 400 that read as "Stripe sent us something bad". Say which it is.
    if (WEBHOOK_SECRETS.length === 0) {
      console.error(
        'No Stripe signing secret configured: set STRIPE_WEBHOOK_SECRET_LIVE ' +
          '(live endpoint) and/or STRIPE_WEBHOOK_SECRET (test endpoint).'
      );
      return new Response(
        JSON.stringify({ error: 'Webhook signing secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature. Must be the async variant: Deno's
    // SubtleCryptoProvider refuses synchronous use, so constructEvent()
    // throws on EVERY delivery (all events 400 before reaching handlers).
    let event: Stripe.Event | undefined;
    let lastErr: unknown;
    for (const secret of WEBHOOK_SECRETS) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          secret
        );
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!event) {
      console.error('Signature verification failed:', errorMessage(lastErr));
      return new Response(
        JSON.stringify({
          error: `Webhook signature verification failed: ${errorMessage(lastErr)}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed`);
      return new Response(
        JSON.stringify({ received: true, message: 'Event already processed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Store webhook event
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        provider: 'stripe',
        provider_event_id: event.id,
        event_type: event.type,
        event_data: event.data.object,
        signature: signature,
        signature_verified: true,
        livemode: event.livemode,
        processed: false,
      })
      .select()
      .single();

    if (webhookError) {
      console.error('Failed to store webhook event:', webhookError);
      throw webhookError;
    }

    // THE TEST ENDPOINT POSTS TO THIS SAME URL. A sandbox event therefore reaches these
    // PRODUCTION tables -- which is how 74 test-mode rows got into them. Keep the audit row
    // written above so the delivery stays visible, and touch nothing else. Returning 200 is
    // deliberate: a non-2xx here would count against BOTH endpoints being disabled (#1180).
    let processResult;
    if (event.livemode === false) {
      console.warn(
        `Test-mode event ${event.id} (${event.type}) acknowledged, not processed`
      );
      processResult = { handled: false, reason: 'test_mode_event' };
    } else {
      switch (event.type) {
        case 'payment_intent.succeeded':
          processResult = await handlePaymentIntentSucceeded(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'checkout.session.completed':
          processResult = await handleCheckoutSessionCompleted(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          processResult = await handleSubscriptionEvent(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'customer.subscription.deleted':
          processResult = await handleSubscriptionDeleted(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        case 'invoice.payment_failed':
          processResult = await handleInvoicePaymentFailed(
            supabase,
            event,
            webhookEvent.id
          );
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
          processResult = { handled: false };
      }
    }

    // Mark webhook event as processed
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        ...(processResult.related_payment_id && {
          related_payment_id: processResult.related_payment_id,
        }),
        ...(processResult.related_subscription_id && {
          related_subscription_id: processResult.related_subscription_id,
        }),
      })
      .eq('id', webhookEvent.id);

    return new Response(
      JSON.stringify({ received: true, processed: processResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage(error) || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  // Find corresponding payment_intent in database
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', paymentIntent.metadata?.intent_id)
    .single();

  if (!intent) {
    console.warn(`No payment_intent found for Stripe PI: ${paymentIntent.id}`);
    return { handled: false };
  }

  // Create payment_result record
  const { data: paymentResult, error } = await supabase
    .from('payment_results')
    .insert({
      intent_id: intent.id,
      provider: 'stripe',
      transaction_id: paymentIntent.id,
      status: 'succeeded',
      charged_amount: paymentIntent.amount,
      charged_currency: paymentIntent.currency,
      provider_fee: paymentIntent.application_fee_amount || null,
      webhook_verified: true,
      verification_method: 'webhook',
    })
    .select()
    .single();

  // BOTH payment handlers now write this row — checkout.session.completed was dead until the
  // correlation fix, so this was the only writer and could never collide. Now whichever event
  // Stripe delivers second hits idx_payment_results_one_succeeded_per_intent. A 500 here would
  // be retried for three days and count toward the endpoint being disabled; the payment is
  // already recorded, so acknowledge it and still advance (advance-order is compare-and-swap).
  if (error?.code === PG_UNIQUE_VIOLATION) {
    console.log(
      `payment_result for intent ${intent.id} already recorded by the other event — advancing only`
    );
    await advanceOrderAndNotify(supabase, {
      intentId: intent.id,
      amount: paymentIntent.amount ?? null,
      currency: paymentIntent.currency ?? null,
      provider: 'stripe',
    });
    return { handled: false, reason: 'payment_already_recorded' };
  }

  if (error) {
    console.error('Failed to create payment_result:', error);
    throw error;
  }

  // THE ORDER TRANSITION LIVES HERE (#1151), and nowhere earlier: payment is proven at this
  // line — `webhook_verified: true` was just written — and `intent.id` is the join key to
  // `orders.intent_id`. Never throws; see advance-order.ts for why a retry storm is the worse
  // failure.
  await advanceOrderAndNotify(supabase, {
    intentId: intent.id,
    amount: paymentIntent.amount ?? null,
    currency: paymentIntent.currency ?? null,
    provider: 'stripe',
  });

  return {
    handled: true,
    related_payment_id: paymentResult.id,
  };
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode === 'subscription') {
    // Handle subscription checkout
    return await handleSubscriptionCheckout(supabase, session, webhookEventId);
  } else {
    // Handle one-time payment checkout
    return await handlePaymentCheckout(supabase, session, webhookEventId);
  }
}

/**
 * Handle one-time payment checkout
 */
async function handlePaymentCheckout(
  supabase: any,
  session: Stripe.Checkout.Session,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  // session.metadata is EMPTY on every session this app creates — the intent id travels in
  // client_reference_id. See resolveCheckoutIntentId for what that cost.
  const intentId = resolveCheckoutIntentId(session);
  if (!intentId) {
    console.warn(
      `Checkout session ${session.id} carries neither metadata.intent_id nor client_reference_id`
    );
    return { handled: false, reason: 'no_intent_reference' };
  }

  const { data: intent } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (!intent) {
    console.warn(
      `No payment_intent ${intentId} for checkout session: ${session.id}`
    );
    return { handled: false };
  }

  const { data: paymentResult, error } = await supabase
    .from('payment_results')
    .insert({
      intent_id: intent.id,
      provider: 'stripe',
      transaction_id: session.payment_intent as string,
      status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
      charged_amount: session.amount_total,
      charged_currency: session.currency,
      webhook_verified: true,
      verification_method: 'webhook',
    })
    .select()
    .single();

  // See the matching note in handlePaymentIntentSucceeded: whichever event arrives second
  // collides on the one-succeeded-per-intent index, and must not 500.
  if (error?.code === PG_UNIQUE_VIOLATION) {
    console.log(
      `payment_result for intent ${intent.id} already recorded by the other event — advancing only`
    );
    if (session.payment_status === 'paid') {
      await advanceOrderAndNotify(supabase, {
        intentId: intent.id,
        amount: session.amount_total ?? null,
        currency: session.currency ?? null,
        provider: 'stripe',
      });
    }
    return { handled: false, reason: 'payment_already_recorded' };
  }

  if (error) {
    console.error('Failed to create payment_result:', error);
    throw error;
  }

  // THIS IS THE PATH PRODUCTION ACTUALLY TAKES (#1151). `/checkout` sends buyers to hosted
  // Stripe Checkout, so `checkout.session.completed` is the event a real purchase produces —
  // `payment_intent.succeeded` is the inline path. Both advance the order; the compare-and-swap
  // in advance-order.ts is what stops two events for one order emailing the buyer twice.
  //
  // Gated on the session actually being paid: an unpaid session is not a completed purchase.
  if (session.payment_status === 'paid') {
    await advanceOrderAndNotify(supabase, {
      intentId: intent.id,
      amount: session.amount_total ?? null,
      currency: session.currency ?? null,
      provider: 'stripe',
    });
  }

  return {
    handled: true,
    related_payment_id: paymentResult.id,
  };
}

/**
 * Handle subscription checkout
 */
async function handleSubscriptionCheckout(
  supabase: any,
  session: Stripe.Checkout.Session,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const subscription = session.subscription as string;

  // Subscription details will come via customer.subscription.created event
  return {
    handled: true,
    subscription_id: subscription,
  };
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionEvent(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;

  // template_user_id and customer_email come from the metadata that
  // create-stripe-subscription sets via subscription_data.metadata when
  // creating the Checkout Session. Without these the NOT NULL
  // constraints on subscriptions.template_user_id / customer_email fail.
  // (Phase 0b — issue #102 — paired this webhook fix with the new
  // create-stripe-subscription function.)
  const templateUserId = subscription.metadata?.template_user_id;
  const customerEmail = subscription.metadata?.customer_email;

  if (!templateUserId) {
    console.error(
      `customer.subscription event missing template_user_id metadata; ` +
        `subscription_id=${subscription.id}. Ensure the Checkout Session was ` +
        `created via create-stripe-subscription which sets ` +
        `subscription_data.metadata.template_user_id.`
    );
    return { handled: false };
  }

  // Pre-payment states never become rows: the table models real (paid)
  // subscriptions and its status CHECK has no 'pending'. Checkout fires
  // customer.subscription.created with status=incomplete BEFORE the card is
  // confirmed; the paid state arrives seconds later as .updated (active).
  if (subscription.status === 'incomplete') {
    return { handled: true, reason: 'incomplete_not_persisted' };
  }
  if (subscription.status === 'incomplete_expired') {
    // Abandoned checkout — only relevant if an earlier state made a row.
    await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('provider_subscription_id', subscription.id);
    return { handled: true, reason: 'incomplete_expired' };
  }

  // Stripe API 2025-03-31+ moved current_period_start/end from the
  // subscription onto its items; the payload shape follows the WEBHOOK
  // ENDPOINT's API version (2025+), not this SDK's pin. Read the item first,
  // fall back to the legacy top-level fields, and never throw on absence.
  const firstItem = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;
  const periodStartSecs =
    firstItem?.current_period_start ?? subscription.current_period_start;
  const periodEndSecs =
    firstItem?.current_period_end ?? subscription.current_period_end;
  const toDateString = (secs: number | undefined | null) =>
    secs ? new Date(secs * 1000).toISOString().split('T')[0] : null;

  // #242: Local 'canceling' = user canceled-at-period-end but STILL LIVE at
  // Stripe through the paid period. Stripe represents that as status=active +
  // cancel_at_period_end=true and fires .updated for it. Map it to 'canceling'
  // (NOT 'canceled') so the row keeps occupying the one-live-per-user slot until
  // Stripe finally fires customer.subscription.deleted at true period end (which
  // handleSubscriptionDeleted maps to 'canceled'). Previously this mapped to
  // 'canceled' immediately, dropping the row out of the live index and letting
  // the user start a second subscription while the first was still billing.
  const mappedStatus = mapStripeSubscriptionStatus(subscription.status);
  const localStatus =
    subscription.cancel_at_period_end && mappedStatus === 'active'
      ? 'canceling'
      : mappedStatus;

  const subscriptionData = {
    provider: 'stripe',
    provider_subscription_id: subscription.id,
    template_user_id: templateUserId,
    customer_email: customerEmail || '',
    plan_amount: firstItem?.price.unit_amount || 0,
    plan_interval: firstItem?.price.recurring?.interval || 'month',
    status: localStatus,
    current_period_start: toDateString(periodStartSecs),
    current_period_end: toDateString(periodEndSecs),
    next_billing_date:
      localStatus === 'active' ? toDateString(periodEndSecs) : null,
    // Reconcile cancellation fields both ways: a Stripe-side cancel carries
    // canceled_at; a resume (cancel_at_period_end back to false) clears it.
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    cancellation_reason: subscription.cancellation_details?.reason ?? null,
  };

  // Upsert subscription (create or update)
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'provider_subscription_id',
    })
    .select()
    .single();

  if (error) {
    // idx_subscriptions_one_live_per_user (partial unique index) rejects a
    // SECOND live subscription for a user who already has one. Don't 500 — the
    // provider would retry forever; acknowledge and report the reason instead.
    if (error.code === '23505') {
      console.warn(
        'Duplicate live subscription rejected by unique index:',
        error.message
      );
      return { handled: false, reason: 'duplicate_live_subscription' };
    }
    console.error('Failed to upsert subscription:', error);
    throw error;
  }

  return {
    handled: true,
    related_subscription_id: sub.id,
  };
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      cancellation_reason: subscription.cancellation_details?.reason || null,
    })
    .eq('provider_subscription_id', subscription.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  // .single() ERRORS ON ZERO ROWS, and that threw a 500 here. Stripe RETRIES a 500 for
  // three days and counts it toward disabling the endpoint, so a subscription we never
  // recorded -- one created outside the app, or predating the row -- turned an
  // unremarkable event into pressure on the whole webhook (#1180). Acknowledge it instead.
  if (!sub) {
    console.warn(
      `subscription.deleted for a subscription not in the database: ${subscription.id}`
    );
    return { handled: false, reason: 'unknown_subscription' };
  }

  return {
    handled: true,
    related_subscription_id: sub.id,
  };
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
): Promise<WebhookHandlerResult> {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    return { handled: false };
  }

  const providerSubId = invoice.subscription as string;

  // Read the current row so we can increment the failure count safely. The
  // supabase-js client has no SQL-expression template tag, so the previous
  // `supabase.sql\`failed_payment_count + 1\`` never incremented — it must be a
  // plain read-then-write. Webhook events for one subscription are delivered
  // serially, so this is not racy in practice.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, failed_payment_count')
    .eq('provider_subscription_id', providerSubId)
    .single();

  if (!existing) {
    return { handled: false };
  }

  // Start the grace clock now (the canonical YYYY-MM-DD TEXT date format used
  // elsewhere in this file). GRACE_PERIOD_DAYS mirrors
  // subscriptionConfig.gracePeriodDays in src/config/payment.ts (Deno can't
  // import that browser module, so the value is duplicated here).
  const gracePeriodExpires = new Date(
    Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0];

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'grace_period',
      failed_payment_count: (existing.failed_payment_count ?? 0) + 1,
      grace_period_expires: gracePeriodExpires,
    })
    .eq('provider_subscription_id', providerSubId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  return {
    handled: true,
    related_subscription_id: sub.id,
  };
}

/**
 * Map Stripe subscription status to our schema
 */
function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'grace_period',
    canceled: 'canceled',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    trialing: 'active', // Treat trial as active
    paused: 'canceled',
  };

  return statusMap[status] || 'canceled';
}
