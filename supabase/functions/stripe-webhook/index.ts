/**
 * Stripe Webhook Handler (Supabase Edge Function)
 * Processes Stripe webhook events for payments and subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

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

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Signature verification failed:', err.message);
      return new Response(
        JSON.stringify({
          error: `Webhook signature verification failed: ${err.message}`,
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
        processed: false,
      })
      .select()
      .single();

    if (webhookError) {
      console.error('Failed to store webhook event:', webhookError);
      throw webhookError;
    }

    // Process event based on type
    let processResult;
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
      JSON.stringify({ error: error.message || 'Internal server error' }),
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
) {
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

  if (error) {
    console.error('Failed to create payment_result:', error);
    throw error;
  }

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
) {
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
) {
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', session.metadata?.intent_id)
    .single();

  if (!intent) {
    console.warn(`No payment_intent found for checkout session: ${session.id}`);
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

  if (error) {
    console.error('Failed to create payment_result:', error);
    throw error;
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
) {
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
) {
  const subscription = event.data.object as Stripe.Subscription;

  const subscriptionData = {
    provider: 'stripe',
    provider_subscription_id: subscription.id,
    customer_email: subscription.metadata?.customer_email || '',
    plan_amount: subscription.items.data[0]?.price.unit_amount || 0,
    plan_interval:
      subscription.items.data[0]?.price.recurring?.interval || 'month',
    status: mapStripeSubscriptionStatus(subscription.status),
    current_period_start: new Date(subscription.current_period_start * 1000)
      .toISOString()
      .split('T')[0],
    current_period_end: new Date(subscription.current_period_end * 1000)
      .toISOString()
      .split('T')[0],
    next_billing_date:
      subscription.status === 'active'
        ? new Date(subscription.current_period_end * 1000)
            .toISOString()
            .split('T')[0]
        : null,
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
) {
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
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(
  supabase: any,
  event: Stripe.Event,
  webhookEventId: string
) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    return { handled: false };
  }

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      failed_payment_count: supabase.sql`failed_payment_count + 1`,
    })
    .eq('provider_subscription_id', invoice.subscription as string)
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
