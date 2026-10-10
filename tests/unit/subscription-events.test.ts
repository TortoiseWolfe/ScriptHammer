/**
 * The subscription rules a webhook replay must not break (#1307 stage 2).
 *
 * Stage 1 made a failed event retryable only for handlers that were already safe to run twice.
 * These are the rules that make the subscription handlers safe too, kept pure in
 * `_shared/subscription-events.ts` so they run here under `Test (20.x)`; nothing in CI executes
 * an Edge Function.
 *
 * Several cases below are the exact timelines a blind review used to reject an earlier design,
 * which skipped a replay whenever the row had changed at all. They must stay green.
 */

import { describe, it, expect } from 'vitest';
import {
  canceledAtFromPayPal,
  canceledAtFromStripe,
  failurePatch,
  laterOf,
  mapPayPalSubscription,
  paypalEventAt,
  snapshotDecision,
  stripeEventAt,
} from '../../supabase/functions/_shared/subscription-events';

const NOW = Date.parse('2026-10-10T17:00:00Z');
const GRACE = 7;
const T1 = '2026-10-10T16:00:00.000Z';
const T2 = '2026-10-10T16:00:05.000Z';

describe('event time', () => {
  it('reads Stripe seconds and PayPal ISO', () => {
    expect(stripeEventAt(Date.parse(T1) / 1000)).toBe(T1);
    expect(paypalEventAt('2026-10-10T16:00:00Z', NOW)).toBe(T1);
  });

  it('falls back to now for a missing or unparseable PayPal time', () => {
    expect(paypalEventAt(undefined, NOW)).toBe(new Date(NOW).toISOString());
    expect(paypalEventAt('garbage', NOW)).toBe(new Date(NOW).toISOString());
  });
});

describe('snapshotDecision: a subscription snapshot applies only if it is not older', () => {
  it('applies to a row that does not exist yet', () => {
    expect(snapshotDecision(null, T1)).toEqual({ apply: true });
  });

  it('applies a newer snapshot, and an equal-time one', () => {
    const stored = { status: 'active', last_provider_event_at: T1 };
    expect(snapshotDecision(stored, T2)).toEqual({ apply: true });
    expect(snapshotDecision(stored, T1)).toEqual({ apply: true });
  });

  it('refuses an OLDER snapshot, whether it is a replay or an out-of-order first delivery', () => {
    const stored = { status: 'past_due', last_provider_event_at: T2 };
    expect(snapshotDecision(stored, T1)).toEqual({
      apply: false,
      reason: 'older_than_stored_state',
    });
  });

  it('applies when the stored row has no provider time yet (written before this column)', () => {
    expect(
      snapshotDecision({ status: 'active', last_provider_event_at: null }, T1)
    ).toEqual({ apply: true });
  });

  it('lets a NEWER provider snapshot correct a canceled the provider never sent', () => {
    // A user may set their own row to 'canceled' (the RLS policy allows it) while Stripe keeps
    // billing, and Stripe `paused` maps to 'canceled' locally. Neither stamps a provider time,
    // so the provider's next snapshot must still win. An earlier draft refused every snapshot
    // for a 'canceled' row, which the blind review rejected.
    expect(
      snapshotDecision({ status: 'canceled', last_provider_event_at: null }, T2)
    ).toEqual({ apply: true });
    expect(
      snapshotDecision({ status: 'canceled', last_provider_event_at: T1 }, T2)
    ).toEqual({ apply: true });
  });

  it('refuses an older snapshot after a stamped cancellation, so it cannot revive the row', () => {
    expect(
      snapshotDecision({ status: 'canceled', last_provider_event_at: T2 }, T1)
    ).toEqual({ apply: false, reason: 'older_than_stored_state' });
  });

  it('is NOT fooled by an unrelated write: only provider time decides', () => {
    // The rejected design skipped any replay whose row had changed since the event arrived. Here
    // the row was written later (say by the retry button), but by no NEWER provider event, so a
    // replayed recovery snapshot must still apply.
    const stored = { status: 'past_due', last_provider_event_at: T1 };
    expect(snapshotDecision(stored, T2)).toEqual({ apply: true });
  });
});

describe('failurePatch: a failed renewal payment', () => {
  const row = (over = {}) => ({
    status: 'active',
    failed_payment_count: 0,
    grace_period_expires: null as string | null,
    last_provider_event_at: T1 as string | null,
    ...over,
  });
  const opts = (over = {}) => ({
    providerCount: 1 as number | null | undefined,
    eventAt: T2,
    nowMs: NOW,
    graceDays: GRACE,
    ...over,
  });

  it('starts grace with the provider count on the first failure', () => {
    expect(failurePatch(row(), opts())).toEqual({
      kind: 'patch',
      patch: {
        status: 'grace_period',
        failed_payment_count: 1,
        grace_period_expires: '2026-10-17',
        last_provider_event_at: T2,
      },
    });
  });

  it('is idempotent: applying the same failure twice writes the same row', () => {
    const first = failurePatch(row(), opts());
    if (first.kind !== 'patch') throw new Error('expected a patch');
    const second = failurePatch(row(first.patch), opts());
    expect(second).toEqual(first);
  });

  it('writes the provider count, so a replay cannot add one again', () => {
    const r = failurePatch(
      row({ failed_payment_count: 3 }),
      opts({ providerCount: 3 })
    );
    expect(r.kind === 'patch' && r.patch.failed_payment_count).toBe(3);
  });

  it('adds one only when the provider sends no count', () => {
    const r = failurePatch(
      row({ failed_payment_count: 2 }),
      opts({ providerCount: null })
    );
    expect(r.kind === 'patch' && r.patch.failed_payment_count).toBe(3);
  });

  it('keeps a grace deadline that has not passed, even on a past_due row', () => {
    // A customer.subscription.updated(past_due) snapshot overwrites status 'grace_period' with
    // 'past_due'. The deadline it left behind still governs.
    const r = failurePatch(
      row({ status: 'past_due', grace_period_expires: '2026-10-12' }),
      opts({ providerCount: 2 })
    );
    expect(r.kind === 'patch' && r.patch.grace_period_expires).toBe(
      '2026-10-12'
    );
  });

  it('keeps a PASSED deadline for a further attempt on the same invoice', () => {
    // Provider count 3 is the third attempt on one failing invoice. A late retry after the
    // deadline must not grant a fresh week of grace.
    const r = failurePatch(
      row({ status: 'past_due', grace_period_expires: '2026-10-01' }),
      opts({ providerCount: 3 })
    );
    expect(r.kind === 'patch' && r.patch.grace_period_expires).toBe(
      '2026-10-01'
    );
  });

  it('starts a new grace period once the old deadline has passed', () => {
    const r = failurePatch(
      row({ status: 'past_due', grace_period_expires: '2026-10-01' }),
      opts()
    );
    expect(r.kind === 'patch' && r.patch.grace_period_expires).toBe(
      '2026-10-17'
    );
  });

  it('still applies after a SAME-TIME or newer past_due snapshot landed first', () => {
    // Review timeline: payment_failed's first attempt failed before writing, then
    // customer.subscription.updated(past_due) wrote the row. The replay must still set the
    // count and the deadline: the snapshot is not a recovery.
    const r = failurePatch(
      row({ status: 'past_due', last_provider_event_at: T2 }),
      opts({ eventAt: T1 })
    );
    expect(r.kind).toBe('patch');
  });

  it('does not apply to a subscription a NEWER snapshot shows active again', () => {
    const r = failurePatch(
      row({ status: 'active', last_provider_event_at: T2 }),
      opts({ eventAt: T1 })
    );
    expect(r).toEqual({ kind: 'skip', reason: 'recovered_since' });
  });

  it('never revives a canceled or expired subscription', () => {
    for (const status of ['canceled', 'expired']) {
      expect(failurePatch(row({ status }), opts())).toEqual({
        kind: 'skip',
        reason: 'subscription_already_ended',
      });
    }
  });

  it('keeps canceling as canceling', () => {
    // Cancel-at-period-end must survive a failure; only the count and deadline change.
    const r = failurePatch(row({ status: 'canceling' }), opts());
    expect(r.kind === 'patch' && r.patch.status).toBe('canceling');
  });

  it('never moves the stored provider time backwards', () => {
    const r = failurePatch(
      row({ status: 'past_due', last_provider_event_at: T2 }),
      opts({ eventAt: T1 })
    );
    expect(r.kind === 'patch' && r.patch.last_provider_event_at).toBe(T2);
  });
});

describe('laterOf', () => {
  it('never moves a stamp backwards', () => {
    expect(laterOf(T2, T1)).toBe(T2);
    expect(laterOf(T1, T2)).toBe(T2);
    expect(laterOf(null, T1)).toBe(T1);
  });
});

describe('canceled_at comes from the event, not from when we processed it', () => {
  const created = Date.parse('2026-10-01T09:00:00Z') / 1000;

  it('uses Stripe canceled_at, then ended_at, then the event time', () => {
    const at = Date.parse('2026-09-30T12:00:00Z') / 1000;
    expect(canceledAtFromStripe({ canceled_at: at }, created)).toBe(
      '2026-09-30T12:00:00.000Z'
    );
    const ended = Date.parse('2026-09-30T23:59:59Z') / 1000;
    expect(
      canceledAtFromStripe({ canceled_at: null, ended_at: ended }, created)
    ).toBe('2026-09-30T23:59:59.000Z');
    expect(canceledAtFromStripe({}, created)).toBe('2026-10-01T09:00:00.000Z');
  });

  it('uses PayPal status_update_time, then the event create_time', () => {
    expect(
      canceledAtFromPayPal(
        { status_update_time: '2026-09-30T12:00:00Z' },
        '2026-10-01T09:00:00Z',
        NOW
      )
    ).toBe('2026-09-30T12:00:00.000Z');
    expect(canceledAtFromPayPal({}, '2026-10-01T09:00:00Z', NOW)).toBe(
      '2026-10-01T09:00:00.000Z'
    );
  });

  it('ignores an unparseable PayPal time instead of writing Invalid Date', () => {
    expect(
      canceledAtFromPayPal({ status_update_time: 'not a date' }, undefined, NOW)
    ).toBe(new Date(NOW).toISOString());
  });
});

describe('mapPayPalSubscription: rows the subscriptions CHECKs accept', () => {
  const monthly = { interval: 'month', amount: 2900 };

  it('maps an active subscription with the plan interval and price from the catalog', () => {
    expect(mapPayPalSubscription({ status: 'ACTIVE' }, monthly)).toEqual({
      kind: 'row',
      status: 'active',
      plan_interval: 'month',
      plan_amount: 2900,
    });
  });

  it('maps the provider statuses the table allows', () => {
    expect(
      mapPayPalSubscription({ status: 'SUSPENDED' }, monthly)
    ).toMatchObject({
      status: 'past_due',
    });
    expect(
      mapPayPalSubscription({ status: 'CANCELLED' }, monthly)
    ).toMatchObject({
      status: 'canceled',
    });
    expect(mapPayPalSubscription({ status: 'EXPIRED' }, monthly)).toMatchObject(
      {
        status: 'expired',
      }
    );
  });

  it('does not persist a subscription that is not active yet', () => {
    // APPROVAL_PENDING used to map to 'pending', which the status CHECK rejects (#1311 /
    // RescueDogs#349). APPROVED had no mapping at all and fell through to 'canceled'.
    for (const status of ['APPROVAL_PENDING', 'APPROVED']) {
      expect(mapPayPalSubscription({ status }, monthly)).toEqual({
        kind: 'skip',
        reason: 'not_yet_active',
      });
    }
  });

  it('skips an unknown status instead of guessing canceled', () => {
    expect(mapPayPalSubscription({ status: 'SOMETHING_NEW' }, monthly)).toEqual(
      {
        kind: 'skip',
        reason: 'unknown_status',
      }
    );
  });

  it('skips a plan the catalog does not know, or one it cannot store', () => {
    expect(mapPayPalSubscription({ status: 'ACTIVE' }, null)).toEqual({
      kind: 'skip',
      reason: 'unknown_plan',
    });
    expect(
      mapPayPalSubscription(
        { status: 'ACTIVE' },
        { interval: null, amount: 2900 }
      )
    ).toEqual({ kind: 'skip', reason: 'plan_not_recurring' });
    expect(
      mapPayPalSubscription(
        { status: 'ACTIVE' },
        { interval: 'year', amount: 50 }
      )
    ).toEqual({ kind: 'skip', reason: 'invalid_plan_amount' });
  });
});
