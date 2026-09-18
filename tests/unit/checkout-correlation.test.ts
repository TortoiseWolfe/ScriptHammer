/**
 * How a Stripe Checkout Session is matched back to our payment_intents row.
 *
 * WHY THIS FILE EXISTS. `handlePaymentCheckout` looked the intent up by
 * `session.metadata?.intent_id`, and `create-stripe-checkout` never sets session-level
 * metadata — it sets `payment_intent_data.metadata.intent_id`, which lands on the
 * PaymentIntent rather than the Session, and `client_reference_id`. So the lookup was always
 * `undefined` and the handler always returned `{handled:false}`.
 *
 * That was not theoretical. Measured against a REAL live Checkout Session created by the
 * deployed function on 2026-09-17:
 *
 *   session.metadata      = {}
 *   client_reference_id   = "516bf680-e568-445a-98da-6a04a40d9589"   (our intent id)
 *
 * and `payment_results` held 0 rows for the entire life of the project, with every historical
 * `payment_intent.succeeded` recording `related_payment_id: null`. Hosted checkout — the path
 * real buyers take — could not be fulfilled.
 *
 * Same placement rationale as advance-order.test.ts: `vitest.config.ts` excludes
 * `supabase/functions/**` and no workflow runs `deno test`, so a test beside the function would
 * never execute. `webhook-types.ts` imports nothing, so it runs inside the required
 * `Test (20.x)` check.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCheckoutIntentId,
  PG_UNIQUE_VIOLATION,
} from '../../supabase/functions/_shared/webhook-types';

describe('resolveCheckoutIntentId', () => {
  it('reads client_reference_id — the field our sessions actually carry', () => {
    // The exact shape observed on the live session above.
    const session = {
      metadata: {},
      client_reference_id: '516bf680-e568-445a-98da-6a04a40d9589',
    };
    expect(resolveCheckoutIntentId(session)).toBe(
      '516bf680-e568-445a-98da-6a04a40d9589'
    );
  });

  it('REGRESSION: an empty metadata object must not shadow client_reference_id', () => {
    // This is the whole bug. `{}` is truthy, so any check that stopped at
    // `session.metadata ? … : …` would still resolve to undefined here.
    expect(
      resolveCheckoutIntentId({ metadata: {}, client_reference_id: 'pi-1' })
    ).toBe('pi-1');
    expect(
      resolveCheckoutIntentId({ metadata: null, client_reference_id: 'pi-1' })
    ).toBe('pi-1');
    expect(resolveCheckoutIntentId({ client_reference_id: 'pi-1' })).toBe(
      'pi-1'
    );
  });

  it('prefers session metadata when it is genuinely populated', () => {
    // Forward compatibility only: if someone later sets session metadata deliberately,
    // an explicit value should beat the convention.
    const session = {
      metadata: { intent_id: 'from-metadata' },
      client_reference_id: 'from-reference',
    };
    expect(resolveCheckoutIntentId(session)).toBe('from-metadata');
  });

  it('returns null when neither is usable, so the caller can acknowledge instead of throwing', () => {
    // Must be null rather than undefined-into-a-query: `.eq('id', undefined)` against a uuid
    // column is a 22P02, which surfaces as a 500 that Stripe then retries for three days.
    expect(resolveCheckoutIntentId({})).toBeNull();
    expect(
      resolveCheckoutIntentId({ metadata: {}, client_reference_id: null })
    ).toBeNull();
    expect(
      resolveCheckoutIntentId({ metadata: {}, client_reference_id: '' })
    ).toBeNull();
    expect(resolveCheckoutIntentId({ metadata: { intent_id: '' } })).toBeNull();
  });

  it('CONTROL: it can return both a value and null, so the assertions above are not vacuous', () => {
    expect(
      resolveCheckoutIntentId({ client_reference_id: 'x' })
    ).not.toBeNull();
    expect(resolveCheckoutIntentId({})).toBeNull();
  });
});

describe('PG_UNIQUE_VIOLATION', () => {
  it('is the Postgres unique_violation code both payment handlers now check', () => {
    // idx_payment_results_one_succeeded_per_intent allows ONE succeeded row per intent.
    // Now that both checkout.session.completed and payment_intent.succeeded write it, the
    // second event collides — and a 500 there is retried by Stripe for three days and counts
    // toward the endpoint being disabled. The handlers acknowledge on this code instead.
    expect(PG_UNIQUE_VIOLATION).toBe('23505');
  });
});
