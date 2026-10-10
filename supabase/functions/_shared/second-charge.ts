/**
 * Telling a SECOND CHARGE on one intent from the duplicate event of ONE charge (#1342 stage 2).
 *
 * Dependency-free on purpose: it takes the Supabase client as a parameter, so vitest drives it
 * with a stub (tests/unit/second-charge.test.ts). Nothing in CI executes an Edge Function.
 *
 * payment_results allows one succeeded row per intent (idx_payment_results_one_succeeded_per_intent),
 * so a webhook's success write meets a unique violation in two situations that mean opposite
 * things:
 *   - the other event of the same payment already wrote the row. Stripe sends
 *     checkout.session.completed AND payment_intent.succeeded for one charge, and PayPal's
 *     webhook can follow the buyer-redirect capture. Harmless: acknowledge it.
 *   - a DIFFERENT charge for the same intent already wrote it. The buyer paid twice: two Stripe
 *     sessions both paid, or two PayPal orders both captured.
 * stripe-webhook used to acknowledge both as "already recorded", so the second never left a trace,
 * and the #1338 double-charge query cannot see it either (it counts distinct paid INTENTS).
 */

/**
 * What a webhook writes into webhook_events.processing_error when it gives up on a second charge.
 * scripts/ci/check-webhook-liveness.mjs counts rows starting with it, as their own failure; a test
 * reads this file to keep the two in step.
 */
export const SECOND_CHARGE_PREFIX = 'second_charge:';

/**
 * A charge for an intent another charge already paid. Thrown, not returned, so the webhook's
 * existing catch records it on the event row; `retryable` makes that record permanent at once.
 */
export class SecondChargeError extends Error {
  readonly intentId: string;
  readonly recorded: string;
  readonly incoming: string;
  constructor(intentId: string, recorded: string, incoming: string) {
    super(
      `${SECOND_CHARGE_PREFIX} intent ${intentId} is already paid by ${recorded}; ` +
        `${incoming} is a second charge for it and needs a refund at the provider`
    );
    this.name = 'SecondChargeError';
    this.intentId = intentId;
    this.recorded = recorded;
    this.incoming = incoming;
  }
}

/**
 * Called on a unique violation for `intentId`. Resolves when the success already recorded is THIS
 * payment, under any of the ids it goes by (`ownIds`); throws SecondChargeError when it is another.
 *
 * Throws the read error itself when the row cannot be read, so the delivery is retried rather than
 * classified on a guess. And throws when no succeeded row exists at all: the violation says one
 * does, so an empty answer is an inconsistency worth a retry, not a quiet "same charge".
 */
export async function assertSameCharge(
  supabase: any,
  intentId: string,
  ownIds: readonly string[]
): Promise<void> {
  const {
    data,
    error,
  }: { data: { transaction_id: string } | null; error: unknown } =
    await supabase
      .from('payment_results')
      .select('transaction_id')
      .eq('intent_id', intentId)
      .eq('status', 'succeeded')
      .limit(1)
      .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      `a succeeded payment for intent ${intentId} collided, but none can be read back`
    );
  }
  if (!ownIds.includes(data.transaction_id)) {
    throw new SecondChargeError(
      intentId,
      data.transaction_id,
      ownIds.join(' / ')
    );
  }
}

/**
 * Whether the webhook's catch should ask the provider to redeliver: only for a replay-safe event,
 * and never for a second charge. No redelivery can make a second charge not have happened;
 * retrying it five times would only delay the alarm by the provider's backoff, which is days.
 */
export function retryable(eventIsReplaySafe: boolean, err: unknown): boolean {
  return eventIsReplaySafe && !(err instanceof SecondChargeError);
}
