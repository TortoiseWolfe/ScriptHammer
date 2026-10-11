import { describe, it, expect } from 'vitest';
import {
  decidePriorSession,
  retirePriorSessions,
  ALREADY_PAID_AT_STRIPE,
  type PriorSession,
  type SessionDeps,
} from '../../supabase/functions/_shared/checkout-sessions';
import { ALREADY_PAID_MESSAGE } from '../../supabase/functions/_shared/payment-chain';

/**
 * No second OPEN Stripe Checkout session for one purchase (#1345).
 *
 * The paid gate (#1342) runs when a session is CREATED. Two sessions created while the purchase
 * was unpaid both pass it, and once a session exists the buyer can pay it at Stripe, where nothing
 * of ours runs. A deduped retry hands back the same child intent, and an abandoned session on the
 * purchase stays open for 24 hours, so a second session was easy to reach: the buyer could pay both.
 *
 * So before a new session is created, every session already recorded for the purchase's retry chain
 * is asked of Stripe, the source of truth: an open one is expired; a complete one means the buyer
 * has paid (the webhook may simply not have arrived), so the new session is refused.
 */

const session = (
  status: PriorSession['status'],
  payment_status: PriorSession['payment_status'] = 'unpaid'
): PriorSession => ({ id: 'cs_x', status, payment_status });

describe('decidePriorSession', () => {
  it('expires an open session', () => {
    expect(decidePriorSession(session('open'))).toBe('expire');
  });

  it('leaves an expired session alone', () => {
    expect(decidePriorSession(session('expired'))).toBe('skip');
  });

  it('refuses when a session is complete: the buyer has paid, whatever our tables say yet', () => {
    expect(decidePriorSession(session('complete', 'paid'))).toBe('refuse_paid');
    // Card-only sessions complete paid. An unpaid complete one is a payment in flight, and
    // opening a second session beside it is exactly the double charge this exists to stop.
    expect(decidePriorSession(session('complete', 'unpaid'))).toBe(
      'refuse_paid'
    );
  });

  it('treats a status it does not know as unknown, never as safe', () => {
    expect(decidePriorSession(session(null))).toBe('unknown');
    expect(decidePriorSession(session('something_new' as never))).toBe(
      'unknown'
    );
  });
});

/** In-memory Stripe and table: which sessions are recorded, their states, and what got expired. */
function fake({
  recorded = [] as string[],
  states = {} as Record<string, PriorSession>,
  failRecorded = false,
  failRetrieve = false,
  failExpire = false,
} = {}) {
  const expired: string[] = [];
  const asked: string[][] = [];
  const deps: SessionDeps = {
    recorded: async (intentIds) => {
      asked.push(intentIds);
      if (failRecorded) throw new Error('db down');
      return recorded;
    },
    retrieve: async (id) => {
      if (failRetrieve) throw new Error('stripe down');
      return states[id] ?? { id, status: 'expired', payment_status: 'unpaid' };
    },
    expire: async (id) => {
      if (failExpire) throw new Error('cannot expire');
      expired.push(id);
    },
  };
  return { deps, expired, asked };
}

describe('retirePriorSessions', () => {
  it('asks for the sessions of the WHOLE chain it is given', async () => {
    const f = fake();
    await retirePriorSessions(f.deps, ['int-1', 'int-2']);
    expect(f.asked).toEqual([['int-1', 'int-2']]);
  });

  it('expires every open session in the chain, and proceeds', async () => {
    const f = fake({
      recorded: ['cs_open1', 'cs_old', 'cs_open2'],
      states: {
        cs_open1: { id: 'cs_open1', status: 'open', payment_status: 'unpaid' },
        cs_old: { id: 'cs_old', status: 'expired', payment_status: 'unpaid' },
        cs_open2: { id: 'cs_open2', status: 'open', payment_status: 'unpaid' },
      },
    });
    expect(await retirePriorSessions(f.deps, ['int-1'])).toEqual({
      kind: 'proceed',
      expired: ['cs_open1', 'cs_open2'],
    });
    expect(f.expired).toEqual(['cs_open1', 'cs_open2']);
  });

  it('refuses with 409 when any session in the chain is complete, and expires nothing', async () => {
    const f = fake({
      recorded: ['cs_paid', 'cs_open'],
      states: {
        cs_paid: { id: 'cs_paid', status: 'complete', payment_status: 'paid' },
        cs_open: { id: 'cs_open', status: 'open', payment_status: 'unpaid' },
      },
    });
    expect(await retirePriorSessions(f.deps, ['int-1'])).toEqual({
      kind: 'refuse',
      status: 409,
      code: 'already_paid',
      error: ALREADY_PAID_AT_STRIPE,
    });
    // Decided before touching anything: a paid purchase leaves its other sessions as they are.
    expect(f.expired).toEqual([]);
  });

  it('proceeds with nothing to do when no session was ever recorded', async () => {
    expect(await retirePriorSessions(fake().deps, ['int-1'])).toEqual({
      kind: 'proceed',
      expired: [],
    });
  });

  it('refuses with 500, creating nothing, when the record, Stripe, or an expiry fails', async () => {
    // Each failure would otherwise leave an open session beside the new one: the bug itself.
    const open = {
      cs_open: {
        id: 'cs_open',
        status: 'open' as const,
        payment_status: 'unpaid' as const,
      },
    };
    for (const f of [
      fake({ failRecorded: true }),
      fake({ recorded: ['cs_open'], states: open, failRetrieve: true }),
      fake({ recorded: ['cs_open'], states: open, failExpire: true }),
      fake({
        recorded: ['cs_odd'],
        states: {
          cs_odd: { id: 'cs_odd', status: null, payment_status: null },
        },
      }),
    ]) {
      const r = await retirePriorSessions(f.deps, ['int-1']);
      expect(r).toMatchObject({
        kind: 'refuse',
        status: 500,
        code: 'session_check_failed',
      });
    }
  });
});

describe('the refusal reads like the other doors', () => {
  it('is the same sentence the paid gate and create-order use', () => {
    // A literal in its own module (no imports, for vitest and tsc); pinned here.
    expect(ALREADY_PAID_AT_STRIPE).toBe(ALREADY_PAID_MESSAGE);
  });
});
