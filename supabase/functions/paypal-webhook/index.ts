/**
 * PayPal Webhook Handler (Supabase Edge Function)
 * Processes PayPal webhook events for payments and subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paypalClientId = Deno.env.get('NEXT_PUBLIC_PAYPAL_CLIENT_ID')!;
const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!;
const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')!;

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

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'paypal')
      .eq('provider_event_id', event.id)
      .single();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ received: true, message: 'Event already processed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        provider: 'paypal',
        provider_event_id: event.id,
        event_type: event.event_type,
        event_data: event.resource,
        signature: transmissionSig,
        signature_verified: true,
        processed: false,
      })
      .select()
      .single();

    if (webhookError) throw webhookError;

    let processResult;
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
      default:
        processResult = { handled: false };
    }

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
    console.error('PayPal webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyPayPalSignature(params: any): Promise<boolean> {
  try {
    const credentials = base64Encode(
      new TextEncoder().encode(paypalClientId + ':' + paypalClientSecret)
    );

    const authResponse = await fetch(
      'https://api-m.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + credentials,
        },
        body: 'grant_type=client_credentials',
      }
    );

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const verifyResponse = await fetch(
      'https://api-m.paypal.com/v1/notifications/verify-webhook-signature',
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
) {
  const resource = event.resource;
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', resource.custom_id || resource.invoice_id)
    .single();

  if (!intent) return { handled: false };

  const { data: paymentResult, error } = await supabase
    .from('payment_results')
    .insert({
      intent_id: intent.id,
      provider: 'paypal',
      transaction_id: resource.id,
      status: 'succeeded',
      charged_amount: Math.round(
        parseFloat(resource.amount?.value || '0') * 100
      ),
      charged_currency: resource.amount?.currency_code?.toLowerCase() || 'usd',
      provider_fee: resource.transaction_fee
        ? Math.round(parseFloat(resource.transaction_fee.value) * 100)
        : null,
      webhook_verified: true,
      verification_method: 'webhook',
    })
    .select()
    .single();

  if (error) throw error;
  return { handled: true, related_payment_id: paymentResult.id };
}

async function handleSubscriptionEvent(
  supabase: any,
  event: any,
  webhookEventId: string
) {
  const resource = event.resource;
  const subscriptionData = {
    provider: 'paypal',
    provider_subscription_id: resource.id,
    customer_email: resource.subscriber?.email_address || '',
    plan_amount: Math.round(
      parseFloat(resource.billing_info?.last_payment?.amount?.value || '0') *
        100
    ),
    plan_interval:
      resource.billing_info?.cycle_executions?.[0]?.tenure_type?.toLowerCase() ||
      'month',
    status: mapPayPalSubscriptionStatus(resource.status),
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
      resource.status === 'ACTIVE' && resource.billing_info?.next_billing_time
        ? new Date(resource.billing_info.next_billing_time)
            .toISOString()
            .split('T')[0]
        : null,
  };

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'provider_subscription_id' })
    .select()
    .single();

  if (error) throw error;
  return { handled: true, related_subscription_id: sub.id };
}

async function handleSubscriptionCancelled(
  supabase: any,
  event: any,
  webhookEventId: string
) {
  const resource = event.resource;
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      cancellation_reason: resource.status_update_time || null,
    })
    .eq('provider_subscription_id', resource.id)
    .select()
    .single();

  if (error) throw error;
  return { handled: true, related_subscription_id: sub.id };
}

function mapPayPalSubscriptionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: 'active',
    SUSPENDED: 'past_due',
    CANCELLED: 'canceled',
    EXPIRED: 'expired',
    APPROVAL_PENDING: 'pending',
  };
  return statusMap[status] || 'canceled';
}
