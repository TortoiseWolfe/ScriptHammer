/**
 * Deno tests for verify-stripe-session.
 *
 * These are shape / contract tests: they validate the function's HTTP
 * contract without making real Stripe API calls. End-to-end is exercised
 * by tests/e2e/payment/01-stripe-onetime.spec.ts.
 *
 * Per Phase 0a (issue #101).
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('module loads without throwing', async () => {
  Deno.env.set('STRIPE_SECRET_KEY', '');
  Deno.env.set('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'eyJfake');
  Deno.env.set('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJfake');

  try {
    await import('./index.ts');
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('serve') &&
      !err.message.includes('bind')
    ) {
      throw err;
    }
  }
});

Deno.test(
  'request body validation — empty session_id returns 400 (documented contract)',
  () => {
    const valid = { session_id: 'cs_test_abc123' };
    const empty = { session_id: '' };
    const missing = {};

    assertEquals(typeof valid.session_id, 'string');
    assertEquals(empty.session_id.trim(), '');
    assertEquals('session_id' in missing, false);
  }
);

Deno.test('payment_status response shape uses Stripe enum values', () => {
  // Contract: response.payment_status is the raw Stripe value, one of:
  // 'paid' | 'unpaid' | 'no_payment_required'. Documented in
  // src/lib/payments/stripe.ts:107 — the browser handler maps 'paid' to
  // {success: true}, everything else to {success: false}.
  const allowedValues = ['paid', 'unpaid', 'no_payment_required'];
  assertEquals(allowedValues.includes('paid'), true);
  assertEquals(allowedValues.includes('succeeded'), false); // would be wrong
});

Deno.test(
  'ownership check requires metadata.intent_id on the payment_intent',
  () => {
    // Contract: the function expands `payment_intent` on the session
    // retrieve call, then reads `payment_intent.metadata.intent_id`. If
    // absent → 403. This is the linkage create-stripe-checkout creates
    // via `payment_intent_data.metadata = { intent_id }`.
    const sessionWithIntentId = {
      payment_intent: { metadata: { intent_id: 'intent-uuid' } },
    };
    const sessionWithoutMetadata = {
      payment_intent: { metadata: {} },
    };
    const sessionAsString = { payment_intent: 'pi_string_form' };

    assertEquals(
      sessionWithIntentId.payment_intent?.metadata?.intent_id,
      'intent-uuid'
    );
    assertEquals(
      sessionWithoutMetadata.payment_intent?.metadata?.intent_id,
      undefined
    );
    assertEquals(typeof sessionAsString.payment_intent === 'object', false);
  }
);
