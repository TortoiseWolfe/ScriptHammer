/**
 * No second OPEN Stripe Checkout session for one purchase (#1345).
 *
 * Dependency-free on purpose: the table read and the two Stripe calls are injected, so vitest drives
 * every branch with fakes (tests/unit/checkout-sessions.test.ts). Nothing in CI executes an Edge
 * Function, and the Stripe SDK is not reachable from vitest either.
 *
 * WHY THIS EXISTS. The paid gate (#1342) runs when a session is CREATED. Two sessions created while
 * the purchase was unpaid both pass it, and once a session exists the buyer can pay it at Stripe,
 * where nothing of ours runs. They were easy to reach: a deduped retry hands back the same child
 * intent, and an abandoned session on the purchase stays open for 24 hours while its retry child is
 * given a new one. Paying both was a second charge, detected since #1342 but not prevented.
 *
 * So before a new session is opened, every session recorded for the purchase's retry chain is asked
 * of Stripe, the source of truth. An open one is expired. A complete one means the buyer has paid,
 * whether or not our webhook has recorded it yet, so the new session is refused.
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
  /** Session ids recorded for any of these intents (stripe_checkout_sessions). */
  recorded(intentIds: string[]): Promise<string[]>;
  retrieve(sessionId: string): Promise<PriorSession>;
  expire(sessionId: string): Promise<void>;
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
    'Could not close an earlier checkout for this payment, so a new one was not opened. Please try again.',
};

/**
 * Retire every earlier session of the chain before a new one is opened. Every session is looked at
 * BEFORE any is expired, so a paid purchase is refused with its other sessions left as they are.
 *
 * Any failure (the record, a retrieve, an expiry, a status this does not know) refuses with 500:
 * proceeding would leave an earlier session open beside the new one, which is the bug itself. An
 * expiry that fails because the session completed in the meantime lands here too, and the retry the
 * buyer is asked for will find it complete and refuse.
 */
export async function retirePriorSessions(
  deps: SessionDeps,
  intentIds: string[]
): Promise<RetireResult> {
  try {
    const ids = await deps.recorded(intentIds);
    const toExpire: string[] = [];
    for (const id of ids) {
      const decision = decidePriorSession(await deps.retrieve(id));
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
