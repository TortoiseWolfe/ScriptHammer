import { describe, it, expect } from 'vitest';
import {
  decidePriorSession,
  retirePriorSessions,
  retrieveOrNull,
  sessionDepsFor,
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

  it('skips a recorded session Stripe does not have, instead of refusing the chain for good', async () => {
    // Recorded under other keys (test to live, or another account). It can be neither open nor
    // paid here; failing on it would 500 every checkout for that purchase until its intent expired.
    const f = fake({
      recorded: ['cs_gone', 'cs_open'],
      states: {
        cs_open: { id: 'cs_open', status: 'open', payment_status: 'unpaid' },
      },
    });
    f.deps.retrieve = async (id) =>
      id === 'cs_gone'
        ? null
        : { id: 'cs_open', status: 'open', payment_status: 'unpaid' };
    expect(await retirePriorSessions(f.deps, ['int-1'])).toEqual({
      kind: 'proceed',
      expired: ['cs_open'],
    });
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

  it('says a failed check charged nothing, which is true for both callers', async () => {
    // The buyer reads it (approvePayPalOrder shows the error). It said "a new one was not opened",
    // which a PayPal buyer whose capture was refused reads as nonsense (blind review of #1347).
    const r = await retirePriorSessions(fake({ failRecorded: true }).deps, [
      'int-1',
    ]);
    expect(r.kind === 'refuse' && r.error).toBe(
      'Could not check an earlier checkout for this payment, so nothing was charged. Please try again.'
    );
  });
});

describe('retrieveOrNull: only "no such session" is skipped (blind review)', () => {
  const open: PriorSession = {
    id: 'cs_1',
    status: 'open',
    payment_status: 'unpaid',
  };

  it('passes a session through', async () => {
    expect(await retrieveOrNull(async () => open)('cs_1')).toEqual(open);
  });

  it("turns Stripe's resource_missing into null", async () => {
    const gone = retrieveOrNull(async () => {
      throw Object.assign(new Error('No such checkout.session'), {
        code: 'resource_missing',
      });
    });
    expect(await gone('cs_1')).toBeNull();
  });

  it('rethrows every other error, so an outage refuses rather than opening a second session', async () => {
    // Widened to swallow everything, a Stripe outage would read as "nothing to retire" and a new
    // session would open beside an open one: the bug itself.
    const outage = retrieveOrNull(async () => {
      throw Object.assign(new Error('connection reset'), {
        code: 'api_connection_error',
      });
    });
    await expect(outage('cs_1')).rejects.toThrow('connection reset');
    const r = await retirePriorSessions(
      {
        recorded: async () => ['cs_1'],
        retrieve: outage,
        expire: async () => {
          throw new Error('must not be reached');
        },
      },
      ['int-1']
    );
    expect(r).toMatchObject({
      kind: 'refuse',
      status: 500,
      code: 'session_check_failed',
    });
  });
});

describe('sessionDepsFor: the one place the table and Stripe are wired (#1347)', () => {
  // Both create-stripe-checkout and capture-paypal-order retire a chain's Stripe sessions. One
  // builder, so the two cannot drift: the lookup's any-age rule and the not-found-only skip live
  // here, where these tests see them.

  /** stripe_checkout_sessions, answering the intents it is asked about. */
  function table(
    rows: { session_id: string; intent_id: string }[],
    fail = false
  ) {
    const seen: {
      table?: string;
      select?: string;
      in?: [string, string[]];
      other: string[];
    } = {
      other: [],
    };
    const chain: Record<string, unknown> = {};
    chain.select = (s: string) => ((seen.select = s), chain);
    chain.in = (c: string, v: string[]) => ((seen.in = [c, v]), chain);
    for (const m of [
      'eq',
      'gte',
      'gt',
      'lt',
      'lte',
      'filter',
      'order',
      'limit',
    ])
      chain[m] = () => (seen.other.push(m), chain);
    chain.then = (res: (v: unknown) => unknown) =>
      Promise.resolve(
        fail
          ? { data: null, error: { code: '08006' } }
          : {
              data: rows
                .filter((r) => seen.in?.[1].includes(r.intent_id))
                .map((r) => ({ session_id: r.session_id })),
              error: null,
            }
      ).then(res);
    return {
      seen,
      supabase: { from: (t: string) => ((seen.table = t), chain) },
    };
  }

  /** A Stripe client fake, counting how often it was built. */
  function stripeFake(
    sessions: Record<string, PriorSession | 'missing' | 'down'>
  ) {
    const built = { n: 0 };
    const expired: string[] = [];
    const getStripe = () => {
      built.n++;
      return {
        checkout: {
          sessions: {
            retrieve: async (id: string) => {
              const s = sessions[id];
              if (s === 'missing')
                throw Object.assign(new Error('No such checkout.session'), {
                  code: 'resource_missing',
                });
              if (s === 'down' || s === undefined)
                throw Object.assign(new Error('connection reset'), {
                  code: 'api_connection_error',
                });
              return { ...s, extra: 'ignored' };
            },
            expire: async (id: string) => {
              expired.push(id);
            },
          },
        },
      };
    };
    return { getStripe, built, expired };
  }

  it('reads every recorded session of the chain, of ANY age, and nothing else', async () => {
    const t = table([
      { session_id: 'cs_1', intent_id: 'int-1' },
      { session_id: 'cs_2', intent_id: 'int-2' },
      { session_id: 'cs_x', intent_id: 'int-other' },
    ]);
    const deps = sessionDepsFor(t.supabase, () => {
      throw new Error('not needed');
    });
    expect(await deps.recorded(['int-1', 'int-2'])).toEqual(['cs_1', 'cs_2']);
    expect(t.seen).toMatchObject({
      table: 'stripe_checkout_sessions',
      select: 'session_id',
      in: ['intent_id', ['int-1', 'int-2']],
    });
    // No time bound and no other filter: an old complete session must still be found (#1345).
    expect(t.seen.other).toEqual([]);
  });

  it('throws when the record cannot be read', async () => {
    const deps = sessionDepsFor(table([], true).supabase, () => {
      throw new Error('x');
    });
    await expect(deps.recorded(['int-1'])).rejects.toMatchObject({
      code: '08006',
    });
  });

  it('maps Stripe sessions to what is decided on, skips only a missing one, and expires through Stripe', async () => {
    const s = stripeFake({
      cs_open: { id: 'cs_open', status: 'open', payment_status: 'unpaid' },
      cs_gone: 'missing',
    });
    const deps = sessionDepsFor(table([]).supabase, s.getStripe);
    expect(await deps.retrieve('cs_open')).toEqual({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
    });
    expect(await deps.retrieve('cs_gone')).toBeNull();
    await deps.expire('cs_open');
    expect(s.expired).toEqual(['cs_open']);
  });

  it('a Stripe outage refuses, through retirePriorSessions', async () => {
    const t = table([{ session_id: 'cs_1', intent_id: 'int-1' }]);
    const deps = sessionDepsFor(
      t.supabase,
      stripeFake({ cs_1: 'down' }).getStripe
    );
    expect(await retirePriorSessions(deps, ['int-1'])).toMatchObject({
      kind: 'refuse',
      status: 500,
      code: 'session_check_failed',
    });
  });

  it('never builds a Stripe client when the chain has no recorded sessions', async () => {
    // A PayPal-only fork has no Stripe key and no sessions; capturing its payment must not need one.
    const s = stripeFake({});
    const deps = sessionDepsFor(table([]).supabase, () => {
      s.built.n++;
      throw new Error('STRIPE_SECRET_KEY is not set');
    });
    expect(await retirePriorSessions(deps, ['int-1'])).toEqual({
      kind: 'proceed',
      expired: [],
    });
    expect(s.built.n).toBe(0);
  });

  it('refuses when sessions ARE recorded but no Stripe client can be built', async () => {
    // Recorded sessions and no key: guessing they are closed would be the bug. Fail closed.
    const t = table([{ session_id: 'cs_1', intent_id: 'int-1' }]);
    const deps = sessionDepsFor(t.supabase, () => {
      throw new Error('STRIPE_SECRET_KEY is not set');
    });
    expect(await retirePriorSessions(deps, ['int-1'])).toMatchObject({
      kind: 'refuse',
      status: 500,
    });
  });
});
