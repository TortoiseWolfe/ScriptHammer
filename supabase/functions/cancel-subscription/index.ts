/**
 * cancel-subscription Edge Function
 *
 * Cancels an active subscription at the provider (Stripe OR PayPal) and marks
 * our row as canceled. Provider-agnostic: it branches on the stored
 * `subscriptions.provider` value, so the caller doesn't need to know which
 * billing rail backs the row.
 *
 * Part of the payment Edge Functions epic (issue #100).
 *
 * REQUEST
 *   POST /functions/v1/cancel-subscription
 *   Authorization: Bearer <user JWT>
 *   Body: { subscription_id: string }   // OUR subscriptions.id UUID, not the provider id
 *
 * RESPONSE
 *   200 OK: { success: true }
 *   400 Bad Request: { error: string } (validation / missing body fields)
 *   401 Unauthorized: { error: string } (missing / invalid JWT)
 *   403 Forbidden: { error: string } (caller does not own the subscription)
 *   404 Not Found: { error: string } (subscription does not exist)
 *   500 Internal Server Error: { error: string } (provider call failed)
 *
 * SECURITY MODEL
 *   - JWT verified via NEXT_PUBLIC_SUPABASE_ANON_KEY (see _shared/auth.ts)
 *   - service-role client used for the subscription lookup + update (bypasses
 *     RLS so we can read/write the row regardless of policy state) — but we
 *     DO check `template_user_id === caller_user_id` manually before acting,
 *     because service-role bypasses RLS.
 *   - Provider credentials (STRIPE_SECRET_KEY / PAYPAL_CLIENT_ID +
 *     PAYPAL_CLIENT_SECRET) live only in the function env, never in the client.
 *   - Stripe cancellation uses `cancel_at_period_end: true` so the customer
 *     retains access through the paid period; PayPal cancellation is immediate
 *     per the PayPal billing API.
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

// PayPal base URL: sandbox by default, overridable for live via env.
const PAYPAL_API =
  Deno.env.get('PAYPAL_API_BASE') ?? 'https://api-m.sandbox.paypal.com';

interface RequestBody {
  subscription_id?: string;
}

/**
 * Obtain a PayPal OAuth2 access token via client_credentials.
 * Kept self-contained inside this function so the PayPal functions don't
 * depend on shared state. Throws if credentials are missing or the call fails.
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
    throw new Error(`PayPal token request failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  return json.access_token as string;
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

    // Branch on provider — cancel at the billing rail that backs this row.
    if (subscription.provider === 'stripe') {
      // cancel_at_period_end keeps access through the paid period.
      await stripe.subscriptions.update(subscription.provider_subscription_id, {
        cancel_at_period_end: true,
      });
    } else if (subscription.provider === 'paypal') {
      const accessToken = await getPayPalAccessToken();
      const res = await fetch(
        `${PAYPAL_API}/v1/billing/subscriptions/${subscription.provider_subscription_id}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Customer requested cancellation' }),
        }
      );

      // PayPal returns 204 No Content on a successful cancel.
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(
          `PayPal subscription cancel failed (${res.status}): ${detail}`
        );
      }
    } else {
      return jsonResponse(
        req,
        {
          error: `Unsupported subscription provider: ${subscription.provider}`,
        },
        400
      );
    }

    // Mark our row canceled. service-role bypasses RLS for the write.
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: nowIso,
        cancellation_reason: 'user_requested',
        updated_at: nowIso,
      })
      .eq('id', subscriptionId);

    if (updateError) {
      throw new Error(
        `Subscription canceled at provider but DB update failed: ${updateError.message}`
      );
    }

    return jsonResponse(req, { success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    console.error('cancel-subscription error:', err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500
    );
  }
});
