/**
 * Claim a webhook delivery before handling it, and record how it ended (#1307).
 *
 * WHAT WAS WRONG. Each webhook inserted its `webhook_events` row as `processed: false` BEFORE its
 * handler ran, and its duplicate check asked only whether a row EXISTED. A handler that threw once
 * returned 500, the provider retried, and the retry was answered "Event already processed" with a
 * 200. The payment result, the order advance and the receipt never happened, and nothing ever
 * reprocessed the row. Two deliveries racing the plain insert also hit the unique index, and the
 * loser returned 500.
 *
 * WHAT THIS DOES.
 *   1. Insert first. The unique (provider, provider_event_id) decides who saw the event first, so
 *      a 23505 means "seen before", not an error.
 *   2. For an event seen before, read its row. A read error THROWS: "could not read" must never be
 *      mistaken for "not there". Then `decideExisting()` decides.
 *   3. `finishWebhookEvent()` marks the row processed and throws if that write fails, so a success
 *      whose bookkeeping failed is retried instead of being left unprocessed in silence.
 *   4. `failWebhookEvent()` records the error and releases the claim. When the event cannot be
 *      retried (its handler is not replay-safe, or it has failed MAX_ATTEMPTS times) it marks the
 *      row `permanently_failed`, which `check-webhook-liveness.mjs` fails on every day, and the
 *      caller answers 200 so the provider stops retrying.
 *
 * WHY THE LOSER OF A CLAIM GETS 409, NOT A 2xx. A 2xx tells the provider the event was delivered.
 * If the winner then failed, nothing would ever retry it: the same loss, one line further on.
 *
 * WHY ONLY LISTED EVENTS ARE HANDLED AGAIN. Re-running a handler is safe only when the handler is
 * idempotent. The 2026-10-10 audit in #1307 found several that were not: a failure counter that
 * incremented again, subscription upserts a late replay could roll back, a pending row inserted
 * twice. Stage 1 listed the handlers that already were safe; stage 2 fixed the rest
 * (`subscription-events.ts`) and listed them. A type NOT in REPLAY_SAFE keeps the
 * old acknowledgement for a redelivery, and its first failure is marked permanently_failed so it
 * trips the alarm instead of vanishing. Add a type only after its handler is idempotent.
 *
 * `last_retry_at` is the start of the live claim; NULL means nobody holds one. The retry script
 * that used to write it was deleted with #1261, so this module is its only writer.
 *
 * Imports nothing, so `tests/unit/webhook-claim.test.ts` can drive it under `Test (20.x)`; vitest
 * excludes `supabase/functions/**`, and nothing runs `deno test`.
 */

export type WebhookProvider = 'stripe' | 'paypal' | 'calcom';

/** Event types whose handler is idempotent, so a retry may run it again (#1307 audit). */
export const REPLAY_SAFE: Readonly<Record<WebhookProvider, readonly string[]>> =
  {
    stripe: [
      // payment_results has one succeeded row per intent (a replay is a caught 23505), and
      // advanceOrderAndNotify is a compare-and-swap on orders.status.
      'payment_intent.succeeded',
      // The same, plus an unpaid session's pending row is looked up before it is inserted.
      'checkout.session.completed',
      // Stage 2 (subscription-events.ts): snapshots are ordered by the provider's event time,
      // a cancellation is terminal with canceled_at from the event, and a failure writes the
      // provider's absolute count.
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
    paypal: [
      // Reads the existing payment_results row before writing, so a replay takes the update
      // path; the order advance is the same compare-and-swap.
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.SALE.COMPLETED',
      // Stage 2, as for Stripe's subscription events.
      'BILLING.SUBSCRIPTION.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.UPDATED',
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
    ],
    // The lead update is a compare-and-swap on status = 'link_opened'.
    calcom: ['BOOKING_CREATED'],
  };

/** Failures after which a replay-safe event is given up on and left to the liveness alarm. */
export const MAX_ATTEMPTS = 5;

/**
 * How long a claim holds before another delivery may take the event over. Supabase lets an Edge
 * Function run for 150 s of wall clock on the free plan and 400 s on paid plans; ten minutes
 * clears both, so a slow handler is not run twice at once. If one ever outlives its lease, the
 * attempt guard on finish and fail below keeps the stale holder from overwriting the new one.
 */
export const CLAIM_LEASE_MS = 10 * 60_000;

/** The longest `processing_error` kept: enough for a stack's first lines, not a whole payload. */
const ERROR_LIMIT = 500;

export interface EventRow {
  id: string;
  processed: boolean;
  permanently_failed: boolean | null;
  /** `NOT NULL DEFAULT 0` in the schema. */
  processing_attempts: number;
  last_retry_at: string | null;
}

export type ExistingDecision =
  | { kind: 'done'; status: 200; message: string }
  | { kind: 'busy'; status: 409; message: string }
  | { kind: 'reclaim'; attempts: number };

export type Claim =
  | { kind: 'claimed'; id: string; attempt: number }
  | { kind: 'respond'; status: 200 | 409; message: string };

export interface EventRecord {
  provider_event_id: string;
  event_type: string;
  event_data: unknown;
  signature: string;
  livemode?: boolean;
}

/** Whether a provider's event type may be handled again on a retry. */
export function replaySafe(provider: WebhookProvider, eventType: string) {
  return REPLAY_SAFE[provider].includes(eventType);
}

/** What to do with a delivery of an event that already has a row. Pure. */
export function decideExisting(
  row: EventRow,
  provider: WebhookProvider,
  eventType: string,
  nowMs: number
): ExistingDecision {
  if (row.processed) {
    return { kind: 'done', status: 200, message: 'Event already processed' };
  }
  if (row.permanently_failed) {
    return {
      kind: 'done',
      status: 200,
      message: 'Event already given up on (permanently_failed)',
    };
  }
  if (!replaySafe(provider, eventType)) {
    return {
      kind: 'done',
      status: 200,
      message: 'Event already received; its handler is not replay-safe (#1307)',
    };
  }
  const claimedAt = row.last_retry_at ? Date.parse(row.last_retry_at) : NaN;
  if (Number.isFinite(claimedAt) && nowMs - claimedAt < CLAIM_LEASE_MS) {
    return {
      kind: 'busy',
      status: 409,
      message: 'Event is being processed by another delivery; retry later',
    };
  }
  return { kind: 'reclaim', attempts: row.processing_attempts };
}

/** After a handler failed on attempt `attempt`: retry, or give up and let the alarm have it. Pure. */
export function afterFailure(
  attempt: number,
  replaySafe: boolean
): { giveUp: boolean; status: 200 | 500 } {
  return !replaySafe || attempt >= MAX_ATTEMPTS
    ? { giveUp: true, status: 200 }
    : { giveUp: false, status: 500 };
}

/**
 * Claim a delivery. `claimed` means this request owns the event and must handle it, then call
 * `finishWebhookEvent` or `failWebhookEvent`. `respond` means answer with that status and stop.
 */
export async function claimWebhookEvent(
  supabase: any,
  provider: WebhookProvider,
  record: EventRecord,
  nowMs: number = Date.now()
): Promise<Claim> {
  const nowIso = new Date(nowMs).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('webhook_events')
    .insert({
      provider,
      ...record,
      signature_verified: true,
      processed: false,
      processing_attempts: 1,
      last_retry_at: nowIso,
    })
    .select('id')
    .single();
  if (!insertError) return { kind: 'claimed', id: inserted.id, attempt: 1 };
  if (insertError.code !== '23505') throw insertError;

  const { data: existing, error: readError } = await supabase
    .from('webhook_events')
    .select(
      'id, processed, permanently_failed, processing_attempts, last_retry_at'
    )
    .eq('provider', provider)
    .eq('provider_event_id', record.provider_event_id)
    .single();
  if (readError) throw readError;

  const decision = decideExisting(existing, provider, record.event_type, nowMs);
  if (decision.kind !== 'reclaim') {
    return {
      kind: 'respond',
      status: decision.status,
      message: decision.message,
    };
  }

  // COMPARE-AND-SWAP on the attempt count this request read. Two deliveries that both read N
  // cannot both write N + 1: the second matches no row and backs off with a 409.
  const next = decision.attempts + 1;
  const { data: won, error: swapError } = await supabase
    .from('webhook_events')
    .update({ processing_attempts: next, last_retry_at: nowIso })
    .eq('id', existing.id)
    .eq('processed', false)
    .eq('processing_attempts', decision.attempts)
    .select('id');
  if (swapError) throw swapError;
  if (!won || won.length === 0) {
    return {
      kind: 'respond',
      status: 409,
      message: 'Event was claimed by another delivery; retry later',
    };
  }
  return { kind: 'claimed', id: existing.id, attempt: next };
}

/**
 * Mark a claimed event processed. Throws if the row was not updated: the write failed, or this
 * request's claim was taken over (`attempt` is no longer the row's count), in which case the
 * provider's retry finds whatever the newer holder recorded.
 */
export async function finishWebhookEvent(
  supabase: any,
  id: string,
  attempt: number,
  related: {
    related_payment_id?: string;
    related_subscription_id?: string;
  } = {},
  nowMs: number = Date.now()
): Promise<void> {
  const { data, error } = await supabase
    .from('webhook_events')
    .update({
      processed: true,
      processed_at: new Date(nowMs).toISOString(),
      processing_error: null,
      ...(related.related_payment_id && {
        related_payment_id: related.related_payment_id,
      }),
      ...(related.related_subscription_id && {
        related_subscription_id: related.related_subscription_id,
      }),
    })
    .eq('id', id)
    .eq('processing_attempts', attempt)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      `webhook_events ${id} was not marked processed: the row is gone or attempt ${attempt} no longer holds the claim`
    );
  }
}

/**
 * Record a handler failure on a claimed event and say how to answer. Never throws: it runs inside
 * the caller's error path, where a second throw would hide the first.
 */
export async function failWebhookEvent(
  supabase: any,
  id: string,
  attempt: number,
  replaySafe: boolean,
  cause: unknown
): Promise<{ giveUp: boolean; status: 200 | 500 }> {
  const outcome = afterFailure(attempt, replaySafe);
  const message =
    cause instanceof Error ? cause.message : JSON.stringify(cause ?? null);
  // Guarded by `attempt`, like finish: a holder whose claim was taken over must not null the new
  // holder's lease, or mark permanently_failed an event that holder is about to process.
  const { data, error } = await supabase
    .from('webhook_events')
    .update({
      processing_error: String(message).slice(0, ERROR_LIMIT),
      last_retry_at: null,
      ...(outcome.giveUp && { permanently_failed: true }),
    })
    .eq('id', id)
    .eq('processing_attempts', attempt)
    .select('id');
  if (error || !data || data.length === 0) {
    console.error(
      error
        ? `webhook-claim: could not record the failure of ${id}`
        : `webhook-claim: attempt ${attempt} on ${id} no longer holds the claim`,
      error ?? ''
    );
    // A 200 without the permanently_failed mark would leave a replay-safe event neither processed
    // nor given up, with no retry coming. Keep the provider retrying; the next delivery reclaims
    // it. (A type that is not replay-safe is still acknowledged on redelivery by decideExisting
    // until #1307 stage 2, so for those this only narrows the loss.)
    return { giveUp: false, status: 500 };
  }
  return outcome;
}
