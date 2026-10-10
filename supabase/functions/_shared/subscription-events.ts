/**
 * Subscription rules that make the webhook handlers safe to run twice (#1307 stage 2).
 *
 * Stage 1 (`webhook-claim.ts`) retries a failed event only when its handler is replay-safe. The
 * 2026-10-10 audit found the subscription handlers were not:
 *
 *   - a replayed snapshot (`customer.subscription.updated`, `BILLING.SUBSCRIPTION.UPDATED`) could
 *     roll a row back to an older state, including reviving a deleted subscription;
 *   - a failed renewal incremented the count again on a replay and restarted the grace clock;
 *   - a late failure for a canceled subscription moved it back into grace, and so back into the
 *     one-live-per-user index, which blocked the user from subscribing again;
 *   - `canceled_at` was `now()` at processing time, so a replay moved the date;
 *   - PayPal rows took `plan_interval` from `tenure_type` ('regular') and `plan_amount` from the
 *     last payment (0 before the first one), and mapped APPROVAL_PENDING to 'pending'. All three
 *     violate the `subscriptions` CHECKs, so those events always failed (#1311, RescueDogs#349).
 *
 * ORDERING USES THE PROVIDER'S CLOCK. `subscriptions.last_provider_event_at` holds the time of the
 * newest provider event applied to the row, and a snapshot older than that is not applied. An
 * earlier draft asked instead whether the row had changed since the event first ARRIVED, and the
 * blind review showed why that is wrong: any write counts, so an unrelated write (another event,
 * the user's retry button) silently dropped a real state change. The provider's event time is the
 * only thing that says which snapshot is newer.
 *
 * Imports nothing, so `tests/unit/subscription-events.test.ts` can drive it.
 */

/** Statuses a subscription does not leave: a provider never revives a canceled subscription id. */
const TERMINAL = new Set(['canceled', 'expired']);

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

const fromSecs = (secs: number | null | undefined) =>
  typeof secs === 'number' && Number.isFinite(secs)
    ? new Date(secs * 1000).toISOString()
    : null;

const fromIso = (iso: string | null | undefined) => {
  const t = toMs(iso);
  return t === null ? null : new Date(t).toISOString();
};

/** True only when `eventAt` is strictly older than `storedAt`. Equal times both apply. */
function olderThanStored(eventAt: string, storedAt: string | null): boolean {
  const e = toMs(eventAt);
  const s = toMs(storedAt);
  return e !== null && s !== null && e < s;
}

/** A Stripe event's time (`event.created`, seconds) as ISO. */
export function stripeEventAt(createdSecs: number): string {
  return fromSecs(createdSecs) ?? new Date(0).toISOString();
}

/** A PayPal event's time (`event.create_time`, ISO), falling back to now. */
export function paypalEventAt(
  createTime: string | null | undefined,
  nowMs: number
): string {
  return fromIso(createTime) ?? new Date(nowMs).toISOString();
}

export interface StoredSubscription {
  status: string;
  last_provider_event_at: string | null;
}

export type SnapshotDecision =
  | { apply: true }
  | {
      apply: false;
      reason: 'subscription_already_ended' | 'older_than_stored_state';
    };

/**
 * Whether a provider SNAPSHOT of a subscription may overwrite the stored row. Pure.
 *
 * Applies to every delivery, first or replayed: an out-of-order first delivery of an older
 * snapshot is exactly as wrong as a replay of one.
 */
export function snapshotDecision(
  stored: StoredSubscription | null,
  eventAt: string,
  newStatus: string
): SnapshotDecision {
  if (!stored) return { apply: true };
  if (TERMINAL.has(stored.status) && !TERMINAL.has(newStatus)) {
    return { apply: false, reason: 'subscription_already_ended' };
  }
  if (olderThanStored(eventAt, stored.last_provider_event_at)) {
    return { apply: false, reason: 'older_than_stored_state' };
  }
  return { apply: true };
}

export interface FailureRow extends StoredSubscription {
  failed_payment_count: number | null;
  grace_period_expires: string | null;
}

export interface FailurePatch {
  status: string;
  failed_payment_count: number;
  grace_period_expires: string;
  last_provider_event_at: string;
}

export type FailureDecision =
  | { kind: 'patch'; patch: FailurePatch }
  | { kind: 'skip'; reason: 'subscription_already_ended' | 'recovered_since' };

/**
 * The update for one failed renewal payment. Pure, and idempotent: applying the same event twice
 * writes the same row.
 *
 *   - The count is the PROVIDER'S absolute count of failed attempts (Stripe
 *     `invoice.attempt_count`, PayPal `billing_info.failed_payments_count`), so a replay cannot
 *     add one again. Only when the provider sends none does it fall back to adding one.
 *   - A grace deadline still in the future is kept, so repeated failures cannot extend grace.
 *     `grace_period_expires` is a YYYY-MM-DD string, and a `past_due` row (a snapshot overwrote
 *     the status) with a live deadline is still in grace.
 *   - An ended subscription is never revived, and one that a NEWER snapshot shows active again
 *     has recovered, so a late failure is not applied to it.
 *   - `canceling` (cancel at period end) keeps its status; only the count and deadline change.
 */
export function failurePatch(
  row: FailureRow,
  opts: {
    providerCount: number | null | undefined;
    eventAt: string;
    nowMs: number;
    graceDays: number;
  }
): FailureDecision {
  if (TERMINAL.has(row.status)) {
    return { kind: 'skip', reason: 'subscription_already_ended' };
  }
  if (
    row.status === 'active' &&
    olderThanStored(opts.eventAt, row.last_provider_event_at)
  ) {
    return { kind: 'skip', reason: 'recovered_since' };
  }
  const today = new Date(opts.nowMs).toISOString().split('T')[0];
  const inGrace =
    Boolean(row.grace_period_expires) &&
    (row.grace_period_expires as string) >= today;
  const count =
    typeof opts.providerCount === 'number' && opts.providerCount > 0
      ? Math.floor(opts.providerCount)
      : (row.failed_payment_count ?? 0) + 1;
  const newest = olderThanStored(opts.eventAt, row.last_provider_event_at)
    ? (row.last_provider_event_at as string)
    : opts.eventAt;
  return {
    kind: 'patch',
    patch: {
      status: row.status === 'canceling' ? 'canceling' : 'grace_period',
      failed_payment_count: count,
      grace_period_expires: inGrace
        ? (row.grace_period_expires as string)
        : new Date(opts.nowMs + opts.graceDays * DAY_MS)
            .toISOString()
            .split('T')[0],
      last_provider_event_at: newest,
    },
  };
}

/** When a Stripe subscription was canceled: its own timestamps first, then the event's. */
export function canceledAtFromStripe(
  subscription: { canceled_at?: number | null; ended_at?: number | null },
  eventCreatedSecs: number
): string {
  return (
    fromSecs(subscription.canceled_at) ??
    fromSecs(subscription.ended_at) ??
    stripeEventAt(eventCreatedSecs)
  );
}

/** When a PayPal subscription was canceled: the resource's status time, then the event's. */
export function canceledAtFromPayPal(
  resource: { status_update_time?: string | null },
  eventCreateTime: string | null | undefined,
  nowMs: number
): string {
  return (
    fromIso(resource.status_update_time) ??
    paypalEventAt(eventCreateTime, nowMs)
  );
}

const PAYPAL_STATUS: Record<string, string> = {
  ACTIVE: 'active',
  SUSPENDED: 'past_due',
  CANCELLED: 'canceled',
  EXPIRED: 'expired',
};

/** PayPal states before the first payment. Like Stripe's `incomplete`, they never become rows. */
const PAYPAL_NOT_YET_ACTIVE = new Set(['APPROVAL_PENDING', 'APPROVED']);

export type PayPalSubscriptionMapping =
  | { kind: 'skip'; reason: string }
  | {
      kind: 'row';
      status: string;
      plan_interval: 'month' | 'year';
      plan_amount: number;
    };

/**
 * The status, interval and price for a PayPal subscription row, or why there should be no row.
 * `product` is the catalog row whose `paypal_plan_id` matches the subscription's `plan_id`; the
 * catalog is where `create-paypal-subscription` chose the plan, so it is the source of truth.
 */
export function mapPayPalSubscription(
  resource: { status?: string | null },
  product: { interval: string | null; amount: number } | null
): PayPalSubscriptionMapping {
  const providerStatus = resource.status ?? '';
  if (PAYPAL_NOT_YET_ACTIVE.has(providerStatus)) {
    return { kind: 'skip', reason: 'not_yet_active' };
  }
  const status = PAYPAL_STATUS[providerStatus];
  if (!status) return { kind: 'skip', reason: 'unknown_status' };
  if (!product) return { kind: 'skip', reason: 'unknown_plan' };
  if (product.interval !== 'month' && product.interval !== 'year') {
    return { kind: 'skip', reason: 'plan_not_recurring' };
  }
  // subscriptions.plan_amount CHECK (plan_amount >= 100).
  if (!(product.amount >= 100)) {
    return { kind: 'skip', reason: 'invalid_plan_amount' };
  }
  return {
    kind: 'row',
    status,
    plan_interval: product.interval,
    plan_amount: product.amount,
  };
}
