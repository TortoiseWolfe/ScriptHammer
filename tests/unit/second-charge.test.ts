import { describe, it, expect } from 'vitest';
import {
  SECOND_CHARGE_PREFIX,
  SecondChargeError,
  assertSameCharge,
  retryable,
} from '../../supabase/functions/_shared/second-charge';

/**
 * Telling a SECOND CHARGE on one intent from the duplicate event of ONE charge (#1342 stage 2).
 *
 * payment_results allows one succeeded row per intent. Both payment webhooks therefore meet a
 * unique violation in two situations that mean opposite things:
 *   - the other event of the same payment already wrote the row (Stripe sends
 *     checkout.session.completed AND payment_intent.succeeded for one charge) — harmless;
 *   - a DIFFERENT charge for the same intent already wrote it — the buyer paid twice.
 * stripe-webhook used to acknowledge both as "already recorded". assertSameCharge reads the
 * transaction that won the row and throws a SecondChargeError when it is not this one, which the
 * webhook marks permanently_failed at once, and Webhook Liveness reports as needing a refund.
 */

/** payment_results filtered by intent and status, answering one row or none. */
function stub({
  recorded = null as string | null,
  error = null as unknown,
} = {}) {
  const seen: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (c: string, v: unknown) => {
    seen[c] = v;
    return chain;
  };
  chain.limit = () => chain;
  chain.maybeSingle = async () =>
    error
      ? { data: null, error }
      : {
          // Only a succeeded row may answer; dropping the status filter would read any row.
          data:
            recorded &&
            seen.status === 'succeeded' &&
            seen.intent_id === 'int-1'
              ? { transaction_id: recorded }
              : null,
          error: null,
        };
  return { from: (_t: string) => chain };
}

describe('assertSameCharge', () => {
  it('passes when the recorded success is this same transaction (the other event of one charge)', async () => {
    await expect(
      assertSameCharge(stub({ recorded: 'pi_A' }), 'int-1', ['pi_A'])
    ).resolves.toBeUndefined();
  });

  it('passes when the recorded success is ANY of the ids this payment goes by', async () => {
    // A PayPal payment is recorded under its order id by create-paypal-order, but the webhook
    // carries the capture id; either may be on the row that won.
    await expect(
      assertSameCharge(stub({ recorded: 'CAP-1' }), 'int-1', [
        'ORDER-1',
        'CAP-1',
      ])
    ).resolves.toBeUndefined();
  });

  it('throws a SecondChargeError naming both transactions when they differ', async () => {
    const err = await assertSameCharge(stub({ recorded: 'pi_A' }), 'int-1', [
      'pi_B',
    ]).catch((e) => e);
    expect(err).toBeInstanceOf(SecondChargeError);
    expect(err.message.startsWith(SECOND_CHARGE_PREFIX)).toBe(true);
    expect(err.message).toContain('int-1');
    expect(err.message).toContain('pi_A');
    expect(err.message).toContain('pi_B');
    expect(err.message).toMatch(/refund/i);
  });

  it('throws the read error itself, so the delivery is retried rather than guessed at', async () => {
    const err = await assertSameCharge(
      stub({ error: { code: '08006' } }),
      'int-1',
      ['pi_A']
    ).catch((e) => e);
    expect(err).toMatchObject({ code: '08006' });
    expect(err).not.toBeInstanceOf(SecondChargeError);
  });

  it('throws when no succeeded row exists, because a unique violation says one does', async () => {
    const err = await assertSameCharge(stub(), 'int-1', ['pi_A']).catch(
      (e) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SecondChargeError);
  });
});

describe('retryable: what the webhook catch does with the error', () => {
  it('retries a replay-safe event after an ordinary failure', () => {
    expect(retryable(true, new Error('connection reset'))).toBe(true);
  });

  it('never retries a second charge: no redelivery can make it not have happened', () => {
    expect(
      retryable(true, new SecondChargeError('int-1', 'pi_A', 'pi_B'))
    ).toBe(false);
  });

  it('does not make an unsafe event retryable', () => {
    expect(retryable(false, new Error('x'))).toBe(false);
  });
});
