/**
 * create-paypal-subscription Edge Function
 *
 * Creates a PayPal Billing Subscription for a recurring payment. The browser
 * uses the returned subscriptionId to approve the subscription via the PayPal
 * JS SDK; once the customer approves, PayPal fires
 * `BILLING.SUBSCRIPTION.ACTIVATED` and the existing `paypal-webhook` handler
 * upserts the `subscriptions` row.
 *
 * PayPal counterpart of create-stripe-subscription, part of the payment Edge
 * Functions epic (issue #100).
 *
 * REQUEST
 *   POST /functions/v1/create-paypal-subscription
 *   Authorization: Bearer <user JWT>
 *   Body: { plan_id: string, customer_email: string }
 *
 * RESPONSE
 *   200 OK: { subscriptionId: string }
 *   400 Bad Request: { error: string } (validation)
 *   401 Unauthorized: { error: string }
 *   500 Internal Server Error: { error: string }
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - The caller's user_id flows into PayPal's subscription `custom_id` so the
 *     webhook can attribute the new subscriptions row to the right user. The
 *     `paypal-webhook` reads `resource.custom_id` to set
 *     `subscriptions.template_user_id` on BILLING.SUBSCRIPTION.ACTIVATED.
 *   - We DON'T insert a subscriptions row here — the row is created by
 *     `paypal-webhook` when the subscription lifecycle events fire. That event
 *     carries the real provider_subscription_id, plan amount/interval, and
 *     status. This mirrors create-stripe-subscription, which likewise leaves
 *     the row to its webhook.
 *   - The `plan_id` is operator-configured in the PayPal Dashboard; the plan
 *     amount + interval come from there. We pass it through.
 *
 * NOTES
 *   - No payment_intents row is involved. Subscriptions are a separate code
 *     path that bypasses the one-off payment_intents/results lifecycle. The
 *     browser caller (createPayPalSubscription) passes the plan_id directly.
 *   - PAYPAL_API_BASE defaults to the sandbox host; override it for live.
 *   - Email validation matches the pattern in payment-service.ts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  plan_id?: string;
  customer_email?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fetch a PayPal OAuth2 access token via client-credentials. Kept inline so
 * each PayPal function stays self-contained. Throws on non-2xx.
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId =
    Deno.env.get('PAYPAL_CLIENT_ID') ??
    Deno.env.get('NEXT_PUBLIC_PAYPAL_CLIENT_ID') ??
    '';
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';

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
    throw new Error(
      `PayPal OAuth token request failed: ${res.status} ${detail}`
    );
  }

  const json = await res.json();
  return json.access_token;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  try {
    const userId = await getAuthenticatedUserId(req);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
    }

    const planId = body.plan_id?.trim();
    if (!planId) {
      return jsonResponse(req, { error: 'plan_id is required' }, 400);
    }

    const customerEmail = body.customer_email?.trim().toLowerCase();
    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return jsonResponse(
        req,
        { error: 'customer_email is required and must be a valid email' },
        400
      );
    }

    // Instantiate the service-role client for parity with the Stripe
    // template's structure. We deliberately do NOT write the subscriptions
    // row here — the row is created by `paypal-webhook` on
    // BILLING.SUBSCRIPTION.ACTIVATED (mirroring create-stripe-subscription).
    createClient(
      Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const accessToken = await getPayPalAccessToken();

    // Create the PayPal Billing Subscription. `custom_id` carries the
    // caller's user_id so `paypal-webhook` can attribute the resulting
    // subscriptions row to the right user (it reads `resource.custom_id`
    // to set subscriptions.template_user_id).
    const res = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        subscriber: { email_address: customerEmail },
        custom_id: userId,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('PayPal create-subscription failed:', res.status, detail);
      return jsonResponse(
        req,
        { error: 'Failed to create PayPal subscription' },
        500
      );
    }

    const sub = await res.json();

    return jsonResponse(req, { subscriptionId: sub.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('create-paypal-subscription error:', err);
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    );
  }
});
