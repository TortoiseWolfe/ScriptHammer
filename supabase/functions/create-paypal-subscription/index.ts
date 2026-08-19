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
 *   Body: { product_id: string, customer_email: string }
 *
 * RESPONSE
 *   200 OK: { subscriptionId: string }
 *   400 Bad Request: { error: string } (validation)
 *   401 Unauthorized: { error: string }
 *   500 Internal Server Error: { error: string }
 *
 * SECURITY MODEL
 *   - JWT verified via SUPABASE_ANON_KEY (auto-injected; NEXT_PUBLIC_ fallback)
 *   - The caller's user_id flows into PayPal's subscription `custom_id` so the
 *     webhook can attribute the new subscriptions row to the right user. The
 *     `paypal-webhook` reads `resource.custom_id` to set
 *     `subscriptions.template_user_id` on BILLING.SUBSCRIPTION.ACTIVATED.
 *   - We DON'T insert a subscriptions row here — the row is created by
 *     `paypal-webhook` when the subscription lifecycle events fire. That event
 *     carries the real provider_subscription_id, plan amount/interval, and
 *     status. This mirrors create-stripe-subscription, which likewise leaves
 *     the row to its webhook.
 *   - THE PLAN COMES FROM THE CATALOG, never from the request (#774, #559).
 *     The caller names a `product_id`; `products.paypal_plan_id` supplies the
 *     plan, and a request that names its own `plan_id` is refused outright.
 *     The rules live in `./resolve.ts` so they are testable without Deno.
 *
 *     This comment used to say the plan was "operator-configured in the PayPal
 *     Dashboard ... we pass it through". The first half was aspiration and the
 *     second half was the bug: whatever the browser sent went to PayPal
 *     unvalidated, so a tampered request could name any plan in the account.
 *
 * NOTES
 *   - No payment_intents row is involved. Subscriptions are a separate code
 *     path that bypasses the one-off payment_intents/results lifecycle.
 *   - PAYPAL_API_BASE defaults to the sandbox host; override it for live.
 *   - Email validation matches the pattern in payment-service.ts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';
import {
  resolvePayPalSubscription,
  type PayPalSubscriptionProductRow,
} from './resolve.ts';

const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  product_id?: string;
  customer_email?: string;
  /**
   * Never honoured. Declared only so a request that still sends it is REFUSED
   * rather than silently ignored — see the note in `./resolve.ts`.
   */
  plan_id?: unknown;
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

    const productId = body.product_id?.trim();
    if (!productId) {
      return jsonResponse(req, { error: 'product_id is required' }, 400);
    }

    const customerEmail = body.customer_email?.trim().toLowerCase();
    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return jsonResponse(
        req,
        { error: 'customer_email is required and must be a valid email' },
        400
      );
    }

    // Service-role client: the catalog read must not be subject to the caller's
    // RLS. We deliberately do NOT write the subscriptions row here — that row is
    // created by `paypal-webhook` on BILLING.SUBSCRIPTION.ACTIVATED (mirroring
    // create-stripe-subscription).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Catalog lookup — the SAME shape create-stripe-subscription uses.
    const { data: productRow, error: productError } = await supabase
      .from('products')
      .select(
        'id, name, type, interval, active, paypal_plan_id, currency, amount'
      )
      .eq('id', productId)
      .maybeSingle();
    if (productError) {
      console.error(
        'create-paypal-subscription: product lookup failed',
        productError
      );
      return jsonResponse(req, { error: 'Internal server error' }, 500);
    }

    // Every plan rule lives in the pure resolver so it is testable without Deno.
    const decision = resolvePayPalSubscription({
      product: (productRow as PayPalSubscriptionProductRow | null) ?? null,
      sentPlanId: body.plan_id,
    });
    if (decision.kind === 'refuse') {
      return jsonResponse(req, { error: decision.error }, decision.status);
    }
    const planId = decision.planId;

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
