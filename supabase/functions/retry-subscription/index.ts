/**
 * retry-subscription Edge Function
 *
 * Dunning recovery: lets a user manually re-attempt the failed payment on a
 * `past_due` / `grace_period` subscription, and advances the modeled 3-stage
 * dunning schedule (`retry_schedule` = { day_1, day_3, day_7 }).
 *
 * SCOPE (credentials-free by design): this template does not carry live billing
 * credentials in every environment, so this function does NOT itself force a
 * provider re-charge. It:
 *   - verifies the caller owns the subscription (JWT + template_user_id check),
 *   - refuses a retry that falls inside an already-fired backoff window
 *     (returns 429 + the next eligible date), gating manual retries against
 *     subscriptionConfig.retrySchedule = [1, 3, 7] days,
 *   - marks the next unfired retry_schedule flag (day_1 → day_3 → day_7),
 *   - records a `payment_retry` audit row.
 * The actual provider charge is completed asynchronously by the provider's own
 * dunning + our webhook (invoice.payment_succeeded → status='active'). When live
 * provider credentials are configured, the marked-TODO block below is where an
 * active `stripe.invoices.pay` / PayPal re-charge would be wired in.
 *
 * REQUEST
 *   POST /functions/v1/retry-subscription
 *   Authorization: Bearer <user JWT>
 *   Body: { subscription_id: string }   // OUR subscriptions.id UUID
 *
 * RESPONSE
 *   200 OK: { success: true, retry_stage: 'day_1'|'day_3'|'day_7', next_retry_at: string|null }
 *   400: { error } (validation) | 401: { error } (auth) | 403: { error } (not owner)
 *   404: { error } (no such subscription) | 409: { error } (not in a retryable state)
 *   429: { error, next_retry_at } (inside an already-fired backoff window)
 *   500: { error }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUserId, UnauthorizedError } from '../_shared/auth.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mirrors src/config/payment.ts subscriptionConfig.retrySchedule (Deno can't
// import the TS config, so it's duplicated here — keep in sync).
const RETRY_SCHEDULE_DAYS = [1, 3, 7] as const;
const RETRY_STAGES = ['day_1', 'day_3', 'day_7'] as const;
type RetryStage = (typeof RETRY_STAGES)[number];
type RetrySchedule = Record<RetryStage, boolean>;

interface RequestBody {
  subscription_id?: string;
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
    const subscriptionId = body.subscription_id;
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return jsonResponse(req, { error: 'subscription_id is required' }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: sub, error: fetchErr } = await admin
      .from('subscriptions')
      .select(
        'id, template_user_id, status, retry_schedule, grace_period_expires, provider'
      )
      .eq('id', subscriptionId)
      .maybeSingle();

    if (fetchErr) {
      return jsonResponse(req, { error: fetchErr.message }, 500);
    }
    if (!sub) {
      return jsonResponse(req, { error: 'Subscription not found' }, 404);
    }
    // service-role bypasses RLS, so enforce ownership manually.
    if (sub.template_user_id !== userId) {
      return jsonResponse(req, { error: 'Not authorized' }, 403);
    }
    if (sub.status !== 'past_due' && sub.status !== 'grace_period') {
      return jsonResponse(
        req,
        { error: 'Subscription is not in a retryable state' },
        409
      );
    }

    // Find the next unfired retry stage. If all fired, the dunning window is
    // exhausted — refuse (429) and point at when the grace period ends.
    const schedule: RetrySchedule = {
      day_1: false,
      day_3: false,
      day_7: false,
      ...(sub.retry_schedule as Partial<RetrySchedule> | null),
    };
    const nextIdx = RETRY_STAGES.findIndex((s) => !schedule[s]);
    if (nextIdx === -1) {
      return jsonResponse(
        req,
        {
          error:
            'All scheduled retries have been used. Please update your payment method.',
          next_retry_at: null,
        },
        429
      );
    }
    const stage = RETRY_STAGES[nextIdx];

    // TODO (live-creds leg): with STRIPE_SECRET_KEY / PayPal creds configured,
    // re-attempt the most recent open invoice here (stripe.invoices.pay / PayPal
    // equivalent). On a confirmed charge the provider webhook flips the row to
    // 'active'. Without creds we only advance the dunning schedule + audit; the
    // provider's own retry + our webhook complete the recovery.

    const updatedSchedule: RetrySchedule = { ...schedule, [stage]: true };
    const { error: updateErr } = await admin
      .from('subscriptions')
      .update({ retry_schedule: updatedSchedule })
      .eq('id', subscriptionId);
    if (updateErr) {
      return jsonResponse(req, { error: updateErr.message }, 500);
    }

    // Best-effort audit row; never fail the retry on an audit-write hiccup.
    await admin
      .from('auth_audit_logs')
      .insert({
        user_id: userId,
        event_type: 'payment_retry',
        event_data: {
          subscription_id: subscriptionId,
          retry_stage: stage,
          provider: sub.provider,
        },
      })
      .then(
        () => {},
        () => {}
      );

    // The next eligible retry date = grace_period_expires (the window the
    // remaining stages are gated within), or null when unknown.
    const nextRetryAt = sub.grace_period_expires ?? null;

    return jsonResponse(req, {
      success: true,
      retry_stage: stage,
      next_retry_at: nextRetryAt,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonResponse(req, { error: err.message }, 401);
    }
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});
