/**
 * resume-subscription Edge Function
 *
 * Reactivates a previously-canceled recurring subscription, provider-agnostic
 * (Stripe or PayPal).
 *
 * Part of the payment Edge Functions epic (issue #100).
 *
 * REQUEST
 *   POST /functions/v1/resume-subscription
 *   Authorization: Bearer <user JWT>
 *   Body: { subscription_id: string }
 *
 * RESPONSE
 *   200 OK: { success: true }
 *   400 Bad Request: { error: string } (validation / missing body fields /
 *     subscription is not canceled)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the subscription)
 *   404 Not Found: { error: string } (subscription does not exist)
 *   500 Internal Server Error: { error: string } (provider call failed)
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY (getAuthenticatedUserId)
 *   - service-role client used for the subscription lookup + update (bypasses
 *     RLS so we can read/write the row regardless of policy state) — but we DO
 *     check `template_user_id === caller_user_id` manually before proceeding
 *   - Only subscriptions in status='canceled' may be resumed; any other status
 *     is rejected with 400 to avoid double-activation or resuming dead subs
 *   - Stripe: clears `cancel_at_period_end` on the provider subscription
 *   - PayPal: activates the provider subscription via the Billing API; a fresh
 *     OAuth2 access token is minted per request (self-contained helper below)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Sandbox by default; override with PAYPAL_API_BASE for live.
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  subscription_id?: string;
}

/**
 * Mint a PayPal OAuth2 access token (client_credentials grant).
 * Self-contained so this function has no cross-function runtime coupling.
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error(
      'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in function env'
    );
  }

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

    const subscriptionId = body.subscription_id?.trim();
    if (!subscriptionId) {
      return jsonResponse(req, { error: 'subscription_id is required' }, 400);
    }

    // Look up the subscription via service-role (bypasses RLS so we can read
    // the row, but we'll do the ownership check ourselves below).
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select(
        'id, template_user_id, provider, provider_subscription_id, status'
      )
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return jsonResponse(req, { error: 'subscription not found' }, 404);
    }

    // Ownership check
    if (subscription.template_user_id !== userId) {
      return jsonResponse(
        req,
        { error: 'Caller does not own this subscription' },
        403
      );
    }

    // Only canceled subscriptions can be resumed.
    if (subscription.status !== 'canceled') {
      return jsonResponse(req, { error: 'subscription is not canceled' }, 400);
    }

    // Reactivate with the provider.
    if (subscription.provider === 'stripe') {
      await stripe.subscriptions.update(subscription.provider_subscription_id, {
        cancel_at_period_end: false,
      });
    } else if (subscription.provider === 'paypal') {
      const accessToken = await getPayPalAccessToken();
      const activateRes = await fetch(
        `${PAYPAL_API}/v1/billing/subscriptions/${subscription.provider_subscription_id}/activate`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'Customer requested reactivation',
          }),
        }
      );

      if (!activateRes.ok) {
        const detail = await activateRes.text();
        throw new Error(
          `PayPal activate request failed: ${activateRes.status} ${detail}`
        );
      }
    } else {
      return jsonResponse(
        req,
        { error: `Unsupported provider: ${subscription.provider}` },
        400
      );
    }

    // Mark the subscription active again locally.
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        canceled_at: null,
        cancellation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`);
    }

    return jsonResponse(req, { success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('resume-subscription error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
