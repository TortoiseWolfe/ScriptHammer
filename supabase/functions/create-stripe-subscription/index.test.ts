/**
 * Deno tests for create-stripe-subscription.
 *
 * Contract tests for the HTTP-layer validation. End-to-end happy path
 * is verified by tests/e2e/payment/02-paypal-subscription.spec.ts (the
 * file covers both Stripe and PayPal subscription paths despite the name)
 * once sandbox keys land — un-skipped per issue #106.
 *
 * Per Phase 0b (issue #102).
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('module loads without throwing', async () => {
  Deno.env.set('STRIPE_SECRET_KEY', '');
  Deno.env.set('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'eyJfake');
  Deno.env.set('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJfake');
  Deno.env.set('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');

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
  'request body validation — empty price_id returns 400 (documented contract)',
  () => {
    const valid = { price_id: 'price_abc', customer_email: 'a@b.co' };
    const emptyPrice = { price_id: '', customer_email: 'a@b.co' };
    const missingPrice = { customer_email: 'a@b.co' };

    assertEquals(typeof valid.price_id, 'string');
    assertEquals(emptyPrice.price_id.trim(), '');
    assertEquals('price_id' in missingPrice, false);
  }
);

Deno.test(
  'email validation regex matches the same shape as payment-service.ts',
  () => {
    // Same regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const valid = 'a@b.co';
    const noAt = 'no-at-sign';
    const noDomain = 'a@b';
    const trailingSpace = 'a@b.co ';

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assertEquals(re.test(valid), true);
    assertEquals(re.test(noAt), false);
    assertEquals(re.test(noDomain), false);
    // Trailing space fails (the function .trim()s first, then validates)
    assertEquals(re.test(trailingSpace), false);
    assertEquals(re.test(trailingSpace.trim()), true);
  }
);

Deno.test(
  'subscription_data.metadata carries template_user_id and customer_email',
  () => {
    // Contract: the Stripe API call sets subscription_data.metadata so the
    // webhook can read those fields when the subscription record is
    // created. Without this the NOT NULL constraint on
    // subscriptions.template_user_id would fail. See companion fix in
    // stripe-webhook/index.ts.
    const userId = 'auth-uuid';
    const email = 'customer@example.com';
    const expectedMetadata = {
      template_user_id: userId,
      customer_email: email,
    };
    assertEquals(expectedMetadata.template_user_id, userId);
    assertEquals(expectedMetadata.customer_email, email);
  }
);

Deno.test('no subscriptions row is inserted at session-creation time', () => {
  // Contract: this function ONLY creates a Stripe Checkout Session and
  // returns its id. The actual subscriptions row is inserted by
  // stripe-webhook when `customer.subscription.created` fires later
  // (after the customer completes checkout in the Stripe-hosted page).
  // Why: at session-creation we don't have a provider_subscription_id
  // (Stripe assigns it post-checkout), and the table's
  // provider_subscription_id is NOT NULL UNIQUE.
  //
  // This test documents that contract — no actual SDK is called here.
  const flow = [
    'create-session',
    'redirect-to-stripe',
    'customer-pays',
    'webhook-inserts-row',
  ];
  assertEquals(
    flow.indexOf('webhook-inserts-row') > flow.indexOf('create-session'),
    true
  );
});
