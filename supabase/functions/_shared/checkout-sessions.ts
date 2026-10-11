/**
 * No Stripe Checkout session left payable beside another payment for one purchase (#1345, #1347).
 *
 * Dependency-free on purpose: the table read and the two Stripe calls are injected, so vitest drives
 * every branch with fakes (tests/unit/checkout-sessions.test.ts). Nothing in CI executes an Edge
 * Function, and the Stripe SDK is not reachable from vitest either.
 *
 * WHY THIS EXISTS. The paid gate (#1342) runs when a session is CREATED. Two sessions created while
 * the purchase was unpaid both pass it, and once a session exists the buyer can pay it at Stripe,
 * where nothing of ours runs. They were easy to reach: a deduped retry hands back the same child
 * intent, and an abandoned session on the purchase stays open for 24 hours while its retry child is
 * given a new one. Paying both was a second charge, detected since #1342 but not prevented. The
 * same was true beside PayPal: an open session survived a PayPal capture and could be paid after it.
 *
 * So before a new session is opened (create-stripe-checkout, #1345) and before a PayPal order is
 * captured (capture-paypal-order, #1347), every session recorded for the purchase's retry chain is
 * asked of Stripe, the source of truth. An open one is expired. A complete one means the buyer has
 * paid, whether or not our webhook has recorded it yet, so the new session or the capture is
 * refused.
 *
 * WHAT IT DOES NOT COVER, stated so nobody reads more into it:
 *   - two create calls for one purchase in the same instant can both retire, then both create.
 *     The client's isProcessing guard keeps a double click from reaching it;
 *   - sessions opened before this shipped were never recorded, so for up to 24 hours after the
 *     deploy an old open session can still sit beside a new one;
 *   - a session opened after a PENDING PayPal capture: that capture is recorded as failed, so
 *     nothing counts the purchase as paid while PayPal settles it (#1349);
 *   - a Stripe ACCOUNT switch within 24 hours of a session opening: the old account's session is
 *     not found under the new keys, so it is skipped here, yet the buyer can still pay it there.
 */

/** The fields of a Stripe Checkout Session this decides on. */
export interface PriorSession {
  id: string;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required' | null;
}

export type PriorDecision = 'expire' | 'skip' | 'refuse_paid' | 'unknown';

/**
 * The same sentence as payment-chain.ts's ALREADY_PAID_MESSAGE, which the paid gate and
 * create-order use. A literal, because this file has no imports (vitest and tsc load it);
 * tests/unit/checkout-sessions.test.ts pins the two equal.
 */
export const ALREADY_PAID_AT_STRIPE =
  'This payment has already gone through, so it has not been charged again.';

/**
 * What to do with one earlier session. Complete means refuse, paid or not: these sessions are
 * card-only, so a complete one is paid, and an unpaid complete one would be a payment in flight,
 * which a second open session beside it could double. A status this does not know is `unknown`,
 * never treated as safe.
 */
export function decidePriorSession(s: PriorSession): PriorDecision {
  switch (s.status) {
    case 'open':
      return 'expire';
    case 'expired':
      return 'skip';
    case 'complete':
      return 'refuse_paid';
    default:
      return 'unknown';
  }
}

export interface SessionDeps {
  /**
   * Every session id recorded for any of these intents (stripe_checkout_sessions), of ANY age: a
   * complete session the webhook never recorded must be found however old it is, or a long webhook
   * outage would let a buyer who has paid be handed a new session (blind review).
   */
  recorded(intentIds: string[]): Promise<string[]>;
  /**
   * The session as Stripe has it, or null when Stripe has no such session: recorded under other
   * keys (a test/live switch, another account). Null is skipped, not failed. A missing session can
   * be neither open nor paid here, and failing on it would refuse that chain every checkout for good.
   */
  retrieve(sessionId: string): Promise<PriorSession | null>;
  expire(sessionId: string): Promise<void>;
}

/**
 * Wraps a raw Stripe retrieve as SessionDeps.retrieve: ONLY "no such session" becomes null, and
 * every other error is rethrown, so retirePriorSessions refuses with 500. Here rather than inline in
 * the function so a test can see it: widened to swallow every error, a Stripe outage would read as
 * "nothing to retire" and open a new session beside an open one, the bug this exists to stop.
 */
export function retrieveOrNull(
  retrieve: (sessionId: string) => Promise<PriorSession>
): (sessionId: string) => Promise<PriorSession | null> {
  return async (sessionId) => {
    try {
      return await retrieve(sessionId);
    } catch (e) {
      if ((e as { code?: unknown })?.code === 'resource_missing') return null;
      throw e;
    }
  };
}

/** The part of the Stripe SDK the retirement uses, so a fake can stand in for it in tests. */
export interface StripeSessionsApi {
  checkout: {
    sessions: {
      retrieve(sessionId: string): Promise<{
        id: string;
        status: PriorSession['status'];
        payment_status: PriorSession['payment_status'];
      }>;
      expire(sessionId: string): Promise<unknown>;
    };
  };
}

/**
 * The table and Stripe, wired once, for every function that retires a chain's sessions (#1347):
 * create-stripe-checkout before it opens a session, capture-paypal-order around a capture. One
 * builder so the two cannot drift apart. The lookup's any-age rule and the not-found-only skip live
 * here, where tests/unit/checkout-sessions.test.ts drives them.
 *
 * `getStripe` is called only when a recorded session has to be asked about, so a chain with no
 * Stripe sessions never needs a Stripe key. That is a PayPal-only fork, or a PayPal-only purchase.
 * If sessions ARE recorded and no client can be built, the error refuses with 500, like any other.
 */
export function sessionDepsFor(
  supabase: any,
  getStripe: () => StripeSessionsApi
): SessionDeps {
  return {
    recorded: async (intentIds) => {
      const { data, error } = await supabase
        .from('stripe_checkout_sessions')
        .select('session_id')
        // Every age, deliberately: a complete session the webhook never recorded must be found
        // however old it is (#1345). A chain's sessions are few, and they are retrieved in parallel.
        .in('intent_id', intentIds);
      if (error) throw error;
      return (data ?? []).map((r: { session_id: string }) => r.session_id);
    },
    retrieve: retrieveOrNull(async (id) => {
      const s = await getStripe().checkout.sessions.retrieve(id);
      return { id: s.id, status: s.status, payment_status: s.payment_status };
    }),
    expire: async (id) => {
      await getStripe().checkout.sessions.expire(id);
    },
  };
}

export type RetireResult =
  | { kind: 'proceed'; expired: string[] }
  | {
      kind: 'refuse';
      status: 409 | 500;
      code: 'already_paid' | 'session_check_failed';
      error: string;
    };

const CHECK_FAILED: RetireResult = {
  kind: 'refuse',
  status: 500,
  code: 'session_check_failed',
  error:
    'Could not check an earlier checkout for this payment, so nothing was charged. Please try again.',
};

/**
 * Retire every session recorded for the chain, before a new one is opened or a PayPal order is
 * captured. Every session is looked at BEFORE any is expired, so a paid purchase is refused with its
 * other sessions left as they are.
 *
 * Any failure (the record, a retrieve, an expiry, a status this does not know) refuses with 500:
 * proceeding would leave a session payable beside the new payment, which is the bug itself. An
 * expiry that fails because the session completed in the meantime lands here too, and the retry the
 * buyer is asked for will find it complete and refuse.
 */
export async function retirePriorSessions(
  deps: SessionDeps,
  intentIds: string[]
): Promise<RetireResult> {
  try {
    const ids = await deps.recorded(intentIds);
    // Asked in parallel; decided in order, before anything is expired.
    const sessions = await Promise.all(ids.map((id) => deps.retrieve(id)));
    const toExpire: string[] = [];
    for (const [i, s] of sessions.entries()) {
      const id = ids[i];
      if (s === null) continue;
      const decision = decidePriorSession(s);
      if (decision === 'refuse_paid') {
        return {
          kind: 'refuse',
          status: 409,
          code: 'already_paid',
          error: ALREADY_PAID_AT_STRIPE,
        };
      }
      if (decision === 'unknown') return CHECK_FAILED;
      if (decision === 'expire') toExpire.push(id);
    }
    for (const id of toExpire) await deps.expire(id);
    return { kind: 'proceed', expired: toExpire };
  } catch (err) {
    console.error('checkout-sessions: could not retire earlier sessions', err);
    return CHECK_FAILED;
  }
}
